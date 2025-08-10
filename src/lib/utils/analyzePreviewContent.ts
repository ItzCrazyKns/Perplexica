import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { formatDateForLLM } from '../utils';
import { ChatOpenAI, OpenAIClient } from '@langchain/openai';
import { removeThinkingBlocks } from './contentUtils';
import { withStructuredOutput } from './structuredOutput';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';

export type PreviewAnalysisResult = {
  isSufficient: boolean;
  reason?: string;
};

export type PreviewContent = {
  title: string;
  snippet: string;
  url: string;
};

// Zod schema for structured preview analysis output
const PreviewAnalysisSchema = z.object({
  isSufficient: z
    .boolean()
    .describe(
      'Whether the preview content is sufficient to answer the task query',
    ),
  reason: z
    .string()
    .nullable()
    .describe(
      'Specific reason why full content analysis is required (only if isSufficient is false)',
    ),
});

export const analyzePreviewContent = async (
  previewContents: PreviewContent[],
  query: string,
  taskQuery: string,
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
---`,
      )
      .join('\n\n');

    // Format chat history for context
    const formattedChatHistory = chatHistory
      .slice(-10) // Only include last 10 messages for context
      .map(
        (message) =>
          `${message.getType()}: ${removeThinkingBlocks(message.content.toString())}`,
      )
      .join('\n');

    const systemPrompt = systemInstructions ? `${systemInstructions}\n\n` : '';

    console.log(`Invoking LLM for preview content analysis`);

    // Create structured LLM with Zod schema
    const structuredLLM = withStructuredOutput(llm, PreviewAnalysisSchema, {
      name: 'analyze_preview_content',
    });

  const analysisResult = await structuredLLM.invoke(
      `You are a preview content analyzer, tasked with determining if search result snippets contain sufficient information to answer the Task Query.

# Instructions
- Analyze the provided search result previews (titles + snippets), and chat history context to determine if they collectively contain enough information to provide a complete and accurate answer to the Task Query
- If the preview content can provide a complete answer to the Task Query, consider it sufficient
- If the preview content lacks important details, requires deeper analysis, or cannot fully answer the Task Query, consider it insufficient
- Be specific in your reasoning when the content is not sufficient but keep the answer under 35 words
- The original query is provided for additional context, only use it for clarification of overall expectations and intent. You do **not** need to answer the original query directly or completely

# System Instructions
${systemPrompt}

# Response Format
Respond with a JSON object that matches this structure:
{
  "isSufficient": boolean,
  "reason": "string"
}

Your response should contain only the JSON object, no additional text or formatting.

# Information Context:
Today's date is ${formatDateForLLM(new Date())}

# Chat History Context:
${formattedChatHistory ? formattedChatHistory : 'No previous conversation context'}

# User Query:
${query}

# Task Query (what to answer):
${taskQuery}

# Search Result Previews to Analyze:
${formattedPreviewContent}
`,
  { signal, ...getLangfuseCallbacks() },
    );

    if (!analysisResult) {
      console.error('No analysis result returned from LLM');
      return {
        isSufficient: false,
        reason:
          'No analysis response returned from LLM - falling back to full content processing',
      };
    }

    console.log(`LLM analysis result:`, analysisResult);

    if (analysisResult.isSufficient) {
      console.log(
        'Preview content determined to be sufficient for answering the query',
      );
      return { isSufficient: true };
    } else {
      console.log(
        `Preview content determined to be insufficient. Reason: ${analysisResult.reason}`,
      );
      return {
        isSufficient: false,
        reason:
          analysisResult.reason ||
          'Preview content insufficient for complete answer',
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
