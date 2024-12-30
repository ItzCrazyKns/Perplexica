import { BaseOutputParser } from "@langchain/core/output_parsers";

export interface ImageSearchResult {
  query: string;
  context?: string;
}

class ImageOutputParser extends BaseOutputParser<ImageSearchResult> {
  lc_namespace = ['langchain', 'output_parsers', 'image_output_parser'];
  
  async parse(text: string): Promise<ImageSearchResult> {
    const parts = text.split('IMAGE:');
    return {
      query: parts[1]?.trim() || '',
      context: parts[0].replace('RÉSUMÉ:', '').trim()
    };
  }

  getFormatInstructions(): string {
    return `Le format attendu est:
RÉSUMÉ: <contexte>
IMAGE: <requête d'image>`;
  }
}

export default ImageOutputParser; 