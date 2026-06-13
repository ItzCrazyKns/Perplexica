import db from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ModelRegistry from '@/lib/models/registry';
import UploadManager from '@/lib/uploads/manager';
import Database from 'better-sqlite3';
import path from 'path';

const rawDb = new Database(path.join(process.cwd(), './data/db.sqlite'));

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const embeddingModelKey = formData.get('embedding_model_key') as string;
    const embeddingModelProviderId = formData.get('embedding_model_provider_id') as string;

    if (!embeddingModelKey || !embeddingModelProviderId) {
      return Response.json(
        { message: 'Embedding model is not configured. Please configure it in Settings before adding files.' },
        { status: 400 },
      );
    }

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const registry = new ModelRegistry();
    const embeddingModel = await registry.loadEmbeddingModel(embeddingModelProviderId, embeddingModelKey);

    const manager = new UploadManager({ embeddingModel });
    const processed = await manager.processFiles(files);

    const addFiles = rawDb.transaction(() => {
      const row = rawDb.prepare('SELECT files FROM spaces WHERE id = ?').get(id) as { files: string } | undefined;
      if (!row) throw new Error('Space not found');
      const current: { fileId: string; name: string }[] = JSON.parse(row.files || '[]');
      const newEntries = processed.map((f) => ({ fileId: f.fileId, name: f.fileName }));
      const updated = [...current, ...newEntries];
      rawDb.prepare('UPDATE spaces SET files = ?, updatedAt = ? WHERE id = ?').run(
        JSON.stringify(updated),
        new Date().toISOString(),
        id,
      );
      return updated;
    });

    const updatedFiles = addFiles();

    return Response.json({ files: updatedFiles, added: processed }, { status: 200 });
  } catch (err) {
    console.error('Error adding files to space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const { fileId } = await req.json();

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const removeFile = rawDb.transaction(() => {
      const row = rawDb.prepare('SELECT files FROM spaces WHERE id = ?').get(id) as { files: string } | undefined;
      if (!row) throw new Error('Space not found');
      const current: { fileId: string; name: string }[] = JSON.parse(row.files || '[]');
      const updated = current.filter((f) => f.fileId !== fileId);
      rawDb.prepare('UPDATE spaces SET files = ?, updatedAt = ? WHERE id = ?').run(
        JSON.stringify(updated),
        new Date().toISOString(),
        id,
      );
      return updated;
    });

    const updatedFiles = removeFile();

    return Response.json({ files: updatedFiles }, { status: 200 });
  } catch (err) {
    console.error('Error removing file from space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
