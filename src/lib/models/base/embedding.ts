import { Chunk } from '@/lib/types';

abstract class BaseEmbedding<CONFIG> {
  constructor(protected config: CONFIG) {}
  abstract embedText(texts: string[]): Promise<number[][]>;
  abstract embedChunks(chunks: Chunk[]): Promise<number[][]>;
}

export default BaseEmbedding;
