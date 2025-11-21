import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import Classifier from './classifier';
import { WidgetRegistry } from './widgets';
import Researcher from './researcher';

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    const classifier = new Classifier();

    const classification = await classifier.classify({
      chatHistory: input.chatHistory,
      enabledSources: input.config.sources,
      query: input.followUp,
      llm: input.config.llm,
    });

    session.emit('data', {
      type: 'classification',
      classification: classification,
    });

    const widgetPromise = WidgetRegistry.executeAll(classification.widgets, {
      llm: input.config.llm,
      embedding: input.config.embedding,
      session: session,
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
  }
}

export default SearchAgent;
