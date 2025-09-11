import db from '@/lib/db';
import { systemPrompts as systemPromptsTable } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export interface PromptData {
  content: string;
  type: 'system' | 'persona';
}

export interface RetrievedPrompts {
  personaInstructions: string;
}

/**
 * Deprecated: previously retrieved both system and persona prompts.
 * Now returns personaInstructions only; system instructions are removed from the app.
 * @param selectedSystemPromptIds Array of prompt IDs to retrieve (treated as persona IDs)
 * @returns Object containing personaInstructions only (systemInstructions is removed)
 */
export async function getSystemPrompts(
  selectedSystemPromptIds: string[],
): Promise<RetrievedPrompts> {
  let personaInstructionsContent = '';

  if (
    !selectedSystemPromptIds ||
    !Array.isArray(selectedSystemPromptIds) ||
    selectedSystemPromptIds.length === 0
  ) {
    return {
      personaInstructions: personaInstructionsContent,
    };
  }

  try {
    const promptsFromDb = await db
      .select({
        content: systemPromptsTable.content,
        type: systemPromptsTable.type,
      })
      .from(systemPromptsTable)
      .where(inArray(systemPromptsTable.id, selectedSystemPromptIds));

    // Separate system and persona prompts
    const personaPrompts = promptsFromDb.filter((p) => p.type === 'persona');
    personaInstructionsContent = personaPrompts
      .map((p) => p.content)
      .join('\n');
  } catch (dbError) {
    console.error('Error fetching system prompts from DB:', dbError);
    // Return empty strings rather than throwing to allow graceful degradation
  }

  return {
    personaInstructions: personaInstructionsContent,
  };
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
    const promptsFromDb = await db
      .select({
        content: systemPromptsTable.content,
        type: systemPromptsTable.type,
      })
      .from(systemPromptsTable)
      .where(inArray(systemPromptsTable.id, selectedPersonaPromptIds));

    const personaPrompts = promptsFromDb.filter((p) => p.type === 'persona');
    return personaPrompts.map((p) => p.content).join('\n');
  } catch (dbError) {
    console.error('Error fetching persona prompts from DB:', dbError);
    return '';
  }
}
