import db from '@/lib/db';
import { systemPrompts as systemPromptsTable } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export interface PromptData {
  content: string;
  type: 'system' | 'persona';
}

export interface RetrievedPrompts {
  systemInstructions: string;
  personaInstructions: string;
}

/**
 * Retrieves and processes system prompts from the database
 * @param selectedSystemPromptIds Array of prompt IDs to retrieve
 * @returns Object containing combined system and persona instructions
 */
export async function getSystemPrompts(
  selectedSystemPromptIds: string[],
): Promise<RetrievedPrompts> {
  let systemInstructionsContent = '';
  let personaInstructionsContent = '';

  if (
    !selectedSystemPromptIds ||
    !Array.isArray(selectedSystemPromptIds) ||
    selectedSystemPromptIds.length === 0
  ) {
    return {
      systemInstructions: systemInstructionsContent,
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
    const systemPrompts = promptsFromDb.filter((p) => p.type === 'system');
    const personaPrompts = promptsFromDb.filter((p) => p.type === 'persona');

    systemInstructionsContent = systemPrompts.map((p) => p.content).join('\n');
    personaInstructionsContent = personaPrompts
      .map((p) => p.content)
      .join('\n');
  } catch (dbError) {
    console.error('Error fetching system prompts from DB:', dbError);
    // Return empty strings rather than throwing to allow graceful degradation
  }

  return {
    systemInstructions: systemInstructionsContent,
    personaInstructions: personaInstructionsContent,
  };
}

/**
 * Retrieves only system instructions (excluding persona prompts) from the database
 * @param selectedSystemPromptIds Array of prompt IDs to retrieve
 * @returns Combined system instructions as a string
 */
export async function getSystemInstructionsOnly(
  selectedSystemPromptIds: string[],
): Promise<string> {
  const { systemInstructions } = await getSystemPrompts(
    selectedSystemPromptIds,
  );
  return systemInstructions;
}
