/**
 * Serializes untrusted metadata (user/Notion-controlled titles) so it
 * cannot be mistaken for prompt structure or instructions. Shared by the
 * researcher and classifier prompts.
 */
export function escapePromptText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\r\n\t]+/g, ' ');
}
