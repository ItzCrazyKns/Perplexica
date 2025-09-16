import {
  BookUser,
  ChevronDown,
  CheckSquare,
  Square,
  Settings,
  User,
  Loader2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment, useEffect, useState } from 'react';
import { Prompt } from '@/lib/types/prompt';

interface SystemPromptSelectorProps {
  selectedPromptIds: string[];
  onSelectedPromptIdsChange: (ids: string[]) => void;
}

const SystemPromptSelector = ({
  selectedPromptIds,
  onSelectedPromptIdsChange,
}: SystemPromptSelectorProps) => {
  const [availablePrompts, setAvailablePrompts] = useState<Prompt[]>([]);
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
          const availablePromptIds = prompts.map((prompt: Prompt) => prompt.id);
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
                'flex items-center gap-1 rounded-lg text-sm transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2',
                selectedCount > 0
                  ? 'text-accent hover:text-accent'
                  : 'text-fg/60 hover:text-fg/30',
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
              <PopoverPanel className="absolute right-0 z-20 w-72 transform bottom-full mb-2">
                <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-surface-2 bg-surface">
                  <div className="px-4 py-3 border-b border-surface-2">
                    <h3 className="text-sm font-medium text-fg/90">
                      Select Prompts
                    </h3>
                    <p className="text-xs text-fg/60 mt-0.5">
                      Choose instructions to guide the AI.
                    </p>
                  </div>
                  {isLoading ? (
                    <div className="px-4 py-3">
                      <Loader2 className="animate-spin text-fg/70" />
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto p-1.5 space-y-3">
                      {availablePrompts.length === 0 && (
                        <p className="text-xs text-fg/50 px-2.5 py-2 text-center">
                          No prompts configured. <br /> Go to{' '}
                          <a className="text-accent" href="/settings">
                            settings
                          </a>{' '}
                          to add some.
                        </p>
                      )}

                      {availablePrompts.filter(
                        (p) => p.type === 'persona' && !p.readOnly,
                      ).length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-fg/70">
                            <User size={14} />
                            <div className="flex items-center gap-1.5">
                              <span>Default Prompts</span>
                              <Popover>
                                <PopoverButton className="focus:outline-none">
                                  <Info
                                    size={14}
                                    className="text-fg/50 hover:text-fg/70"
                                  />
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
                                  <PopoverPanel className="absolute z-30 w-64 p-3 bg-surface border border-surface-2 rounded-lg shadow-lg text-xs text-fg/80">
                                    The prompts in this section are system
                                    provided prompts. The system will choose one
                                    of these formatting prompts itself based on
                                    focus mode, if no persona prompts are
                                    selected. Choose one if you want to override
                                    the default behavior or if you want to
                                    combine default prompts with your own
                                    persona prompts.
                                  </PopoverPanel>
                                </Transition>
                              </Popover>
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            {availablePrompts
                              .filter((p) => p.type === 'persona' && p.readOnly)
                              .map((prompt) => (
                                <div
                                  key={prompt.id}
                                  onClick={() => handleTogglePrompt(prompt.id)}
                                  className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-surface-2 cursor-pointer"
                                >
                                  {selectedPromptIds.includes(prompt.id) ? (
                                    <CheckSquare
                                      size={18}
                                      className="text-accent flex-shrink-0"
                                    />
                                  ) : (
                                    <Square
                                      size={18}
                                      className="text-fg/40 flex-shrink-0"
                                    />
                                  )}
                                  <span
                                    className="text-sm text-fg/80 truncate"
                                    title={prompt.name}
                                  >
                                    {prompt.name}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {availablePrompts.filter(
                        (p) => p.type === 'persona' && !p.readOnly,
                      ).length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-fg/70">
                            <User size={14} />
                            <span>Persona Prompts</span>
                          </div>
                          <div className="space-y-0.5">
                            {availablePrompts
                              .filter(
                                (p) => p.type === 'persona' && !p.readOnly,
                              )
                              .map((prompt) => (
                                <div
                                  key={prompt.id}
                                  onClick={() => handleTogglePrompt(prompt.id)}
                                  className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-surface-2 cursor-pointer"
                                >
                                  {selectedPromptIds.includes(prompt.id) ? (
                                    <CheckSquare
                                      size={18}
                                      className="text-accent flex-shrink-0"
                                    />
                                  ) : (
                                    <Square
                                      size={18}
                                      className="text-fg/40 flex-shrink-0"
                                    />
                                  )}
                                  <span
                                    className="text-sm text-fg/80 truncate"
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
