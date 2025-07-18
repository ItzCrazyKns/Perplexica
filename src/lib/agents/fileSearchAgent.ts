import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { Document } from 'langchain/document';
import { AgentState } from './agentState';
import { Embeddings } from '@langchain/core/embeddings';
import {
  processFilesToDocuments,
  getRankedDocs,
} from '../utils/fileProcessing';

export class FileSearchAgent {
  private llm: BaseChatModel;
  private emitter: EventEmitter;
  private systemInstructions: string;
  private signal: AbortSignal;
  private embeddings: Embeddings;

  constructor(
    llm: BaseChatModel,
    emitter: EventEmitter,
    systemInstructions: string,
    signal: AbortSignal,
    embeddings: Embeddings,
  ) {
    this.llm = llm;
    this.emitter = emitter;
    this.systemInstructions = systemInstructions;
    this.signal = signal;
    this.embeddings = embeddings;
  }

  /**
   * File search agent node
   */
  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      // Determine current task to process
      const currentTask =
        state.tasks && state.tasks.length > 0
          ? state.tasks[state.currentTaskIndex || 0]
          : state.query;

      console.log(
        `Processing file search for task ${(state.currentTaskIndex || 0) + 1} of ${state.tasks?.length || 1}: "${currentTask}"`,
      );

      // Check if we have file IDs to process
      if (!state.fileIds || state.fileIds.length === 0) {
        console.log('No files attached for search');
        return new Command({
          goto: 'analyzer',
          update: {
            messages: [new AIMessage('No files attached to search.')],
          },
        });
      }

      // Emit consulting attached files event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'CONSULTING_ATTACHED_FILES',
          message: `Consulting attached files...`,
          details: {
            query: state.query,
            currentTask: currentTask,
            taskIndex: (state.currentTaskIndex || 0) + 1,
            totalTasks: state.tasks?.length || 1,
            fileCount: state.fileIds.length,
            documentCount: state.relevantDocuments.length,
          },
        },
      });

      // Process files to documents
      const fileDocuments = await processFilesToDocuments(state.fileIds);

      if (fileDocuments.length === 0) {
        console.log('No processable file content found');
        return new Command({
          goto: 'analyzer',
          // update: {
          //   messages: [
          //     new AIMessage('No searchable content found in attached files.'),
          //   ],
          // },
        });
      }

      console.log(
        `Processed ${fileDocuments.length} file documents for search`,
      );

      // Emit searching file content event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'SEARCHING_FILE_CONTENT',
          message: `Searching through ${fileDocuments.length} file sections for relevant information`,
          details: {
            query: state.query,
            currentTask: currentTask,
            taskIndex: (state.currentTaskIndex || 0) + 1,
            totalTasks: state.tasks?.length || 1,
            fileDocumentCount: fileDocuments.length,
            documentCount: state.relevantDocuments.length,
          },
        },
      });

      // Generate query embedding for similarity search
      const queryEmbedding = await this.embeddings.embedQuery(
        state.originalQuery + ' ' + currentTask,
      );

      // Perform similarity search over file documents
      const rankedDocuments = getRankedDocs(
        queryEmbedding,
        fileDocuments,
        12, // maxDocs
        0.3, // similarity threshold
      );

      console.log(`Found ${rankedDocuments.length} relevant file sections`);

      if (rankedDocuments.length === 0) {
        // Emit no relevant content event
        this.emitter.emit('agent_action', {
          type: 'agent_action',
          data: {
            action: 'NO_RELEVANT_FILE_CONTENT',
            message: `No relevant content found in attached files for the current task`,
            details: {
              query: state.query,
              currentTask: currentTask,
              taskIndex: (state.currentTaskIndex || 0) + 1,
              totalTasks: state.tasks?.length || 1,
              searchedDocuments: fileDocuments.length,
              documentCount: state.relevantDocuments.length,
            },
          },
        });

        return new Command({
          goto: 'analyzer',
          // update: {
          //   messages: [
          //     new AIMessage(
          //       'No relevant content found in attached files for the current task.',
          //     ),
          //   ],
          // },
        });
      }

      // Emit file content found event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'FILE_CONTENT_FOUND',
          message: `Found ${rankedDocuments.length} relevant sections in attached files`,
          details: {
            query: state.query,
            currentTask: currentTask,
            taskIndex: (state.currentTaskIndex || 0) + 1,
            totalTasks: state.tasks?.length || 1,
            relevantSections: rankedDocuments.length,
            searchedDocuments: fileDocuments.length,
            documentCount:
              state.relevantDocuments.length + rankedDocuments.length,
          },
        },
      });

      const responseMessage = `File search completed. Found ${rankedDocuments.length} relevant sections in attached files.`;
      console.log(responseMessage);

      return new Command({
        goto: 'analyzer', // Route back to analyzer to process the results
        update: {
          // messages: [new AIMessage(responseMessage)],
          relevantDocuments: rankedDocuments,
        },
      });
    } catch (error) {
      console.error('File search error:', error);
      const errorMessage = new AIMessage(
        `File search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    }
  }

  /**
   * Perform a similarity search over file documents
   * @param state The current agent state
   * @returns Ranked documents relevant to the current task
   */
  async search(state: typeof AgentState.State): Promise<Document[]> {
    if (!state.fileIds || state.fileIds.length === 0) {
      return [];
    }

    // Process files to documents
    const fileDocuments = await processFilesToDocuments(state.fileIds);

    if (fileDocuments.length === 0) {
      return [];
    }

    // Determine current task to search for
    const currentTask =
      state.tasks && state.tasks.length > 0
        ? state.tasks[state.currentTaskIndex || 0]
        : state.query;

    // Generate query embedding for similarity search
    const queryEmbedding = await this.embeddings.embedQuery(
      state.originalQuery + ' ' + currentTask,
    );

    // Perform similarity search and return ranked documents
    return getRankedDocs(
      queryEmbedding,
      fileDocuments,
      8, // maxDocs
      0.3, // similarity threshold
    );
  }
}
