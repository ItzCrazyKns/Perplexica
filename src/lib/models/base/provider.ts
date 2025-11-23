import { ModelList, ProviderMetadata } from '../types';
import { UIConfigField } from '@/lib/config/types';
import BaseLLM from './llm';
import BaseEmbedding from './embedding';

abstract class BaseModelProvider<CONFIG> {
  constructor(
    protected id: string,
    protected name: string,
    protected config: CONFIG,
  ) {}
  abstract getDefaultModels(): Promise<ModelList>;
  abstract getModelList(): Promise<ModelList>;
  abstract loadChatModel(modelName: string): Promise<BaseLLM<any>>;
  abstract loadEmbeddingModel(modelName: string): Promise<BaseEmbedding<any>>;
  static getProviderConfigFields(): UIConfigField[] {
    throw new Error('Method not implemented.');
  }
  static getProviderMetadata(): ProviderMetadata {
    throw new Error('Method not Implemented.');
  }
  static parseAndValidate(raw: any): any {
    /* Static methods can't access class type parameters */
    throw new Error('Method not Implemented.');
  }
}

export type ProviderConstructor<CONFIG> = {
  new (id: string, name: string, config: CONFIG): BaseModelProvider<CONFIG>;
  parseAndValidate(raw: any): CONFIG;
  getProviderConfigFields: () => UIConfigField[];
  getProviderMetadata: () => ProviderMetadata;
};

export const createProviderInstance = <P extends ProviderConstructor<any>>(
  Provider: P,
  id: string,
  name: string,
  rawConfig: unknown,
): InstanceType<P> => {
  const cfg = Provider.parseAndValidate(rawConfig);
  return new Provider(id, name, cfg) as InstanceType<P>;
};

export default BaseModelProvider;
