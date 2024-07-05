import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

export interface HuggingFaceTransformersEmbeddingsParameters extends EmbeddingsParams {
  modelName: string;

  model: string;

  timeout?: number;

  batchSize?: number;

  stripNewLines?: boolean;
}

export class HuggingFaceTransformersEmbeddings
  extends Embeddings
  implements HuggingFaceTransformersEmbeddingsParameters
{
  modelName = "Xenova/all-MiniLM-L6-v2";

  model = "Xenova/all-MiniLM-L6-v2";

  batchSize = 512;

  stripNewLines = true;

  timeout?: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipelinePromise: Promise<any>;

  constructor(fields?: Partial<HuggingFaceTransformersEmbeddingsParameters>) {
    super(fields ?? {});

    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.timeout = fields?.timeout;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(this.stripNewLines ? texts.map(t => t.replaceAll("\n", " ")) : texts, this.batchSize);

    const batchRequests = batches.map(batch => this.runEmbedding(batch));
    const batchResponses = await Promise.all(batchRequests);
    const embeddings: number[][] = [];

    for (const batchResponse of batchResponses) {
      for (const element of batchResponse) {
        embeddings.push(element);
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const data = await this.runEmbedding([this.stripNewLines ? text.replaceAll("\n", " ") : text]);
    return data[0];
  }

  private async runEmbedding(texts: string[]) {
    const { pipeline } = await import("@xenova/transformers");

    const pipe = await (this.pipelinePromise ??= pipeline("feature-extraction", this.model));

    return this.caller.call(async () => {
      const output = await pipe(texts, { pooling: "mean", normalize: true });
      return output.tolist();
    });
  }
}
