import { BadgePercent, Globe, Pencil, SwatchBook } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { SiReddit, SiYoutube } from '@icons-pack/react-simple-icons';
import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { useChat } from '@/lib/hooks/useChat';

const focusModeIcons: Record<string, JSX.Element> = {
  webSearch: <Globe size={16} />,
  academicSearch: <SwatchBook size={16} />,
  writingAssistant: <Pencil size={16} />,
  wolframAlphaSearch: <BadgePercent size={16} />,
  youtubeSearch: <SiYoutube className="h-[16px] w-auto mr-0.5" />,
  redditSearch: <SiReddit className="h-[16px] w-auto mr-0.5" />,
};

const Focus = () => {
  const { focusMode, setFocusMode } = useChat();
  const t = useTranslations('components.focus');
  const modes = [
    'webSearch',
    'academicSearch',
    'writingAssistant',
    'wolframAlphaSearch',
    'youtubeSearch',
    'redditSearch',
  ];
  return (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      <PopoverButton
        type="button"
        className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none headless-open:text-black dark:headless-open:text-white text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        {focusMode !== 'webSearch' ? (
          <div className="flex flex-row items-center space-x-1">
            {focusModeIcons[focusMode]}
          </div>
        ) : (
          <div className="flex flex-row items-center space-x-1">
            <Globe size={16} />
          </div>
        )}
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
        <PopoverPanel className="absolute z-10 w-64 md:w-[500px] -right-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-4 max-h-[200px] md:max-h-none overflow-y-auto">
            {modes.map((key, i) => (
              <PopoverButton
                onClick={() => setFocusMode(key)}
                key={i}
                className={cn(
                  'p-2 rounded-lg flex flex-col items-start justify-start text-start space-y-2 duration-200 cursor-pointer transition focus:outline-none',
                  focusMode === key
                    ? 'bg-light-secondary dark:bg-dark-secondary'
                    : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                )}
              >
                <div
                  className={cn(
                    'flex flex-row items-center space-x-1',
                    focusMode === key
                      ? 'text-[#24A0ED]'
                      : 'text-black dark:text-white',
                  )}
                >
                  {focusModeIcons[key]}
                  <p className="text-sm font-medium">
                    {t(`modes.${key}.title`)}
                  </p>
                </div>
                <p className="text-black/70 dark:text-white/70 text-xs">
                  {t(`modes.${key}.description`)}
                </p>
              </PopoverButton>
            ))}
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default Focus;
