import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
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
import { BaseMessage, BaseMessageLike } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import LineListOutputParser from '../outputParsers/listLineOutputParser';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { getDocumentsFromLinks } from '../utils/documents';
import { Document } from 'langchain/document';
import { search } from './providers';
import { getDefaultLanguage } from '../config';
import path from 'node:path';
import fs from 'node:fs';
import computeSimilarity from '../utils/computeSimilarity';
import formatChatHistoryAsString from '../utils/formatHistory';
import eventEmitter from 'events';
import { StreamEvent } from '@langchain/core/tracers/log_stream';

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
    customResponsePrompt?: string,
    customRetrieverPrompt?: string,
    restrictToSites?: string[],
    searchEngineCx?: string,
    synthesize?: boolean,
  ) => Promise<{ emitter: eventEmitter; promptUsed: string }>;
}

interface Config {
  searchWeb: boolean;
  rerank: boolean;
  rerankThreshold: number;
  queryGeneratorPrompt: string;
  queryGeneratorFewShots: BaseMessageLike[];
  responsePrompt: string;
  activeEngines: string[];
}

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

class MetaSearchAgent implements MetaSearchAgentType {
  private config: Config;
  private strParser = new StringOutputParser();

  constructor(config: Config) {
    this.config = config;
  }

  private async createSearchRetrieverChain(
    llm: BaseChatModel,
    restrictToSites?: string[],
    customRetrieverPrompt?: string,
    searchEngineCx?: string,
  ) {
    (llm as unknown as ChatOpenAI).temperature = 0;

    const retrieverPromptToUse =
      customRetrieverPrompt || this.config.queryGeneratorPrompt;

    return RunnableSequence.from([
      ChatPromptTemplate.fromMessages([
        ['system', retrieverPromptToUse],
        ...this.config.queryGeneratorFewShots,
        [
          'user',
          `
        <conversation>
        {chat_history}
        </conversation>

        <query>
        {query}
        </query>
       `,
        ],
      ]),
      llm,
      this.strParser,
      RunnableLambda.from(async (input: string) => {
        const linksOutputParser = new LineListOutputParser({
          key: 'links',
        });

        const questionOutputParser = new LineOutputParser({
          key: 'question',
        });

        const links = await linksOutputParser.parse(input);
        let question = (await questionOutputParser.parse(input)) ?? input;

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

          await Promise.all(
            docGroups.map(async (doc) => {
              const res = await llm.invoke(`
            You are a web search summarizer, tasked with summarizing a piece of text retrieved from a web search. Your job is to summarize the 
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
          `);

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
          question = question.replace(/<think>.*?<\/think>/g, '');

          let searchQuery = question;
          if (
            restrictToSites &&
            restrictToSites.length > 0 &&
            this.config.searchWeb
          ) {
            const siteRestrictions = restrictToSites
              .map((site) => `site:${site}`)
              .join(' OR ');
            searchQuery = `${siteRestrictions} ${question}`;
          }

          const res = await search(searchQuery, {
            language: getDefaultLanguage(),
            engines: this.config.activeEngines,
            ...(searchEngineCx && { cx: searchEngineCx }),
          });

          const documents = res.results.map(
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

          return { query: question, docs: documents };
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
    customResponsePrompt?: string,
    customRetrieverPrompt?: string,
    restrictToSites?: string[],
    searchEngineCx?: string,
  ) {
    const promptToUse = customResponsePrompt || this.config.responsePrompt;

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

          if (this.config.searchWeb) {
            const searchRetrieverChain = await this.createSearchRetrieverChain(
              llm,
              restrictToSites,
              customRetrieverPrompt,
              searchEngineCx,
            );

            const searchRetrieverResult = await searchRetrieverChain.invoke({
              chat_history: processedHistory,
              query,
            });

            query = searchRetrieverResult.query;
            docs = searchRetrieverResult.docs;
          }

          const sortedDocs = await this.rerankDocs(
            query,
            docs ?? [],
            fileIds,
            embeddings,
            optimizationMode,
          );

          return sortedDocs;
        })
          .withConfig({
            runName: 'FinalSourceRetriever',
          })
          .pipe(this.processDocs),
      }),
      ChatPromptTemplate.fromMessages([
        ['system', promptToUse],
        new MessagesPlaceholder('chat_history'),
        ['user', '{query}'],
      ]),
      llm,
      this.strParser,
    ]).withConfig({
      runName: 'FinalResponseGenerator',
    });
  }

  private async rerankDocs(
    query: string,
    docs: Document[],
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
  ) {
    if (docs.length === 0 && fileIds.length === 0) {
      return docs;
    }

    const filesData = fileIds
      .map((file) => {
        const filePath = path.join(process.cwd(), 'uploads', file);

        const contentPath = filePath + '-extracted.json';
        const embeddingsPath = filePath + '-embeddings.json';

        const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
        const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));

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

    if (query.toLocaleLowerCase() === 'summarize') {
      return docs.slice(0, 15);
    }

    const docsWithContent = docs.filter(
      (doc) => doc.pageContent && doc.pageContent.length > 0,
    );

    if (optimizationMode === 'speed' || this.config.rerank === false) {
      if (filesData.length > 0) {
        const [queryEmbedding] = await Promise.all([
          embeddings.embedQuery(query),
        ]);

        const fileDocs = filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: `File`,
            },
          });
        });

        const similarity = filesData.map((fileData, i) => {
          const sim = computeSimilarity(queryEmbedding, fileData.embeddings);

          return {
            index: i,
            similarity: sim,
          };
        });

        let sortedDocs = similarity
          .filter(
            (sim) => sim.similarity > (this.config.rerankThreshold ?? 0.3),
          )
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 15)
          .map((sim) => fileDocs[sim.index]);

        sortedDocs =
          docsWithContent.length > 0 ? sortedDocs.slice(0, 8) : sortedDocs;

        return [
          ...sortedDocs,
          ...docsWithContent.slice(0, 15 - sortedDocs.length),
        ];
      } else {
        return docsWithContent.slice(0, 15);
      }
    } else if (optimizationMode === 'balanced') {
      const [docEmbeddings, queryEmbedding] = await Promise.all([
        embeddings.embedDocuments(
          docsWithContent.map((doc) => doc.pageContent),
        ),
        embeddings.embedQuery(query),
      ]);

      docsWithContent.push(
        ...filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: `File`,
            },
          });
        }),
      );

      docEmbeddings.push(...filesData.map((fileData) => fileData.embeddings));

      const similarity = docEmbeddings.map((docEmbedding, i) => {
        const sim = computeSimilarity(queryEmbedding, docEmbedding);

        return {
          index: i,
          similarity: sim,
        };
      });

      const sortedDocs = similarity
        .filter((sim) => sim.similarity > (this.config.rerankThreshold ?? 0.3))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 15)
        .map((sim) => docsWithContent[sim.index]);

      return sortedDocs;
    }

    return [];
  }

  private processDocs(docs: Document[]) {
    return docs
      .map(
        (_, index) =>
          `${index + 1}. ${docs[index].metadata.title} ${docs[index].pageContent}`,
      )
      .join('\n');
  }

  private async handleStream(
    stream: AsyncGenerator<StreamEvent, any, any>,
    emitter: eventEmitter,
  ) {
    try {
      for await (const event of stream) {
        if (
          event.event === 'on_chain_end' &&
          event.name === 'FinalSourceRetriever'
        ) {
          emitter.emit(
            'data',
            JSON.stringify({ type: 'sources', data: event.data.output }),
          );
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
          emitter.emit('end');
        }
      }
    } catch (error: any) {
      emitter.emit(
        'error',
        JSON.stringify({
          type: 'error',
          data:
            error?.message || 'An error occurred while processing the stream',
        }),
      );
    }
  }

  private async runSearchOnly(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    emitter: eventEmitter,
    customRetrieverPrompt?: string,
    restrictToSites?: string[],
    searchEngineCx?: string,
  ) {
    try {
      const processedHistory = formatChatHistoryAsString(history);

      let docs: Document[] = [];
      let query = message;

      if (this.config.searchWeb) {
        const searchRetrieverChain = await this.createSearchRetrieverChain(
          llm,
          restrictToSites,
          customRetrieverPrompt,
          searchEngineCx,
        );

        const result = await searchRetrieverChain.invoke({
          chat_history: processedHistory,
          query: message,
        });

        query = result.query;
        docs = result.docs;
      }

      const sortedDocs = await this.rerankDocs(
        query,
        docs,
        fileIds,
        embeddings,
        optimizationMode,
      );

      emitter.emit('data', JSON.stringify({ type: 'sources', data: sortedDocs }));
      emitter.emit('end');
    } catch (error: any) {
      emitter.emit(
        'error',
        JSON.stringify({
          type: 'error',
          data: error?.message || 'An error occurred during search',
        }),
      );
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
    customResponsePrompt?: string,
    customRetrieverPrompt?: string,
    restrictToSites?: string[],
    searchEngineCx?: string,
    synthesize: boolean = true,
  ) {
    const emitter = new eventEmitter();
    const promptUsed = customResponsePrompt || this.config.responsePrompt;

    if (!synthesize) {
      this.runSearchOnly(
        message,
        history,
        llm,
        embeddings,
        optimizationMode,
        fileIds,
        emitter,
        customRetrieverPrompt,
        restrictToSites,
        searchEngineCx,
      );
      return { emitter, promptUsed };
    }

    try {
      const answeringChain = await this.createAnsweringChain(
        llm,
        fileIds,
        embeddings,
        optimizationMode,
        systemInstructions,
        customResponsePrompt,
        customRetrieverPrompt,
        restrictToSites,
        searchEngineCx,
      );

      const stream = answeringChain.streamEvents(
        {
          chat_history: history,
          query: message,
        },
        {
          version: 'v1',
        },
      );

      this.handleStream(stream, emitter).catch((error: any) => {
        emitter.emit(
          'error',
          JSON.stringify({
            type: 'error',
            data:
              error?.message ||
              'An error occurred while processing the request',
          }),
        );
      });
    } catch (error: any) {
      emitter.emit(
        'error',
        JSON.stringify({
          type: 'error',
          data:
            error?.message || 'An error occurred while initializing the search',
        }),
      );
    }

    return { emitter, promptUsed };
  }
}

export default MetaSearchAgent;
