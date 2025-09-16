import db from '@/lib/db';
import { systemPrompts as systemPromptsTable } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import {
  formattingAndCitationsLocal,
  formattingAndCitationsScholarly,
  formattingAndCitationsWeb,
  formattingChat,
} from '@/lib/prompts/templates';
import prompts from '../prompts';

export interface PromptData {
  content: string;
  type: 'system' | 'persona';
}

export interface RetrievedPrompts {
  personaInstructions: string;
}

/**
 * Retrieves only persona instructions from the database
 * @param selectedPersonaPromptIds Array of persona prompt IDs to retrieve
 * @returns Combined persona instructions as a string
 */
export async function getPersonaInstructionsOnly(
  selectedPersonaPromptIds: string[],
): Promise<string> {
  if (
    !selectedPersonaPromptIds ||
    !Array.isArray(selectedPersonaPromptIds) ||
    selectedPersonaPromptIds.length === 0
  ) {
    return '';
  }

  try {
    let promptsString = '';

    const basePrompts = [
      formattingAndCitationsLocal,
      formattingAndCitationsScholarly,
      formattingAndCitationsWeb,
      formattingChat,
    ];

    // Include base prompts if their IDs are in the selectedPersonaPromptIds
    basePrompts.forEach((bp) => {
      if (selectedPersonaPromptIds.includes(bp.id)) {
        promptsString += bp.content + '\n';
      }
    });

    const promptsFromDb = await db
      .select({
        content: systemPromptsTable.content,
        type: systemPromptsTable.type,
      })
      .from(systemPromptsTable)
      .where(inArray(systemPromptsTable.id, selectedPersonaPromptIds));

    let personaPrompts = promptsFromDb.filter((p) => p.type === 'persona');

    return promptsString + personaPrompts.map((p) => p.content).join('\n');
  } catch (dbError) {
    console.error('Error fetching persona prompts from DB:', dbError);
    return '';
  }
}
