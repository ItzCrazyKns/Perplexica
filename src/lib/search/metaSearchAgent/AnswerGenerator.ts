import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ConfigManager } from './ConfigManager';
import { Embeddings } from '@langchain/core/embeddings';
import { Document } from 'langchain/document';
import {
  RunnableLambda,
  RunnableMap,
  RunnableSequence,
} from '@langchain/core/runnables';
import { SearchRetriever } from './SearchRetriever';
import { DocumentRanker } from './DocumentRanker';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { BasicChainInput } from './types';
import { getSearchProvider } from '@/lib/config';
import { SearchProviderNames } from '../searchProviders/types';

export class AnswerGenerator {
  private strParser = new StringOutputParser();

  constructor(
    private llm: BaseChatModel,
    private configManager: ConfigManager,
    private embeddings: Embeddings,
  ) {}

  async createAnsweringChain(
    fileIds: string[],
    optimizationMode: 'speed' | 'balanced' | 'quality',
    systemInstructions: string,
  ) {
    return RunnableSequence.from([
      RunnableMap.from({
        systemInstructions: () => systemInstructions,
        query: (input: BasicChainInput) => input.query,
        chat_history: (input: BasicChainInput) => input.chat_history,
        date: () => new Date().toISOString(),
        context: RunnableLambda.from(async (input: BasicChainInput) => {
          const processedHistory = formatChatHistoryAsString(
            input.chat_history,
          );

          let docs: Document[] | null = null;
          let query = input.query;

          if (this.configManager.searchWeb) {
            const searchRetriever = new SearchRetriever(
              this.llm,
              this.configManager,
            );
            const searchResult = await searchRetriever.retrieve(
              query,
              input.chat_history,
            );

            query = searchResult.query;
            docs = searchResult.docs;
          }

          const provider = getSearchProvider();
          const providersThatNeedReranking: SearchProviderNames[] = ['searxng'];

          // rerank only if needed
          if (provider && providersThatNeedReranking.includes(provider)) {
            console.log('use reranking');
            const ranker = new DocumentRanker(
              this.configManager,
              this.embeddings,
            );
            const sortedDocs = await ranker.rerankDocs(
              query,
              docs ?? [],
              fileIds,
              optimizationMode,
            );

            return sortedDocs;
          }

          return docs ?? [];
        }).withConfig({
          runName: 'FinalSourceRetriever',
        }),
      }),
      ChatPromptTemplate.fromMessages([
        ['system', this.configManager.responsePrompt],
        new MessagesPlaceholder('chat_history'),
        ['user', '{query}'],
      ]),
      this.llm,
      this.strParser,
    ]).withConfig({
      runName: 'FinalResponseGenerator',
    });
  }
}
