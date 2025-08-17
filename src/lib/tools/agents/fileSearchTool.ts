import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { Document } from 'langchain/document';
import { Embeddings } from '@langchain/core/embeddings';
import { Command, getCurrentTaskInput } from '@langchain/langgraph';
import { ToolMessage } from '@langchain/core/messages';
import { SimplifiedAgentStateType } from '@/lib/state/chatAgentState';
import {
  processFilesToDocuments,
  getRankedDocs,
} from '@/lib/utils/fileProcessing';

// Schema for file search tool input
const FileSearchToolSchema = z.object({
  query: z
    .string()
    .describe('The search query to find relevant content in files'),
  maxResults: z
    .number()
    .optional()
    .default(12)
    .describe('Maximum number of results to return'),
  similarityThreshold: z
    .number()
    .optional()
    .default(0.3)
    .describe('Minimum similarity threshold for results'),
});

/**
 * FileSearchTool - Reimplementation of FileSearchAgent as a tool
 *
 * This tool handles:
 * 1. Processing uploaded files into searchable documents
 * 2. Performing similarity search across file content
 * 3. Ranking and filtering results by relevance
 * 4. Returning relevant file sections as documents
 */
export const fileSearchTool = tool(
  async (
    input: z.infer<typeof FileSearchToolSchema>,
    config?: RunnableConfig,
  ) => {
    try {
      const { query, maxResults = 12, similarityThreshold = 0.3 } = input;

      const currentState = getCurrentTaskInput() as SimplifiedAgentStateType;
      let currentDocCount = currentState.relevantDocuments.length;

      // Get fileIds from config (provided by the agent)
      const fileIds: string[] = config?.configurable?.fileIds || [];

      console.log(
        `FileSearchTool: Processing ${fileIds.length} files for query: "${query}"`,
      );

      // Check if we have files to process
      if (!fileIds || fileIds.length === 0) {
        console.log('FileSearchTool: No files provided for search');
        return new Command({
          update: {
            relevantDocuments: [],
            messages: [
              new ToolMessage({
                content: 'No files attached to search.',
                tool_call_id: (config as any)?.toolCall.id,
              }),
            ],
          },
        });
      }

      // Get embeddings from config
      if (!config?.configurable?.embeddings) {
        throw new Error('Embeddings not available in config');
      }

      const embeddings: Embeddings = config.configurable.embeddings;

      // Step 1: Process files to documents
      console.log('FileSearchTool: Processing files to documents...');
      const fileDocuments = await processFilesToDocuments(fileIds);

      if (fileDocuments.length === 0) {
        console.log('FileSearchTool: No processable content found in files');
        return new Command({
          update: {
            relevantDocuments: [],
            messages: [
              new ToolMessage({
                content: 'No searchable content found in attached files.',
                tool_call_id: (config as any)?.toolCall.id,
              }),
            ],
          },
        });
      }

      console.log(
        `FileSearchTool: Processed ${fileDocuments.length} file sections`,
      );

      // Step 2: Generate query embedding for similarity search
      console.log('FileSearchTool: Generating query embedding...');
      const queryEmbedding = await embeddings.embedQuery(query);

      // Step 3: Perform similarity search and ranking
      console.log('FileSearchTool: Performing similarity search...');
      const rankedDocuments = getRankedDocs(
        queryEmbedding,
        fileDocuments,
        maxResults,
        similarityThreshold,
      );

      console.log(
        `FileSearchTool: Found ${rankedDocuments.length} relevant file sections`,
      );

      // Add search metadata to documents and remove embeddings to reduce context size
      const documentsWithMetadata = rankedDocuments.map((doc) => {
        // Extract metadata and exclude embeddings
        const { embeddings: _, ...metadataWithoutEmbeddings } =
          doc.metadata || {};

        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...metadataWithoutEmbeddings,
            sourceId: ++currentDocCount,
            source: 'file_search',
            searchQuery: query,
            similarityScore: doc.metadata?.similarity || 0,
          },
        });
      });

      console.log(
        `FileSearchTool: Created ${documentsWithMetadata.length} documents from file search`,
      );

      return new Command({
        update: {
          relevantDocuments: documentsWithMetadata,
          messages: [
            new ToolMessage({
              content: JSON.stringify({
                documents: documentsWithMetadata,
                processedFiles: fileIds.length,
                relevantSections: rankedDocuments.length,
              }),
              tool_call_id: (config as any)?.toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      console.error('FileSearchTool: Error during file search:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return new Command({
        update: {
          relevantDocuments: [],
          messages: [
            new ToolMessage({
              content: 'Error occurred during file search: ' + errorMessage,
              tool_call_id: (config as any)?.toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: 'file_search',
    description:
      'Searches through all uploaded files to find relevant content sections based on a query using semantic similarity. Automatically searches all available files - no need to specify file IDs.',
    schema: FileSearchToolSchema,
  },
);
