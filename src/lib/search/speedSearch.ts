import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from '@langchain/core/prompts';
import {
  RunnableLambda,
  RunnableMap,
  RunnableSequence,
} from '@langchain/core/runnables';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { ChatOpenAI } from '@langchain/openai';
import eventEmitter from 'events';
import { Document } from 'langchain/document';
import LineOutputParser from '../outputParsers/lineOutputParser';
import LineListOutputParser from '../outputParsers/listLineOutputParser';
import { searchSearxng } from '../searxng';
import { formatDateForLLM } from '../utils';
import { getDocumentsFromLinks } from '../utils/documents';
import formatChatHistoryAsString from '../utils/formatHistory';
import { getModelName } from '../utils/modelUtils';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';
import {
  formattingAndCitationsLocal,
  formattingAndCitationsWeb,
} from '@/lib/prompts/templates';

export interface SpeedSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    signal: AbortSignal,
    personaInstructions?: string,
    focusMode?: string,
  ) => Promise<eventEmitter>;
}

interface Config {
  searchWeb: boolean;
  rerank: boolean;
  summarizer: boolean;
  rerankThreshold: number;
  queryGeneratorPrompt: string;
  responsePrompt: string;
  activeEngines: string[];
  additionalSearchCriteria?: string;
}

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

class SpeedSearchAgent implements SpeedSearchAgentType {
  private config: Config;
  private strParser = new StringOutputParser();
  private searchQuery?: string;
  private searxngUrl?: string;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Emit a progress event with the given percentage and message
   */
  private emitProgress(
    emitter: eventEmitter,
    percentage: number,
    message: string,
    subMessage?: string,
  ) {
    const progressData: any = {
      message,
      current: percentage,
      total: 100,
    };

    // Add subMessage if provided
    if (subMessage) {
      progressData.subMessage = subMessage;
    }

    emitter.emit(
      'progress',
      JSON.stringify({
        type: 'progress',
        data: progressData,
      }),
    );
  }

  private async createSearchRetrieverChain(
    llm: BaseChatModel,
    emitter: eventEmitter,
    signal: AbortSignal,
  ) {
    // TODO: Don't we want to set this back to default once search is done?
    (llm as unknown as ChatOpenAI).temperature = 0;

    this.emitProgress(emitter, 10, `Building search query`);

    return RunnableSequence.from([
      PromptTemplate.fromTemplate(this.config.queryGeneratorPrompt),
      llm,
      this.strParser,
      RunnableLambda.from(async (input: string) => {
        try {
          //console.log(`LLM response for initial web search:"${input}"`);
          const linksOutputParser = new LineListOutputParser({
            key: 'links',
          });

          const questionOutputParser = new LineOutputParser({
            key: 'answer',
          });

          const links = await linksOutputParser.parse(input);
          let question = await questionOutputParser.parse(input);

          //console.log('question', question);

          if (question === 'not_needed') {
            return { query: '', docs: [] };
          }

          if (links.length > 0) {
            if (question.length === 0) {
              question = 'summarize';
            }

            let docs: Document[] = [];

            const linkDocs = await getDocumentsFromLinks({ links });

            const docGroups: Document[] = [];

            linkDocs.map((doc) => {
              const URLDocExists = docGroups.find(
                (d) =>
                  d.metadata.url === doc.metadata.url &&
                  d.metadata.totalDocs < 10,
              );

              if (!URLDocExists) {
                docGroups.push({
                  ...doc,
                  metadata: {
                    ...doc.metadata,
                    totalDocs: 1,
                  },
                });
              }

              const docIndex = docGroups.findIndex(
                (d) =>
                  d.metadata.url === doc.metadata.url &&
                  d.metadata.totalDocs < 10,
              );

              if (docIndex !== -1) {
                docGroups[docIndex].pageContent =
                  docGroups[docIndex].pageContent + `\n\n` + doc.pageContent;
                docGroups[docIndex].metadata.totalDocs += 1;
              }
            });

            this.emitProgress(emitter, 20, `Summarizing content`);

            await Promise.all(
              docGroups.map(async (doc) => {
                const res = await llm.invoke(
                  `You are a web search summarizer, tasked with summarizing a piece of text retrieved from a web search. Your job is to summarize the 
            text into a detailed, 2-4 paragraph explanation that captures the main ideas and provides a comprehensive answer to the query.
            If the query is \"summarize\", you should provide a detailed summary of the text. If the query is a specific question, you should answer it in the summary.
            
            - **Journalistic tone**: The summary should sound professional and journalistic, not too casual or vague.
            - **Thorough and detailed**: Ensure that every key point from the text is captured and that the summary directly answers the query.
            - **Not too lengthy, but detailed**: The summary should be informative but not excessively long. Focus on providing detailed information in a concise format.

            The text will be shared inside the \`text\` XML tag, and the query inside the \`query\` XML tag.

            <example>
            1. \`<text>
            Docker is a set of platform-as-a-service products that use OS-level virtualization to deliver software in packages called containers. 
            It was first released in 2013 and is developed by Docker, Inc. Docker is designed to make it easier to create, deploy, and run applications 
            by using containers.
            </text>

            <query>
            What is Docker and how does it work?
            </query>

            Response:
            Docker is a revolutionary platform-as-a-service product developed by Docker, Inc., that uses container technology to make application 
            deployment more efficient. It allows developers to package their software with all necessary dependencies, making it easier to run in 
            any environment. Released in 2013, Docker has transformed the way applications are built, deployed, and managed.
            \`
            2. \`<text>
            The theory of relativity, or simply relativity, encompasses two interrelated theories of Albert Einstein: special relativity and general
            relativity. However, the word "relativity" is sometimes used in reference to Galilean invariance. The term "theory of relativity" was based
            on the expression "relative theory" used by Max Planck in 1906. The theory of relativity usually encompasses two interrelated theories by
            Albert Einstein: special relativity and general relativity. Special relativity applies to all physical phenomena in the absence of gravity.
            General relativity explains the law of gravitation and its relation to other forces of nature. It applies to the cosmological and astrophysical
            realm, including astronomy.
            </text>

            <query>
            summarize
            </query>

            Response:
            The theory of relativity, developed by Albert Einstein, encompasses two main theories: special relativity and general relativity. Special
            relativity applies to all physical phenomena in the absence of gravity, while general relativity explains the law of gravitation and its
            relation to other forces of nature. The theory of relativity is based on the concept of "relative theory," as introduced by Max Planck in
            1906. It is a fundamental theory in physics that has revolutionized our understanding of the universe.
            \`
            </example>

            Everything below is the actual data you will be working with. Good luck!

            <query>
            ${question}
            </query>

            <text>
            ${doc.pageContent}
            </text>

            Make sure to answer the query in the summary.
    `,
                  { signal, ...getLangfuseCallbacks() },
                );

                const document = new Document({
                  pageContent: res.content as string,
                  metadata: {
                    title: doc.metadata.title,
                    url: doc.metadata.url,
                  },
                });

                docs.push(document);
              }),
            );

            return { query: question, docs: docs };
          } else {
            if (this.config.additionalSearchCriteria) {
              question = `${question} ${this.config.additionalSearchCriteria}`;
            }
            this.emitProgress(
              emitter,
              20,
              `Searching the web`,
              `Search Query: ${question}`,
            );

            const searxngResult = await searchSearxng(question, {
              language: 'en',
              engines: this.config.activeEngines,
            });

            // Store the SearXNG URL for later use in emitting to the client
            this.searxngUrl = searxngResult.searchUrl;

            const documents = searxngResult.results.map(
              (result) =>
                new Document({
                  pageContent:
                    result.content ||
                    (this.config.activeEngines.includes('youtube')
                      ? result.title
                      : '') /* Todo: Implement transcript grabbing using Youtubei (source: https://www.npmjs.com/package/youtubei) */,
                  metadata: {
                    title: result.title,
                    url: result.url,
                    ...(result.img_src && { img_src: result.img_src }),
                  },
                }),
            );

            return { query: question, docs: documents, searchQuery: question };
          }
        } catch (error) {
          console.error('Error in search retriever chain:', error);
          emitter.emit('error', JSON.stringify({ data: error }));
          throw error;
        }
      }),
    ]);
  }

  private async createAnsweringChain(
    llm: BaseChatModel,
    embeddings: Embeddings,
    signal: AbortSignal,
    emitter: eventEmitter,
    personaInstructions?: string,
    focusMode?: string,
  ) {
    return RunnableSequence.from([
      RunnableMap.from({
        query: (input: BasicChainInput) => input.query,
        chat_history: (input: BasicChainInput) => input.chat_history,
        date: () => formatDateForLLM(),
        formattingAndCitations: () => (personaInstructions ? personaInstructions : formattingAndCitationsWeb),
        context: RunnableLambda.from(
          async (
            input: BasicChainInput,
            options?: { signal?: AbortSignal },
          ) => {
            // Check if the request was aborted
            if (options?.signal?.aborted || signal?.aborted) {
              console.log('Request cancelled by user');
              throw new Error('Request cancelled by user');
            }

            const processedHistory = formatChatHistoryAsString(
              input.chat_history,
            );

            let docs: Document[] | null = null;
            let query = input.query;

            if (this.config.searchWeb) {
              const searchRetrieverChain =
                await this.createSearchRetrieverChain(
                  llm,
                  emitter,
                  signal,
                );
              var date = formatDateForLLM();

              const searchRetrieverResult = await searchRetrieverChain.invoke(
                {
                  chat_history: processedHistory,
                  query,
                  date,
                },
                { signal: options?.signal, ...getLangfuseCallbacks() },
              );

              query = searchRetrieverResult.query;
              docs = searchRetrieverResult.docs;

              // Store the search query in the context for emitting to the client
              if (searchRetrieverResult.searchQuery) {
                this.searchQuery = searchRetrieverResult.searchQuery;
              }
            }

            const sortedDocs = await this.rerankDocsForSpeed(
              query,
              docs ?? [],
              embeddings,
              emitter,
              signal,
            );

            if (options?.signal?.aborted || signal?.aborted) {
              console.log('Request cancelled by user');
              throw new Error('Request cancelled by user');
            }

            this.emitProgress(emitter, 100, `Done`);
            return sortedDocs;
          },
        )
          .withConfig({
            runName: 'FinalSourceRetriever',
            ...getLangfuseCallbacks(),
          })
          .pipe(this.processDocs),
      }),
      ChatPromptTemplate.fromMessages([
        ['system', this.config.responsePrompt],
        new MessagesPlaceholder('chat_history'),
        ['user', '{query}'],
      ]),
      llm,
      this.strParser,
    ]).withConfig({
      runName: 'FinalResponseGenerator',
      ...getLangfuseCallbacks(),
    });
  }

  /**
   * Speed-optimized document reranking with simplified logic for web results only
   */
  private async rerankDocsForSpeed(
    query: string,
    docs: Document[],
    embeddings: Embeddings,
    emitter: eventEmitter,
    signal: AbortSignal,
  ): Promise<Document[]> {
    try {
      if (docs.length === 0) {
        return docs;
      }

      if (query.toLocaleLowerCase() === 'summarize') {
        return docs.slice(0, 15);
      }

      // Filter out documents with no content
      let docsWithContent = docs.filter(
        (doc) => doc.pageContent && doc.pageContent.length > 0,
      );

      // Speed mode logic - simply return first 15 documents with content
      // No similarity ranking to prioritize speed
      this.emitProgress(
        emitter,
        50,
        `Ranking sources`,
        this.searchQuery ? `Search Query: ${this.searchQuery}` : undefined,
      );

      return docsWithContent.slice(0, 15);
    } catch (error) {
      console.error('Error in rerankDocsForSpeed:', error);
      emitter.emit('error', JSON.stringify({ data: error }));
    }
    return [];
  }

  private processDocs(docs: Document[]) {
    const fullDocs = docs
      .map(
        (_, index) =>
          `<${index + 1}>\n
<title>${docs[index].metadata.title}</title>\n
${docs[index].metadata?.url.toLowerCase().includes('file') ? '' : '\n<url>' + docs[index].metadata.url + '</url>\n'}
<content>\n${docs[index].pageContent}\n</content>\n
</${index + 1}>\n`,
      )
      .join('\n');
    console.log('Processed docs:', fullDocs);
    return fullDocs;
  }

  private async handleStream(
    stream: AsyncGenerator<StreamEvent, any, any>,
    emitter: eventEmitter,
    llm: BaseChatModel,
    signal: AbortSignal,
  ) {
    if (signal.aborted) {
      return;
    }

    for await (const event of stream) {
      if (signal.aborted) {
        return;
      }

      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalSourceRetriever'
      ) {
        const sourcesData = event.data.output;
        if (this.searchQuery) {
          emitter.emit(
            'data',
            JSON.stringify({
              type: 'sources',
              data: sourcesData,
              searchQuery: this.searchQuery,
              searchUrl: this.searxngUrl,
            }),
          );
        } else {
          emitter.emit(
            'data',
            JSON.stringify({ type: 'sources', data: sourcesData }),
          );
        }
      }
      if (
        event.event === 'on_chain_stream' &&
        event.name === 'FinalResponseGenerator'
      ) {
        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: event.data.chunk }),
        );
      }
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalResponseGenerator'
      ) {
        const modelName = getModelName(llm);

        // Send model info before ending
        emitter.emit(
          'stats',
          JSON.stringify({
            type: 'modelStats',
            data: {
              modelName,
            },
          }),
        );

        emitter.emit('end');
      }
    }
  }

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    signal: AbortSignal,
    personaInstructions?: string,
    focusMode?: string,
  ) {
    const emitter = new eventEmitter();

    const answeringChain = await this.createAnsweringChain(
      llm,
      embeddings,
      signal,
      emitter,
      personaInstructions,
      focusMode,
    );

    const stream = answeringChain.streamEvents(
      {
        chat_history: history,
        query: message,
      },
      {
        version: 'v1',
        // Pass the abort signal to the LLM streaming chain
        signal,
        ...getLangfuseCallbacks(),
      },
    );

    this.handleStream(stream, emitter, llm, signal);

    return emitter;
  }
}

export default SpeedSearchAgent;
