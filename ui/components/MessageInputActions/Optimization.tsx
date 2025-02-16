import { ChevronDown, Minimize2, Sliders, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment, useEffect } from 'react';
const OptimizationModes = [
  {
    key: 'speed',
    title: 'Speed',
    description: 'Prioritize speed and get the quickest possible answer.',
    icon: <Zap size={20} className="text-[#FF9800]" />,
  },
  {
    key: 'balanced',
    title: 'Balanced',
    description: 'Find the right balance between speed and accuracy',
    icon: <Sliders size={20} className="text-[#4CAF50]" />,
  },
  {
    key: 'quality',
    title: 'Quality (Soon)',
    description: 'Get the most thorough and accurate answer',
    icon: (
      <Star
        size={16}
        className="text-[#2196F3] dark:text-[#BBDEFB] fill-[#BBDEFB] dark:fill-[#2196F3]"
      />
    ),
  },
];

const Optimization = ({
  optimizationMode,
  setOptimizationMode,
  isCompact,
  setIsCompact,
}: {
  optimizationMode: string;
  setOptimizationMode: (mode: string) => void;
  isCompact: boolean;
  setIsCompact: (isCompact: boolean) => void;
}) => {
  useEffect(() => {
    const savedCompactMode = localStorage.getItem('compactMode');
    if (savedCompactMode === null) {
      localStorage.setItem('compactMode', String(isCompact));
    } else {
      setIsCompact(savedCompactMode === 'true');
    }
  }, [setIsCompact]);

  const handleCompactChange = (checked: boolean) => {
    setIsCompact(checked);
    localStorage.setItem('compactMode', String(checked));
  };

  const handleOptimizationChange = (mode: string) => {
    setOptimizationMode(mode);
    localStorage.setItem('optimizationMode', mode);
  };

  return (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      <PopoverButton
        type="button"
        className="p-2 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        <div className="flex flex-row items-center space-x-1">
          {isCompact && (
            <Minimize2
              size={16}
              className="text-gray-600 dark:text-gray-400"
            />
          )}
          {
            OptimizationModes.find((mode) => mode.key === optimizationMode)
              ?.icon
          }
          <p className="text-xs font-medium">
            {
              OptimizationModes.find((mode) => mode.key === optimizationMode)
                ?.title
            }
          </p>
          <ChevronDown size={20} />
        </div>
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute z-10 w-64 md:w-[250px] right-0 bottom-[100%] mb-2">
          <div className="flex flex-col gap-2 bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-4 max-h-[200px] md:max-h-none overflow-y-auto">
            {OptimizationModes.map((mode, i) => (
              <PopoverButton
                onClick={() => handleOptimizationChange(mode.key)}
                key={i}
                disabled={mode.key === 'quality'}
                className={cn(
                  'p-2 rounded-lg flex flex-col items-start justify-start text-start space-y-1 duration-200 cursor-pointer transition',
                  optimizationMode === mode.key
                    ? 'bg-light-secondary dark:bg-dark-secondary'
                    : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                  mode.key === 'quality' && 'opacity-50 cursor-not-allowed',
                )}
              >
                <div className="flex flex-row items-center space-x-1 text-black dark:text-white">
                  {mode.icon}
                  <p className="text-sm font-medium">{mode.title}</p>
                </div>
                <p className="text-black/70 dark:text-white/70 text-xs">
                  {mode.description}
                </p>
              </PopoverButton>
            ))}
            <div className="border-t border-light-200 dark:border-dark-200 pt-2 mt-1">
              <label className="flex items-center space-x-2 p-2 rounded-lg cursor-pointer hover:bg-light-secondary dark:hover:bg-dark-secondary">
                <input
                  type="checkbox"
                  checked={isCompact}
                  onChange={(e) => handleCompactChange(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                />
                <div className="flex items-center space-x-2">
                  <Minimize2
                    size={16}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white">
                      Compact Mode
                    </p>
                    <p className="text-xs text-black/70 dark:text-white/70">
                      Generate more concise responses
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default Optimization;
