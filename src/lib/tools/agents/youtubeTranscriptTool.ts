import { SimplifiedAgentStateType } from '@/lib/state/chatAgentState';
import { retrieveYoutubeTranscript } from '@/lib/utils/documents';
import { ToolMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { tool } from '@langchain/core/tools';
import { Command, getCurrentTaskInput } from '@langchain/langgraph';
import { z } from 'zod';

// Schema for YouTube transcript tool input
const YoutubeTranscriptToolSchema = z.object({
  videoUrl: z
    .string()
    .describe(
      'The YouTube video URL. Provide the URL of the YouTube video to retrieve a transcript for.',
    ),
});

/**
 * YoutubeTranscriptTool - Retrieves the transcript of a YouTube video
 *
 * Responsibilities:
 * 1. Extract video ID from the provided URL
 * 2. Fetch the transcript using YouTube API
 * 3. Return the transcript as a string
 */
export const youtubeTranscriptTool = tool(
  async (
    input: z.infer<typeof YoutubeTranscriptToolSchema>,
    config?: RunnableConfig,
  ) => {
    try {
      const { videoUrl } = input;

      const currentState = getCurrentTaskInput() as SimplifiedAgentStateType;

      console.log(
        `[youtubeTranscriptTool] Retrieving transcript for video: "${videoUrl}"`,
      );
      
      const doc = await retrieveYoutubeTranscript(videoUrl);

      if (!doc) {
        console.log(`[youtubeTranscriptTool] No documents found for video: ${videoUrl}`);
        return new Command({
          update: {
            relevantDocuments: [],
            messages: [
              new ToolMessage({
                content: 'No transcript available for this video.',
                tool_call_id: (config as any)?.toolCall.id,
              }),
            ],
          },
        });
      }

      console.log(`[youtubeTranscriptTool] Retrieved document from video: ${videoUrl}`);
      return new Command({
        update: {
          relevantDocuments: [doc],
          messages: [
            new ToolMessage({
              content: JSON.stringify({
                document: [doc],
              }),
              tool_call_id: (config as any)?.toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      console.error('[youtubeTranscriptTool] Error during transcript retrieval:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: 'Error occurred during image search: ' + errorMessage,
              tool_call_id: (config as any)?.toolCall?.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: 'youtube_transcript',
    description:
      'Retrieves the transcript of a YouTube video given its URL.',
    schema: YoutubeTranscriptToolSchema,
  },
);
