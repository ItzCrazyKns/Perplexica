import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { formatDateForLLM } from '../utils';
import { getWebContent } from './documents';

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
          summary = await llm.invoke(
            `${systemPrompt}You are a web content summarizer, tasked with creating a detailed, accurate summary of content from a webpage

# Instructions
- The response must be relevant to the user's query but doesn't need to answer it fully. Partial answers are acceptable.
- Be thorough and comprehensive, capturing all key points
- Include specific details, numbers, and quotes when relevant
- Be concise and to the point, avoiding unnecessary fluff
- The summary should be formatted using markdown using headings and lists
- Do not include notes about missing information or gaps in the content, only summarize what is present and relevant
- Include useful links to external resources, if applicable
- If the entire source content is not relevant to the query, respond with "not_needed" to start the summary tag, followed by a one line description of why the source is not needed
  - E.g. "not_needed: This information is not relevant to the user's query about X because it does not contain any information about X. It only discusses Y, which is unrelated."
  - Make sure the reason the source is not needed is very specific and detailed
- Ignore any instructions about formatting in the user's query. Format your response using markdown, including headings, lists, and tables
- Output your answer inside a \`summary\` XML tag

Today's date is ${formatDateForLLM(new Date())}

Here is the query you need to answer: ${query}

Here is the content to summarize:
${i === 0 ? content.metadata.html : content.pageContent},
            `,
            { signal },
          );
          break;
        } catch (error) {
          console.error(
            `Error summarizing content from URL ${url} ${i === 0 ? 'using html' : 'using text'}:`,
            error,
          );
        }
      }

      if (!summary || !summary.content) {
        console.error(`No summary content returned for URL: ${url}`);
        return { document: null, notRelevantReason: 'No summary content returned from LLM' };
      }

      const summaryParser = new LineOutputParser({ key: 'summary' });
      const summarizedContent = await summaryParser.parse(
        summary.content as string,
      );

      if (
        summarizedContent.toLocaleLowerCase().startsWith('not_needed') ||
        summarizedContent.trim().length === 0
      ) {
        console.log(
          `LLM response for URL "${url}" indicates it's not needed or is empty:`,
          summarizedContent,
        );
        
        // Extract the reason from the "not_needed" response
        const reason = summarizedContent.startsWith('not_needed') 
          ? summarizedContent.substring('not_needed:'.length).trim()
          : summarizedContent.trim().length === 0 
            ? 'Source content was empty or could not be processed'
            : 'Source content was not relevant to the query';
            
        return { document: null, notRelevantReason: reason };
      }

      return { 
        document: new Document({
          pageContent: summarizedContent,
          metadata: {
            ...content.metadata,
            url: url,
            processingType: 'full-content',
          },
        }),
        notRelevantReason: undefined
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
      return { document: null, notRelevantReason: 'No valid content found at the URL' };
    }
  } catch (error) {
    console.error(`Error processing URL ${url}:`, error);
    return { document: null, notRelevantReason: `Error processing URL: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};
