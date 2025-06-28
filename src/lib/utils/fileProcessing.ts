import { Document } from 'langchain/document';
import fs from 'node:fs';
import path from 'node:path';
import computeSimilarity from './computeSimilarity';

/**
 * File data interface for similarity search objects
 */
export interface FileData {
  fileName: string;
  content: string;
  embeddings: number[];
}

/**
 * Processes file IDs to extract content and create Document objects
 * @param fileIds Array of file IDs to process
 * @returns Array of Document objects with content and embeddings
 */
export async function processFilesToDocuments(fileIds: string[]): Promise<Document[]> {
  if (fileIds.length === 0) {
    return [];
  }

  const filesData: FileData[] = fileIds
    .map((file) => {
      try {
        const filePath = path.join(process.cwd(), 'uploads', file);

        const contentPath = filePath + '-extracted.json';
        const embeddingsPath = filePath + '-embeddings.json';

        // Check if files exist
        if (!fs.existsSync(contentPath) || !fs.existsSync(embeddingsPath)) {
          console.warn(`File processing data not found for file: ${file}`);
          return [];
        }

        const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
        const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));

        const fileSimilaritySearchObject = content.contents.map(
          (c: string, i: number) => {
            return {
              fileName: content.title,
              content: c,
              embeddings: embeddings.embeddings[i],
            };
          },
        );

        return fileSimilaritySearchObject;
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
        return [];
      }
    })
    .flat();

  // Convert file data to Document objects
  const documents = filesData.map((fileData) => {
    return new Document({
      pageContent: fileData.content,
      metadata: {
        title: fileData.fileName,
        url: 'File', //TODO: Consider using a more meaningful URL or identifier especially for citation purposes
        embeddings: fileData.embeddings,
      },
    });
  });

  return documents;
}

/**
 * Ranks documents based on similarity to a query embedding
 * @param queryEmbedding The embedding vector for the query
 * @param documents Documents to rank
 * @param maxDocs Maximum number of documents to return
 * @param similarityThreshold Minimum similarity threshold (default: 0.3)
 * @returns Ranked documents sorted by similarity
 */
export function getRankedDocs(
  queryEmbedding: number[],
  documents: Document[],
  maxDocs: number = 8,
  similarityThreshold: number = 0.3,
): Document[] {
  if (documents.length === 0) {
    return [];
  }

  // Import computeSimilarity utility
  
  const similarity = documents.map((doc, i) => {
    const sim = computeSimilarity(
      queryEmbedding,
      doc.metadata?.embeddings || [],
    );
    return {
      index: i,
      similarity: sim,
    };
  });

  const rankedDocs = similarity
    .filter((sim) => sim.similarity > similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxDocs)
    .map((sim) => documents[sim.index]);

  return rankedDocs;
}
