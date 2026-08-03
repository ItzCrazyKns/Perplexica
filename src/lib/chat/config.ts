import { MinimalProvider } from '@/lib/models/types';

export interface ModelProviderSelection {
  key: string;
  providerId: string;
}

/* Resolves the stored model selection against the live provider list,
   falling back to the first available model, and persists the result. */
export const resolveModelConfig = async (): Promise<{
  chatModelProvider: ModelProviderSelection;
  embeddingModelProvider: ModelProviderSelection;
}> => {
  let chatModelKey = localStorage.getItem('chatModelKey');
  let chatModelProviderId = localStorage.getItem('chatModelProviderId');
  let embeddingModelKey = localStorage.getItem('embeddingModelKey');
  let embeddingModelProviderId = localStorage.getItem(
    'embeddingModelProviderId',
  );

  const res = await fetch(`/api/providers`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Provider fetching failed with status code ${res.status}`);
  }

  const data = await res.json();
  const providers: MinimalProvider[] = data.providers;

  if (providers.length === 0) {
    throw new Error(
      'No chat model providers found, please configure them in the settings page.',
    );
  }

  const chatModelProvider =
    providers.find((p) => p.id === chatModelProviderId) ??
    providers.find((p) => p.chatModels.length > 0);

  if (!chatModelProvider) {
    throw new Error(
      'No chat models found, pleae configure them in the settings page.',
    );
  }

  chatModelProviderId = chatModelProvider.id;

  const chatModel =
    chatModelProvider.chatModels.find((m) => m.key === chatModelKey) ??
    chatModelProvider.chatModels[0];
  chatModelKey = chatModel.key;

  /* The built-in Transformers provider is the zero-config last
     resort; when real embedding providers exist, prefer them. */
  const embeddingModelProvider =
    providers.find((p) => p.id === embeddingModelProviderId) ??
    providers.find(
      (p) =>
        p.embeddingModels.length > 0 &&
        p.name.toLowerCase() !== 'transformers',
    ) ??
    providers.find((p) => p.embeddingModels.length > 0);

  if (!embeddingModelProvider) {
    throw new Error(
      'No embedding models found, pleae configure them in the settings page.',
    );
  }

  embeddingModelProviderId = embeddingModelProvider.id;

  const embeddingModel =
    embeddingModelProvider.embeddingModels.find(
      (m) => m.key === embeddingModelKey,
    ) ?? embeddingModelProvider.embeddingModels[0];
  embeddingModelKey = embeddingModel.key;

  localStorage.setItem('chatModelKey', chatModelKey);
  localStorage.setItem('chatModelProviderId', chatModelProviderId);
  localStorage.setItem('embeddingModelKey', embeddingModelKey);
  localStorage.setItem('embeddingModelProviderId', embeddingModelProviderId);

  return {
    chatModelProvider: {
      key: chatModelKey,
      providerId: chatModelProviderId,
    },
    embeddingModelProvider: {
      key: embeddingModelKey,
      providerId: embeddingModelProviderId,
    },
  };
};
