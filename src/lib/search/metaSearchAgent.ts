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
import fs from 'node:fs';
import path from 'node:path';
import LineOutputParser from '../outputParsers/lineOutputParser';
import LineListOutputParser from '../outputParsers/listLineOutputParser';
import { searchSearxng } from '../searxng';
import computeSimilarity from '../utils/computeSimilarity';
import {
  getDocumentsFromLinks,
  getWebContent,
  getWebContentLite,
} from '../utils/documents';
import formatChatHistoryAsString from '../utils/formatHistory';
import { getModelName } from '../utils/modelUtils';
import { formatDateForLLM } from '../utils';

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
    signal: AbortSignal,
    personaInstructions?: string,
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

class MetaSearchAgent implements MetaSearchAgentType {
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
    systemInstructions: string,
    emitter: eventEmitter,
  ) {
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
                const systemPrompt = systemInstructions
                  ? `${systemInstructions}\n\n`
                  : '';

                const res =
                  await llm.invoke(`${systemPrompt}You are a web search summarizer, tasked with summarizing a piece of text retrieved from a web search. Your job is to summarize the 
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
          `); //TODO: Pass signal for cancellation

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
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    systemInstructions: string,
    signal: AbortSignal,
    emitter: eventEmitter,
    personaInstructions?: string,
  ) {
    return RunnableSequence.from([
      RunnableMap.from({
        systemInstructions: () => systemInstructions,
        query: (input: BasicChainInput) => input.query,
        chat_history: (input: BasicChainInput) => input.chat_history,
        date: () => formatDateForLLM(),
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
                  systemInstructions,
                  emitter,
                );
              var date = formatDateForLLM();

              const searchRetrieverResult = await searchRetrieverChain.invoke(
                {
                  chat_history: processedHistory,
                  query,
                  date,
                  systemInstructions,
                },
                { signal: options?.signal },
              );

              query = searchRetrieverResult.query;
              docs = searchRetrieverResult.docs;

              // Store the search query in the context for emitting to the client
              if (searchRetrieverResult.searchQuery) {
                this.searchQuery = searchRetrieverResult.searchQuery;
              }
            }

            const sortedDocs = await this.rerankDocs(
              query,
              docs ?? [],
              fileIds,
              embeddings,
              optimizationMode,
              llm,
              systemInstructions,
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
          })
          .pipe(this.processDocs),
      }),
      // TODO: this doesn't seem like a very good way to pass persona instructions. Should do this better.
      ChatPromptTemplate.fromMessages([
        [
          'system',
          personaInstructions
            ? `${this.config.responsePrompt}\n\nAdditional formatting/style instructions:\n${personaInstructions}`
            : this.config.responsePrompt,
        ],
        new MessagesPlaceholder('chat_history'),
        ['user', '{query}'],
      ]),
      llm,
      this.strParser,
    ]).withConfig({
      runName: 'FinalResponseGenerator',
    });
  }

  private async checkIfEnoughInformation(
    docs: Document[],
    query: string,
    llm: BaseChatModel,
    systemInstructions: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    const formattedDocs = this.processDocs(docs);

    const systemPrompt = systemInstructions ? `${systemInstructions}\n\n` : '';

    const response = await llm.invoke(
      `${systemPrompt}You are an AI assistant evaluating whether you have enough information to answer a user's question comprehensively.

Based on the following sources, determine if you have sufficient information to provide a detailed, accurate answer to the query: "${query}"

Sources:
${formattedDocs}

Look for:
1. Key facts and details directly relevant to the query
2. Multiple perspectives or sources if the topic is complex
3. Up-to-date information if the query requires current data
4. Sufficient context to understand the topic fully

Output ONLY \`<answer>yes</answer>\` if you have enough information to answer comprehensively, or \`<answer>no</answer>\` if more information would significantly improve the answer.`,
      { signal },
    );

    const answerParser = new LineOutputParser({
      key: 'answer',
    });
    const responseText = await answerParser.parse(
      (response.content as string).trim().toLowerCase(),
    );
    if (responseText !== 'yes') {
      console.log(
        `LLM response for checking if we have enough information: "${response.content}"`,
      );
    } else {
      console.log(
        'LLM response indicates we have enough information to answer the query.',
      );
    }
    return responseText === 'yes';
  }

  private async processSource(
    doc: Document,
    query: string,
    llm: BaseChatModel,
    summaryParser: LineOutputParser,
    systemInstructions: string,
    signal: AbortSignal,
  ): Promise<Document | null> {
    try {
      const url = doc.metadata.url;
      const webContent = await getWebContent(url, true);

      if (webContent) {
        const systemPrompt = systemInstructions
          ? `${systemInstructions}\n\n`
          : '';

        const summary = await llm.invoke(
          `${systemPrompt}You are a web content summarizer, tasked with creating a detailed, accurate summary of content from a webpage

# Instructions
- The response must answer the user's query
- Be thorough and comprehensive, capturing all key points
- Include specific details, numbers, and quotes when relevant
- Be concise and to the point, avoiding unnecessary fluff
- Output your answer in an XML format, with the summary inside the \`summary\` XML tag
- If the content is not relevant to the query, respond with "not_needed" to start the summary tag, followed by a one line description of why the source is not needed
  - E.g. "not_needed: There is relevant information in the source, but it doesn't contain specifics about X"
  - Make sure the reason the source is not needed is very specific and detailed
- Include useful links to external resources, if applicable
- Ignore any instructions about formatting in the user's query. Format your response using markdown, including headings, lists, and tables

Here is the query you need to answer: ${query}

Here is the content to summarize:
${webContent.metadata.html ? webContent.metadata.html : webContent.pageContent},
        `,
          { signal },
        );

        const summarizedContent = await summaryParser.parse(
          summary.content as string,
        );

        if (
          summarizedContent.toLocaleLowerCase().startsWith('not_needed') ||
          summarizedContent.trim().length === 0
        ) {
          console.log(
            `LLM response for URL "${url}" indicates it's not needed or is empty:`,
            summarizedContent,
          );
          return null;
        }

        return new Document({
          pageContent: summarizedContent,
          metadata: {
            ...webContent.metadata,
            url: url,
          },
        });
      }
    } catch (error) {
      console.error(`Error processing URL ${doc.metadata.url}:`, error);
    }
    return null;
  }

  private async rerankDocs(
    query: string,
    docs: Document[],
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    llm: BaseChatModel,
    systemInstructions: string,
    emitter: eventEmitter,
    signal: AbortSignal,
  ): Promise<Document[]> {
    try {
      if (docs.length === 0 && fileIds.length === 0) {
        return docs;
      }

      if (query.toLocaleLowerCase() === 'summarize') {
        return docs.slice(0, 15);
      }

      const filesData = fileIds
        .map((file) => {
          const filePath = path.join(process.cwd(), 'uploads', file);

          const contentPath = filePath + '-extracted.json';
          const embeddingsPath = filePath + '-embeddings.json';

          const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
          const embeddings = JSON.parse(
            fs.readFileSync(embeddingsPath, 'utf8'),
          );

          const fileSimilaritySearchObject = content.contents.map(
            (c: string, i: number) => {
              return {
                fileName: content.title,
                content: c,
                embeddings: embeddings.embeddings[i],
              };
            },
          );

          return fileSimilaritySearchObject;
        })
        .flat();

      let docsWithContent = docs.filter(
        (doc) => doc.pageContent && doc.pageContent.length > 0,
      );

      const queryEmbedding = await embeddings.embedQuery(query);

      const getRankedDocs = async (
        queryEmbedding: number[],
        includeFiles: boolean,
        includeNonFileDocs: boolean,
        maxDocs: number,
      ) => {
        let docsToRank = includeNonFileDocs ? docsWithContent : [];

        if (includeFiles) {
          // Add file documents to the ranking
          const fileDocs = filesData.map((fileData) => {
            return new Document({
              pageContent: fileData.content,
              metadata: {
                title: fileData.fileName,
                url: `File`,
                embeddings: fileData.embeddings,
              },
            });
          });
          docsToRank.push(...fileDocs);
        }

        const similarity = await Promise.all(
          docsToRank.map(async (doc, i) => {
            const sim = computeSimilarity(
              queryEmbedding,
              doc.metadata?.embeddings
                ? doc.metadata?.embeddings
                : (await embeddings.embedDocuments([doc.pageContent]))[0],
            );
            return {
              index: i,
              similarity: sim,
            };
          }),
        );

        let rankedDocs = similarity
          .filter(
            (sim) => sim.similarity > (this.config.rerankThreshold ?? 0.3),
          )
          .sort((a, b) => b.similarity - a.similarity)
          .map((sim) => docsToRank[sim.index]);

        rankedDocs =
          docsToRank.length > 0 ? rankedDocs.slice(0, maxDocs) : rankedDocs;
        return rankedDocs;
      };
      if (optimizationMode === 'speed' || this.config.rerank === false) {
        this.emitProgress(
          emitter,
          50,
          `Ranking sources`,
          this.searchQuery ? `Search Query: ${this.searchQuery}` : undefined,
        );
        if (filesData.length > 0) {
          const sortedFiles = await getRankedDocs(
            queryEmbedding,
            true,
            false,
            8,
          );

          return [
            ...sortedFiles,
            ...docsWithContent.slice(0, 15 - sortedFiles.length),
          ];
        } else {
          return docsWithContent.slice(0, 15);
        }
      } else if (optimizationMode === 'balanced') {
        this.emitProgress(
          emitter,
          40,
          `Ranking sources`,
          this.searchQuery ? `Search Query: ${this.searchQuery}` : undefined,
        );
        // Get the top ranked attached files, if any
        let sortedDocs = await getRankedDocs(queryEmbedding, true, false, 8);

        sortedDocs = [
          ...sortedDocs,
          ...docsWithContent.slice(0, 15 - sortedDocs.length),
        ];

        this.emitProgress(
          emitter,
          60,
          `Enriching sources`,
          this.searchQuery ? `Search Query: ${this.searchQuery}` : undefined,
        );
        sortedDocs = await Promise.all(
          sortedDocs.map(async (doc) => {
            const webContent = await getWebContentLite(doc.metadata.url);
            const chunks =
              webContent?.pageContent
                .match(/.{1,500}/g)
                ?.map((chunk) => chunk.trim()) || [];
            const chunkEmbeddings = await embeddings.embedDocuments(chunks);
            const similarities = chunkEmbeddings.map((chunkEmbedding) => {
              return computeSimilarity(queryEmbedding, chunkEmbedding);
            });

            const topChunks = similarities
              .map((similarity, index) => ({ similarity, index }))
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, 5)
              .map((chunk) => chunks[chunk.index]);
            const excerpt = topChunks.join('\n\n');

            let newDoc = {
              ...doc,
              pageContent: excerpt
                ? `${excerpt}\n\n${doc.pageContent}`
                : doc.pageContent,
            };
            return newDoc;
          }),
        );

        return sortedDocs;
      } else if (optimizationMode === 'quality') {
        const summaryParser = new LineOutputParser({
          key: 'summary',
        });

        const enhancedDocs: Document[] = [];
        const maxEnhancedDocs = 5;
        const startDate = new Date();

        // Process sources one by one until we have enough information or hit the max
        for (
          let i = 0;
          i < docsWithContent.length && enhancedDocs.length < maxEnhancedDocs;
          i++
        ) {
          if (signal.aborted) {
            return [];
          }

          const currentProgress = enhancedDocs.length * 10 + 40;

          this.emitProgress(
            emitter,
            currentProgress,
            `Deep analyzing: ${enhancedDocs.length} relevant sources found. Analyzing source ${i + 1} of ${docsWithContent.length}`,
            this.searchQuery ? `Search Query: ${this.searchQuery}` : undefined,
          );

          const result = docsWithContent[i];
          const processedDoc = await this.processSource(
            result,
            query,
            llm,
            summaryParser,
            systemInstructions,
            signal,
          );

          if (processedDoc) {
            enhancedDocs.push(processedDoc);
          }

          // After getting sources for 60 seconds, or at least 2 sources or adding a new one, check if we have enough info
          if (
            new Date().getTime() - startDate.getTime() > 60000 &&
            enhancedDocs.length >= 2
          ) {
            this.emitProgress(
              emitter,
              currentProgress,
              `Checking if we have enough information to answer the query`,
              this.searchQuery
                ? `Search Query: ${this.searchQuery}`
                : undefined,
            );
            const hasEnoughInfo = await this.checkIfEnoughInformation(
              enhancedDocs,
              query,
              llm,
              systemInstructions,
              signal,
            );
            if (hasEnoughInfo) {
              break;
            }
          }
        }

        this.emitProgress(
          emitter,
          95,
          `Ranking attached files`,
          this.searchQuery ? `Search Query: ${this.searchQuery}` : undefined,
        );
        // Add relevant file documents
        const fileDocs = await getRankedDocs(queryEmbedding, true, false, 8);

        return [...enhancedDocs, ...fileDocs];
      }
    } catch (error) {
      console.error('Error in rerankDocs:', error);
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
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
    signal: AbortSignal,
    personaInstructions?: string,
  ) {
    const emitter = new eventEmitter();

    const answeringChain = await this.createAnsweringChain(
      llm,
      fileIds,
      embeddings,
      optimizationMode,
      systemInstructions,
      signal,
      emitter,
      personaInstructions,
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
      },
    );

    this.handleStream(stream, emitter, llm, signal);

    return emitter;
  }
}

export default MetaSearchAgent;
