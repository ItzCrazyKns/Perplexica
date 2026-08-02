abstract class BaseEmbedding<CONFIG> {
  constructor(protected config: CONFIG) {}
  abstract embedText(texts: string[]): Promise<number[][]>;
}

export default BaseEmbedding;
