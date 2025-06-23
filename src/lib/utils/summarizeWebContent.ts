import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { formatDateForLLM } from '../utils';
import { getWebContent } from './documents';
import { removeThinkingBlocks } from './contentUtils';
import { setTemperature } from './modelUtils';

export type SummarizeResult = {
  document: Document | null;
  notRelevantReason?: string;
};

export const summarizeWebContent = async (
  url: string,
  query: string,
  llm: BaseChatModel,
  systemInstructions: string,
  signal: AbortSignal,
): Promise<SummarizeResult> => {
  try {
    setTemperature(llm, 0); // Set temperature to 0 for deterministic output
    // Helper function to summarize content and check relevance
    const summarizeContent = async (
      content: Document,
    ): Promise<SummarizeResult> => {
      const systemPrompt = systemInstructions
        ? `${systemInstructions}\n\n`
        : '';

      let summary = null;
      for (let i = 0; i < 2; i++) {
        try {
          console.log(
            `Summarizing content from URL: ${url} using ${i === 0 ? 'html' : 'text'}`,
          );
          
          const prompt = `${systemPrompt}You are a web content summarizer, tasked with creating a detailed, accurate summary of content from a webpage.

# Instructions
- First determine if the content is relevant to the user's query
- You do not need to provide a full answer to the query in order to be relevant, partial answers are acceptable
- If the content is relevant, return a thorough and comprehensive summary capturing all key points
- Include specific details, numbers, and quotes when relevant
- Be concise and to the point, avoiding unnecessary fluff
- Format the summary using markdown with headings and lists
- Include useful links to external resources, if applicable

# Decision Tree
- If the content is NOT relevant to the query, do not provide a summary; respond with 'not_relevant'
- If the content is relevant, return a detailed summary following the instructions above

Today's date is ${formatDateForLLM(new Date())}

Here is the query you need to answer: ${query}

Here is the content to summarize:
${i === 0 ? content.metadata.html : content.pageContent}`;

          const result = await llm.invoke(prompt, { signal });
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
          notRelevantReason: 'Content not relevant to query' 
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
  } finally {
    // Reset temperature to default after processing
    setTemperature(llm);
  }
};
