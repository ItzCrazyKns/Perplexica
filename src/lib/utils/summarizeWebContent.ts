import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { formatDateForLLM } from '../utils';
import { getWebContent } from './documents';
import { removeThinkingBlocks } from './contentUtils';
import { setTemperature } from './modelUtils';
import { withStructuredOutput } from './structuredOutput';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';

export type SummarizeResult = {
  document: Document | null;
  notRelevantReason?: string;
};

// Zod schema for structured relevance check output
const RelevanceCheckSchema = z.object({
  relevant: z
    .boolean()
    .describe('Whether the content is relevant to the user query'),
  reason: z
    .string()
    .describe(
      "Brief explanation of why content is or isn't relevant. 20 words or less.",
    ),
});

export const summarizeWebContent = async (
  url: string,
  query: string,
  llm: BaseChatModel,
  signal: AbortSignal,
): Promise<SummarizeResult> => {
  try {
    setTemperature(llm, 0); // Set temperature to 0 for deterministic output
    // Helper function to summarize content and check relevance
    const summarizeContent = async (
      content: Document,
    ): Promise<SummarizeResult> => {
      // Determine content length for short-circuit logic
      const contentToAnalyze =
        content.pageContent || content.metadata.html || '';
      const isShortContent = contentToAnalyze.length < 4000;

      if (isShortContent) {
        // For short content, only check relevance without summarizing
        console.log(
          `Short content detected (${contentToAnalyze.length} chars) for URL: ${url}, checking relevance only`,
        );

        try {
          // Create structured LLM with Zod schema
          const structuredLLM = withStructuredOutput(
            llm,
            RelevanceCheckSchema,
            {
              name: 'check_content_relevance',
            },
          );

          const relevanceResult = await structuredLLM.invoke(
            `You are a content relevance checker. Your task is to determine if the given content is relevant to the user's query.

# Instructions
- Analyze the content to determine if it contains information relevant to the user's query
- You do not need to provide a full answer to the query in order to be relevant, partial answers are acceptable
- Provide a brief explanation of your reasoning

# Response Format
Respond with a JSON object that matches this structure:
{
  "relevant": boolean, // true if content is relevant, false otherwise
  "reason": "string" // Brief explanation of why content is or isn't relevant
}

Your response should contain only the JSON object, no additional text or formatting.
Do not include data that would require escape characters, do not escape quotes or other characters.
This is important for the application to parse the response correctly.

# Example Response
{
  "relevant": true,
  "reason": "The content discusses the main features of the product which directly relate to the user's query about its capabilities."
}

# Context

Today's date is ${formatDateForLLM(new Date())}

Here is the query you need to answer: ${query}

Here is the content to analyze:
${contentToAnalyze}`,
            { signal, ...getLangfuseCallbacks() },
          );

          if (!relevanceResult) {
            console.error(`No relevance result returned for URL ${url}`);
            // Fall through to full summarization as fallback
          } else if (relevanceResult.relevant) {
            console.log(
              `Short content for URL "${url}" is relevant: ${relevanceResult.reason}`,
            );
            return {
              document: new Document({
                pageContent: content.pageContent,
                metadata: {
                  ...content.metadata,
                  url: url,
                  processingType: 'short-content',
                },
              }),
              notRelevantReason: undefined,
            };
          } else {
            console.log(
              `Short content for URL "${url}" is not relevant: ${relevanceResult.reason}`,
            );
            return {
              document: null,
              notRelevantReason:
                relevanceResult.reason || 'Content not relevant to query',
            };
          }
        } catch (error) {
          console.error(
            `Error checking relevance for short content from URL ${url}:`,
            error,
          );
          // Fall through to full summarization as fallback
        }
      }

      // For longer content or if relevance check failed, use full summarization
      let summary = null;
      for (let i = 0; i < 2; i++) {
        try {
          console.log(
            `Summarizing content from URL: ${url} using ${i === 0 ? 'html' : 'text'}`,
          );

          const prompt = `You are a web content summarizer, tasked with creating a detailed, accurate summary of content from a webpage.

# Instructions
- First determine if the content is relevant to the user's query
- You do not need to provide a full answer to the query in order to be relevant, partial answers are acceptable
- If the content is relevant, return a thorough and comprehensive summary capturing all key points
- Include specific details, numbers, and quotes when relevant
- Be concise and to the point, avoiding unnecessary fluff
- Format the summary using markdown with headings and lists
- Include useful links to external resources, if applicable

# Response Format
- Respond with a detailed summary of the content, formatted in markdown. Do not include any additional text or explanations outside the summary.

# Decision Tree
- If the content is NOT relevant to the query, do not provide a summary; respond with 'not_relevant'
- If the content is relevant, return a detailed summary following the instructions above

Today's date is ${formatDateForLLM(new Date())}

Here is the query you need to answer: ${query}

Here is the content to summarize:
${i === 0 ? content.metadata.html : content.pageContent}`;

          const result = await llm.invoke(prompt, {
            signal,
            ...getLangfuseCallbacks(),
          });
          summary = removeThinkingBlocks(result.content as string);
          break;
        } catch (error) {
          console.error(
            `Error summarizing content from URL ${url} ${i === 0 ? 'using html' : 'using text'}:`,
            error,
          );
        }
      }

      if (!summary) {
        console.error(`No summary result returned for URL: ${url}`);
        return {
          document: null,
          notRelevantReason: 'No summary content returned from LLM',
        };
      }

      // Check if content is relevant (empty or very short response indicates not relevant)
      const trimmedSummary = summary.trim();
      if (trimmedSummary.length === 0 || trimmedSummary.length < 25) {
        console.log(
          `LLM response for URL "${url}" indicates it's not relevant (empty or very short response)`,
        );

        return {
          document: null,
          notRelevantReason: 'Content not relevant to query',
        };
      }

      return {
        document: new Document({
          pageContent: trimmedSummary,
          metadata: {
            ...content.metadata,
            url: url,
            processingType: 'full-content',
          },
        }),
        notRelevantReason: undefined,
      };
    };

    // // First try the lite approach
    // let webContent = await getWebContentLite(url, true);

    // // Try lite content first
    // if (webContent) {
    //   console.log(`Trying lite content extraction for URL: ${url}`);
    //   const liteResult = await summarizeContent(webContent);

    //   if (liteResult) {
    //     console.log(`Successfully used lite content for URL: ${url}`);
    //     return liteResult;
    //   }

    // }

    // // If lite content is not relevant, try full content
    // console.log(`Lite content not relevant for URL ${url}, trying full content extraction`);
    const webContent = await getWebContent(url, 50000, true, signal);

    // Process full content or return null if no content
    if (
      (webContent &&
        webContent.pageContent &&
        webContent.pageContent.trim().length > 0) ||
      (webContent?.metadata.html && webContent.metadata.html.trim().length > 0)
    ) {
      console.log(`Using full content extraction for URL: ${url}`);
      return await summarizeContent(webContent);
    } else {
      console.log(`No valid content found for URL: ${url}`);
      return {
        document: null,
        notRelevantReason: 'No valid content found at the URL',
      };
    }
  } catch (error) {
    console.error(`Error processing URL ${url}:`, error);
    return {
      document: null,
      notRelevantReason: `Error processing URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  } finally {
    // Reset temperature to default after processing
    setTemperature(llm);
  }
};
