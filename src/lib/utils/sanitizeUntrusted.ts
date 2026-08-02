/*
 * Scraped pages and search snippets are attacker-authored text that we
 * interpolate between prompt delimiters. Neutralising the closing tags
 * stops a page from ending the envelope early and continuing as if it
 * were the operator speaking.
 */
const CLOSING_DELIMITERS =
  /<\/(result|search_results|scraped_data|context|widgets_result|queries|system)>/gi;

export const sanitizeUntrusted = (text: string): string =>
  text.replace(CLOSING_DELIMITERS, (m) => m.replace('<', '&lt;'));
