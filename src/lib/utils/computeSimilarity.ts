const computeSimilarity = (x: number[], y: number[]): number => {
  if (x.length !== y.length)
    throw new Error('Vectors must be of the same length');

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < x.length; i++) {
    dotProduct += x[i] * y[i];
    normA += x[i] * x[i];
    normB += y[i] * y[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export default computeSimilarity;
