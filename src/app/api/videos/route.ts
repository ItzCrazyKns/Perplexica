import handleVideoSearch from '@/lib/chains/videoSearchAgent';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { getAvailableChatModelProviders } from '@/lib/providers';
import { getSystemInstructionsOnly } from '@/lib/utils/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';

interface ChatModel {
  provider: string;
  model: string;
  ollamaContextWindow?: number;
}

interface VideoSearchBody {
  query: string;
  chatHistory: any[];
  chatModel?: ChatModel;
  selectedSystemPromptIds?: string[];
}

export const POST = async (req: Request) => {
  try {
    const body: VideoSearchBody = await req.json();

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
        openAIApiKey: getCustomOpenaiApiKey(),
        modelName: getCustomOpenaiModelName(),
        temperature: 0.7,
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

    let systemInstructions = '';
    if (
      body.selectedSystemPromptIds &&
      body.selectedSystemPromptIds.length > 0
    ) {
      try {
        const retrievedInstructions = await getSystemInstructionsOnly(
          body.selectedSystemPromptIds,
        );
        systemInstructions = retrievedInstructions;
      } catch (error) {
        console.error('Error retrieving system prompts:', error);
        // Continue with existing systemInstructions as fallback
      }
    }

    const videos = await handleVideoSearch(
      {
        chat_history: chatHistory,
        query: body.query,
      },
      llm,
      systemInstructions,
    );

    return Response.json({ videos }, { status: 200 });
  } catch (err) {
    console.error(`An error occurred while searching videos: ${err}`);
    return Response.json(
      { message: 'An error occurred while searching videos' },
      { status: 500 },
    );
  }
};
