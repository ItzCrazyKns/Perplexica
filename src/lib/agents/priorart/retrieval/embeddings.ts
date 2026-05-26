import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import BaseEmbedding from '@/lib/models/base/embedding';
import { PatentDocument } from '../schemas';

// Use require — `import * as sqliteVec` doesn't survive Next.js standalone
// bundling cleanly for this native-binding CJS module.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqliteVec: { load: (db: Database.Database) => void } = require('sqlite-vec');

export type EmbeddingStoreConfig = {
  storePath: string;
  embedder: BaseEmbedding<unknown>;
  embeddingDimension: number;
  workspaceId: string;
};

type RankedHit = {
  publicationNumber: string;
  distance: number;
};

export class PriorArtEmbeddings {
  private db: Database.Database;
  private dim: number;
  private workspaceId: string;
  private embedder: BaseEmbedding<unknown>;

  constructor(cfg: EmbeddingStoreConfig) {
    fs.mkdirSync(path.dirname(cfg.storePath), { recursive: true });
    this.db = new Database(cfg.storePath);
    sqliteVec.load(this.db);
    this.dim = cfg.embeddingDimension;
    this.workspaceId = cfg.workspaceId;
    this.embedder = cfg.embedder;
    this.ensureSchema();
  }

  private ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS priorart_docs (
        workspace_id TEXT NOT NULL,
        publication_number TEXT NOT NULL,
        title TEXT,
        text TEXT,
        PRIMARY KEY (workspace_id, publication_number)
      );
    `);
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS priorart_vec USING vec0(
        workspace_id TEXT,
        publication_number TEXT,
        embedding FLOAT[${this.dim}]
      );
    `);
  }

  async ingest(docs: PatentDocument[]): Promise<void> {
    if (!docs.length) return;
    const texts = docs.map((d) =>
      [d.title, d.abstract, d.firstIndependentClaim].filter(Boolean).join('\n\n'),
    );
    const vectors = await this.embedder.embedText(texts);
    const insertDoc = this.db.prepare(
      'INSERT OR REPLACE INTO priorart_docs (workspace_id, publication_number, title, text) VALUES (?, ?, ?, ?)',
    );
    const insertVec = this.db.prepare(
      'INSERT INTO priorart_vec (workspace_id, publication_number, embedding) VALUES (?, ?, ?)',
    );
    const txn = this.db.transaction(() => {
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        insertDoc.run(this.workspaceId, d.publicationNumber, d.title, texts[i]);
        insertVec.run(this.workspaceId, d.publicationNumber, Buffer.from(new Float32Array(vectors[i]).buffer));
      }
    });
    txn();
  }

  async query(text: string, k: number): Promise<RankedHit[]> {
    const [vec] = await this.embedder.embedText([text]);
    const rows = this.db
      .prepare(
        `SELECT publication_number, distance
         FROM priorart_vec
         WHERE workspace_id = ? AND embedding MATCH ?
         ORDER BY distance
         LIMIT ?`,
      )
      .all(this.workspaceId, Buffer.from(new Float32Array(vec).buffer), k) as RankedHit[];
    return rows;
  }

  close() {
    this.db.close();
  }
}
