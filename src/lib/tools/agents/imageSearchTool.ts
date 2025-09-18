import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { Document } from 'langchain/document';
import { searchSearxng } from '@/lib/searxng';
import { Command, getCurrentTaskInput } from '@langchain/langgraph';
import { SimplifiedAgentStateType } from '@/lib/state/chatAgentState';
import { ToolMessage } from '@langchain/core/messages';

// Schema for image search tool input
const ImageSearchToolSchema = z.object({
  query: z
    .string()
    .describe(
      'The image search query. Provide a concise description of what images to find.',
    ),
  maxResults: z
    .number()
    .optional()
    .default(12)
    .describe('Maximum number of image results to return.'),
});

/**
 * ImageSearchTool - Performs image search via SearXNG and returns image results
 *
 * Responsibilities:
 * 1. Execute image-specific search using image engines
 * 2. Normalize results to a consistent structure
 * 3. Return results as Documents in state (metadata contains image fields)
 */
export const imageSearchTool = tool(
  async (
    input: z.infer<typeof ImageSearchToolSchema>,
    config?: RunnableConfig,
  ) => {
    try {
      const { query, maxResults = 12 } = input;

      const currentState = getCurrentTaskInput() as SimplifiedAgentStateType;
      let currentDocCount = currentState.relevantDocuments.length;

      console.log(`ImageSearchTool: Searching images for query: "${query}"`);
      const retrievalSignal: AbortSignal | undefined =
        (config as any)?.configurable?.retrievalSignal;

      const searchResults = await searchSearxng(
        query,
        {
          language: 'en',
          engines: ['bing images', 'google images'],
        },
        retrievalSignal,
      );

      const images = (searchResults.results || [])
        .filter((r: any) => r && r.img_src && r.url)
        .slice(0, maxResults);

      if (images.length === 0) {
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: 'No image results found.',
                tool_call_id: (config as any)?.toolCall?.id,
              }),
            ],
          },
        });
      }

      const documents: Document[] = images.map(
        (img: any) =>
          new Document({
            pageContent: `${img.title || 'Image'}\n${img.url}`,
            metadata: {
              sourceId: ++currentDocCount,
              title: img.title || 'Image',
              url: img.url,
              source: img.url,
              img_src: img.img_src,
              thumbnail: img.thumbnail || undefined,
              processingType: 'image-search',
              searchQuery: query,
            },
          }),
      );

      return new Command({
        update: {
          relevantDocuments: documents,
          messages: [
            new ToolMessage({
              content: JSON.stringify({ images }),
              tool_call_id: (config as any)?.toolCall?.id,
            }),
          ],
        },
      });
    } catch (error) {
      console.error('ImageSearchTool: Error during image search:', error);
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
    name: 'image_search',
    description:
      'Searches the web for images related to a query using SearXNG and returns image URLs, titles, and sources. Use when the user asks for pictures, photos, charts, or visual examples.',
    schema: ImageSearchToolSchema,
  },
);
