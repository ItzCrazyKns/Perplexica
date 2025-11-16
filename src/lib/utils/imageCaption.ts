import path from 'node:path';

type CaptionPipeline = (image: string) => Promise<any>;

let pipelinePromise: Promise<CaptionPipeline> | null = null;
let captionPipeline: CaptionPipeline | null = null;

const loadPipeline = async (): Promise<CaptionPipeline> => {
  if (captionPipeline) {
    return captionPipeline;
  }

  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const instance = await pipeline(
        'image-to-text',
        'Xenova/vit-gpt2-image-captioning',
      );

      const wrapped = async (image: string) => {
        const normalized = path.resolve(image);
        return instance(normalized);
      };

      captionPipeline = wrapped;
      return wrapped;
    })().catch((error) => {
      pipelinePromise = null;
      console.error('[imageCaption] Failed to initialise pipeline:', error);
      throw error;
    });
  }

  return pipelinePromise;
};

export const describeImage = async (
  imagePath: string,
): Promise<string | null> => {
  try {
    const pipeline = await loadPipeline();
    const output = await pipeline(imagePath);

    const candidate = Array.isArray(output)
      ? output[0]?.generated_text ?? output[0]?.output_text
      : output?.generated_text ?? output?.output_text;

    if (typeof candidate === 'string') {
      const caption = candidate.trim();
      return caption.length > 0 ? caption : null;
    }

    return null;
  } catch (error) {
    console.error(
      `[imageCaption] Failed to describe image "${imagePath}":`,
      error,
    );
    return null;
  }
};

