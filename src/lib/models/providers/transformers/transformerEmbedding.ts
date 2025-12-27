import { Chunk } from '@/lib/types';
import BaseEmbedding from '../../base/embedding';
import { FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';

type TransformerConfig = {
  model: string;
};

class TransformerEmbedding extends BaseEmbedding<TransformerConfig> {
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(protected config: TransformerConfig) {
    super(config);
  }

  async embedText(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    return this.embed(chunks.map((c) => c.content));
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        const transformers = await import('@huggingface/transformers');
        return (await transformers.pipeline(
          'feature-extraction',
          this.config.model,
        )) as unknown as FeatureExtractionPipeline;
      })();
    }

    const pipeline = await this.pipelinePromise;

    const output = await pipeline(texts, { pooling: 'mean', normalize: true });

    return output.tolist() as number[][];
  }
}

export default TransformerEmbedding;
