import {
  BookUser,
  ChevronDown,
  CheckSquare,
  Square,
  Settings,
  User,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment, useEffect, useState } from 'react';

interface SystemPrompt {
  id: string;
  name: string;
  type: 'system' | 'persona';
}

interface SystemPromptSelectorProps {
  selectedPromptIds: string[];
  onSelectedPromptIdsChange: (ids: string[]) => void;
}

const SystemPromptSelector = ({
  selectedPromptIds,
  onSelectedPromptIdsChange,
}: SystemPromptSelectorProps) => {
  const [availablePrompts, setAvailablePrompts] = useState<SystemPrompt[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return; // Only fetch when popover is open or about to open
    const fetchPrompts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/system-prompts');
        if (response.ok) {
          const prompts = await response.json();
          setAvailablePrompts(prompts);

          // Check if any currently selected prompt IDs are not in the API response
          const availablePromptIds = prompts.map(
            (prompt: SystemPrompt) => prompt.id,
          );
          const validSelectedIds = selectedPromptIds.filter((id) =>
            availablePromptIds.includes(id),
          );

          // If some selected IDs are no longer available, update the selection
          if (validSelectedIds.length !== selectedPromptIds.length) {
            onSelectedPromptIdsChange(validSelectedIds);
          }
        } else {
          console.error('Failed to load system prompts.');
        }
      } catch (error) {
        console.error('Error loading system prompts.');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrompts();
  }, [isOpen, selectedPromptIds, onSelectedPromptIdsChange]);

  const handleTogglePrompt = (promptId: string) => {
    const newSelectedIds = selectedPromptIds.includes(promptId)
      ? selectedPromptIds.filter((id) => id !== promptId)
      : [...selectedPromptIds, promptId];
    onSelectedPromptIdsChange(newSelectedIds);
  };

  const selectedCount = selectedPromptIds.length;

  return (
    <Popover className="relative">
      {({ open }) => {
        if (open && !isOpen) setIsOpen(true);
        if (!open && isOpen) setIsOpen(false);
        return (
          <>
            <PopoverButton
              className={cn(
                'flex items-center gap-1 rounded-lg text-sm transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                selectedCount > 0
                  ? 'text-[#24A0ED] hover:text-blue-200'
                  : 'text-black/60 hover:text-black/30 dark:text-white/60 dark:hover:*:text-white/30',
              )}
              title="Select Prompts"
            >
              <BookUser size={18} />
              {selectedCount > 0 ? <span> {selectedCount} </span> : null}
              <ChevronDown size={16} className="opacity-60" />
            </PopoverButton>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <PopoverPanel className="absolute z-20 w-72 transform bottom-full mb-2">
                <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5 dark:ring-white/5 bg-white dark:bg-dark-secondary">
                  <div className="px-4 py-3 border-b border-light-200 dark:border-dark-200">
                    <h3 className="text-sm font-medium text-black/90 dark:text-white/90">
                      Select Prompts
                    </h3>
                    <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                      Choose instructions to guide the AI.
                    </p>
                  </div>
                  {isLoading ? (
                    <div className="px-4 py-3">
                      <Loader2 className="animate-spin text-black/70 dark:text-white/70" />
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto p-1.5 space-y-3">
                      {availablePrompts.length === 0 && (
                        <p className="text-xs text-black/50 dark:text-white/50 px-2.5 py-2 text-center">
                          No prompts configured. <br /> Go to{' '}
                          <a className="text-blue-500" href="/settings">
                            settings
                          </a>{' '}
                          to add some.
                        </p>
                      )}

                      {availablePrompts.filter((p) => p.type === 'system')
                        .length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-black/70 dark:text-white/70">
                            <Settings size={14} />
                            <span>System Prompts</span>
                          </div>
                          <div className="space-y-0.5">
                            {availablePrompts
                              .filter((p) => p.type === 'system')
                              .map((prompt) => (
                                <div
                                  key={prompt.id}
                                  onClick={() => handleTogglePrompt(prompt.id)}
                                  className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-light-100 dark:hover:bg-dark-100 cursor-pointer"
                                >
                                  {selectedPromptIds.includes(prompt.id) ? (
                                    <CheckSquare
                                      size={18}
                                      className="text-[#24A0ED] flex-shrink-0"
                                    />
                                  ) : (
                                    <Square
                                      size={18}
                                      className="text-black/40 dark:text-white/40 flex-shrink-0"
                                    />
                                  )}
                                  <span
                                    className="text-sm text-black/80 dark:text-white/80 truncate"
                                    title={prompt.name}
                                  >
                                    {prompt.name}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {availablePrompts.filter((p) => p.type === 'persona')
                        .length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-black/70 dark:text-white/70">
                            <User size={14} />
                            <span>Persona Prompts</span>
                          </div>
                          <div className="space-y-0.5">
                            {availablePrompts
                              .filter((p) => p.type === 'persona')
                              .map((prompt) => (
                                <div
                                  key={prompt.id}
                                  onClick={() => handleTogglePrompt(prompt.id)}
                                  className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-light-100 dark:hover:bg-dark-100 cursor-pointer"
                                >
                                  {selectedPromptIds.includes(prompt.id) ? (
                                    <CheckSquare
                                      size={18}
                                      className="text-[#24A0ED] flex-shrink-0"
                                    />
                                  ) : (
                                    <Square
                                      size={18}
                                      className="text-black/40 dark:text-white/40 flex-shrink-0"
                                    />
                                  )}
                                  <span
                                    className="text-sm text-black/80 dark:text-white/80 truncate"
                                    title={prompt.name}
                                  >
                                    {prompt.name}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </PopoverPanel>
            </Transition>
          </>
        );
      }}
    </Popover>
  );
};

export default SystemPromptSelector;
