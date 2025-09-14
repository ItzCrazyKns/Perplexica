import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { Document } from 'langchain/document';
import { getWebContent } from '@/lib/utils/documents';
import { removeThinkingBlocks } from '@/lib/utils/contentUtils';
import { Command, getCurrentTaskInput } from '@langchain/langgraph';
import { SimplifiedAgentStateType } from '@/lib/state/chatAgentState';
import { ToolMessage } from '@langchain/core/messages';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';

// Schema for URL summarization tool input
const URLSummarizationToolSchema = z.object({
  urls: z.array(z.string()).describe('Array of URLs to process and summarize'),
  query: z
    .string()
    .describe('The user query to guide content extraction and summarization'),
  retrieveHtml: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to retrieve the full HTML content of the pages'),
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
  ) => {
    try {
      const {
        urls,
        query,
        retrieveHtml = false,
        intent = 'extract relevant content',
      } = input;

      const currentState = getCurrentTaskInput() as SimplifiedAgentStateType;
      let currentDocCount = currentState.relevantDocuments.length;

      console.log(
        `URLSummarizationTool: Processing ${urls.length} \n  URLs for query: "${query}"\n  retrieveHtml: ${retrieveHtml}\n  intent: ${intent}`,
      );

      if (!urls || urls.length === 0) {
        console.log('URLSummarizationTool: No URLs provided for processing');
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: 'No search results found.',
                tool_call_id: (config as any)?.toolCall.id,
              }),
            ],
          },
        });
      }

      // Get LLM from config
      if (!config?.configurable?.systemLlm) {
        throw new Error('System LLM not available in config');
      }
      const llm = config.configurable.systemLlm;
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
          const webContent = await getWebContent(url, 50000, retrieveHtml);

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

            const summarizationPrompt = `You are a web content processor. Extract and summarize ONLY the information from the provided web page content that is relevant to the user's query.

# Critical Instructions
- Output ONLY a summary of the web page content provided below
- Focus on information that relates to or helps answer the user's query and processing intent
- Do NOT add pleasantries, greetings, or conversational elements
- Do NOT mention missing URLs, other pages, or content not provided
- Do NOT ask follow-up questions or suggest additional actions
- Do NOT add commentary about the user's request or query
- Present the information in a clear, well-structured format with key facts and details
- Include all relevant details that could help answer the user's question

# User's Query: ${query}
# Processing Intent: ${intent}

# Content Title: ${webContent.metadata.title || 'Web Page'}
# Content URL: ${url}

# Web Page Content to Summarize:
${retrieveHtml && webContent.metadata?.html ? webContent.metadata.html : webContent.pageContent}

Provide a comprehensive summary of the above web page content, focusing on information relevant to the user's query:`;

            const result = await llm.invoke(summarizationPrompt, {
              signal: config?.signal,
              ...getLangfuseCallbacks(),
            });

            finalContent = removeThinkingBlocks(result.content as string);
            processingType = 'url-content-extraction';
          }

          // Web content less than 100 characters probably isn't useful so discard it.
          if (finalContent && finalContent.trim().length > 100) {
            const document = new Document({
              pageContent: finalContent,
              metadata: {
                sourceId: ++currentDocCount,
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
    } catch (error) {
      console.error(
        'URLSummarizationTool: Error during URL processing:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: 'Error occurred during URL processing: ' + errorMessage,
              tool_call_id: (config as any)?.toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: 'url_summarization',
    description:
      'Fetches content from URLs and either uses it directly or summarizes it based on length, focusing on information relevant to the user query. URLs must be real and should not be invented.',
    schema: URLSummarizationToolSchema,
  },
);
