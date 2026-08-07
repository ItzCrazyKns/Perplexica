import { NotionApiError } from '@/lib/connectors/notion';
import type { SearchActionOutput } from '../../../types';

/**
 * Shared friendly error results for the notion tools. Actions never throw
 * on connection or API errors — they return a `search_results` chunk the
 * agent/writer can relay to the user.
 */

export function buildNotConnectedResult(): SearchActionOutput {
  return {
    type: 'search_results',
    results: [
      {
        content:
          'Notion is not connected. Tell the user to connect Notion in Settings before using Notion pages.',
        metadata: { title: 'Notion: not connected', url: '' },
      },
    ],
  };
}

export function buildApiErrorResult(
  err: NotionApiError,
  toolName: string,
): SearchActionOutput {
  // pages.ts/databases.ts report "not connected" as a synthetic
  // NotionApiError with status 0 and code 'not_connected'.
  if (err.code === 'not_connected' || err.status === 0) {
    return buildNotConnectedResult();
  }

  return {
    type: 'search_results',
    results: [
      {
        content: `The Notion API returned an error (${err.status}: ${err.code || err.message}). ${
          err.status === 403 || err.status === 404
            ? 'The page may not be shared with the connection — ask the user to select it.'
            : 'Try a different page or retry later.'
        }`,
        metadata: { title: `Notion: ${toolName} failed`, url: '' },
      },
    ],
  };
}

export function buildGenericErrorResult(err: unknown): SearchActionOutput {
  return {
    type: 'search_results',
    results: [
      {
        content: `Reading Notion failed (${err instanceof Error ? err.message : 'unknown error'}). Please try again later.`,
        metadata: { title: 'Notion: error', url: '' },
      },
    ],
  };
}
