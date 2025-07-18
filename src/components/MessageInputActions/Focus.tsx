import { Globe, MessageCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const focusModes = [
  {
    key: 'webSearch',
    title: 'All',
    description: 'Searches across all of the internet',
    icon: <Globe size={20} className="text-[#24A0ED]" />,
  },
  {
    key: 'chat',
    title: 'Chat',
    description: 'Have a creative conversation',
    icon: <MessageCircle size={16} className="text-[#10B981]" />,
  },
  {
    key: 'localResearch',
    title: 'Local Research',
    description: 'Research and interact with local files with citations',
    icon: <Pencil size={16} className="text-[#8B5CF6]" />,
  },
];

const Focus = ({
  focusMode,
  setFocusMode,
}: {
  focusMode: string;
  setFocusMode: (mode: string) => void;
}) => {
  const [showWebSearchTooltip, setShowWebSearchTooltip] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const [showLocalResearchTooltip, setShowLocalResearchTooltip] =
    useState(false);

  const webSearchMode = focusModes.find((mode) => mode.key === 'webSearch');
  const chatMode = focusModes.find((mode) => mode.key === 'chat');
  const localResearchMode = focusModes.find(
    (mode) => mode.key === 'localResearch',
  );

  return (
    <div className="text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white">
      <div className="flex flex-row items-center space-x-1">
        <div className="relative">
          <div className="flex items-center border border-light-200 dark:border-dark-200 rounded-lg overflow-hidden">
            {/* Web Search Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                focusMode === 'webSearch'
                  ? 'bg-[#24A0ED]/20 text-[#24A0ED] scale-105'
                  : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50 hover:bg-light-secondary/50 dark:hover:bg-dark-secondary/50',
              )}
              onMouseEnter={() => setShowWebSearchTooltip(true)}
              onMouseLeave={() => setShowWebSearchTooltip(false)}
              onClick={(e) => {
                e.stopPropagation();
                setFocusMode('webSearch');
              }}
            >
              <Globe size={18} />
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-light-200 dark:bg-dark-200"></div>

            {/* Chat Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                focusMode === 'chat'
                  ? 'bg-[#10B981]/20 text-[#10B981] scale-105'
                  : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50 hover:bg-light-secondary/50 dark:hover:bg-dark-secondary/50',
              )}
              onMouseEnter={() => setShowChatTooltip(true)}
              onMouseLeave={() => setShowChatTooltip(false)}
              onClick={(e) => {
                e.stopPropagation();
                setFocusMode('chat');
              }}
            >
              <MessageCircle size={18} />
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-light-200 dark:bg-dark-200"></div>

            {/* Local Research Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                focusMode === 'localResearch'
                  ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] scale-105'
                  : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50 hover:bg-light-secondary/50 dark:hover:bg-dark-secondary/50',
              )}
              onMouseEnter={() => setShowLocalResearchTooltip(true)}
              onMouseLeave={() => setShowLocalResearchTooltip(false)}
              onClick={(e) => {
                e.stopPropagation();
                setFocusMode('localResearch');
              }}
            >
              <Pencil size={18} />
            </button>
          </div>

          {/* Web Search Mode Tooltip */}
          {showWebSearchTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 left-0 animate-in fade-in-0 duration-150">
              <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Globe size={16} className="text-[#24A0ED]" />
                  <h3 className="font-medium text-sm text-black dark:text-white text-left">
                    {webSearchMode?.title}
                  </h3>
                </div>
                <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed text-left">
                  {webSearchMode?.description}
                </p>
              </div>
            </div>
          )}

          {/* Chat Mode Tooltip */}
          {showChatTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 left-0 transform animate-in fade-in-0 duration-150">
              <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <MessageCircle size={16} className="text-[#10B981]" />
                  <h3 className="font-medium text-sm text-black dark:text-white text-left">
                    {chatMode?.title}
                  </h3>
                </div>
                <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed text-left">
                  {chatMode?.description}
                </p>
              </div>
            </div>
          )}

          {/* Local Research Mode Tooltip */}
          {showLocalResearchTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 left-0 animate-in fade-in-0 duration-150">
              <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Pencil size={16} className="text-[#8B5CF6]" />
                  <h3 className="font-medium text-sm text-black dark:text-white text-left">
                    {localResearchMode?.title}
                  </h3>
                </div>
                <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed text-left">
                  {localResearchMode?.description}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Focus;
