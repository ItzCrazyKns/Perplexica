import { NotionApiError } from '@/lib/connectors/notion';
import type {
  AdditionalConfig,
  SearchActionOutput,
  SearchAgentConfig,
} from '../../../types';
import type { ResearchBlock } from '@/lib/types';

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

export function buildUnauthorizedResult(toolName: string): SearchActionOutput {
  return {
    type: 'search_results',
    results: [
      {
        content:
          'The requested page is not shared with the Notion connection or was not selected in this conversation. Ask the user to select the page before reading it — never read a page that was not authorized.',
        metadata: { title: `Notion: ${toolName} not authorized`, url: '' },
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

type ExecuteConfig = AdditionalConfig & {
  researchBlockId: string;
  fileIds: string[];
  mode: SearchAgentConfig['mode'];
};

/**
 * Emits a terminal `notion_search_results` substep for an error result,
 * so the Research Progress UI doesn't stay stuck on "Searching Notion".
 * Returns the result unchanged so callers can `return emitResultsSubstep(...)`.
 */
export function emitResultsSubstep(
  additionalConfig: ExecuteConfig,
  result: SearchActionOutput,
): SearchActionOutput {
  const researchBlock = additionalConfig.session.getBlock(
    additionalConfig.researchBlockId,
  ) as ResearchBlock | undefined;

  if (researchBlock && researchBlock.type === 'research') {
    researchBlock.data.subSteps.push({
      id: crypto.randomUUID(),
      type: 'notion_search_results',
      results: result.results,
    });

    additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
      {
        op: 'replace',
        path: '/data/subSteps',
        value: researchBlock.data.subSteps,
      },
    ]);
  }

  return result;
}
