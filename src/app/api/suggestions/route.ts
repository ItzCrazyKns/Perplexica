import generateSuggestions from '@/lib/chains/suggestionGeneratorAgent';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { getAvailableChatModelProviders } from '@/lib/providers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';

interface ChatModel {
  provider: string;
  model: string;
  ollamaContextWindow?: number;
}

interface SuggestionsGenerationBody {
  chatHistory: any[];
  chatModel?: ChatModel;
  selectedSystemPromptIds?: string[];
}

export const POST = async (req: Request) => {
  try {
    const body: SuggestionsGenerationBody = await req.json();

    const chatHistory = body.chatHistory
      .map((msg: any) => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        }
      })
      .filter((msg) => msg !== undefined) as BaseMessage[];

    const chatModelProviders = await getAvailableChatModelProviders();

    const chatModelProvider =
      chatModelProviders[
        body.chatModel?.provider || Object.keys(chatModelProviders)[0]
      ];
    const chatModel =
      chatModelProvider[
        body.chatModel?.model || Object.keys(chatModelProvider)[0]
      ];

    let llm: BaseChatModel | undefined;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        apiKey: getCustomOpenaiApiKey(),
        modelName: getCustomOpenaiModelName(),
        // temperature: 0.7,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (chatModelProvider && chatModel) {
      llm = chatModel.model;
      // Set context window size for Ollama models
      if (llm instanceof ChatOllama && body.chatModel?.provider === 'ollama') {
        llm.numCtx = body.chatModel.ollamaContextWindow || 2048;
      }
    }

    if (!llm) {
      return Response.json({ error: 'Invalid chat model' }, { status: 400 });
    }

    const suggestions = await generateSuggestions(
      {
        chat_history: chatHistory,
      },
      llm,
    );

    return Response.json({ suggestions }, { status: 200 });
  } catch (err) {
    console.error(`An error occurred while generating suggestions: ${err}`);
    return Response.json(
      { message: 'An error occurred while generating suggestions' },
      { status: 500 },
    );
  }
};
