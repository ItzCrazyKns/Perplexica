import { useEffect, useState } from 'react';
import { Cpu, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment } from 'react';

interface ModelOption {
  provider: string;
  model: string;
  displayName: string;
}

interface ProviderModelMap {
  [provider: string]: {
    displayName: string;
    models: ModelOption[];
  };
}

const ModelSelector = ({
  selectedModel,
  setSelectedModel,
  truncateModelName = true,
}: {
  selectedModel: { provider: string; model: string } | null;
  setSelectedModel: (model: { provider: string; model: string }) => void;
  truncateModelName?: boolean;
}) => {
  const [providerModels, setProviderModels] = useState<ProviderModelMap>({});
  const [providersList, setProvidersList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModelDisplay, setSelectedModelDisplay] = useState<string>('');
  const [selectedProviderDisplay, setSelectedProviderDisplay] =
    useState<string>('');
  const [expandedProviders, setExpandedProviders] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models', {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();
        const providersData: ProviderModelMap = {};

        // Organize models by provider
        Object.entries(data.chatModelProviders).forEach(
          ([provider, models]: [string, any]) => {
            const providerDisplayName =
              provider.charAt(0).toUpperCase() + provider.slice(1);
            providersData[provider] = {
              displayName: providerDisplayName,
              models: [],
            };

            Object.entries(models).forEach(
              ([modelKey, modelData]: [string, any]) => {
                providersData[provider].models.push({
                  provider,
                  model: modelKey,
                  displayName: modelData.displayName || modelKey,
                });
              },
            );
          },
        );

        // Filter out providers with no models
        Object.keys(providersData).forEach((provider) => {
          if (providersData[provider].models.length === 0) {
            delete providersData[provider];
          }
        });

        // Sort providers by name (only those that have models)
        const sortedProviders = Object.keys(providersData).sort();
        setProvidersList(sortedProviders);

        // Initialize expanded state for all providers
        const initialExpandedState: Record<string, boolean> = {};
        sortedProviders.forEach((provider) => {
          initialExpandedState[provider] = selectedModel?.provider === provider;
        });

        // Expand the first provider if none is selected
        if (sortedProviders.length > 0 && !selectedModel) {
          initialExpandedState[sortedProviders[0]] = true;
        }

        setExpandedProviders(initialExpandedState);
        setProviderModels(providersData);

        // Find the current model in our options to display its name
        if (selectedModel) {
          const provider = providersData[selectedModel.provider];
          if (provider) {
            const currentModel = provider.models.find(
              (option) => option.model === selectedModel.model,
            );

            if (currentModel) {
              setSelectedModelDisplay(currentModel.displayName);
              setSelectedProviderDisplay(provider.displayName);
            }
          } else {
            setSelectedModelDisplay('');
            setSelectedProviderDisplay('');
          }
        } else {
          setSelectedModelDisplay('');
          setSelectedProviderDisplay('');
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching models:', error);
        setLoading(false);
      }
    };

    fetchModels();
  }, [selectedModel]);

  const toggleProviderExpanded = (provider: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  const handleSelectModel = (option: ModelOption) => {
    setSelectedModel({
      provider: option.provider,
      model: option.model,
    });

    setSelectedModelDisplay(option.displayName);
    setSelectedProviderDisplay(
      providerModels[option.provider]?.displayName || option.provider,
    );
  };

  const getDisplayText = () => {
    if (loading) return 'Loading...';
    if (!selectedModelDisplay) return 'Select model';

    return `${selectedModelDisplay} (${selectedProviderDisplay})`;
  };

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <div className="relative">
            <PopoverButton
              type="button"
              className="p-2 group flex text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
            >
              <Cpu size={18} />
              <span
                className={cn(
                  'mx-2 text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap hidden lg:block',
                  {
                    'max-w-44': truncateModelName,
                  },
                )}
              >
                {getDisplayText()}
              </span>
              <ChevronDown
                size={16}
                className={cn(
                  'transition-transform',
                  open ? 'rotate-180' : 'rotate-0',
                )}
              />
            </PopoverButton>
          </div>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel className="absolute z-10 w-72 transform bottom-full mb-2">
              <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5 dark:ring-white/5 bg-white dark:bg-dark-secondary divide-y divide-light-200 dark:divide-dark-200">
                <div className="px-4 py-3">
                  <h3 className="text-sm font-medium text-black/90 dark:text-white/90">
                    Select Model
                  </h3>
                  <p className="text-xs text-black/60 dark:text-white/60 mt-1">
                    Choose a provider and model for your conversation
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-3 text-sm text-black/70 dark:text-white/70">
                      Loading available models...
                    </div>
                  ) : providersList.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-black/70 dark:text-white/70">
                      No models available
                    </div>
                  ) : (
                    <div className="py-1">
                      {providersList.map((providerKey) => {
                        const provider = providerModels[providerKey];
                        const isExpanded = expandedProviders[providerKey];

                        return (
                          <div
                            key={providerKey}
                            className="border-t border-light-200 dark:border-dark-200 first:border-t-0"
                          >
                            {/* Provider header */}
                            <button
                              className={cn(
                                'w-full flex items-center justify-between px-4 py-2 text-sm text-left',
                                'hover:bg-light-100 dark:hover:bg-dark-100',
                                selectedModel?.provider === providerKey
                                  ? 'bg-light-50 dark:bg-dark-50'
                                  : '',
                              )}
                              onClick={() =>
                                toggleProviderExpanded(providerKey)
                              }
                            >
                              <div className="font-medium flex items-center">
                                <Cpu
                                  size={14}
                                  className="mr-2 text-black/70 dark:text-white/70"
                                />
                                {provider.displayName}
                                {selectedModel?.provider === providerKey && (
                                  <span className="ml-2 text-xs text-[#24A0ED]">
                                    (active)
                                  </span>
                                )}
                              </div>
                              <ChevronRight
                                size={14}
                                className={cn(
                                  'transition-transform',
                                  isExpanded ? 'rotate-90' : '',
                                )}
                              />
                            </button>

                            {/* Models list */}
                            {isExpanded && (
                              <div className="pl-6">
                                {provider.models.map((modelOption) => (
                                  <PopoverButton
                                    key={`${modelOption.provider}-${modelOption.model}`}
                                    className={cn(
                                      'w-full text-left px-4 py-2 text-sm flex items-center',
                                      selectedModel?.provider ===
                                        modelOption.provider &&
                                        selectedModel?.model ===
                                          modelOption.model
                                        ? 'bg-light-100 dark:bg-dark-100 text-black dark:text-white'
                                        : 'text-black/70 dark:text-white/70 hover:bg-light-100 dark:hover:bg-dark-100',
                                    )}
                                    onClick={() =>
                                      handleSelectModel(modelOption)
                                    }
                                  >
                                    <div className="flex flex-col flex-1">
                                      <span className="font-medium">
                                        {modelOption.displayName}
                                      </span>
                                    </div>
                                    {/* Active indicator */}
                                    {selectedModel?.provider ===
                                      modelOption.provider &&
                                      selectedModel?.model ===
                                        modelOption.model && (
                                        <div className="ml-auto bg-[#24A0ED] text-white text-xs px-1.5 py-0.5 rounded">
                                          Active
                                        </div>
                                      )}
                                  </PopoverButton>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default ModelSelector;
