import eventEmitter from 'events';
import { ConfigManager } from './ConfigManager';
import { AnswerGenerator } from './AnswerGenerator';
import { StreamHandler } from './StreamHandler';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Config, MetaSearchAgentType } from './types';
import { BaseMessage } from '@langchain/core/messages';

export class MetaSearchAgent implements MetaSearchAgentType {
  private configManager: ConfigManager;
  private answerGenerator: AnswerGenerator;
  private streamHandler?: StreamHandler;

  constructor(
    private config: Config,
    private llm: BaseChatModel,
    private embeddings: Embeddings,
  ) {
    this.configManager = new ConfigManager(this.config);
    this.answerGenerator = new AnswerGenerator(
      this.llm,
      this.configManager,
      this.embeddings,
    );
  }

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
  ): Promise<eventEmitter> {
    const emitter = new eventEmitter();
    this.streamHandler = new StreamHandler(emitter);

    const answeringChain = await this.answerGenerator.createAnsweringChain(
      fileIds,
      optimizationMode,
      systemInstructions,
    );

    const stream = answeringChain.streamEvents(
      { chat_history: history, query: message },
      { version: 'v1' },
    );

    this.streamHandler.handle(stream);

    return emitter;
  }
}
