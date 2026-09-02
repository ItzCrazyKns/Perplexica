import SessionManager from '@/lib/session';
import type { StagedWrite } from './types';

/**
 * Per-response staging of Notion writes, keyed by the response's session
 * (one session per chat response, so staging never leaks across
 * responses). A WeakMap keeps this free of the session TTL lifecycle.
 */
const stagedWrites = new WeakMap<SessionManager, StagedWrite[]>();

export function stageWrite(session: SessionManager, write: StagedWrite): void {
  const list = stagedWrites.get(session) ?? [];
  list.push(write);
  stagedWrites.set(session, list);
}

export function getStagedWrites(session: SessionManager): StagedWrite[] {
  return stagedWrites.get(session) ?? [];
}
