import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { ModelList, ProviderMetadata } from '../types';
import BaseModelProvider, { ProviderConstructor } from '../base/provider';
import BaseEmbedding from '../base/embedding';
import BaseLLM from '../base/llm';
import OpenAILLM from './openaiLLM';
import OpenAIEmbedding from './openaiEmbedding';

/*
 * Every provider except Ollama and Transformers speaks the OpenAI
 * wire protocol and differed only in config fields, base URL, model
 * discovery and embedding support; the classes were byte-duplicated.
 * One spec object per provider replaces each ~120-line copy.
 */
export type OpenAICompatibleSpec<C> = {
  key: string;
  name: string;
  configFields: UIConfigField[];
  parseAndValidate: (raw: any) => C;
  /* Connection params for the OpenAI SDK client. */
  resolve: (config: C) => { baseURL: string; apiKey: string };
  /* The provider's own discoverable models; user-added models from
     config are merged on top by getModelList. */
  listDefaultModels: (
    config: C,
    resolved: { baseURL: string; apiKey: string },
  ) => Promise<ModelList>;
  supportsEmbeddings: boolean;
};

export const createOpenAICompatibleProvider = <C>(
  spec: OpenAICompatibleSpec<C>,
): ProviderConstructor<C> => {
  return class extends BaseModelProvider<C> {
    constructor(id: string, name: string, config: C) {
      super(id, name, config);
    }

    async getDefaultModels(): Promise<ModelList> {
      return spec.listDefaultModels(this.config, spec.resolve(this.config));
    }

    async getModelList(): Promise<ModelList> {
      const defaultModels = await this.getDefaultModels();
      const configProvider = getConfiguredModelProviderById(this.id)!;

      return {
        embedding: spec.supportsEmbeddings
          ? [...defaultModels.embedding, ...configProvider.embeddingModels]
          : [],
        chat: [...defaultModels.chat, ...configProvider.chatModels],
      };
    }

    async loadChatModel(key: string): Promise<BaseLLM<any>> {
      const modelList = await this.getModelList();

      if (!modelList.chat.find((m) => m.key === key)) {
        throw new Error(
          `Error loading ${spec.name} chat model: invalid model selected`,
        );
      }

      const { baseURL, apiKey } = spec.resolve(this.config);
      return new OpenAILLM({ apiKey, model: key, baseURL });
    }

    async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
      if (!spec.supportsEmbeddings) {
        throw new Error(
          `${spec.name} provider does not support embedding models.`,
        );
      }

      const modelList = await this.getModelList();

      if (!modelList.embedding.find((m) => m.key === key)) {
        throw new Error(
          `Error loading ${spec.name} embedding model: invalid model selected`,
        );
      }

      const { baseURL, apiKey } = spec.resolve(this.config);
      return new OpenAIEmbedding({ apiKey, model: key, baseURL });
    }

    static parseAndValidate(raw: any): C {
      return spec.parseAndValidate(raw);
    }

    static getProviderConfigFields(): UIConfigField[] {
      return spec.configFields;
    }

    static getProviderMetadata(): ProviderMetadata {
      return { key: spec.key, name: spec.name };
    }
  };
};

export const requireObject = (raw: any) => {
  if (!raw || typeof raw !== 'object')
    throw new Error('Invalid config provided. Expected object');
  return raw;
};
