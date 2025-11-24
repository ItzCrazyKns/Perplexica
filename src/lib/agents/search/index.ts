import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import Classifier from './classifier';
import { WidgetRegistry } from './widgets';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import fs from 'fs';

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    const classifier = new Classifier();

    const classification = await classifier.classify({
      chatHistory: input.chatHistory,
      enabledSources: input.config.sources,
      query: input.followUp,
      llm: input.config.llm,
    });

    const widgetPromise = WidgetRegistry.executeAll(classification.widgets, {
      llm: input.config.llm,
      embedding: input.config.embedding,
      session: session,
    }).then((widgetOutputs) => {
      widgetOutputs.forEach((o) => {
        session.emitBlock({
          id: crypto.randomUUID(),
          type: 'widget',
          data: {
            widgetType: o.type,
            params: o.data,
          },
        });
      });
      return widgetOutputs;
    });

    let searchPromise: Promise<ResearcherOutput> | null = null;

    if (!classification.skipSearch) {
      const researcher = new Researcher();
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

    session.emit('data', {
      type: 'researchComplete',
    });

    const finalContext =
      searchResults?.findings
        .filter((f) => f.type === 'search_results')
        .flatMap((f) => f.results)
        .map((f) => `${f.metadata.title}: ${f.content}`)
        .join('\n') || '';

    const widgetContext = widgetOutputs
      .map((o) => {
        return `${o.type}: ${o.llmContext}`;
      })
      .join('\n-------------\n');

    const finalContextWithWidgets = `<search_results note="These are the search results and you can cite these">${finalContext}</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, you can use this information to answer the query but do not CITE this as a souce">${widgetContext}</widgets_result>`;

    const writerPrompt = getWriterPrompt(finalContextWithWidgets);
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

    let accumulatedText = '';

    for await (const chunk of answerStream) {
      accumulatedText += chunk.contentChunk;

      session.emit('data', {
        type: 'response',
        data: chunk.contentChunk,
      });
    }

    session.emit('end', {});
  }
}

export default SearchAgent;
