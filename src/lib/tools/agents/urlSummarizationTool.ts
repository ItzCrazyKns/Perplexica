import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { Document } from 'langchain/document';
import { getWebContent } from '@/lib/utils/documents';
import { removeThinkingBlocks } from '@/lib/utils/contentUtils';

// Schema for URL summarization tool input
const URLSummarizationToolSchema = z.object({
  urls: z.array(z.string()).describe('Array of URLs to process and summarize'),
  query: z
    .string()
    .describe('The user query to guide content extraction and summarization'),
  intent: z
    .string()
    .optional()
    .default('extract relevant content')
    .describe('Processing intent for the URLs'),
});

/**
 * URLSummarizationTool - Reimplementation of URLSummarizationAgent as a tool
 *
 * This tool handles:
 * 1. Fetching content from provided URLs
 * 2. Deciding whether to use content directly or summarize it
 * 3. Generating summaries using LLM when content is too long
 * 4. Returning processed documents with metadata
 */
export const urlSummarizationTool = tool(
  async (
    input: z.infer<typeof URLSummarizationToolSchema>,
    config?: RunnableConfig,
  ): Promise<{
    relevantDocuments: Document[];
    processedUrls: number;
    successfulExtractions: number;
  }> => {
    try {
      const { urls, query, intent = 'extract relevant content' } = input;

      console.log(
        `URLSummarizationTool: Processing ${urls.length} URLs for query: "${query}"`,
      );
      console.log(`URLSummarizationTool: Processing intent: ${intent}`);

      if (!urls || urls.length === 0) {
        console.log('URLSummarizationTool: No URLs provided for processing');
        return {
          relevantDocuments: [],
          processedUrls: 0,
          successfulExtractions: 0,
        };
      }

      // Get LLM from config
      if (!config?.configurable?.llm) {
        throw new Error('LLM not available in config');
      }

      const llm = config.configurable.llm;
      const documents: Document[] = [];

      // Process each URL
      for (const url of urls) {
        if (config?.signal?.aborted) {
          console.warn('URLSummarizationTool: Operation aborted by signal');
          break;
        }

        try {
          console.log(`URLSummarizationTool: Processing ${url}`);

          // Fetch full content using the enhanced web content retrieval
          const webContent = await getWebContent(url, true);

          if (!webContent || !webContent.pageContent) {
            console.warn(
              `URLSummarizationTool: No content retrieved from URL: ${url}`,
            );
            continue;
          }

          const contentLength = webContent.pageContent.length;
          let finalContent: string;
          let processingType: string;

          // If content is short (< 4000 chars), use it directly; otherwise summarize
          if (contentLength < 4000) {
            finalContent = webContent.pageContent;
            processingType = 'url-direct-content';

            console.log(
              `URLSummarizationTool: Content is short (${contentLength} chars), using directly without summarization`,
            );
          } else {
            // Content is long, summarize using LLM
            console.log(
              `URLSummarizationTool: Content is long (${contentLength} chars), generating summary`,
            );

            const systemPrompt = config.configurable?.systemInstructions
              ? `${config.configurable.systemInstructions}\n\n`
              : '';

            const summarizationPrompt = `${systemPrompt}You are a web content processor. Extract and summarize ONLY the information from the provided web page content that is relevant to the user's query.

# Critical Instructions
- Output ONLY a summary of the web page content provided below
- Focus on information that relates to or helps answer the user's query
- Do NOT add pleasantries, greetings, or conversational elements
- Do NOT mention missing URLs, other pages, or content not provided
- Do NOT ask follow-up questions or suggest additional actions
- Do NOT add commentary about the user's request or query
- Present the information in a clear, well-structured format with key facts and details
- Include all relevant details that could help answer the user's question

# User's Query: ${query}

# Content Title: ${webContent.metadata.title || 'Web Page'}
# Content URL: ${url}

# Web Page Content to Summarize:
${webContent.pageContent}

Provide a comprehensive summary of the above web page content, focusing on information relevant to the user's query:`;

            const result = await llm.invoke(summarizationPrompt, {
              signal: config?.signal,
            });

            finalContent = removeThinkingBlocks(result.content as string);
            processingType = 'url-content-extraction';
          }

          if (finalContent && finalContent.trim().length > 0) {
            const document = new Document({
              pageContent: finalContent,
              metadata: {
                title: webContent.metadata.title || 'URL Content',
                url: url,
                source: url,
                processingType: processingType,
                processingIntent: intent,
                originalContentLength: contentLength,
                searchQuery: query,
              },
            });

            documents.push(document);

            console.log(
              `URLSummarizationTool: Successfully processed content from ${url} (${finalContent.length} characters, ${processingType})`,
            );
          } else {
            console.warn(
              `URLSummarizationTool: No valid content generated for URL: ${url}`,
            );
          }
        } catch (error) {
          console.error(
            `URLSummarizationTool: Error processing URL ${url}:`,
            error,
          );
          continue;
        }
      }

      console.log(
        `URLSummarizationTool: Successfully processed ${documents.length} out of ${urls.length} URLs`,
      );

      return {
        relevantDocuments: documents,
        processedUrls: urls.length,
        successfulExtractions: documents.length,
      };
    } catch (error) {
      console.error(
        'URLSummarizationTool: Error during URL processing:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Return empty results on error, but don't throw to allow graceful handling
      return {
        relevantDocuments: [],
        processedUrls: input.urls?.length || 0,
        successfulExtractions: 0,
      };
    }
  },
  {
    name: 'url_summarization',
    description:
      'Fetches content from URLs and either uses it directly or summarizes it based on length, focusing on information relevant to the user query',
    schema: URLSummarizationToolSchema,
  },
);
