import { Embeddings } from '@langchain/core/embeddings';
import {
  loadCachedEmbedding,
  writeCachedEmbedding,
  purgeEmbeddingCache,
} from './embeddingCache';

// Initialize cache purging on first import
purgeEmbeddingCache().catch((err) => {
  console.warn(
    '[embeddingCache] Failed to purge cache on initialization:',
    err,
  );
});

/**
 * CachedEmbeddings - A wrapper class that provides caching functionality for embeddings.
 * This class encapsulates the LangChain Embeddings instance along with provider/model metadata
 * and handles all caching logic transparently.
 */
export class CachedEmbeddings {
  private embeddings: Embeddings;
  private provider: string;
  private model: string;

  constructor(embeddings: Embeddings, provider: string, model: string) {
    this.embeddings = embeddings;
    this.provider = provider;
    this.model = model;
  }

  /**
   * Embed a single query with caching
   */
  async embedQuery(content: string): Promise<number[]> {
    // Try to load from cache first
    const cached = await loadCachedEmbedding(
      this.provider,
      this.model,
      content,
    );
    if (cached) {
      return cached;
    }

    // Cache miss - compute embedding
    const embedding = await this.embeddings.embedQuery(content);

    // Store in cache for future use
    await writeCachedEmbedding(this.provider, this.model, content, embedding);

    return embedding;
  }

  /**
   * Embed multiple documents with caching
   */
  async embedDocuments(contents: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const uncachedIndices: number[] = [];
    const uncachedContents: string[] = [];

    // Check cache for each content
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      const cached = await loadCachedEmbedding(
        this.provider,
        this.model,
        content,
      );

      if (cached) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
        uncachedContents.push(content);
      }
    }

    // Compute embeddings for uncached contents
    if (uncachedContents.length > 0) {
      const newEmbeddings =
        await this.embeddings.embedDocuments(uncachedContents);

      // Store new embeddings in cache and results array
      for (let i = 0; i < uncachedContents.length; i++) {
        const originalIndex = uncachedIndices[i];
        const content = uncachedContents[i];
        const embedding = newEmbeddings[i];

        results[originalIndex] = embedding;

        // Cache the embedding (fire and forget)
        writeCachedEmbedding(
          this.provider,
          this.model,
          content,
          embedding,
        ).catch((err) => {
          console.warn(
            `[CachedEmbeddings] Failed to cache embedding for ${this.provider}:${this.model}:`,
            err,
          );
        });
      }
    }

    return results;
  }

  /**
   * Get the provider name
   */
  getProvider(): string {
    return this.provider;
  }

  /**
   * Get the model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get a string representation of the provider:model combination
   */
  getIdentifier(): string {
    return `${this.provider}:${this.model}`;
  }

  /**
   * Get the underlying embeddings instance (for compatibility if needed)
   * @deprecated Use the cached methods instead
   */
  getEmbeddings(): Embeddings {
    return this.embeddings;
  }
}

/**
 * Manually purge the embedding cache (removes expired and LRU entries)
 */
export async function purgeCache() {
  await purgeEmbeddingCache();
}
