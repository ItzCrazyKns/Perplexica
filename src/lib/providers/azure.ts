import {
  AzureChatOpenAI,
  AzureOpenAIEmbeddings,
} from '@langchain/azure-openai';
import { getAzureOpenaiApiKey, getAzureOpenaiEndpoint } from '../../config';
import {
  getAzureOpenaiDeploymentNameGpt35,
  getAzureOpenaiDeploymentNameGpt35_16K,
  getAzureOpenaiDeploymentNameGpt35TurboInstruct,
  getAzureOpenaiDeploymentNameGpt4,
  getAzureOpenaiDeploymentNameGpt4_32K,
  getAzureOpenaiDeploymentNameGpt4o,
  getAzureOpenaiDeploymentNameGpt4oMini,
  getAzureOpenaiDeploymentNameEmbeddingsAda,
  getAzureOpenaiDeploymentNameEmbeddingsSmall,
  getAzureOpenaiDeploymentNameEmbeddingsLarge,
} from '../../config';
import logger from '../../utils/logger';

export const loadAzureOpenAIChatModels = async () => {
  const azureApiKey = getAzureOpenaiApiKey();
  const azureEndpoint = getAzureOpenaiEndpoint();

  if (!azureApiKey || !azureEndpoint) {
    logger.error('Azure OpenAI API key or endpoint is missing');
    return {};
  }

  const chatModels = {};

  try {
    const deploymentNames = {
      'GPT-3.5 turbo': getAzureOpenaiDeploymentNameGpt35(),
      'GPT-3.5 turbo 16K': getAzureOpenaiDeploymentNameGpt35_16K(),
      'GPT-3.5 turbo instruct':
        getAzureOpenaiDeploymentNameGpt35TurboInstruct(),
      'GPT-4': getAzureOpenaiDeploymentNameGpt4(),
      'GPT-4 32K': getAzureOpenaiDeploymentNameGpt4_32K(),
      'GPT-4 omni': getAzureOpenaiDeploymentNameGpt4o(),
      'GPT-4 omni mini': getAzureOpenaiDeploymentNameGpt4oMini(),
    };

    let atLeastOneModelLoaded = false;

    for (const [modelName, deploymentName] of Object.entries(deploymentNames)) {
      try {
        if (deploymentName) {
          chatModels[modelName] = new AzureChatOpenAI({
            azureOpenAIEndpoint: azureEndpoint,
            azureOpenAIApiKey: azureApiKey,
            azureOpenAIApiDeploymentName: deploymentName,
            temperature: 0.7,
          });
          atLeastOneModelLoaded = true;
        }
      } catch (error) {
        logger.warn(
          `Deployment for ${modelName} is missing or failed to load:`,
          error,
        );
        // Continue the loop even if a specific model fails
      }
    }

    // Check if at least one model is loaded, log error if not
    if (!atLeastOneModelLoaded) {
      logger.error(
        'No chat models for Azure OpenAI could be loaded. At least one model is required.',
      );
      return {};
    }

    return chatModels;
  } catch (error) {
    logger.error('Failed to load Azure OpenAI chat models', error);
    return {};
  }
};

export const loadAzureOpenAIEmbeddings = async () => {
  const azureApiKey = getAzureOpenaiApiKey();
  const azureEndpoint = getAzureOpenaiEndpoint();

  if (!azureApiKey || !azureEndpoint) return {};

  try {
    const embeddings = {
      'Text embedding Ada 002': new AzureOpenAIEmbeddings({
        azureOpenAIEndpoint: azureEndpoint,
        azureOpenAIApiKey: azureApiKey,
        azureOpenAIApiDeploymentName:
          getAzureOpenaiDeploymentNameEmbeddingsAda(),
      }),
      'Text embedding 3 small': new AzureOpenAIEmbeddings({
        azureOpenAIEndpoint: azureEndpoint,
        azureOpenAIApiKey: azureApiKey,
        azureOpenAIApiDeploymentName:
          getAzureOpenaiDeploymentNameEmbeddingsSmall(),
      }),
      'Text embedding 3 large': new AzureOpenAIEmbeddings({
        azureOpenAIEndpoint: azureEndpoint,
        azureOpenAIApiKey: azureApiKey,
        azureOpenAIApiDeploymentName:
          getAzureOpenaiDeploymentNameEmbeddingsLarge(),
      }),
    };

    return embeddings;
  } catch (error) {
    logger.error('Failed to load Azure OpenAI embeddings', error);
    return {};
  }
};
