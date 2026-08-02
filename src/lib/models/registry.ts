import { ConfigModelProvider } from '../config/types';
import BaseModelProvider, { createProviderInstance } from './base/provider';
import { getConfiguredModelProviders } from '../config/serverRegistry';
import { providers } from './providers';
import { MinimalProvider, ModelList } from './types';
import configManager from '../config';

const MODEL_LIST_TTL_MS = 60_000;

class ModelRegistry {
  /* One instance per process: constructing per request re-validated
     every provider config and refetched every model list before the
     first token of every chat. */
  private static instance: ModelRegistry | null = null;

  static getInstance(): ModelRegistry {
    return (this.instance ??= new ModelRegistry());
  }

  activeProviders: (ConfigModelProvider & {
    provider: BaseModelProvider<any>;
  })[] = [];

  private modelListCache = new Map<string, { at: number; list: ModelList }>();

  private constructor() {
    this.initializeActiveProviders();
  }

  /* Wraps the instance rather than the registry call sites because
     loadChatModel/loadEmbeddingModel re-enter getModelList inside the
     provider; caching only in getActiveProviders would still put one
     or two live /models calls ahead of every chat request. */
  private withModelListCache<T extends BaseModelProvider<any>>(
    id: string,
    provider: T,
  ): T {
    const original = provider.getModelList.bind(provider);

    provider.getModelList = async (): Promise<ModelList> => {
      const cached = this.modelListCache.get(id);

      if (cached && Date.now() - cached.at < MODEL_LIST_TTL_MS) {
        return cached.list;
      }

      const list = await original();
      this.modelListCache.set(id, { at: Date.now(), list });
      return list;
    };

    return provider;
  }

  private initializeActiveProviders() {
    const configuredProviders = getConfiguredModelProviders();

    configuredProviders.forEach((p) => {
      try {
        const provider = providers[p.type];
        if (!provider) throw new Error('Invalid provider type');

        this.activeProviders.push({
          ...p,
          provider: this.withModelListCache(
            p.id,
            createProviderInstance(provider, p.id, p.name, p.config),
          ),
        });
      } catch (err) {
        console.error(
          `Failed to initialize provider. Type: ${p.type}, ID: ${p.id}, Config: ${JSON.stringify(p.config)}, Error: ${err}`,
        );
      }
    });
  }

  async getActiveProviders() {
    const providers: MinimalProvider[] = [];

    await Promise.all(
      this.activeProviders.map(async (p) => {
        let m: ModelList = { chat: [], embedding: [] };

        try {
          m = await p.provider.getModelList();
        } catch (err: any) {
          console.error(
            `Failed to get model list. Type: ${p.type}, ID: ${p.id}, Error: ${err.message}`,
          );

          m = {
            chat: [
              {
                key: 'error',
                name: err.message,
              },
            ],
            embedding: [],
          };
        }

        providers.push({
          id: p.id,
          name: p.name,
          chatModels: m.chat,
          embeddingModels: m.embedding,
        });
      }),
    );

    return providers;
  }

  async loadChatModel(providerId: string, modelName: string) {
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) throw new Error('Invalid provider id');

    const model = await provider.provider.loadChatModel(modelName);

    return model;
  }

  async loadEmbeddingModel(providerId: string, modelName: string) {
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) throw new Error('Invalid provider id');

    const model = await provider.provider.loadEmbeddingModel(modelName);

    return model;
  }

  async addProvider(
    type: string,
    name: string,
    config: Record<string, any>,
  ): Promise<ConfigModelProvider> {
    const provider = providers[type];
    if (!provider) throw new Error('Invalid provider type');

    /* Validate before persisting: a rejected config must not land in
       config.json where it would fail on every subsequent boot. */
    provider.parseAndValidate(config);

    const newProvider = configManager.addModelProvider(type, name, config);

    const instance = this.withModelListCache(
      newProvider.id,
      createProviderInstance(
        provider,
        newProvider.id,
        newProvider.name,
        newProvider.config,
      ),
    );

    let m: ModelList = { chat: [], embedding: [] };

    try {
      m = await instance.getModelList();
    } catch (err: any) {
      console.error(
        `Failed to get model list for newly added provider. Type: ${type}, ID: ${newProvider.id}, Error: ${err.message}`,
      );

      m = {
        chat: [
          {
            key: 'error',
            name: err.message,
          },
        ],
        embedding: [],
      };
    }

    this.activeProviders.push({
      ...newProvider,
      provider: instance,
    });

    return {
      ...newProvider,
      chatModels: m.chat || [],
      embeddingModels: m.embedding || [],
    };
  }

  async removeProvider(providerId: string): Promise<void> {
    configManager.removeModelProvider(providerId);
    this.modelListCache.delete(providerId);
    this.activeProviders = this.activeProviders.filter(
      (p) => p.id !== providerId,
    );

    return;
  }

  async updateProvider(
    providerId: string,
    name: string,
    config: any,
  ): Promise<ConfigModelProvider> {
    const updated = await configManager.updateModelProvider(
      providerId,
      name,
      config,
    );
    /* updated.config, not the raw body: redacted secrets have been
       resolved back to their stored values by the config manager. */
    this.modelListCache.delete(providerId);
    const instance = this.withModelListCache(
      providerId,
      createProviderInstance(
        providers[updated.type],
        providerId,
        name,
        updated.config,
      ),
    );

    let m: ModelList = { chat: [], embedding: [] };

    try {
      m = await instance.getModelList();
    } catch (err: any) {
      console.error(
        `Failed to get model list for updated provider. Type: ${updated.type}, ID: ${updated.id}, Error: ${err.message}`,
      );

      m = {
        chat: [
          {
            key: 'error',
            name: err.message,
          },
        ],
        embedding: [],
      };
    }

    /* Replace, not push: a duplicate id would make loadChatModel
       resolve the stale instance. */
    this.activeProviders = this.activeProviders.map((p) =>
      p.id === providerId ? { ...updated, provider: instance } : p,
    );

    return {
      ...updated,
      chatModels: m.chat || [],
      embeddingModels: m.embedding || [],
    };
  }

  /* Using async here because maybe in the future we might want to add some validation?? */
  async addProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    model: any,
  ): Promise<any> {
    const addedModel = configManager.addProviderModel(providerId, type, model);
    /* The cached list would hide the new model from loadChatModel
       until the TTL lapses. */
    this.modelListCache.delete(providerId);
    return addedModel;
  }

  async removeProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    modelKey: string,
  ): Promise<void> {
    configManager.removeProviderModel(providerId, type, modelKey);
    this.modelListCache.delete(providerId);
    return;
  }
}

export default ModelRegistry;
