import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import { sanitizeUntrusted } from '@/lib/utils/sanitizeUntrusted';

class APISearchAgent {
  /* Started without awaiting; a rejection here would otherwise be
     unhandled and the caller's stream would never terminate. */
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    try {
      await this.run(session, input);
    } catch (err: any) {
      console.error('API search agent failed:', err);
      session.emit('error', {
        data: err?.message ?? 'An error occurred while answering.',
      });
    }
  }

  private async run(session: SessionManager, input: SearchAgentInput) {
    const classification = await classify({
      chatHistory: input.chatHistory,
      enabledSources: input.config.sources,
      query: input.followUp,
      llm: input.config.llm,
    });

    const widgetPromise = WidgetExecutor.executeAll({
      classification,
      chatHistory: input.chatHistory,
      followUp: input.followUp,
      llm: input.config.llm,
    }).catch((err) => {
      console.error(`Error executing widgets: ${err}`);
      return [];
    });

    let searchPromise: Promise<ResearcherOutput> | null = null;

    if (!classification.classification.skipSearch) {
      const researcher = new Researcher();
      /* The route's session, not a fresh one: a second session was
         registered per request and retained for the whole TTL, and its
         block events were never delivered to anyone. */
      searchPromise = researcher.research(session, {
        chatHistory: input.chatHistory,
        followUp: input.followUp,
        classification: classification,
        config: input.config,
      });
    }

    const [widgetOutputs, searchResults] = await Promise.all([
      widgetPromise,
      searchPromise,
    ]);

    if (searchResults) {
      session.emit('data', {
        type: 'searchResults',
        data: searchResults.searchFindings,
      });
    }

    session.emit('data', {
      type: 'researchComplete',
    });

    const finalContext =
      searchResults?.searchFindings
        .map(
          (f, index) =>
            `<result index=${index + 1} title=${JSON.stringify(f.metadata.title ?? '')}>${sanitizeUntrusted(f.content)}</result>`,
        )
        .join('\n') || '';

    const widgetContext = widgetOutputs
      .map((o) => {
        return `<result>${o.llmContext}</result>`;
      })
      .join('\n-------------\n');

    const finalContextWithWidgets = `<search_results note="These are the search results and assistant can cite these">\n${finalContext}\n</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, assistant can use this information to answer the query but do not CITE this as a souce">\n${widgetContext}\n</widgets_result>`;

    const writerPrompt = getWriterPrompt(
      finalContextWithWidgets,
      input.config.systemInstructions,
      input.config.mode,
    );

    const answerStream = input.config.llm.streamText({
      messages: [
        {
          role: 'system',
          content: writerPrompt,
        },
        ...input.chatHistory,
        {
          role: 'user',
          content: input.followUp,
        },
      ],
    });

    for await (const chunk of answerStream) {
      session.emit('data', {
        type: 'response',
        data: chunk.contentChunk,
      });
    }

    session.emit('end', {});
  }
}

export default APISearchAgent;
