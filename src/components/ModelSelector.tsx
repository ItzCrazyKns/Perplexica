'use client';

import { useEffect, useState } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import { ChevronDown } from 'lucide-react';
import { MinimalProvider } from '@/lib/models/types';

const ModelSelector = () => {
  const { chatModelProvider, setChatModelProvider } = useChat();
  const [providers, setProviders] = useState<MinimalProvider[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch('/api/providers');
        if (res.ok) {
          const data = await res.json();
          setProviders(data.providers);
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err);
      }
    };
    fetchProviders();
  }, []);

  // Find current model name
  let currentModelName = 'Select Model';
  for (const provider of providers) {
    const model = provider.chatModels.find(
      (m) =>
        m.key === chatModelProvider.key &&
        provider.id === chatModelProvider.providerId,
    );
    if (model) {
      currentModelName = model.name;
      break;
    }
  }

  // Flatten all models with provider info
  const allModels = providers.flatMap((provider) =>
    provider.chatModels.map((model) => ({
      ...model,
      providerId: provider.id,
      providerName: provider.name,
    })),
  );

  const handleSelect = (providerId: string, modelKey: string) => {
    setChatModelProvider({ key: modelKey, providerId });
    localStorage.setItem('chatModelKey', modelKey);
    localStorage.setItem('chatModelProviderId', providerId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-black/60 dark:text-white/60 hover:text-black/80 dark:hover:text-white/80 transition-colors px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
      >
        <span className="truncate max-w-[120px]">{currentModelName}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 z-50 bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-lg min-w-[220px] max-h-[300px] overflow-y-auto">
            {providers.map((provider) =>
              provider.chatModels.length > 0 ? (
                <div key={provider.id}>
                  <div className="px-3 py-1.5 text-[10px] font-medium text-black/40 dark:text-white/40 uppercase tracking-wider">
                    {provider.name}
                  </div>
                  {provider.chatModels.map((model) => {
                    const isSelected =
                      model.key === chatModelProvider.key &&
                      provider.id === chatModelProvider.providerId;
                    return (
                      <button
                        key={model.key}
                        type="button"
                        onClick={() => handleSelect(provider.id, model.key)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          isSelected
                            ? 'bg-[#24A0ED]/10 text-[#24A0ED]'
                            : 'text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {model.name}
                      </button>
                    );
                  })}
                </div>
              ) : null,
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ModelSelector;
