import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { getModelName } from '../utils/modelUtils';
import { AgentState } from './agentState';
import { removeThinkingBlocksFromMessages } from '../utils/contentUtils';
import { synthesizerPrompt } from '../prompts/synthesizer';

export class SynthesizerAgent {
  private llm: BaseChatModel;
  private emitter: EventEmitter;
  private personaInstructions: string;
  private signal: AbortSignal;

  constructor(
    llm: BaseChatModel,
    emitter: EventEmitter,
    personaInstructions: string,
    signal: AbortSignal,
  ) {
    this.llm = llm;
    this.emitter = emitter;
    this.personaInstructions = personaInstructions;
    this.signal = signal;
  }

  /**
   * Synthesizer agent node that combines information to answer the query
   */
  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      // Format the prompt using the external template
      const template = PromptTemplate.fromTemplate(synthesizerPrompt);

      const conversationHistory =
        removeThinkingBlocksFromMessages(state.messages)
          .map((msg) => `<${msg.getType()}>${msg.content}</${msg.getType()}>`)
          .join('\n') || 'No previous conversation context';

      const relevantDocuments = state.relevantDocuments
        .map((doc, index) => {
          const isFile = doc.metadata?.url?.toLowerCase().includes('file');
          return `<${index + 1}>\n
    <title>${doc.metadata.title}</title>
    <source_type>${isFile ? 'file' : 'web'}</source_type>
    ${isFile ? '' : '\n<url>' + doc.metadata.url + '</url>'}
    <content>\n${doc.pageContent}\n    </content>
</${index + 1}>`;
        })
        .join('\n');

      const formattedPrompt = await template.format({
        personaInstructions: this.personaInstructions,
        conversationHistory: conversationHistory,
        relevantDocuments: relevantDocuments,
        query: state.originalQuery || state.query,
      });

      // Stream the response in real-time using LLM streaming capabilities
      let fullResponse = '';

      // Emit the sources as a data response
      this.emitter.emit(
        'data',
        JSON.stringify({
          type: 'sources',
          data: state.relevantDocuments,
          searchQuery: '',
          searchUrl: '',
        }),
      );

      const stream = await this.llm.stream(
        [
          new SystemMessage(formattedPrompt),
          new HumanMessage(state.originalQuery || state.query),
        ],
        { signal: this.signal },
      );

      for await (const chunk of stream) {
        if (this.signal.aborted) {
          break;
        }

        const content = chunk.content;
        if (typeof content === 'string' && content.length > 0) {
          fullResponse += content;

          // Emit each chunk as a data response in real-time
          this.emitter.emit(
            'data',
            JSON.stringify({
              type: 'response',
              data: content,
            }),
          );
        }
      }

      // Emit model stats and end signal after streaming is complete
      const modelName = getModelName(this.llm);
      this.emitter.emit(
        'stats',
        JSON.stringify({
          type: 'modelStats',
          data: { modelName },
        }),
      );

      this.emitter.emit('end');

      // Create the final response message with the complete content
      const response = new SystemMessage(fullResponse);

      return new Command({
        goto: END,
        update: {
          messages: [response],
        },
      });
    } catch (error) {
      console.error('Synthesis error:', error);
      const errorMessage = new SystemMessage(
        `Failed to synthesize answer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    }
  }
}
