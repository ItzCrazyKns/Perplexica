import fs from 'node:fs';
import path from 'node:path';
import { Document } from 'langchain/document';
import { Embeddings } from '@langchain/core/embeddings';
import { ConfigManager } from './ConfigManager';
import computeSimilarity from '@/lib/utils/computeSimilarity';

export class DocumentRanker {
  constructor(
    private configManager: ConfigManager,
    private embeddings: Embeddings,
  ) {}

  loadFilesData(fileIds: string[]) {
    return fileIds
      .map((file) => {
        const filePath = path.join(process.cwd(), 'uploads', file);
        const contentPath = filePath + '-extracted.json';
        const embeddingsPath = filePath + '-embeddings.json';

        if (!fs.existsSync(contentPath) || !fs.existsSync(embeddingsPath)) {
          return [];
        }

        const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
        const embeddingsData = JSON.parse(
          fs.readFileSync(embeddingsPath, 'utf8'),
        );

        return content.contents.map((c: string, i: number) => ({
          fileName: content.title,
          content: c,
          embeddings: embeddingsData.embeddings[i],
        }));
      })
      .flat();
  }

  async rerankDocs(
    query: string,
    docs: Document[],
    fileIds: string[],
    optimizationMode: 'speed' | 'balanced' | 'quality',
  ): Promise<Document[]> {
    if (docs.length === 0 && fileIds.length === 0) return docs;

    const filesData = this.loadFilesData(fileIds);

    const docsWithContent = docs.filter(
      (doc) => doc.pageContent && doc.pageContent.length > 0,
    );

    if (optimizationMode === 'speed' || !this.configManager.rerank) {
      if (filesData.length > 0) {
        const [queryEmbedding] = await Promise.all([
          this.embeddings.embedQuery(query),
        ]);

        const fileDocs = filesData.map(
          (fileData) =>
            new Document({
              pageContent: fileData.content,
              metadata: { title: fileData.fileName, url: 'File' },
            }),
        );

        const similarity = filesData.map((fileData, i) => {
          const sim = computeSimilarity(queryEmbedding, fileData.embeddings);
          return { index: i, similarity: sim };
        });

        let sortedDocs = similarity
          .filter((sim) => sim.similarity > this.configManager.rerankThreshold)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 15)
          .map((sim) => fileDocs[sim.index]);

        sortedDocs =
          docsWithContent.length > 0 ? sortedDocs.slice(0, 8) : sortedDocs;

        return [
          ...sortedDocs,
          ...docsWithContent.slice(0, 15 - sortedDocs.length),
        ];
      } else {
        return docsWithContent.slice(0, 15);
      }
    } else if (optimizationMode === 'balanced') {
      const [docEmbeddings, queryEmbedding] = await Promise.all([
        this.embeddings.embedDocuments(
          docsWithContent.map((doc) => doc.pageContent),
        ),
        this.embeddings.embedQuery(query),
      ]);

      docsWithContent.push(
        ...filesData.map(
          (fileData) =>
            new Document({
              pageContent: fileData.content,
              metadata: { title: fileData.fileName, url: 'File' },
            }),
        ),
      );

      docEmbeddings.push(...filesData.map((fileData) => fileData.embeddings));

      const similarity = docEmbeddings.map((docEmbedding, i) => {
        const sim = computeSimilarity(queryEmbedding, docEmbedding);
        return { index: i, similarity: sim };
      });

      const sortedDocs = similarity
        .filter((sim) => sim.similarity > this.configManager.rerankThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 15)
        .map((sim) => docsWithContent[sim.index]);

      return sortedDocs;
    }

    return [];
  }
}
