import { ChevronDown, Sliders, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { useChat } from '@/lib/hooks/useChat';

const OptimizationModes = [
  {
    key: 'speed',
    icon: <Zap size={16} className="text-[#FF9800]" />,
  },
  {
    key: 'balanced',
    icon: <Sliders size={16} className="text-[#4CAF50]" />,
  },
  {
    key: 'quality',
    icon: (
      <Star
        size={16}
        className="text-[#2196F3] dark:text-[#BBDEFB] fill-[#BBDEFB] dark:fill-[#2196F3]"
      />
    ),
  },
];

const Optimization = () => {
  const { optimizationMode, setOptimizationMode } = useChat();
  const t = useTranslations('components.optimization');
  return (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className="p-2 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white focus:outline-none"
          >
            <div className="flex flex-row items-center space-x-1">
              {
                OptimizationModes.find((mode) => mode.key === optimizationMode)
                  ?.icon
              }
              <ChevronDown
                size={16}
                className={cn(
                  open ? 'rotate-180' : 'rotate-0',
                  'transition duration:200',
                )}
              />
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
            <PopoverPanel className="absolute z-10 w-64 md:w-[250px] left-0">
              <div className="flex flex-col gap-2 bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-4 max-h-[200px] md:max-h-none overflow-y-auto">
                {OptimizationModes.map((mode, i) => (
                  <PopoverButton
                    onClick={() => setOptimizationMode(mode.key)}
                    key={i}
                    disabled={mode.key === 'quality'}
                    className={cn(
                      'p-2 rounded-lg flex flex-col items-start justify-start text-start space-y-1 duration-200 cursor-pointer transition focus:outline-none',
                      optimizationMode === mode.key
                        ? 'bg-light-secondary dark:bg-dark-secondary'
                        : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                      mode.key === 'quality' && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <div className="flex flex-row items-center space-x-1 text-black dark:text-white">
                      {mode.icon}
                      <p className="text-sm font-medium">
                        {t(`modes.${mode.key}.title`)}
                      </p>
                    </div>
                    <p className="text-black/70 dark:text-white/70 text-xs">
                      {t(`modes.${mode.key}.description`)}
                    </p>
                  </PopoverButton>
                ))}
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default Optimization;
