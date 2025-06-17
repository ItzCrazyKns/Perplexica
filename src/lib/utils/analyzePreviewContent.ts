import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { formatDateForLLM } from '../utils';

export type PreviewAnalysisResult = {
  isSufficient: boolean;
  reason?: string;
};

export type PreviewContent = {
  title: string;
  snippet: string;
  url: string;
};

export const analyzePreviewContent = async (
  previewContents: PreviewContent[],
  query: string,
  chatHistory: BaseMessage[],
  llm: BaseChatModel,
  systemInstructions: string,
  signal: AbortSignal,
): Promise<PreviewAnalysisResult> => {
  try {
    console.log(`Analyzing preview content for query: "${query}"`);
    console.log(
      `Preview content being analyzed:`,
      previewContents.map((content) => ({
        title: content.title,
        snippet: content.snippet.substring(0, 100) + '...',
        url: content.url,
      })),
    );

    // Format preview content for analysis
    const formattedPreviewContent = previewContents
      .map(
        (content, index) =>
          `Source ${index + 1}:
Title: ${content.title}
Snippet: ${content.snippet}
URL: ${content.url}
---`,
      )
      .join('\n\n');

    // Format chat history for context
    const formattedChatHistory = chatHistory
      .slice(-10) // Only include last 10 messages for context
      .map((message, index) => `${message._getType()}: ${message.content}`)
      .join('\n');

    const systemPrompt = systemInstructions ? `${systemInstructions}\n\n` : '';

    console.log(`Invoking LLM for preview content analysis`);

    const analysisResponse = await llm.invoke(
      `${systemPrompt}You are a preview content analyzer, tasked with determining if search result snippets contain sufficient information to answer a user's query.

# Instructions
- Analyze the provided search result previews (titles + snippets) to determine if they collectively contain enough information to provide a complete and accurate answer to the user's query
- Consider the chat history context when making your decision
- You must make a binary decision: either the preview content is sufficient OR it is not sufficient
- If the preview content can provide a complete answer to the query, respond with "sufficient"
- If the preview content lacks important details, requires deeper analysis, or cannot fully answer the query, respond with "not_needed: [specific reason why full content analysis is required]"
- Be specific in your reasoning when the content is not sufficient
- Consider query complexity: simple factual questions may be answerable from snippets, while complex research questions typically need full content
- Consider information completeness: if key details are missing from the snippets that would be needed for a complete answer, full analysis is required
- Output your decision inside a \`decision\` XML tag

Today's date is ${formatDateForLLM(new Date())}

# Chat History Context:
${formattedChatHistory ? formattedChatHistory : 'No previous conversation context'}

# User Query:
${query}

# Search Result Previews to Analyze:
${formattedPreviewContent}
      `,
      { signal },
    );

    if (!analysisResponse || !analysisResponse.content) {
      console.error('No analysis response returned from LLM');
      return {
        isSufficient: false,
        reason:
          'No analysis response returned from LLM - falling back to full content processing',
      };
    }

    const decisionParser = new LineOutputParser({ key: 'decision' });
    const decision = await decisionParser.parse(
      analysisResponse.content as string,
    );

    console.log(`LLM decision response:`, decision);

    if (decision.toLowerCase().trim() === 'sufficient') {
      console.log(
        'Preview content determined to be sufficient for answering the query',
      );
      return { isSufficient: true };
    } else if (decision.toLowerCase().startsWith('not_needed')) {
      // Extract the reason from the "not_needed" response
      const reason = decision.startsWith('not_needed')
        ? decision.substring('not_needed:'.length).trim()
        : 'Preview content insufficient for complete answer';

      console.log(
        `Preview content determined to be insufficient. Reason: ${reason}`,
      );
      return { isSufficient: false, reason };
    } else {
      // Default to not sufficient if unclear response
      console.log(
        `Unclear LLM response, defaulting to insufficient: ${decision}`,
      );
      return {
        isSufficient: false,
        reason:
          'Unclear analysis response - falling back to full content processing',
      };
    }
  } catch (error) {
    console.error('Error analyzing preview content:', error);
    return {
      isSufficient: false,
      reason: `Error during preview analysis: ${error instanceof Error ? error.message : 'Unknown error'} - falling back to full content processing`,
    };
  }
};
