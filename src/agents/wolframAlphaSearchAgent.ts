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
import logger from '../utils/logger';
import { IterableReadableStream } from '@langchain/core/utils/stream';

const basicWolframAlphaSearchRetrieverPrompt = `
You will be given a conversation and a follow-up question. Rephrase the follow-up question to make it a standalone question that can be used by the LLM to search Wolfram Alpha for information.

- If the question is related to a writing task or simple greetings (e.g., "Hi", "Hello"), return \`not_needed\` as the response.

Examples:
1. Follow-up question: What is the atomic radius of S?
   Rephrased: Atomic radius of S

2. Follow-up question: What is linear algebra?
   Rephrased: Linear algebra

3. Follow-up question: What is the third law of thermodynamics?
   Rephrased: Third law of thermodynamics

Conversation:
{chat_history}

Follow-up question: {query}
Rephrased question:
`;


const basicWolframAlphaSearchResponsePrompt = `
You are Perplexica, an AI model expert at searching the web using Wolfram Alpha, a computational knowledge engine that answers factual queries and performs computations.

- Use the provided context to generate an informative, unbiased response that directly answers the user's query. Do not simply repeat the text from the context.
- Your response should be informative and relevant, in a medium to long format. Use markdown to format your response and bullet points if necessary.
- Cite each part of your response using [number] notation, where each number corresponds to the relevant context source.

Examples:
- If relevant, cite sentences with multiple context numbers, like [number1][number2].
- Do not ask the user to visit a website or open links; provide the answer within the response.

You must always cite the relevant context information provided below. Anything inside the \`context\` block is from Wolfram Alpha and is not part of the user’s conversation.

<context>
{context}
</context>

If the search results do not contain relevant information, respond with: "Hmm, sorry I could not find any relevant information on this topic. Would you like me to search again or ask something else?"

Today's date is ${new Date().toISOString()}
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

const createBasicWolframAlphaSearchRetrieverChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(basicWolframAlphaSearchRetrieverPrompt),
    llm,
    strParser,
    RunnableLambda.from(async (input: string) => {
      if (input === 'not_needed') {
        return { query: '', docs: [] };
      }

      const res = await searchSearxng(input, {
        language: 'en',
        engines: ['wolframalpha'],
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

      return { query: input, docs: documents };
    }),
  ]);
};

const createBasicWolframAlphaSearchAnsweringChain = (llm: BaseChatModel) => {
  const basicWolframAlphaSearchRetrieverChain =
    createBasicWolframAlphaSearchRetrieverChain(llm);

  const processDocs = (docs: Document[]) => {
    return docs
      .map((_, index) => `${index + 1}. ${docs[index].pageContent}`)
      .join('\n');
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
        basicWolframAlphaSearchRetrieverChain
          .pipe(({ query, docs }) => {
            return docs;
          })
          .withConfig({
            runName: 'FinalSourceRetriever',
          })
          .pipe(processDocs),
      ]),
    }),
    ChatPromptTemplate.fromMessages([
      ['system', basicWolframAlphaSearchResponsePrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    strParser,
  ]).withConfig({
    runName: 'FinalResponseGenerator',
  });
};

const basicWolframAlphaSearch = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
) => {
  const emitter = new eventEmitter();

  try {
    const basicWolframAlphaSearchAnsweringChain =
      createBasicWolframAlphaSearchAnsweringChain(llm);
    const stream = basicWolframAlphaSearchAnsweringChain.streamEvents(
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
    logger.error(`Error in WolframAlphaSearch: ${err}`);
  }

  return emitter;
};

const handleWolframAlphaSearch = (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const emitter = basicWolframAlphaSearch(message, history, llm);
  return emitter;
};

export default handleWolframAlphaSearch;
