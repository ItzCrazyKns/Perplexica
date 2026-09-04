import { UIConfigField } from '@/lib/config/types';
import { ProviderMetadata } from '../../types';
import OllamaProvider from '../ollama';

// llmman (https://github.com/llmmanorg/llmman) serves the Ollama API on port
// 17434, so only the config fields and metadata differ from OllamaProvider.

const providerConfigFields: UIConfigField[] = [
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for llmman',
    required: true,
    placeholder: process.env.DOCKER
      ? 'http://host.docker.internal:17434'
      : 'http://localhost:17434',
    env: 'LLMMAN_BASE_URL',
    scope: 'server',
  },
];

class LlmmanProvider extends OllamaProvider {
  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'llmman',
      name: 'llmman',
    };
  }
}

export default LlmmanProvider;
