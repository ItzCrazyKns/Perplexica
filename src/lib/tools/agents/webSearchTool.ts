import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { withStructuredOutput } from '@/lib/utils/structuredOutput';
import { PromptTemplate } from '@langchain/core/prompts';
import { webSearchRetrieverAgentPrompt } from '@/lib/prompts/webSearch';
import { searchSearxng } from '@/lib/searxng';
import { formatDateForLLM } from '@/lib/utils';
import { summarizeWebContent } from '@/lib/utils/summarizeWebContent';
import {
  analyzePreviewContent,
  PreviewContent,
} from '@/lib/utils/analyzePreviewContent';
import { Document } from 'langchain/document';
import { Embeddings } from '@langchain/core/embeddings';
import computeSimilarity from '@/lib/utils/computeSimilarity';
import { removeThinkingBlocksFromMessages } from '@/lib/utils/contentUtils';

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

// Schema for web search tool input
const WebSearchToolSchema = z.object({
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
 * WebSearchTool - Reimplementation of WebSearchAgent as a tool
 *
 * This tool handles:
 * 1. Query optimization for web search
 * 2. Web search execution using SearXNG
 * 3. Content extraction and summarization
 * 4. Document ranking and filtering
 */
export const webSearchTool = tool(
  async (
    input: z.infer<typeof WebSearchToolSchema>,
    config?: RunnableConfig,
  ): Promise<{
    documents: Document[];
    searchQuery: string;
    reasoning: string;
    sourcesFound: number;
    relevantDocuments?: any[];
  }> => {
    try {
      const { query, searchInstructions, context = '' } = input;

      // Get LLM and embeddings from config
      if (!config?.configurable?.llm) {
        throw new Error('LLM not available in config');
      }
      if (!config?.configurable?.embeddings) {
        throw new Error('Embeddings not available in config');
      }

      const llm = config.configurable.llm;
      const embeddings: Embeddings = config.configurable.embeddings;

      // Step 1: Generate optimized search query
      const template = PromptTemplate.fromTemplate(
        webSearchRetrieverAgentPrompt,
      );
      const prompt = await template.format({
        systemInstructions:
          config.configurable?.systemInstructions ||
          'You are a helpful AI assistant.',
        query: query,
        date: formatDateForLLM(new Date()),
        supervisor: searchInstructions || query,
      });

      // Use structured output for search query generation
      const structuredLlm = withStructuredOutput(llm, SearchQuerySchema, {
        name: 'generate_search_query',
      });

      const searchQueryResult = await structuredLlm.invoke(prompt, {
        signal: config?.signal,
      });

      const searchQuery = searchQueryResult.searchQuery;
      console.log(
        `WebSearchTool: Performing web search for query: "${searchQuery}"`,
      );
      console.log(
        'WebSearchTool: Search query reasoning:',
        searchQueryResult.reasoning,
      );

      // Step 2: Execute web search
      const searchResults = await searchSearxng(searchQuery, {
        language: 'en',
        engines: [],
      });

      console.log(
        `WebSearchTool: Found ${searchResults.results.length} search results`,
      );

      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          documents: [],
          searchQuery,
          reasoning: searchQueryResult.reasoning,
          sourcesFound: 0,
        };
      }

      // Step 3: Calculate similarities and rank results
      const queryVector = await embeddings.embedQuery(query);

      // Calculate similarities for all results
      const resultsWithSimilarity = await Promise.all(
        searchResults.results.map(async (result) => {
          const vector = await embeddings.embedQuery(
            result.title + ' ' + (result.content || ''),
          );
          const similarity = computeSimilarity(vector, queryVector);
          return { result, similarity };
        }),
      );

      // Step 4: Prepare preview content for analysis
      let previewContents: PreviewContent[] = [];

      // Always take the top 3 results for preview content
      previewContents.push(
        ...searchResults.results.slice(0, 3).map((result) => ({
          title: result.title || 'Untitled',
          snippet: result.content || '',
          url: result.url,
        })),
      );

      // Sort by relevance score and take top 12 results for a total of 15
      previewContents.push(
        ...resultsWithSimilarity
          .slice(3)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 12)
          .map(({ result }) => ({
            title: result.title || 'Untitled',
            snippet: result.content || '',
            url: result.url,
          })),
      );

      console.log(
        `WebSearchTool: Extracted preview content from ${previewContents.length} search results`,
      );

      // Step 5: Analyze preview content to determine processing approach
      let previewAnalysisResult = null;
      let documentsToProcess: any[] = [];

      if (previewContents.length > 0) {
        console.log(
          'WebSearchTool: Analyzing preview content to determine processing approach',
        );

        previewAnalysisResult = await analyzePreviewContent(
          previewContents,
          query,
          query, // taskQuery same as query for tools
          [], // no chat history for tools
          llm,
          config.configurable?.systemInstructions ||
            'You are a helpful AI assistant.',
          config?.signal || new AbortController().signal,
        );

        console.log(
          'WebSearchTool: Preview analysis result:',
          previewAnalysisResult.isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT',
        );

        if (!previewAnalysisResult.isSufficient) {
          // Need full content retrieval - process top similarity results
          documentsToProcess = resultsWithSimilarity
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5)
            .map(({ result }) => result);
        } else {
          // Preview content is sufficient - no need for full content retrieval
          console.log(
            'WebSearchTool: Preview content is sufficient, skipping full content retrieval',
          );
          documentsToProcess = [];
        }
      } else {
        // No preview content, process top results
        documentsToProcess = searchResults.results.slice(0, 5);
      }

      console.log(
        `WebSearchTool: Processing ${documentsToProcess.length} URLs for content extraction`,
      );

      // Step 6: Extract content - either from full URLs or preview content
      const documents: Document[] = [];
      let processedCount = 0;

      if (previewAnalysisResult?.isSufficient) {
        // Create documents from preview content since it's sufficient
        console.log(
          'WebSearchTool: Creating documents from preview content (sufficient for answer)',
        );

        documents.push(
          ...previewContents.map((previewContent) => {
            return new Document({
              pageContent: `${previewContent.title}\n\n${previewContent.snippet}`,
              metadata: {
                title: previewContent.title,
                url: previewContent.url,
                source: previewContent.url,
                processingType: 'preview-content',
                searchQuery: searchQuery,
              },
            });
          }),
        );

        console.log(
          `WebSearchTool: Created ${documents.length} documents from preview content`,
        );
      } else {
        // Extract and summarize content from selected URLs
        for (const result of documentsToProcess) {
          if (processedCount >= 5) break; // Limit processing

          try {
            console.log(`WebSearchTool: Processing ${result.url}`);

            const summaryResult = await summarizeWebContent(
              result.url,
              query,
              llm,
              config.configurable?.systemInstructions ||
                'You are a helpful AI assistant.',
              config?.signal || new AbortController().signal,
            );

            if (summaryResult.document) {
              documents.push(summaryResult.document);
              console.log(
                `WebSearchTool: Successfully extracted content from ${result.url}`,
              );
            } else {
              console.log(
                `WebSearchTool: No relevant content found for ${result.url}: ${summaryResult.notRelevantReason}`,
              );
            }

            processedCount++;
          } catch (error) {
            console.error(
              `WebSearchTool: Error processing ${result.url}:`,
              error,
            );
            continue;
          }
        }

        console.log(
          `WebSearchTool: Successfully extracted ${documents.length} documents from ${processedCount} processed URLs`,
        );
      }

      return {
        documents,
        searchQuery,
        reasoning: searchQueryResult.reasoning,
        sourcesFound: searchResults.results.length,
      };
    } catch (error) {
      console.error('WebSearchTool: Error during web search:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        documents: [],
        searchQuery: input.query,
        reasoning: `Error occurred during web search: ${errorMessage}`,
        sourcesFound: 0,
      };
    }
  },
  {
    name: 'web_search',
    description:
      'Performs web search using SearXNG, analyzes results, and extracts relevant content from top sources',
    schema: WebSearchToolSchema,
  },
);
