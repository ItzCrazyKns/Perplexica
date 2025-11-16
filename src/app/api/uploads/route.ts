import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import ModelRegistry from '@/lib/models/registry';
import { describeImage } from '@/lib/utils/imageCaption';

interface FileRes {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

const TEXT_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const files = formData.getAll('files') as File[];
    const embedding_model = formData.get('embedding_model_key') as string;
    const embedding_model_provider = formData.get(
      'embedding_model_provider_id',
    ) as string;

    const registry = new ModelRegistry();

    let embeddingModel: Awaited<
      ReturnType<typeof registry.loadEmbeddingModel>
    > | null = null;

    if (embedding_model && embedding_model_provider) {
      try {
        embeddingModel = await registry.loadEmbeddingModel(
          embedding_model_provider,
          embedding_model,
        );
      } catch (error) {
        console.warn(
          '[uploads] Failed to load embedding model. Continuing without embeddings.',
          error,
        );
      }
    }

    const processedFiles: FileRes[] = [];

    for (const file of files as any[]) {
      if (!file?.name) continue;

      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const isText = fileExtension ? TEXT_EXTENSIONS.has(fileExtension) : false;
      const isImage = fileExtension
        ? IMAGE_EXTENSIONS.has(fileExtension)
        : false;

      if (!fileExtension || (!isText && !isImage)) {
        return NextResponse.json(
          { message: 'File type not supported' },
          { status: 400 },
        );
      }

      const uniqueFileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
      const filePath = path.join(uploadDir, uniqueFileName);

      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, new Uint8Array(buffer));

      let extractedContents: string[] = [];
      if (isImage) {
        const caption = await describeImage(filePath);
        if (caption) {
          extractedContents = [caption];
        }
      } else {
        let docs: Document[] = [];
        if (fileExtension === 'pdf') {
          const loader = new PDFLoader(filePath);
          docs = await loader.load();
        } else if (fileExtension === 'docx') {
          const loader = new DocxLoader(filePath);
          docs = await loader.load();
        } else if (fileExtension === 'txt') {
          const text = fs.readFileSync(filePath, 'utf-8');
          docs = [
            new Document({ pageContent: text, metadata: { title: file.name } }),
          ];
        }

        const splitted = await splitter.splitDocuments(docs);
        extractedContents = splitted.map((doc) => doc.pageContent);
      }

      const extractedDataPath = filePath.replace(/\.\w+$/, '-extracted.json');
      fs.writeFileSync(
        extractedDataPath,
        JSON.stringify({
          title: file.name,
          contents: extractedContents,
        }),
      );

      const embeddingsDataPath = filePath.replace(
        /\.\w+$/,
        '-embeddings.json',
      );

      let embeddings: number[][] = [];
      if (extractedContents.length > 0 && embeddingModel) {
        try {
          embeddings = await embeddingModel.embedDocuments(extractedContents);
        } catch (error) {
          console.warn(
            '[uploads] Failed to generate embeddings for uploaded file.',
            error,
          );
        }
      }
      fs.writeFileSync(
        embeddingsDataPath,
        JSON.stringify({
          title: file.name,
          embeddings,
        }),
      );

      processedFiles.push({
        fileName: file.name,
        fileExtension,
        fileId: uniqueFileName.replace(/\.\w+$/, ''),
      });
    }

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
