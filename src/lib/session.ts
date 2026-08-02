import { EventEmitter } from 'stream';
import { applyPatch } from 'rfc6902';
import { Block, TextBlock } from './types';

const sessions =
  (global as any)._sessionManagerSessions || new Map<string, SessionManager>();
if (process.env.NODE_ENV !== 'production') {
  (global as any)._sessionManagerSessions = sessions;
}

/*
 * Holds current block snapshots plus terminal state instead of an
 * event log. The previous design retained every emitted event for the
 * whole TTL, which for a streamed answer meant every intermediate
 * full-text patch: O(n^2) memory in answer length, all replayed on
 * reconnect.
 */
class SessionManager {
  private static sessions: Map<string, SessionManager> = sessions;
  readonly id: string;
  private blocks = new Map<string, Block>();
  private researchComplete = false;
  private terminal: { event: 'end' | 'error'; data: any } | null = null;
  private emitter = new EventEmitter();
  private TTL_MS = 30 * 60 * 1000;

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();

    /* unref: a GC timer must not hold the process open. */
    setTimeout(() => {
      SessionManager.sessions.delete(this.id);
    }, this.TTL_MS).unref();
  }

  static getSession(id: string): SessionManager | undefined {
    return this.sessions.get(id);
  }

  static getAllSessions(): SessionManager[] {
    return Array.from(this.sessions.values());
  }

  static createSession(): SessionManager {
    const session = new SessionManager();
    this.sessions.set(session.id, session);
    return session;
  }

  removeAllListeners() {
    this.emitter.removeAllListeners();
  }

  emit(event: string, data: any) {
    /* State is tracked even with zero listeners: the producer runs
       detached from any subscriber, and reconnects replay from here. */
    if (event === 'data' && data?.type === 'researchComplete') {
      this.researchComplete = true;
    } else if (event === 'end' || event === 'error') {
      if (this.terminal) return;
      this.terminal = { event, data };
    }

    this.emitter.emit(event, data);
  }

  emitBlock(block: Block) {
    this.blocks.set(block.id, block);
    this.emit('data', {
      type: 'block',
      block: block,
    });
  }

  getBlock(blockId: string): Block | undefined {
    return this.blocks.get(blockId);
  }

  appendText(blockId: string, delta: string) {
    const block = this.blocks.get(blockId) as TextBlock | undefined;

    if (!block || delta === '') return;

    block.data += delta;
    this.emit('data', {
      type: 'appendText',
      blockId: blockId,
      delta: delta,
    });
  }

  updateBlock(blockId: string, patch: any[]) {
    const block = this.blocks.get(blockId);

    if (block) {
      applyPatch(block, patch);
      this.blocks.set(blockId, block);
      this.emit('data', {
        type: 'updateBlock',
        blockId: blockId,
        patch: patch,
      });
    }
  }

  getAllBlocks() {
    return Array.from(this.blocks.values());
  }

  subscribe(listener: (event: string, data: any) => void): () => void {
    const handler = (event: string) => (data: any) => listener(event, data);
    const dataHandler = handler('data');
    const endHandler = handler('end');
    const errorHandler = handler('error');

    this.emitter.on('data', dataHandler);
    this.emitter.on('end', endHandler);
    this.emitter.on('error', errorHandler);

    /* Replay after attach is safe: this block is synchronous, so no
       live emit can interleave and nothing is delivered twice. Late
       subscribers get each block once at its current state instead of
       the full patch history. */
    for (const block of this.blocks.values()) {
      listener('data', { type: 'block', block });
    }

    if (this.researchComplete) {
      listener('data', { type: 'researchComplete' });
    }

    if (this.terminal) {
      listener(this.terminal.event, this.terminal.data);
    }

    return () => {
      this.emitter.off('data', dataHandler);
      this.emitter.off('end', endHandler);
      this.emitter.off('error', errorHandler);
    };
  }
}

export default SessionManager;
