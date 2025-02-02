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
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import LineListOutputParser from '../lib/outputParsers/listLineOutputParser';
import LineOutputParser from '../lib/outputParsers/lineOutputParser';
import { getDocumentsFromLinks } from '../utils/documents';
import { Document } from 'langchain/document';
import { searchSearxng } from '../lib/searxng';
import path from 'path';
import fs from 'fs';
import computeSimilarity from '../utils/computeSimilarity';
import formatChatHistoryAsString from '../utils/formatHistory';
import eventEmitter from 'events';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import logger from '../utils/logger'; // Winston logger

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
  ) => Promise<eventEmitter>;
}
// twst
interface Config {
  searchWeb: boolean;
  rerank: boolean;
  summarizer: boolean;
  rerankThreshold: number;
  queryGeneratorPrompt: string;
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
    // Optional: log the configuration at instantiation
    logger.info(`MetaSearchAgent created with config: ${JSON.stringify(config)}`);
  }

  private async createSearchRetrieverChain(llm: BaseChatModel) {
    (llm as unknown as ChatOpenAI).temperature = 0;
    logger.info('createSearchRetrieverChain: LLM temperature set to 0');

    return RunnableSequence.from([
      PromptTemplate.fromTemplate(this.config.queryGeneratorPrompt),
      llm,
      this.strParser,
      RunnableLambda.from(async (input: string) => {
        logger.info(`Parsed query: ${input}`);

        const linksOutputParser = new LineListOutputParser({
          key: 'links',
        });
        const questionOutputParser = new LineOutputParser({
          key: 'question',
        });

        const links = await linksOutputParser.parse(input);
        let question = this.config.summarizer
          ? await questionOutputParser.parse(input)
          : input;

        logger.info(`Links found: ${JSON.stringify(links, null, 2)}`);
        logger.info(`Question parsed: ${question}`);

        if (question === 'not_needed') {
          logger.info('No question needed ("not_needed"), returning empty docs.');
          return { query: '', docs: [] };
        }

        if (links.length > 0) {
          logger.info('Handling user-provided links...');
          if (question.length === 0) {
            question = 'summarize';
          }

          let docs: Document[] = [];
          const linkDocs = await getDocumentsFromLinks({ links });
          logger.info(`Fetched ${linkDocs.length} documents from user links.`);

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
                ... // Summarizer prompt ...
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
          logger.info('Docs after summarizing user-provided links: ', docs);

          return { query: question, docs };
        } else {
          logger.info(`No links specified, searching via Searxng on query: "${question}"`);
          const res = await searchSearxng(question, {
            language: 'en',
            engines: this.config.activeEngines,
          });
          logger.info(`Searxng returned ${res.results.length} results.`);

          const documents = res.results.map(
            (result) =>
              new Document({
                pageContent:
                  result.content ||
                  (this.config.activeEngines.includes('youtube')
                    ? result.title
                    : ''),
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
  ) {
    logger.info(`Creating answering chain. Optimization mode: ${optimizationMode}`);
    return RunnableSequence.from([
      RunnableMap.from({
        query: (input: BasicChainInput) => input.query,
        chat_history: (input: BasicChainInput) => input.chat_history,
        date: () => new Date().toISOString(),
        context: RunnableLambda.from(async (input: BasicChainInput) => {
          logger.info('Retrieving final source documents...');
          const processedHistory = formatChatHistoryAsString(input.chat_history);

          let docs: Document[] | null = null;
          let query = input.query;

          if (this.config.searchWeb) {
            const searchRetrieverChain =
              await this.createSearchRetrieverChain(llm);

            const searchRetrieverResult = await searchRetrieverChain.invoke({
              chat_history: processedHistory,
              query,
            });

            query = searchRetrieverResult.query;
            docs = searchRetrieverResult.docs;
            logger.info(`Got ${docs.length} docs from searchRetriever.`);
          }

          const sortedDocs = await this.rerankDocs(
            query,
            docs ?? [],
            fileIds,
            embeddings,
            optimizationMode,
          );
          logger.info(`Sorted docs length: ${sortedDocs?.length ?? 0}`);

          return sortedDocs;
        })
          .withConfig({
            runName: 'FinalSourceRetriever',
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
    });
  }

  private async rerankDocs(
    query: string,
    docs: Document[],
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
  ) {
    logger.info(`Reranking. Query="${query}", initial docs=${docs.length}, fileIds=${fileIds.length}`);
    if (docs.length === 0 && fileIds.length === 0) {
      logger.info('No docs or fileIds to rerank. Returning empty.');
      return docs;
    }

    const filesData = fileIds
      .map((file) => {
        const filePath = path.join(process.cwd(), 'uploads', file);

        const contentPath = filePath + '-extracted.json';
        const embeddingsPath = filePath + '-embeddings.json';

        logger.info(`Reading content from ${contentPath}`);
        logger.info(`Reading embeddings from ${embeddingsPath}`);

        const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
        const fileEmbeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));

        const fileSimilaritySearchObject = content.contents.map(
          (c: string, i: number) => ({
            fileName: content.title,
            content: c,
            embeddings: fileEmbeddings.embeddings[i],
          }),
        );

        return fileSimilaritySearchObject;
      })
      .flat();

    // If only summarizing, just return top docs
    if (query.toLocaleLowerCase() === 'summarize') {
      logger.info(`Query is "summarize". Returning top 15 docs from web sources.`);
      return docs.slice(0, 15);
    }

    const docsWithContent = docs.filter((doc) => doc.pageContent && doc.pageContent.length > 0);

    if (optimizationMode === 'speed' || this.config.rerank === false) {
      logger.info(`Reranking in 'speed' mode or no rerank. Docs with content: ${docsWithContent.length}`);
      if (filesData.length > 0) {
        const [queryEmbedding] = await Promise.all([
          embeddings.embedQuery(query),
        ]);

        const fileDocs = filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: 'File',
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
          .filter((sim) => sim.similarity > (this.config.rerankThreshold ?? 0.3))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 15)
          .map((sim) => fileDocs[sim.index]);

        sortedDocs = docsWithContent.length > 0 ? sortedDocs.slice(0, 8) : sortedDocs;
        logger.info(`Final sorted docs in 'speed' mode: ${sortedDocs.length}`);
        
        return [...sortedDocs, ...docsWithContent.slice(0, 15 - sortedDocs.length)];
      } else {
        logger.info('No file data, returning top 15 from docsWithContent.');
        return docsWithContent.slice(0, 15);
      }
    } else if (optimizationMode === 'balanced') {
      logger.info('Reranking in balanced mode.');
      const [docEmbeddings, queryEmbedding] = await Promise.all([
        embeddings.embedDocuments(docsWithContent.map((doc) => doc.pageContent)),
        embeddings.embedQuery(query),
      ]);

      docsWithContent.push(
        ...filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: 'File',
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

      logger.info(`Final sorted docs in 'balanced' mode: ${sortedDocs.length}`);
      return sortedDocs;
    }

    // If "quality" is passed but not implemented, you might want to log or fallback
    logger.warn(`Optimization mode "${optimizationMode}" not fully implemented. Returning docs as-is.`);
    return docsWithContent.slice(0, 15);
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
    stream: IterableReadableStream<StreamEvent>,
    emitter: eventEmitter,
  ) {
    logger.info('Starting to stream chain events...');
    for await (const event of stream) {
      // You can add debug logs here to see each event
      // logger.info(`Event: ${JSON.stringify(event, null, 2)}`);

      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalSourceRetriever'
      ) {
        logger.info('FinalSourceRetriever ended, sending docs to front-end...');
        emitter.emit(
          'data',
          JSON.stringify({ type: 'sources', data: event.data.output }),
        );
      }
      if (
        event.event === 'on_chain_stream' &&
        event.name === 'FinalResponseGenerator'
      ) {
        logger.info('Response chunk received, streaming to client...');
        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: event.data.chunk }),
        );
      }
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalResponseGenerator'
      ) {
        logger.info('FinalResponseGenerator ended, signaling end of stream.');
        emitter.emit('end');
      }
    }
    logger.info('Finished streaming chain events.');
  }

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
  ) {
    const emitter = new eventEmitter();

    logger.info(`Received query: "${message}"`);
    logger.info(`History length: ${history.length}`);
    logger.info(`Optimization mode: ${optimizationMode}`);
    logger.info(`File IDs: ${fileIds.join(', ') || 'None'}`);

    const answeringChain = await this.createAnsweringChain(
      llm,
      fileIds,
      embeddings,
      optimizationMode,
    );

    // .streamEvents(...) can throw, so a try/catch can help you catch/log errors
    try {
      const stream = answeringChain.streamEvents(
        { chat_history: history, query: message },
        { version: 'v1' },
      );
      this.handleStream(stream, emitter);
    } catch (error: any) {
      logger.error(`Error in searchAndAnswer streaming: ${error.message}`);
      emitter.emit('error', error);
    }

    return emitter;
  }
}

export default MetaSearchAgent;
