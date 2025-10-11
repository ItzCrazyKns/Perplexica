import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, BaseMessageLike } from '@langchain/core/messages';
import eventEmitter from 'events';

export interface Config {
  activeEngines: string[];
  queryGeneratorPrompt: string;
  responsePrompt: string;
  queryGeneratorFewShots: BaseMessageLike[];
  rerank: boolean;
  rerankThreshold?: number;
  searchWeb: boolean;
}

/**
 * Represents the basic input structure for a chain event.
 *
 * This type defines the format of the input data associated with chain events,
 * such as the output or chunk data carried within the event payloads.
 */
export interface BasicChainInput {
  chat_history: BaseMessage[];
  query: string;
}

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
  ) => Promise<eventEmitter>;
}
