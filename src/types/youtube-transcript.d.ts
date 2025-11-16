declare module 'youtube-transcript' {
  export interface TranscriptItem {
    text: string;
    offset: number;
    duration: number;
  }

  export interface TranscriptOptions {
    lang?: string;
    country?: string;
  }

  export class YoutubeTranscript {
    static fetchTranscript(
      videoId: string,
      options?: TranscriptOptions,
    ): Promise<TranscriptItem[]>;
  }
}

