import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { AzureChatOpenAI, AzureOpenAIEmbeddings } from '@langchain/openai';
import BaseModelProvider from './baseProvider';
import { Model, ModelList, ProviderMetadata } from '../types';
import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';

interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  apiVersion: string;
  chatDeployment: string;
  embeddingDeployment?: string;
  embeddingEndpoint?: string;
  embeddingApiKey?: string;
  embeddingApiVersion?: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Azure OpenAI API key',
    required: true,
    placeholder: 'Azure OpenAI API Key',
    env: 'AZURE_OPENAI_API_KEY',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Endpoint',
    key: 'endpoint',
    description: 'The endpoint for your Azure OpenAI resource',
    required: true,
    placeholder: 'https://<resource>.openai.azure.com',
    env: 'AZURE_OPENAI_ENDPOINT',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'API Version',
    key: 'apiVersion',
    description: 'The API version to use with Azure OpenAI',
    required: true,
    placeholder: '2025-01-01-preview',
    env: 'AZURE_OPENAI_API_VERSION',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Chat Deployment Name',
    key: 'chatDeployment',
    description:
      'Deployment name for chat/completions requests (e.g. gpt-4o-chat)',
    required: true,
    placeholder: 'Azure Chat Deployment',
    env: 'AZURE_OPENAI_DEPLOYMENT',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Embeddings Deployment Name',
    key: 'embeddingDeployment',
    description:
      'Optional deployment name for embeddings requests (defaults to chat deployment when omitted)',
    required: false,
    placeholder: 'Azure Embeddings Deployment',
    env: 'AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Embeddings Endpoint',
    key: 'embeddingEndpoint',
    description:
      'Optional endpoint override for embeddings requests (defaults to chat endpoint)',
    required: false,
    placeholder: 'https://<resource>.openai.azure.com',
    env: 'AZURE_OPENAI_EMBEDDINGS_ENDPOINT',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Embeddings API Version',
    key: 'embeddingApiVersion',
    description:
      'Optional API version override for embeddings requests (defaults to chat API version)',
    required: false,
    placeholder: '2023-05-15',
    env: 'AZURE_OPENAI_API_EMBEDDINGS_VERSION',
    scope: 'server',
  },
  {
    type: 'password',
    name: 'Embeddings API Key',
    key: 'embeddingApiKey',
    description:
      'Optional Azure OpenAI API key to use exclusively for embeddings requests',
    required: false,
    placeholder: 'Azure Embeddings API Key',
    env: 'AZURE_OPENAI_API_EMBEDDING_KEY',
    scope: 'server',
  },
];

const normalizeAzureBasePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    const cleanedPath = url.pathname
      .replace(/\/openai\/deployments\/[^/]+\/embeddings\/?$/i, '')
      .replace(/\/openai\/deployments\/[^/]+\/?$/i, '')
      .replace(/\/$/, '');

    url.pathname = cleanedPath;
    url.search = '';
    url.hash = '';

    const result = url.origin + (url.pathname === '/' ? '' : url.pathname);
    return result.replace(/\/$/, '');
  } catch {
    return trimmed
      .replace(/\/openai\/deployments\/[^/]+\/embeddings(?:\/)?(?:\?.*)?$/i, '')
      .replace(/\/openai\/deployments\/[^/]+(?:\/)?(?:\?.*)?$/i, '')
      .replace(/\/$/, '');
  }
};

class AzureOpenAIProvider extends BaseModelProvider<AzureOpenAIConfig> {
  constructor(id: string, name: string, config: AzureOpenAIConfig) {
    super(id, name, config);
  }

  private getDefaultChatModels(): Model[] {
    if (!this.config.chatDeployment) return [];

    return [
      {
        name: this.config.chatDeployment,
        key: this.config.chatDeployment,
      },
    ];
  }

  private getDefaultEmbeddingModels(): Model[] {
    const deployment = this.config.embeddingDeployment || '';

    if (!deployment) return [];

    return [
      {
        name: deployment,
        key: deployment,
      },
    ];
  }

  async getDefaultModels(): Promise<ModelList> {
    return {
      chat: this.getDefaultChatModels(),
      embedding: this.getDefaultEmbeddingModels(),
    };
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id);

    if (!configProvider) {
      return defaultModels;
    }

    const mergeModels = (
      defaults: Model[],
      configured: Model[],
    ): Model[] => {
      const seen = new Set(defaults.map((m) => m.key));

      const additional = configured.filter((model) => {
        if (seen.has(model.key)) return false;
        seen.add(model.key);
        return true;
      });

      return [...defaults, ...additional];
    };

    return {
      chat: mergeModels(defaultModels.chat, configProvider.chatModels),
      embedding: mergeModels(
        defaultModels.embedding,
        configProvider.embeddingModels,
      ),
    };
  }

  async loadChatModel(key: string): Promise<BaseChatModel> {
    const modelList = await this.getModelList();
    const exists = modelList.chat.find((model) => model.key === key);

    if (!exists) {
      throw new Error(
        'Error loading Azure OpenAI chat model. Invalid deployment selected.',
      );
    }

    return new AzureChatOpenAI({
      temperature: 0.7,
      azureOpenAIApiKey: this.config.apiKey,
      azureOpenAIEndpoint: this.config.endpoint,
      azureOpenAIApiVersion: this.config.apiVersion,
      azureOpenAIApiDeploymentName: key,
      model: key,
    });
  }

  async loadEmbeddingModel(key: string): Promise<Embeddings> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((model) => model.key === key);

    if (!exists) {
      throw new Error(
        'Error loading Azure OpenAI embeddings model. Invalid deployment selected.',
      );
    }

    const apiKey =
      this.config.embeddingApiKey && this.config.embeddingApiKey.length > 0
        ? this.config.embeddingApiKey
        : this.config.apiKey;
    const endpoint =
      this.config.embeddingEndpoint && this.config.embeddingEndpoint.length > 0
        ? this.config.embeddingEndpoint
        : this.config.endpoint;
    const apiVersion =
      this.config.embeddingApiVersion &&
      this.config.embeddingApiVersion.length > 0
        ? this.config.embeddingApiVersion
        : this.config.apiVersion;

    const basePath = `${endpoint}/openai/deployments`;

    return new AzureOpenAIEmbeddings({
      azureOpenAIApiKey: apiKey,
      azureOpenAIBasePath: basePath,
      azureOpenAIApiVersion: apiVersion,
      azureOpenAIApiDeploymentName: key,
      model: key,
    });
  }

  static parseAndValidate(raw: any): AzureOpenAIConfig {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid config provided. Expected object');
    }

    const apiKey = raw.apiKey;
    const endpoint = raw.endpoint;
    const apiVersion = raw.apiVersion;
    const chatDeployment = raw.chatDeployment ?? raw.deployment;
    const embeddingDeployment = raw.embeddingDeployment;
    const embeddingEndpoint = raw.embeddingEndpoint ?? raw.embeddingsEndpoint;
    const embeddingApiKey =
      raw.embeddingApiKey ?? raw.embeddingsApiKey ?? raw.embeddingKey;
    const embeddingApiVersion =
      raw.embeddingApiVersion ?? raw.embeddingsApiVersion;

    if (!apiKey || !endpoint || !apiVersion || !chatDeployment) {
      throw new Error(
        'Invalid config provided. API key, endpoint, API version, and chat deployment must be provided',
      );
    }

    return {
      apiKey: String(apiKey).trim(),
      endpoint: normalizeAzureBasePath(String(endpoint)),
      apiVersion: String(apiVersion).trim(),
      chatDeployment: String(chatDeployment).trim(),
      embeddingDeployment: embeddingDeployment
        ? String(embeddingDeployment).trim()
        : undefined,
      embeddingEndpoint: embeddingEndpoint
        ? normalizeAzureBasePath(String(embeddingEndpoint))
        : undefined,
      embeddingApiKey: embeddingApiKey
        ? String(embeddingApiKey).trim()
        : undefined,
      embeddingApiVersion: embeddingApiVersion
        ? String(embeddingApiVersion).trim()
        : undefined,
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'azure-openai',
      name: 'Azure OpenAI',
    };
  }
}

export default AzureOpenAIProvider;
