import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { formatDateForLLM } from '../utils';
import { getWebContent } from './documents';

export type SummarizeResult = {
  document: Document | null;
  notRelevantReason?: string;
};

// Zod schema for structured summary output
const SummarySchema = z.object({
  isRelevant: z.boolean().describe('Whether the content is relevant to the user query'),
  summary: z.string().describe('Detailed summary of the content in markdown format, or explanation if not relevant'),
  notRelevantReason: z.string().optional().describe('Specific reason why content is not relevant (only if isRelevant is false)')
});

export const summarizeWebContent = async (
  url: string,
  query: string,
  llm: BaseChatModel,
  systemInstructions: string,
  signal: AbortSignal,
): Promise<SummarizeResult> => {
  try {
    // Helper function to summarize content and check relevance
    const summarizeContent = async (
      content: Document,
    ): Promise<SummarizeResult> => {
      const systemPrompt = systemInstructions
        ? `${systemInstructions}\n\n`
        : '';

      // Create structured LLM with Zod schema
      const structuredLLM = llm.withStructuredOutput(SummarySchema);

      let result = null;
      for (let i = 0; i < 2; i++) {
        try {
          console.log(
            `Summarizing content from URL: ${url} using ${i === 0 ? 'html' : 'text'}`,
          );
          
          const prompt = `${systemPrompt}You are a web content summarizer, tasked with creating a detailed, accurate summary of content from a webpage.

# Instructions
- Determine if the content is relevant to the user's query
- You do not need to provide a full answer to the query, partial answers are acceptable
- If relevant, create a thorough and comprehensive summary capturing all key points
- Include specific details, numbers, and quotes when relevant
- Be concise and to the point, avoiding unnecessary fluff
- Format the summary using markdown with headings and lists
- Include useful links to external resources, if applicable
- If the content is not relevant, set isRelevant to false and provide a specific reason

# Response Format
You must return a JSON object with:
- isRelevant: boolean indicating if content is relevant to the query
- summary: string with detailed markdown summary if relevant, or explanation if not relevant
- notRelevantReason: string explaining why content is not relevant (only if isRelevant is false)

Today's date is ${formatDateForLLM(new Date())}

Here is the query you need to answer: ${query}

Here is the content to summarize:
${i === 0 ? content.metadata.html : content.pageContent}`;

          result = await structuredLLM.invoke(prompt, { signal });
          break;
        } catch (error) {
          console.error(
            `Error summarizing content from URL ${url} ${i === 0 ? 'using html' : 'using text'}:`,
            error,
          );
        }
      }

      if (!result) {
        console.error(`No summary result returned for URL: ${url}`);
        return {
          document: null,
          notRelevantReason: 'No summary content returned from LLM',
        };
      }

      // Check if content is relevant
      if (!result.isRelevant) {
        console.log(
          `LLM response for URL "${url}" indicates it's not relevant:`,
          result.notRelevantReason || result.summary,
        );

        return { 
          document: null, 
          notRelevantReason: result.notRelevantReason || result.summary 
        };
      }

      // Content is relevant, create document with summary
      if (!result.summary || result.summary.trim().length === 0) {
        console.error(`No summary content in relevant response for URL: ${url}`);
        return {
          document: null,
          notRelevantReason: 'Summary content was empty',
        };
      }

      return {
        document: new Document({
          pageContent: result.summary,
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
    const webContent = await getWebContent(url, true);

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
  }
};
