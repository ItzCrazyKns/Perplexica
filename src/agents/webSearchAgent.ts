import { BaseMessage } from '@langchain/core/messages';
import {
  PromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Document } from '@langchain/core/documents';
import { searchSearxng } from '../lib/searxng';
import type { StreamEvent } from '@langchain/core/tracers/log_stream';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import formatChatHistoryAsString from '../utils/formatHistory';
import eventEmitter from 'events';
import computeSimilarity from '../utils/computeSimilarity';
import logger from '../utils/logger';
import LineListOutputParser from '../lib/outputParsers/listLineOutputParser';
import { getDocumentsFromLinks } from '../lib/linkDocument';
import LineOutputParser from '../lib/outputParsers/lineOutputParser';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { ChatOpenAI } from '@langchain/openai';

const basicSearchRetrieverPrompt = `
You are an AI question rephraser. Given a conversation and a follow-up question, rephrase the follow-up question so it is clear, standalone, and ready for another LLM to search the web for an answer.

- If the question is a simple greeting or a non-question (e.g., "Hi," "Hello," "How are you?"), return \`not_needed\` in the \`question\` block (no need to search the web).
- If the user provides a URL or asks to summarize a PDF/webpage, return the link in the \`links\` block and the rephrased question in the \`question\` block.
  - If the question is to summarize, replace the rephrased question with \`summarize\` inside the \`question\` block.

Always return the rephrased question inside the \`question\` block, and include the \`links\` block only when URLs are mentioned.

Here are examples for guidance:

<examples>
1. Follow-up question: What is the capital of France?
   Rephrased question: \`
   <question>
   Capital of France?
   </question>
   \`

2. Hi, how are you?
   Rephrased question: \`
   <question>
   not_needed
   </question>
   \`

3. Follow-up question: What is Docker?
   Rephrased question: \`
   <question>
   What is Docker?
   </question>
   \`

4. Follow-up question: Can you tell me what X is from https://example.com?
   Rephrased question: \`
   <question>
   Can you tell me what X is?
   </question>
   <links>
   https://example.com
   </links>
   \`

5. Follow-up question: Summarize the content from https://example.com.
   Rephrased question: \`
   <question>
   summarize
   </question>
   <links>
   https://example.com
   </links>
   \`
</examples>

Now, using the conversation and follow-up question, rephrase the question following the rules above:

<conversation>
{chat_history}
</conversation>

Follow-up question: {query}
Rephrased question:
`;


const basicWebSearchResponsePrompt = `
You are Perplexica, an AI model skilled at web searches and summarizing web pages or documents.

- Generate a response that is informative, relevant, and unbiased, using the provided search context. 
- Avoid repeating text. Provide the answer directly in your response, using bullet points when appropriate.
- If the user requests links, include them in your answer, but do not direct the user to visit any websites.

For queries that contain links, the \`context\` block will contain the relevant content. Use this to:
  - Answer the user's query.
  - If a summary is requested, provide it using the provided content (already summarized).
  
Responses should be medium to long in length, thoroughly answering the query.

Cite information using [number] notation, where the number refers to the search result used. Cite every part of your answer with its corresponding search result. If a sentence uses multiple sources, cite each one.

Here is the provided search context for reference (not to be mentioned in your response):

<context>
{context}
</context>

If there is no relevant information, respond with: "Hmm, sorry I could not find any relevant information on this topic. Would you like me to search again or ask something else?" (except for summarization tasks).

Today's date is ${new Date().toISOString()}.
`;


const strParser = new StringOutputParser();

const handleStream = async (
  stream: IterableReadableStream<StreamEvent>,
  emitter: eventEmitter,
) => {
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
};

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

const createBasicWebSearchRetrieverChain = (llm: BaseChatModel) => {
  (llm as unknown as ChatOpenAI).temperature = 0;

  return RunnableSequence.from([
    PromptTemplate.fromTemplate(basicSearchRetrieverPrompt),
    llm,
    strParser,
    RunnableLambda.from(async (input: string) => {
      const linksOutputParser = new LineListOutputParser({
        key: 'links',
      });

      const questionOutputParser = new LineOutputParser({
        key: 'question',
      });

      const links = await linksOutputParser.parse(input);
      let question = await questionOutputParser.parse(input);

      if (question === 'not_needed') {
        return { query: '', docs: [] };
      }

      if (links.length > 0) {
        if (question.length === 0) {
          question = 'summarize';
        }

        let docs = [];

        const linkDocs = await getDocumentsFromLinks({ links });

        const docGroups: Document[] = [];

        linkDocs.map((doc) => {
          const URLDocExists = docGroups.find(
            (d) =>
              d.metadata.url === doc.metadata.url && d.metadata.totalDocs < 10,
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
              d.metadata.url === doc.metadata.url && d.metadata.totalDocs < 10,
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
              You are a web search summarizer, tasked with condensing and explaining text retrieved from a web search into a detailed and concise summary.
              
              **Instructions:**
              - Summarize the provided text into a 2-4 paragraph explanation that directly addresses the query. If the query asks for a summary, ensure you give a comprehensive yet concise summary of the text.
              - If the query is a specific question, answer it within the summary, making sure the key ideas from the text are covered.
              - The tone should be **professional** and **journalistic**. Avoid casual language or vagueness.
              - Provide **thorough and detailed** summaries. Ensure every major point from the text is included and answer the query directly.
              - The summary should be **informative** but **not overly long**. Focus on clarity and conciseness without losing key details.
              
              **Text format:**
              The provided text will be enclosed within the \`<text>\` XML tag, and the query will be inside the \`<query>\` XML tag.
              
              ### Examples:
              
              1. **Example 1:**
                 \`\`<text>
                 Docker is a set of platform-as-a-service products that use OS-level virtualization to deliver software in packages called containers. 
                 It was first released in 2013 and is developed by Docker, Inc. Docker is designed to make it easier to create, deploy, and run applications 
                 by using containers.
                 </text>
                 <query>
                 What is Docker and how does it work?
                 </query>
                 
                 **Response:**  
                 Docker is a platform-as-a-service product developed by Docker, Inc., utilizing container technology to streamline application deployment. Released in 2013, it enables developers to package software along with necessary dependencies, making deployment easier across different environments.
                 \`\`
              
              2. **Example 2:**
                 \`\`<text>
                 The theory of relativity, or simply relativity, encompasses two interrelated theories of Albert Einstein: special relativity and general
                 relativity. Special relativity applies to all physical phenomena in the absence of gravity, while general relativity explains gravitation and its relation to other forces. The term "theory of relativity" was coined based on Max Planck’s expression “relative theory” in 1906.
                 </text>
                 <query>
                 summarize
                 </query>
                 
                 **Response:**  
                 The theory of relativity, formulated by Albert Einstein, consists of two major theories: special relativity, which addresses physical phenomena in the absence of gravity, and general relativity, which explains the law of gravitation and its relation to other forces. The term was first coined by Max Planck in 1906. These theories have fundamentally transformed our understanding of the universe.
                 \`\`
              
              ### Now, below is the actual data you will be working with:
              
              <query>
              ${question}
              </query>
              
              <text>
              ${doc.pageContent}
              </text>
              
              Make sure to respond directly to the query in the summary.
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
        const res = await searchSearxng(question, {
          language: 'en',
        });

        const documents = res.results.map(
          (result) =>
            new Document({
              pageContent: result.content,
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
};

const createBasicWebSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
  optimizationMode: 'speed' | 'balanced' | 'quality',
) => {
  const basicWebSearchRetrieverChain = createBasicWebSearchRetrieverChain(llm);

  const processDocs = async (docs: Document[]) => {
    return docs
      .map((_, index) => `${index + 1}. ${docs[index].pageContent}`)
      .join('\n');
  };

  const rerankDocs = async ({
    query,
    docs,
  }: {
    query: string;
    docs: Document[];
  }) => {
    if (docs.length === 0) {
      return docs;
    }

    if (query.toLocaleLowerCase() === 'summarize') {
      return docs;
    }

    const docsWithContent = docs.filter(
      (doc) => doc.pageContent && doc.pageContent.length > 0,
    );

    if (optimizationMode === 'speed') {
      return docsWithContent.slice(0, 15);
    } else if (optimizationMode === 'balanced') {
      const [docEmbeddings, queryEmbedding] = await Promise.all([
        embeddings.embedDocuments(
          docsWithContent.map((doc) => doc.pageContent),
        ),
        embeddings.embedQuery(query),
      ]);

      const similarity = docEmbeddings.map((docEmbedding, i) => {
        const sim = computeSimilarity(queryEmbedding, docEmbedding);

        return {
          index: i,
          similarity: sim,
        };
      });

      const sortedDocs = similarity
        .filter((sim) => sim.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 15)
        .map((sim) => docsWithContent[sim.index]);

      return sortedDocs;
    }
  };

  return RunnableSequence.from([
    RunnableMap.from({
      query: (input: BasicChainInput) => input.query,
      chat_history: (input: BasicChainInput) => input.chat_history,
      context: RunnableSequence.from([
        (input) => ({
          query: input.query,
          chat_history: formatChatHistoryAsString(input.chat_history),
        }),
        basicWebSearchRetrieverChain
          .pipe(rerankDocs)
          .withConfig({
            runName: 'FinalSourceRetriever',
          })
          .pipe(processDocs),
      ]),
    }),
    ChatPromptTemplate.fromMessages([
      ['system', basicWebSearchResponsePrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    strParser,
  ]).withConfig({
    runName: 'FinalResponseGenerator',
  });
};

const basicWebSearch = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
  optimizationMode: 'speed' | 'balanced' | 'quality',
) => {
  const emitter = new eventEmitter();

  try {
    const basicWebSearchAnsweringChain = createBasicWebSearchAnsweringChain(
      llm,
      embeddings,
      optimizationMode,
    );

    const stream = basicWebSearchAnsweringChain.streamEvents(
      {
        chat_history: history,
        query: query,
      },
      {
        version: 'v1',
      },
    );

    handleStream(stream, emitter);
  } catch (err) {
    emitter.emit(
      'error',
      JSON.stringify({ data: 'An error has occurred please try again later' }),
    );
    logger.error(`Error in websearch: ${err}`);
  }

  return emitter;
};

const handleWebSearch = (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
  optimizationMode: 'speed' | 'balanced' | 'quality',
) => {
  const emitter = basicWebSearch(
    message,
    history,
    llm,
    embeddings,
    optimizationMode,
  );
  return emitter;
};

export default handleWebSearch;
