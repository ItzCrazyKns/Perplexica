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
import {
  AIMessage,
  BaseMessage,
  isAIMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import LineListOutputParser from '../outputParsers/listLineOutputParser';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { getDocumentsFromLinks } from '../utils/documents';
import { Document } from 'langchain/document';
import { searchSearxng } from '../searxng';
import path from 'node:path';
import fs from 'node:fs';
import computeSimilarity from '../utils/computeSimilarity';
import formatChatHistoryAsString from '../utils/formatHistory';
import eventEmitter from 'events';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import {
  IterableReadableStream,
  IterableReadableStreamInterface,
} from '@langchain/core/utils/stream';
import EventEmitter from 'node:events';
import { BaseLanguageModel } from '@langchain/core/language_models/base';

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
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
}

class MetaSearchAgent implements MetaSearchAgentType {
  private config: Config;
  private strParser = new StringOutputParser();

  constructor(config: Config) {
    this.config = config;
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
    stream: AsyncIterable<[BaseMessage, Record<string, any>]>,
    emitter: eventEmitter,
  ) {
    for await (const [message, _metadata] of stream) {
      if (isAIMessage(message) && message.tool_calls?.length) {
      } else if (isAIMessage(message) && message.content) {
        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: message.content }),
        );
      }
    }

    emitter.emit('end');
  }

  getTools({
    llm,
    emitter,
  }: {
    llm: BaseLanguageModel;
    emitter: EventEmitter;
  }): DynamicStructuredTool[] {
    const searchToolInputSchema = z.object({
      searchMode: z
        .enum(['normal', 'news'])
        .describe(
          'The search mode. If you want latest, live or articles on a topic use the news mode (you also need to use news mode for queries where you think there might be a newswall), otherwise for normal searches use normal mode.',
        ),
      query: z.string().describe('The query to search the web for.'),
      links: z
        .array(z.string().describe('The link to get data from'))
        .describe(
          'A list of links (if shared by user) to generate an answer from.',
        ),
    });

    const searchTool = tool(
      async (input: any) => {
        if (input.links.length > 0) {
          let docs: Document[] = [];

          const linkDocs = await getDocumentsFromLinks({ links: input.links });

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

          const URLSourcePrompt = `
              You are a web search question answerer, tasked with finding relevant information from web documents to answer questions. Your job is to extract and summarize the most relevant parts of a document that can help answer the user's query.

              - **Find relevant sections**: Identify parts of the document that directly relate to the question
              - **Extract key information**: Pull out specific facts, data, or explanations that answer the query
              - **Summarize concisely**: Provide a focused summary of the relevant information found
              - **Stay on topic**: Only include information that helps answer the specific question asked

              The document text will be shared inside the \`text\` XML tag, and the query inside the \`query\` XML tag.

              Extract and summarize the relevant information from the document that answers the query.
              `;

          const URLSourceChatPrompt = ChatPromptTemplate.fromMessages([
            ['system', URLSourcePrompt],
            [
              'human',
              `
              <text>
             Docker is a set of platform-as-a-service products that use OS-level virtualization to deliver software in packages called containers. 
             It was first released in 2013 and is developed by Docker, Inc. Docker is designed to make it easier to create, deploy, and run applications 
             by using containers.
             </text>
 
             <query>
             What is Docker and how does it work?
             </query>
              `,
            ],
            [
              'assistant',
              `
                 Docker is a revolutionary platform-as-a-service product developed by Docker, Inc., that uses container technology to make application 
             deployment more efficient. It allows developers to package their software with all necessary dependencies, making it easier to run in 
             any environment. Released in 2013, Docker has transformed the way applications are built, deployed, and managed.
                `,
            ],
            [
              'human',
              `
     <text>
     Rising global temperatures are causing significant changes to Earth's climate system. Ice sheets in Greenland and Antarctica are melting at accelerated rates, contributing to sea level rise. Ocean temperatures are increasing, leading to coral bleaching events. Weather patterns are becoming more extreme, with increased frequency of hurricanes, droughts, and flooding. The Arctic is warming twice as fast as the global average, a phenomenon known as Arctic amplification.
     </text>

     <query>
     What are the main effects of climate change on the environment?
     </query>
   `,
            ],
            [
              'assistant',
              `
     Climate change is causing accelerated melting of ice sheets in Greenland and Antarctica, leading to sea level rise. Rising ocean temperatures are causing coral bleaching, while weather patterns are becoming more extreme with increased hurricanes, droughts, and flooding. The Arctic is experiencing particularly rapid warming at twice the global average rate.
   `,
            ],

            [
              'human',
              `
     <text>
     Pasta is a staple food of Italian cuisine made from wheat flour and water. Common shapes include spaghetti, penne, and fusilli. It can be served with various sauces like marinara, alfredo, or pesto. Pasta cooking involves boiling water with salt and cooking until al dente. Different regions of Italy have their own traditional pasta dishes and preparation methods.
     </text>

     <query>
     How do solar panels generate electricity?
     </query>
   `,
            ],
            [
              'assistant',
              `
     The provided document about pasta and Italian cuisine does not contain information about how solar panels generate electricity. No relevant information found to answer the query.
   `,
            ],

            [
              'human',
              `
     <text>
     {content}
     </text>

     <query>
     {query}
     </query>
   `,
            ],
          ]);

          await Promise.all(
            docGroups.map(async (doc) => {
              const formattedPrompt = await URLSourceChatPrompt.formatMessages({
                query: input.query,
                content: doc.pageContent,
              });

              const llmResponse = await llm.invoke(formattedPrompt);

              const document = new Document({
                pageContent: llmResponse.content as string,
                metadata: {
                  title: doc.metadata.title,
                  url: doc.metadata.url,
                },
              });

              docs.push(document);
            }),
          );

          emitter.emit('data', JSON.stringify({ type: 'sources', data: docs }));

          return this.processDocs(docs);
        } else {
          const res = await searchSearxng(input.query, {
            language: 'en',
            engines:
              input.searchMode === 'news'
                ? ['bing_news']
                : this.config.activeEngines,
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

          emitter.emit(
            'data',
            JSON.stringify({ type: 'sources', data: documents }),
          );

          return this.processDocs(documents);
        }
      },
      {
        name: 'search_web',
        schema: searchToolInputSchema,
        description: 'This tool allows you to search the web for information.',
      },
    );

    const summarizeToolInputSchema = z.object({
      links: z
        .array(z.string().describe('The URL to summarize'))
        .describe('The list of URLs to summarize'),
    });

    const summarizeTool = tool(
      async (input: any) => {
        if (input.links.length > 0) {
          let docs: Document[] = [];

          const linkDocs = await getDocumentsFromLinks({ links: input.links });
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

          const summarizerPrompt = `
You are a document summarizer for map-reduce processing of website content. Extract all factual information, data, and key concepts from document chunks into concise paragraph summaries.

**Requirements:**
- **Extract facts only**: Include concrete information, data, numbers, dates, definitions, and explanations
- **Ignore fluff**: Skip opinions, filler words, casual language, and non-essential content
- **Be concise**: Create summaries shorter than the original content
- **Paragraph format**: Write in plain paragraph form, no markdown, bullet points, or formatting
- **Preserve specifics**: Keep exact numbers, dates, names, and technical terms

The document text will be provided inside the \`text\` XML tag. Create a factual paragraph summary.
`;

          const summarizerChatPrompt = ChatPromptTemplate.fromMessages([
            ['system', summarizerPrompt],
            [
              'human',
              `
    <text>
    Docker is a platform-as-a-service product developed by Docker, Inc. and released in 2013 that uses OS-level virtualization to deliver software in containers. Containers are lightweight, portable packages that include application code, runtime, system tools, libraries, and settings.
    </text>
    `,
            ],
            [
              'assistant',
              `Docker is a platform-as-a-service product developed by Docker, Inc. in 2013 that uses OS-level virtualization to deliver software in containers. Containers are lightweight, portable packages containing application code, runtime, system tools, libraries, and settings.`,
            ],
            [
              'human',
              `
    <text>
    Hey there! So like, I was totally thinking about pasta the other day, you know? It's super amazing how there are different shapes. Spaghetti is long and thin, penne has tube shapes, and fusilli is all twisty! Haha, I just love Italian creativity with food.
    </text>
    `,
            ],
            [
              'assistant',
              `Pasta comes in various shapes including spaghetti which is long and thin, penne which has tube shapes, and fusilli which has a twisted form. These are Italian food products.`,
            ],
            [
              'human',
              `
    <text>
    {content}
    </text>
    `,
            ],
          ]);

          await Promise.all(
            docGroups.map(async (doc) => {
              const formattedPrompt = await summarizerChatPrompt.formatMessages(
                {
                  content: doc.pageContent,
                },
              );

              const llmResponse = await llm.invoke(formattedPrompt);

              const document = new Document({
                pageContent: llmResponse.content as string,
                metadata: {
                  title: doc.metadata.title,
                  url: doc.metadata.url,
                },
              });

              docs.push(document);
            }),
          );

          emitter.emit('data', JSON.stringify({ type: 'sources', data: docs }));

          return this.processDocs(docs);
        }
      },
      {
        name: 'summarize',
        description: 'This tool can be used to summarize URL(s)',
        schema: summarizeToolInputSchema,
      },
    );

    return [searchTool, summarizeTool];
  }

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
  ) {
    const emitter = new eventEmitter();

    const tools = this.getTools({
      emitter,
      llm,
    });

    const shouldContinue = (state: typeof MessagesAnnotation.State) => {
      const lastMessage = state.messages[
        state.messages.length - 1
      ] as AIMessage;

      if (lastMessage.tool_calls && lastMessage.tool_calls.length) {
        return 'tools';
      }

      return '__end__';
    };

    const callTools = async (
      state: typeof MessagesAnnotation.State,
    ): Promise<Partial<typeof MessagesAnnotation.State>> => {
      const lastMessage = state.messages[
        state.messages.length - 1
      ] as AIMessage;

      const toolResults: BaseMessage[] = [];

      if (lastMessage.tool_calls && lastMessage.tool_calls.length) {
        await Promise.all(
          lastMessage.tool_calls.map(async (t) => {
            const toolToCall = tools.find((i) => i.name === t.name);

            const result = await toolToCall?.invoke(t.args)!;

            toolResults.push(
              new ToolMessage({
                content: result,
                tool_call_id: t.id!,
              }),
            );
          }),
        );
      }

      return {
        messages: [...toolResults],
      };
    };

    const boundModel = llm.bindTools?.(tools)!;

    const callModel = async (
      state: typeof MessagesAnnotation.State,
    ): Promise<Partial<typeof MessagesAnnotation.State>> => {
      const { messages } = state;
      const res = await boundModel?.invoke(messages);

      return {
        messages: [res!],
      };
    };

    const workflow = new StateGraph(MessagesAnnotation)
      .addNode('agent', callModel)
      .addNode(
        'tools',
        RunnableLambda.from(callTools).withConfig({
          tags: ['nostream'],
        }),
      )
      .addEdge('__start__', 'agent')
      .addEdge('tools', 'agent')
      .addConditionalEdges('agent', shouldContinue);

    const app = workflow.compile();

    const filledPrompt = await PromptTemplate.fromTemplate(
      this.config.responsePrompt,
    ).format({
      systemInstructions: systemInstructions,
      date: Date.now(),
    });

    const stream = await app.stream(
      {
        messages: [['system', filledPrompt], ...history, ['human', message]],
      },
      {
        streamMode: 'messages',
      },
    );

    this.handleStream(stream, emitter);

    return emitter;
  }
}

export default MetaSearchAgent;
