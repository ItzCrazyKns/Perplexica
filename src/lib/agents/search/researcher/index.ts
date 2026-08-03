import { ActionOutput, ResearcherInput, ResearcherOutput } from '../types';
import { ActionRegistry } from './actions';
import { getResearcherPrompt } from '@/lib/prompts/search/researcher';
import SessionManager from '@/lib/session';
import { Message, ReasoningResearchBlock } from '@/lib/types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { ToolCall } from '@/lib/models/types';
import { parseTextActions } from './textActionFallback';
import { withInactivityTimeout } from '@/lib/utils/streamTimeout';
import { createResearchBudget } from '../researchBudget';
import { seedAllowedUrls } from '../urlAllowlist';

class Researcher {
  async research(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    let actionOutput: ActionOutput[] = [];
    const budget = createResearchBudget(input.config.mode);
    const allowedScrapeUrls = seedAllowedUrls(
      input.chatHistory,
      input.followUp,
    );
    let maxIteration =
      input.config.mode === 'speed'
        ? 2
        : input.config.mode === 'balanced'
          ? 6
          : 25;

    const availableTools = ActionRegistry.getAvailableActionTools({
      classification: input.classification,
      fileIds: input.config.fileIds,
      mode: input.config.mode,
      sources: input.config.sources,
    });

    const availableActionsDescription =
      ActionRegistry.getAvailableActionsDescriptions({
        classification: input.classification,
        fileIds: input.config.fileIds,
        mode: input.config.mode,
        sources: input.config.sources,
      });

    const researchBlockId = crypto.randomUUID();

    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: {
        subSteps: [],
      },
    });

    const agentMessageHistory: Message[] = [
      {
        role: 'user',
        content: `
          <conversation>
          ${formatChatHistoryAsString(input.chatHistory.slice(-10))}
           User: ${input.followUp} (Standalone question: ${input.classification.standaloneFollowUp})
           </conversation>
        `,
      },
    ];

    let budgetHit = false;

    for (let i = 0; i < maxIteration; i++) {
      if (budget.expired()) {
        console.warn('Research budget exhausted, answering from context');
        budgetHit = true;
        break;
      }

      const researcherPrompt = getResearcherPrompt(
        availableActionsDescription,
        input.config.mode,
        i,
        maxIteration,
        input.config.fileIds,
      );

      const actionStream = input.config.llm.streamText({
        messages: [
          {
            role: 'system',
            content: researcherPrompt,
          },
          ...agentMessageHistory,
        ],
        tools: availableTools,
      });

      const block = session.getBlock(researchBlockId);

      let reasoningEmitted = false;
      let reasoningId = crypto.randomUUID();

      let finalToolCalls: ToolCall[] = [];
      let streamedText = '';

      for await (const partialRes of withInactivityTimeout(
        actionStream,
        120_000,
        'Researcher stream',
      )) {
        streamedText += partialRes.contentChunk || '';
        if (partialRes.toolCallChunk.length > 0) {
          partialRes.toolCallChunk.forEach((tc) => {
            if (
              tc.name === '__reasoning_preamble' &&
              tc.arguments['plan'] &&
              !reasoningEmitted &&
              block &&
              block.type === 'research'
            ) {
              reasoningEmitted = true;

              block.data.subSteps.push({
                id: reasoningId,
                type: 'reasoning',
                reasoning: tc.arguments['plan'],
              });

              session.updateBlock(researchBlockId, [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: block.data.subSteps,
                },
              ]);
            } else if (
              tc.name === '__reasoning_preamble' &&
              tc.arguments['plan'] &&
              reasoningEmitted &&
              block &&
              block.type === 'research'
            ) {
              const subStepIndex = block.data.subSteps.findIndex(
                (step: any) => step.id === reasoningId,
              );

              if (subStepIndex !== -1) {
                const subStep = block.data.subSteps[
                  subStepIndex
                ] as ReasoningResearchBlock;
                subStep.reasoning = tc.arguments['plan'];
                session.updateBlock(researchBlockId, [
                  {
                    op: 'replace',
                    path: '/data/subSteps',
                    value: block.data.subSteps,
                  },
                ]);
              }
            }

            const existingIndex = finalToolCalls.findIndex(
              (ftc) => ftc.id === tc.id,
            );

            if (existingIndex !== -1) {
              finalToolCalls[existingIndex].arguments = tc.arguments;
            } else {
              finalToolCalls.push(tc);
            }
          });
        }
      }

      if (finalToolCalls.length === 0) {
        /* Some local models narrate the call as text instead of using
           the tool-call channel; recover it rather than aborting the
           research with empty context. */
        finalToolCalls = parseTextActions(
          streamedText,
          availableTools.map((t) => t.name),
        );

        if (finalToolCalls.length > 0) {
          console.warn(
            'Researcher: recovered',
            finalToolCalls.length,
            'tool call(s) from narrated text',
          );
        } else {
          break;
        }
      }

      /* The prompts tell the model to emit searches and `done` in one
         batch, so stopping at `done` must not discard its siblings. */
      const isDone = finalToolCalls.some((tc) => tc.name === 'done');
      const toExecute = finalToolCalls.filter((tc) => tc.name !== 'done');

      if (toExecute.length > 0) {
        agentMessageHistory.push({
          role: 'assistant',
          content: '',
          tool_calls: toExecute,
        });

        const actionResults = await ActionRegistry.executeAll(toExecute, {
          llm: input.config.llm,
          embedding: input.config.embedding,
          session: session,
          researchBlockId: researchBlockId,
          fileIds: input.config.fileIds,
          mode: input.config.mode,
          budget: budget,
          allowedScrapeUrls: allowedScrapeUrls,
        });

        actionOutput.push(...actionResults);

        actionResults.forEach((action, i) => {
          agentMessageHistory.push({
            role: 'tool',
            id: toExecute[i].id,
            name: toExecute[i].name,
            content: JSON.stringify(action),
          });
        });
      }

      if (isDone) {
        break;
      }
    }

    if (budgetHit) {
      session.emitBlock({
        id: crypto.randomUUID(),
        type: 'text',
        data: '*Research was cut short by the time budget; the answer uses what was gathered so far.*',
      });
    }

    const searchResults = actionOutput
      .filter((a) => a.type === 'search_results')
      .flatMap((a) => a.results);

    const seenUrls = new Map<string, number>();

    const filteredSearchResults = searchResults
      .map((result, index) => {
        if (result.metadata.url && !seenUrls.has(result.metadata.url)) {
          seenUrls.set(result.metadata.url, index);
          return result;
        } else if (result.metadata.url && seenUrls.has(result.metadata.url)) {
          const existingIndex = seenUrls.get(result.metadata.url)!;

          const existingResult = searchResults[existingIndex];

          existingResult.content += `\n\n${result.content}`;

          return undefined;
        }

        return result;
      })
      .filter((r) => r !== undefined);

    session.emitBlock({
      id: crypto.randomUUID(),
      type: 'source',
      data: filteredSearchResults,
    });

    return {
      findings: actionOutput,
      searchFindings: filteredSearchResults,
    };
  }
}

export default Researcher;
