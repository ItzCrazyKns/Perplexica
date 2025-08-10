import { Globe, MessageCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const focusModes = [
  {
    key: 'webSearch',
    title: 'All',
    description: 'Searches across all of the internet',
    icon: <Globe size={20} className="text-accent" />,
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
    <div className="rounded-xl transition duration-200">
      <div className="flex flex-row items-center space-x-1">
        <div className="relative">
          <div className="flex items-center border border-surface-2 rounded-lg overflow-hidden">
            {/* Web Search Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                focusMode === 'webSearch'
                  ? 'text-accent scale-105'
                  : 'text-fg/70 hover:bg-surface-2',
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
            <div className="h-6 w-px border-l opacity-10"></div>

            {/* Chat Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                focusMode === 'chat'
                  ? 'text-accent scale-105'
                  : 'text-fg/70 hover:bg-surface-2',
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
            <div className="h-6 w-px border-l opacity-10"></div>

            {/* Local Research Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                focusMode === 'localResearch'
                  ? 'text-accent scale-105'
                  : 'text-fg/70 hover:bg-surface-2',
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
              <div className="bg-surface border rounded-lg border-surface-2 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Globe size={16} className="text-accent" />
                  <h3 className="font-medium text-sm text-left">
                    {webSearchMode?.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-left">
                  {webSearchMode?.description}
                </p>
              </div>
            </div>
          )}

          {/* Chat Mode Tooltip */}
          {showChatTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 left-0 transform animate-in fade-in-0 duration-150">
              <div className="bg-surface border rounded-lg border-surface-2 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <MessageCircle size={16} className="text-accent" />
                  <h3 className="font-medium text-sm text-left">
                    {chatMode?.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-left">
                  {chatMode?.description}
                </p>
              </div>
            </div>
          )}

          {/* Local Research Mode Tooltip */}
          {showLocalResearchTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 left-0 animate-in fade-in-0 duration-150">
              <div className="bg-surface border rounded-lg border-surface-2 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Pencil size={16} className="text-accent" />
                  <h3 className="font-medium text-sm text-left">
                    {localResearchMode?.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-left">
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
