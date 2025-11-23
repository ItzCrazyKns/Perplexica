import z from 'zod';
import {
  ActionConfig,
  ActionOutput,
  ResearcherInput,
  ResearcherOutput,
} from '../types';
import { ActionRegistry } from './actions';
import { getResearcherPrompt } from '@/lib/prompts/search/researcher';
import SessionManager from '@/lib/session';
import { ReasoningResearchBlock } from '@/lib/types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';

class Researcher {
  async research(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    let findings: string = '';
    let actionOutput: ActionOutput[] = [];
    let maxIteration =
      input.config.mode === 'speed'
        ? 1
        : input.config.mode === 'balanced'
          ? 3
          : 25;

    const availableActions = ActionRegistry.getAvailableActions({
      classification: input.classification,
    });

    const schema = z.object({
      reasoning: z
        .string()
        .describe('The reasoning behind choosing the next action.'),
      action: z
        .union(availableActions.map((a) => a.schema))
        .describe('The action to be performed next.'),
    });

    const availableActionsDescription =
      ActionRegistry.getAvailableActionsDescriptions({
        classification: input.classification,
      });

    const researchBlockId = crypto.randomUUID();

    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: {
        subSteps: [],
      },
    });

    for (let i = 0; i < maxIteration; i++) {
      const researcherPrompt = getResearcherPrompt(
        availableActionsDescription,
        input.config.mode,
        i,
        maxIteration,
      );

      const actionStream = input.config.llm.streamObject<
        z.infer<typeof schema>
      >({
        messages: [
          {
            role: 'system',
            content: researcherPrompt,
          },
          {
            role: 'user',
            content: `
                    <conversation>
                    ${formatChatHistoryAsString(input.chatHistory.slice(-10))}
                    User: ${input.followUp} (Standalone question: ${input.classification.standaloneFollowUp})
                    </conversation>

                    <previous_actions>
                    ${findings}
                    </previous_actions>
                    `,
          },
        ],
        schema,
      });

      const block = session.getBlock(researchBlockId);

      let reasoningEmitted = false;
      let reasoningId = crypto.randomUUID();

      let finalActionRes: any;

      for await (const partialRes of actionStream) {
        try {
          if (
            partialRes.reasoning &&
            !reasoningEmitted &&
            block &&
            block.type === 'research'
          ) {
            reasoningEmitted = true;
            block.data.subSteps.push({
              id: reasoningId,
              type: 'reasoning',
              reasoning: partialRes.reasoning,
            });
            session.updateBlock(researchBlockId, [
              {
                op: 'replace',
                path: '/data/subSteps',
                value: block.data.subSteps,
              },
            ]);
          } else if (
            partialRes.reasoning &&
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
              subStep.reasoning = partialRes.reasoning;
              session.updateBlock(researchBlockId, [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: block.data.subSteps,
                },
              ]);
            }
          }

          finalActionRes = partialRes;
        } catch (e) {
          // nothing
        }
      }

      if (finalActionRes.action.type === 'done') {
        break;
      }

      const actionConfig: ActionConfig = {
        type: finalActionRes.action.type as string,
        params: finalActionRes.action,
      };

      const queries = actionConfig.params.queries || [];
      if (block && block.type === 'research') {
        block.data.subSteps.push({
          id: crypto.randomUUID(),
          type: 'searching',
          searching: queries,
        });
        session.updateBlock(researchBlockId, [
          { op: 'replace', path: '/data/subSteps', value: block.data.subSteps },
        ]);
      }

      findings += `\n---\nIteration ${i + 1}:\n`;
      findings += 'Reasoning: ' + finalActionRes.reasoning + '\n';
      findings += `Executing Action: ${actionConfig.type} with params ${JSON.stringify(actionConfig.params)}\n`;

      const actionResult = await ActionRegistry.execute(
        actionConfig.type,
        actionConfig.params,
        {
          llm: input.config.llm,
          embedding: input.config.embedding,
          session: session,
        },
      );

      actionOutput.push(actionResult);

      if (actionResult.type === 'search_results') {
        if (block && block.type === 'research') {
          block.data.subSteps.push({
            id: crypto.randomUUID(),
            type: 'reading',
            reading: actionResult.results,
          });
          session.updateBlock(researchBlockId, [
            {
              op: 'replace',
              path: '/data/subSteps',
              value: block.data.subSteps,
            },
          ]);
        }

        findings += actionResult.results
          .map(
            (r) =>
              `Title: ${r.metadata.title}\nURL: ${r.metadata.url}\nContent: ${r.content}\n`,
          )
          .join('\n');
      }

      findings += '\n---------\n';
    }

    const searchResults = actionOutput.filter(
      (a) => a.type === 'search_results',
    );

    session.emit('data', {
      type: 'sources',
      data: searchResults
        .flatMap((a) => a.results)
        .map((r) => ({
          content: r.content,
          metadata: r.metadata,
        })),
    });

    return {
      findings: actionOutput,
    };
  }
}

export default Researcher;
