import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { formatDateForLLM } from '../utils';
import { AgentState } from './agentState';
import { setTemperature } from '../utils/modelUtils';
import {
  additionalUserInputPrompt,
  additionalWebSearchPrompt,
  decideNextActionPrompt,
} from '../prompts/analyzer';
import {
  removeThinkingBlocks,
  removeThinkingBlocksFromMessages,
} from '../utils/contentUtils';

export class AnalyzerAgent {
  private llm: BaseChatModel;
  private emitter: EventEmitter;
  private systemInstructions: string;
  private signal: AbortSignal;

  constructor(
    llm: BaseChatModel,
    emitter: EventEmitter,
    systemInstructions: string,
    signal: AbortSignal,
  ) {
    this.llm = llm;
    this.emitter = emitter;
    this.systemInstructions = systemInstructions;
    this.signal = signal;
  }

  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      setTemperature(this.llm, 0.0);

      // Initialize originalQuery if not set
      if (!state.originalQuery) {
        state.originalQuery = state.query;
      }

      let nextActionContent = 'need_more_info';
      // Skip full analysis if this is the first run.
      //if (state.fullAnalysisAttempts > 0) {
      // Emit initial analysis event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'ANALYZING_CONTEXT',
          message:
            'Analyzing the context to see if we have enough information to answer the query',
          details: {
            documentCount: state.relevantDocuments.length,
            query: state.query,
            searchIterations: state.searchInstructionHistory.length,
          },
        },
      });

      console.log(
        `Analyzing ${state.relevantDocuments.length} documents for relevance...`,
      );

      const nextActionPrompt = await ChatPromptTemplate.fromTemplate(
        decideNextActionPrompt,
      ).format({
        systemInstructions: this.systemInstructions,
        context: state.relevantDocuments
          .map(
            (doc, index) =>
              `<source${index + 1}>${doc?.metadata?.title ? `<title>${doc?.metadata?.title}</title>` : ''}<content>${doc.pageContent}</content></source${index + 1}>`,
          )
          .join('\n\n'),
        date: formatDateForLLM(new Date()),
        searchInstructionHistory: state.searchInstructionHistory
          .map((question) => `- ${question}`)
          .join('\n'),
        query: state.originalQuery || state.query, // Use original query for analysis context
      });

      const thinkingBlocksRemovedMessages = removeThinkingBlocksFromMessages(
        state.messages,
      );

      const nextActionResponse = await this.llm.invoke(
        [...thinkingBlocksRemovedMessages, new HumanMessage(nextActionPrompt)],
        { signal: this.signal },
      );

      nextActionContent = removeThinkingBlocks(
        nextActionResponse.content as string,
      );

      console.log('Next action response:', nextActionContent);
      //}

      if (!nextActionContent.startsWith('good_content')) {
        if (nextActionContent.startsWith('need_user_info')) {
          const moreUserInfoPrompt = await ChatPromptTemplate.fromTemplate(
            additionalUserInputPrompt,
          ).format({
            systemInstructions: this.systemInstructions,
            context: state.relevantDocuments
              .map(
                (doc, index) =>
                  `<source${index + 1}>${doc?.metadata?.title ? `<title>${doc?.metadata?.title}</title>` : ''}<content>${doc.pageContent}</content></source${index + 1}>`,
              )
              .join('\n\n'),
            date: formatDateForLLM(new Date()),
            searchInstructionHistory: state.searchInstructionHistory
              .map((question) => `- ${question}`)
              .join('\n'),
            query: state.originalQuery || state.query, // Use original query for user info context
          });

          const stream = await this.llm.stream(
            [
              ...removeThinkingBlocksFromMessages(state.messages),
              new SystemMessage(moreUserInfoPrompt),
            ],
            { signal: this.signal },
          );

          let fullResponse = '';
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

          this.emitter.emit('end');

          // Create the final response message with the complete content
          const response = new SystemMessage(fullResponse);

          return new Command({
            goto: END,
            update: {
              messages: [response],
            },
          });
        }

        // If we need more information from the LLM, generate a more specific search query
        const moreInfoPrompt = await ChatPromptTemplate.fromTemplate(
          additionalWebSearchPrompt,
        ).format({
          systemInstructions: this.systemInstructions,
          context: state.relevantDocuments
            .map(
              (doc, index) =>
                `<source${index + 1}>${doc?.metadata?.title ? `<title>${doc?.metadata?.title}</title>` : ''}<content>${doc.pageContent}</content></source${index + 1}>`,
            )
            .join('\n\n'),
          date: formatDateForLLM(new Date()),
          searchInstructionHistory: state.searchInstructionHistory
            .map((question) => `- ${question}`)
            .join('\n'),
          query: state.originalQuery || state.query, // Use original query for more info context
        });

        const moreInfoResponse = await this.llm.invoke(
          [
            ...removeThinkingBlocksFromMessages(state.messages),
            new HumanMessage(moreInfoPrompt),
          ],
          { signal: this.signal },
        );

        const moreInfoQuestion = removeThinkingBlocks(
          moreInfoResponse.content as string,
        );

        // Emit reanalyzing event when we need more information
        this.emitter.emit('agent_action', {
          type: 'agent_action',
          data: {
            action: 'MORE_DATA_NEEDED',
            message:
              'Current context is insufficient - analyzing search requirements',
            details: {
              nextSearchQuery: moreInfoQuestion,
              documentCount: state.relevantDocuments.length,
              searchIterations: state.searchInstructionHistory.length,
              query: state.originalQuery || state.query, // Show original query in details
              currentSearchFocus: moreInfoQuestion,
            },
          },
        });

        return new Command({
          goto: 'task_manager',
          update: {
            messages: [
              new AIMessage(
                `The following question can help refine the search: ${moreInfoQuestion}`,
              ),
            ],
            query: moreInfoQuestion, // Use the refined question for TaskManager to analyze
            searchInstructions: moreInfoQuestion,
            searchInstructionHistory: [
              ...(state.searchInstructionHistory || []),
              moreInfoQuestion,
            ],
            fullAnalysisAttempts: 1,
            originalQuery: state.originalQuery || state.query, // Preserve the original user query
            // Reset task list so TaskManager can break down the search requirements again
            tasks: [],
            currentTaskIndex: 0,
          },
        });
      }

      // Emit information gathering complete event when we have sufficient information
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'INFORMATION_GATHERING_COMPLETE',
          message: 'Sufficient information gathered, ready to respond.',
          details: {
            documentCount: state.relevantDocuments.length,
            searchIterations: state.searchInstructionHistory.length,
            totalTasks: state.tasks?.length || 1,
            query: state.originalQuery || state.query,
          },
        },
      });

      return new Command({
        goto: 'synthesizer',
        update: {
          messages: [
            new AIMessage(
              `Analysis completed. We have sufficient information to answer the query.`,
            ),
          ],
        },
      });
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = new AIMessage(
        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    } finally {
      setTemperature(this.llm); // Reset temperature for subsequent actions
    }
  }
}
