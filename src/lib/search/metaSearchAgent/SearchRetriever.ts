import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { Document } from 'langchain/document';
import { ConfigManager } from './ConfigManager';
import LineListOutputParser from '@/lib/outputParsers/listLineOutputParser';
import LineOutputParser from '@/lib/outputParsers/lineOutputParser';
import { getDocumentsFromLinks } from '@/lib/utils/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseMessage } from '@langchain/core/messages';
import { baseSearchProviderManager } from '../searchProviders/manager';
import { getSearchProvider, getSearchLanguage } from '@/lib/config';

export class SearchRetriever {
  private strParser = new StringOutputParser();

  constructor(
    private llm: BaseChatModel,
    private configManager: ConfigManager,
  ) {
    (this.llm as any).temperature = 0;
  }

  async createSearchChain() {
    return RunnableSequence.from([
      ChatPromptTemplate.fromMessages([
        ['system', this.configManager.queryGeneratorPrompt],
        ...this.configManager.queryGeneratorFewShots,
        [
          'user',
          `
<conversation>{chat_history}</conversation>

<query>{query}</query>
          `,
        ],
      ]),
      this.llm,
      this.strParser,
      RunnableLambda.from(async (input: string) => {
        const linksParser = new LineListOutputParser({ key: 'links' });
        const questionParser = new LineOutputParser({ key: 'question' });

        const links = await linksParser.parse(input);
        let question = (await questionParser.parse(input)) || input;

        if (question === 'not_needed') {
          return { query: '', docs: [] };
        }

        if (links.length > 0) {
          if (!question) question = 'summarize';

          const linkDocs = await getDocumentsFromLinks({ links });

          const docGroups: Document[] = [];

          linkDocs.forEach((doc) => {
            const existingIndex = docGroups.findIndex(
              (d) =>
                d.metadata.url === doc.metadata.url &&
                (d.metadata.totalDocs ?? 0) < 10,
            );

            if (existingIndex === -1) {
              docGroups.push({
                ...doc,
                metadata: { ...doc.metadata, totalDocs: 1 },
              });
            } else {
              docGroups[existingIndex].pageContent += `\n\n${doc.pageContent}`;
              docGroups[existingIndex].metadata.totalDocs =
                (docGroups[existingIndex].metadata.totalDocs ?? 0) + 1;
            }
          });

          const summarizedDocs: Document[] = [];

          await Promise.all(
            docGroups.map(async (doc) => {
              const res = await this.llm.invoke(
                `You are a web search summarizer... <query>${question}</query> <text>${doc.pageContent}</text>`,
              );
              summarizedDocs.push(
                new Document({
                  pageContent: res.content as string,
                  metadata: {
                    title: doc.metadata.title,
                    url: doc.metadata.url,
                  },
                }),
              );
            }),
          );

          return { query: question, docs: summarizedDocs };
        } else {
          question = question.replace(/<think>.*?<\/think>/g, '');

          const searchOptions = {
            language: getSearchLanguage() || 'en',
            engines: this.configManager.activeEngines,
          };

          const provider = getSearchProvider();
          const searchProvider =
            baseSearchProviderManager.getProvider(provider);
          if (!searchProvider) {
            throw new Error('Search provider not found');
          }

          // You can specify a specific provider or leave it empty to use all available ones
          const providerResults = await searchProvider.search(
            question,
            searchOptions,
          );

          const allDocuments = providerResults.map(
            (result) =>
              new Document({
                pageContent: result.content || result.title || '',
                metadata: {
                  title: result.title,
                  url: result.url,
                  provider: searchProvider.getName(), // get name from the method
                  ...(result.img_src && { img_src: result.img_src }),
                },
              }),
          );

          return { query: question, docs: allDocuments };
        }
      }),
    ]);
  }

  async retrieve(query: string, chatHistory: BaseMessage[]) {
    const chain = await this.createSearchChain();
    return chain.invoke({ chat_history: chatHistory, query });
  }
}
