import { EventEmitter } from 'stream';
import { applyPatch } from 'rfc6902';
import { Block } from './types';

class SessionManager {
  private static sessions = new Map<string, SessionManager>();
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

  addListener(event: string, listener: (data: any) => void) {
    this.emitter.addListener(event, listener);
  }

  replay() {
    for (const { event, data } of this.events) {
      /* Using emitter directly to avoid infinite loop */
      this.emitter.emit(event, data);
    }
  }
}

export default SessionManager;
