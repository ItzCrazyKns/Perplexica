import { NextResponse } from 'next/server';
import ModelRegistry from '@/lib/models/registry';
import UploadManager from '@/lib/uploads/manager';

const MAX_FILES_PER_REQUEST = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  try {
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

    if (files.length === 0 || files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { message: `Between 1 and ${MAX_FILES_PER_REQUEST} files required.` },
        { status: 400 },
      );
    }

    const oversized = files.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      return NextResponse.json(
        {
          message: `File ${oversized.name} exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit.`,
        },
        { status: 413 },
      );
    }

    const registry = new ModelRegistry();

    const model = await registry.loadEmbeddingModel(embeddingModelProvider, embeddingModel);
    
    const uploadManager = new UploadManager({
      embeddingModel: model,
    })

    const processedFiles = await uploadManager.processFiles(files);

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
