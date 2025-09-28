import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { Command, getCurrentTaskInput } from '@langchain/langgraph';
import { SimplifiedAgentStateType } from '@/lib/state/chatAgentState';
import { ToolMessage } from '@langchain/core/messages';
import {
  retrievePdfDoc,
  retrieveYoutubeTranscript,
} from '@/lib/utils/documents';

// Schema for PDF transcript tool input
const PDFLoaderToolSchema = z.object({
  pdfUrl: z
    .string()
    .describe(
      'The PDF document URL. Provide the URL of the PDF document to retrieve its content.',
    ),
});

/**
 * PDFLoaderTool - Retrieves the content of a PDF document
 *
 * Responsibilities:
 * 1. Extract PDF URL from the provided input
 * 2. Fetch the PDF content using a PDF parsing library
 * 3. Return the content as a string
 */
export const pdfLoaderTool = tool(
  async (
    input: z.infer<typeof PDFLoaderToolSchema>,
    config?: RunnableConfig,
  ) => {
    try {
      const { pdfUrl } = input;

      const currentState = getCurrentTaskInput() as SimplifiedAgentStateType;

      console.log(`[pdfLoaderTool] Retrieving content for PDF: "${pdfUrl}"`);

      const doc = await retrievePdfDoc(pdfUrl);

      if (!doc) {
        console.log(`[pdfLoaderTool] No documents found for PDF: ${pdfUrl}`);
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

      console.log(`[pdfLoaderTool] Retrieved document from PDF: ${pdfUrl}`);
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
      console.error(
        '[pdfLoaderTool] Error during PDF content retrieval:',
        error,
      );
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
    name: 'pdf_loader',
    description: 'Retrieves the content of a PDF document given its URL.',
    schema: PDFLoaderToolSchema,
  },
);
