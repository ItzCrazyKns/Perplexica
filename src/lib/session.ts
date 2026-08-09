import { EventEmitter } from 'stream';
import { applyPatch } from 'rfc6902';
import { Block } from './types';

const sessions =
  (global as any)._sessionManagerSessions || new Map<string, SessionManager>();
if (process.env.NODE_ENV !== 'production') {
  (global as any)._sessionManagerSessions = sessions;
}

class SessionManager {
  private static sessions: Map<string, SessionManager> = sessions;
  readonly id: string;
  private blocks = new Map<string, Block>();
  private events: { event: string; data: any }[] = [];
  private emitter = new EventEmitter();
  private TTL_MS = 30 * 60 * 1000;

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();

    setTimeout(() => {
      SessionManager.sessions.delete(this.id);
    }, this.TTL_MS);
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
    this.emitter.emit(event, data);
    this.events.push({ event, data });
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

  private pendingDecisions = new Map<string, (decision: any) => void>();

  /**
   * Pauses the response pipeline until {@link resolveDecision} is called
   * for this block (an interactive, awaitable block — ADR-0003), or the
   * timeout elapses, in which case it resolves with an automatic reject.
   */
  waitForDecision(blockId: string, timeoutMs = 15 * 60 * 1000): Promise<any> {
    return new Promise((resolve) => {
      this.pendingDecisions.set(blockId, resolve);

      const timer = setTimeout(() => {
        if (this.pendingDecisions.has(blockId)) {
          this.pendingDecisions.delete(blockId);
          resolve({ action: 'reject', reason: 'timeout' });
        }
      }, timeoutMs);
      // Do not keep the process alive just because a decision is pending.
      if (typeof timer.unref === 'function') timer.unref();
    });
  }

  /** Resolves a pending decision. Returns false when none is pending. */
  resolveDecision(blockId: string, decision: any): boolean {
    const resolve = this.pendingDecisions.get(blockId);
    if (!resolve) return false;
    this.pendingDecisions.delete(blockId);
    resolve(decision);
    return true;
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
    const currentEventsLength = this.events.length;

    const handler = (event: string) => (data: any) => listener(event, data);
    const dataHandler = handler('data');
    const endHandler = handler('end');
    const errorHandler = handler('error');

    this.emitter.on('data', dataHandler);
    this.emitter.on('end', endHandler);
    this.emitter.on('error', errorHandler);

    for (let i = 0; i < currentEventsLength; i++) {
      const { event, data } = this.events[i];
      listener(event, data);
    }

    return () => {
      this.emitter.off('data', dataHandler);
      this.emitter.off('end', endHandler);
      this.emitter.off('error', errorHandler);
    };
  }
}

export default SessionManager;
