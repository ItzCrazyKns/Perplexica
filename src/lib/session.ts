import { EventEmitter } from 'stream';
/* todo implement history saving and better artifact typing and handling */
class SessionManager {
  private static sessions = new Map<string, SessionManager>();
  readonly id: string;
  private artifacts = new Map<string, Artifact>();
  private emitter = new EventEmitter();

  constructor() {
    this.id = crypto.randomUUID();
  }

  static getSession(id: string): SessionManager | undefined {
    return this.sessions.get(id);
  }

  static getAllSessions(): SessionManager[] {
    return Array.from(this.sessions.values());
  }

  emit(event: string, data: any) {
    this.emitter.emit(event, data);
  }

  emitArtifact(artifact: Artifact) {
    this.artifacts.set(artifact.id, artifact);
    this.emitter.emit('addArtifact', artifact);
  }

  appendToArtifact(artifactId: string, data: any) {
    const artifact = this.artifacts.get(artifactId);
    if (artifact) {
      if (typeof artifact.data === 'string') {
        artifact.data += data;
      } else if (Array.isArray(artifact.data)) {
        artifact.data.push(data);
      } else if (typeof artifact.data === 'object') {
        Object.assign(artifact.data, data);
      }
      this.emitter.emit('updateArtifact', artifact);
    }
  }
}

export default SessionManager;
