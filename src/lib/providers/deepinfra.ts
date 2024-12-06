import { DeepInfraEmbeddings } from "@langchain/community/embeddings/deepinfra";
import { ChatDeepInfra } from "@langchain/community/chat_models/deepinfra";
import { getDeepInftaApiKeys } from "../../config";
import logger from '../../utils/logger';

export const loadDeepInfraChatModels = async () => {
    const deepinfraApiKey = getDeepInftaApiKeys();
  
    if (!deepinfraApiKey) return {};
  
    try {
      const chatModels = {
        'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': {
          displayName: 'LLaMA 3.1 70B Turbo',
          model: new ChatDeepInfra({
            model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
            temperature: 0.7,
            apiKey: deepinfraApiKey,
          }),
        },
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': {
          displayName: 'LLaMA 3.1 8B Turbo',
          model: new ChatDeepInfra({
            model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
            temperature: 0.7,
            apiKey: deepinfraApiKey,
          }),
        },
        'meta-llama/Meta-Llama-3.1-70B-Instruct': {
          displayName: 'LLaMA 3.1 70B',
          model: new ChatDeepInfra({
            model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
            temperature: 0.7,
            apiKey: deepinfraApiKey,
          }),
        },
        'meta-llama/Meta-Llama-3.1-8B-Instruct': {
          displayName: 'LLaMA 3.1 8B',
          model: new ChatDeepInfra({
            model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
            temperature: 0.7,
            apiKey: deepinfraApiKey,
          }),
        },
      };
  
      return chatModels;
    } catch (err) {
      logger.error(`Error loading Gemini models: ${err}`);
      return {};
    }
  };
  
  export const loadDeepInfraEmbeddingsModels = async () => {
    const deepinfraApiKey = getDeepInftaApiKeys();
  
    if (!deepinfraApiKey) return {};
  
    try {
      const embeddingModels = {
        'BAAI/bge-m3': {
          displayName: 'BAAI/bge-m3',
          model: new DeepInfraEmbeddings({
            apiToken: deepinfraApiKey,
            modelName: 'BAAI/bge-m3',
          }),
        },
      };
  
      return embeddingModels;
    } catch (err) {
      logger.error(`Error loading Gemini embeddings model: ${err}`);
      return {};
    }
  };
  