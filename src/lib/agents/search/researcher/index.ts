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

class Researcher {
  async research(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    let findings: string = '';
    let actionOutput: ActionOutput[] = [];
    let maxIteration =
      input.config.mode === 'fast'
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

    for (let i = 0; i < maxIteration; i++) {
      const researcherPrompt = getResearcherPrompt(availableActionsDescription);

      const res = await input.config.llm.generateObject<z.infer<typeof schema>>(
        {
          messages: [
            {
              role: 'system',
              content: researcherPrompt,
            },
            {
              role: 'user',
              content: `
                    <research_query>
                    ${input.classification.standaloneFollowUp}
                    </research_query>

                    <previous_actions>
                    ${findings}
                    </previous_actions>
                    `,
            },
          ],
          schema,
        },
      );


      if (res.action.type === 'done') {
        console.log('Research complete - "done" action selected');
        break;
      }

      const actionConfig: ActionConfig = {
        type: res.action.type as string,
        params: res.action,
      };

      findings += 'Reasoning: ' + res.reasoning + '\n';
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
        findings += actionResult.results
          .map(
            (r) =>
              `Title: ${r.metadata.title}\nURL: ${r.metadata.url}\nContent: ${r.content}\n`,
          )
          .join('\n');
      }
    }

    return {
      findings: actionOutput,
    };
  }
}

export default Researcher;
