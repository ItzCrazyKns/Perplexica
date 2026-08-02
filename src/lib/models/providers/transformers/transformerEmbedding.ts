import BaseEmbedding from '../../base/embedding';
import { FeatureExtractionPipeline } from '@huggingface/transformers';

type TransformerConfig = {
  model: string;
};

/* Module scoped, keyed by model: instances are recreated on provider
   config changes, and each ONNX load costs seconds and hundreds of MB. */
const pipelines = new Map<string, Promise<FeatureExtractionPipeline>>();

const getPipeline = (model: string): Promise<FeatureExtractionPipeline> => {
  let p = pipelines.get(model);

  if (!p) {
    p = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const result = await pipeline('feature-extraction', model, {
        dtype: 'fp32',
      });
      return result as FeatureExtractionPipeline;
    })();

    /* A failed load must not poison the cache for every later call. */
    p.catch(() => pipelines.delete(model));
    pipelines.set(model, p);
  }

  return p;
};

class TransformerEmbedding extends BaseEmbedding<TransformerConfig> {
  constructor(protected config: TransformerConfig) {
    super(config);
  }

  async embedText(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  private async embed(texts: string[]) {
    const pipe = await getPipeline(this.config.model);
    const output = await pipe(texts, { pooling: 'mean', normalize: true });
    return output.tolist() as number[][];
  }
}

export default TransformerEmbedding;
