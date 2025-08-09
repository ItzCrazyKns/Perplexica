import {
  Wrench,
  ChevronDown,
  CheckSquare,
  Square,
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

interface Tool {
  name: string;
  description: string;
}

interface ToolSelectorProps {
  selectedToolNames: string[];
  onSelectedToolNamesChange: (names: string[]) => void;
}

const ToolSelector = ({
  selectedToolNames,
  onSelectedToolNamesChange,
}: ToolSelectorProps) => {
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/tools');
        if (response.ok) {
          const tools = await response.json();
          setAvailableTools(tools);

          // Check if any currently selected tool names are not in the API response
          const availableToolNames = tools.map((tool: Tool) => tool.name);
          const validSelectedNames = selectedToolNames.filter((name) =>
            availableToolNames.includes(name),
          );

          // If some selected names are no longer available, update the selection
          if (validSelectedNames.length !== selectedToolNames.length) {
            onSelectedToolNamesChange(validSelectedNames);
          }
        } else {
          console.error('Failed to load tools.');
        }
      } catch (error) {
        console.error('Error loading tools.');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch tools once when the component mounts
    fetchTools();
  }, [selectedToolNames, onSelectedToolNamesChange]);

  const handleToggleTool = (toolName: string) => {
    const newSelectedNames = selectedToolNames.includes(toolName)
      ? selectedToolNames.filter((name) => name !== toolName)
      : [...selectedToolNames, toolName];
    onSelectedToolNamesChange(newSelectedNames);
  };

  const selectedCount = selectedToolNames.length;

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton
            className={cn(
              'flex items-center gap-1 rounded-lg text-sm transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              selectedCount > 0
                ? 'text-accent hover:text-accent'
                : 'text-fg/60 hover:text-fg/30',
            )}
            title="Select Tools"
          >
            <Wrench size={18} />
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
              <div className="overflow-hidden rounded-lg shadow-lg bg-surface border border-surface-2">
                <div className="px-4 py-3 border-b border-surface-2">
                  <h3 className="text-sm font-medium text-fg/90">
                    Select Tools
                  </h3>
                  <p className="text-xs text-fg/60 mt-0.5">
                    Choose tools to assist the AI.
                  </p>
                </div>
                {isLoading ? (
                  <div className="px-4 py-3">
                    <Loader2 className="animate-spin text-fg/70" />
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
                    {availableTools.length === 0 && (
                      <p className="text-xs text-fg/50 px-2.5 py-2 text-center">
                        No tools available.
                      </p>
                    )}

                    {availableTools.map((tool) => (
                      <div
                        key={tool.name}
                        onClick={() => handleToggleTool(tool.name)}
                        className="flex items-start gap-2.5 p-2.5 rounded-md hover:bg-surface-2 cursor-pointer"
                      >
                        {selectedToolNames.includes(tool.name) ? (
                          <CheckSquare
                            size={18}
                            className="text-accent flex-shrink-0 mt-0.5"
                          />
                        ) : (
                          <Square
                            size={18}
                            className="text-fg/40 flex-shrink-0 mt-0.5"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-sm font-medium text-fg/80 block truncate"
                            title={tool.name}
                          >
                            {tool.name.replace(/_/g, ' ')}
                          </span>
                          <p className="text-xs text-fg/60 mt-0.5">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default ToolSelector;
