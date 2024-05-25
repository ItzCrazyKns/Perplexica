export interface Settings {
  chatModelProviders: {
    [key: string]: string[];
  };
  embeddingModelProviders: {
    [key: string]: string[];
  };
  openaiApiKey: string;
  groqApiKey: string;
  ollamaApiUrl: string;
  copilotEnabled: boolean;
}
