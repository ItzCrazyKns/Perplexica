import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { withStructuredOutput } from '@/lib/utils/structuredOutput';
import { PromptTemplate } from '@langchain/core/prompts';
import { webSearchRetrieverAgentPrompt } from '@/lib/prompts/webSearch';
import { searchSearxng } from '@/lib/searxng';
import { formatDateForLLM } from '@/lib/utils';
import { Document } from 'langchain/document';
import computeSimilarity from '@/lib/utils/computeSimilarity';
import { Command, getCurrentTaskInput } from '@langchain/langgraph';
import { ToolMessage } from '@langchain/core/messages';
import { SimplifiedAgentStateType } from '@/lib/state/chatAgentState';
import { isSoftStop } from '@/lib/utils/runControl';
import { CachedEmbeddings } from '@/lib/utils/cachedEmbeddings';

// Schema for search query generation
const SearchQuerySchema = z.object({
  searchQuery: z
    .string()
    .describe('The optimized search query to use for web search'),
  reasoning: z
    .string()
    .describe(
      'A short explanation of how the search query was optimized for better results',
    ),
});

// Schema for simple web search tool input
const SimpleWebSearchToolSchema = z.object({
  query: z.string().describe('The search query or task to process'),
  searchInstructions: z
    .string()
    .optional()
    .describe('Additional instructions for search refinement'),
  context: z
    .string()
    .optional()
    .describe('Additional context about the search'),
});

/**
 * SimpleWebSearchTool - Simplified version of WebSearchTool
 *
 * This tool handles:
 * 1. Query optimization for web search
 * 2. Web search execution using SearXNG
 * 3. Document ranking and filtering (top 15: top 3 + ranked top 12)
 * 4. Returns raw search results as documents without analysis or content extraction
 */
export const simpleWebSearchTool = tool(
  async (
    input: z.infer<typeof SimpleWebSearchToolSchema>,
    config?: RunnableConfig,
  ) => {
    try {
      const { query, searchInstructions, context = '' } = input;
      const currentState = getCurrentTaskInput() as SimplifiedAgentStateType;
      let currentDocCount = currentState.relevantDocuments.length;

      // Get LLM and embeddings from config
      if (!config?.configurable?.systemLlm) {
        throw new Error('System LLM not available in config');
      }
      if (!config?.configurable?.embeddings) {
        throw new Error('Embeddings not available in config');
      }

      const llm = config.configurable.systemLlm;
      const embeddings: CachedEmbeddings = config.configurable.embeddings;
      const retrievalSignal: AbortSignal | undefined = (config as any)
        ?.configurable?.retrievalSignal;
      const messageId: string | undefined = (config as any)?.configurable
        ?.messageId;

      const searchQuery = query;
      console.log(
        `SimpleWebSearchTool: Performing web search for query: "${searchQuery}"`,
      );

      // Step 2: Execute web search
      if (messageId && isSoftStop(messageId)) {
        return new Command({
          update: {
            relevantDocuments: [],
            messages: [
              new ToolMessage({
                content: 'Soft-stop set; skipping web search.',
                tool_call_id: (config as any)?.toolCall.id,
              }),
            ],
          },
        });
      }

      const searchResults = await searchSearxng(
        searchQuery,
        {
          language: 'en',
          engines: [],
        },
        retrievalSignal,
      );

      console.log(
        `SimpleWebSearchTool: Found ${searchResults.results.length} search results`,
      );

      if (!searchResults.results || searchResults.results.length === 0) {
        return new Command({
          update: {
            relevantDocuments: [],
            messages: [
              new ToolMessage({
                content: 'No search results found.',
                tool_call_id: (config as any)?.toolCall.id,
              }),
            ],
          },
        });
      }

      // Step 3: Calculate similarities and rank results
      const queryVector = await embeddings.embedQuery(query);

      // Calculate similarities for all results
      const resultsWithSimilarity = await Promise.all(
        searchResults.results.map(async (result) => {
          const content = result.title + ' ' + (result.content || '');
          const vector = await embeddings.embedQuery(content);
          const similarity = computeSimilarity(vector, queryVector);
          return { result, similarity };
        }),
      );

      const documents: Document[] = [];

      // Always take the top 3 results first
      const top3Results = searchResults.results.slice(0, 3);
      documents.push(
        ...top3Results.map((result, i) => {
          return new Document({
            pageContent: `${result.title || 'Untitled'}\n\n${result.content || ''}`,
            metadata: {
              sourceId: ++currentDocCount,
              title: result.title || 'Untitled',
              url: result.url,
              source: result.url,
              processingType: 'preview-only',
              searchQuery: searchQuery,
              rank: 'top-3',
            },
          });
        }),
      );

      // Sort by relevance score and take top 5 from the remaining results
      const remainingResults = resultsWithSimilarity
        .slice(3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      documents.push(
        ...remainingResults.map(({ result }) => {
          return new Document({
            pageContent: `${result.title || 'Untitled'}\n\n${result.content || ''}`,
            metadata: {
              sourceId: ++currentDocCount,
              title: result.title || 'Untitled',
              url: result.url,
              source: result.url,
              processingType: 'preview-only',
              searchQuery: searchQuery,
              rank: 'ranked',
            },
          });
        }),
      );

      console.log(
        `SimpleWebSearchTool: Created ${documents.length} documents from search results`,
      );

      //return { documents };
      return new Command({
        update: {
          relevantDocuments: documents,
          messages: [
            new ToolMessage({
              content: JSON.stringify({
                document: documents,
              }),
              tool_call_id: (config as any)?.toolCall.id,
            }),
          ],
        },
      });
    } catch (error: any) {
      console.error('SimpleWebSearchTool: Error during web search:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Treat abort as non-fatal/no-op update
      if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
        return new Command({
          update: {
            relevantDocuments: [],
            messages: [
              new ToolMessage({
                content: 'Web search aborted by soft-stop.',
                tool_call_id: (config as any)?.toolCall.id,
              }),
            ],
          },
        });
      }

      //return { documents: [] };
      return new Command({
        update: {
          relevantDocuments: [],
          messages: [
            new ToolMessage({
              content: 'Error occurred during web search: ' + errorMessage,
              tool_call_id: (config as any)?.toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: 'web_search',
    description:
      'Performs web search using SearXNG and returns ranked search results as documents without content analysis or extraction',
    schema: SimpleWebSearchToolSchema,
  },
);
