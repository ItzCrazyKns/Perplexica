import { NextRequest, NextResponse } from 'next/server';
import ModelRegistry from '@/lib/models/registry';
import UploadManager from '@/lib/uploads/manager';
import { requireAuth } from '@/lib/middleware';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.success) return auth.error;

    const formData = await req.formData();

    const files = formData.getAll('files') as File[];
    const embeddingModel = formData.get('embedding_model_key') as string;
    const embeddingModelProvider = formData.get('embedding_model_provider_id') as string;

    if (!embeddingModel || !embeddingModelProvider) {
      return NextResponse.json(
        { message: 'Missing embedding model or provider' },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();

    const model = await registry.loadEmbeddingModel(embeddingModelProvider, embeddingModel);
    
    const uploadManager = new UploadManager({
      embeddingModel: model,
      userId: auth.user.id, // Scope uploads to authenticated user
    });

    const processedFiles = await uploadManager.processFiles(files, auth.user.id);

    return NextResponse.json({
      files: processedFiles,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
}
