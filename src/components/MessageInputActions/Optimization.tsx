import { Zap, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const OptimizationModes = [
  {
    key: 'speed',
    title: 'Speed',
    description:
      'Prioritize speed and get the quickest possible answer. Uses only web search results - attached files will not be processed.',
    icon: <Zap size={20} className="text-[#FF9800]" />,
  },
  {
    key: 'agent',
    title: 'Agent (Experimental)',
    description:
      'Use an agentic workflow to answer complex multi-part questions. This mode may take longer and is experimental. It uses large prompts and may not work with all models. Best with at least a 8b model that supports 32k context or more.',
    icon: <Bot size={20} className="text-[#9C27B0]" />,
  },
];

const Optimization = ({
  optimizationMode,
  setOptimizationMode,
  showTitle = false,
}: {
  optimizationMode: string;
  setOptimizationMode: (mode: string) => void;
  showTitle?: boolean;
}) => {
  const currentMode = OptimizationModes.find(
    (mode) => mode.key === optimizationMode,
  );
  const isAgentMode = optimizationMode === 'agent';

  const [showSpeedTooltip, setShowSpeedTooltip] = useState(false);
  const [showAgentTooltip, setShowAgentTooltip] = useState(false);

  const handleToggle = () => {
    setOptimizationMode(isAgentMode ? 'speed' : 'agent');
  };

  const speedMode = OptimizationModes.find((mode) => mode.key === 'speed');
  const agentMode = OptimizationModes.find((mode) => mode.key === 'agent');

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
    >
      <div className="flex flex-row items-center space-x-1">
        <div className="relative">
          <div className="flex items-center border border-light-200 dark:border-dark-200 rounded-lg overflow-hidden">
            {/* Speed Mode Icon */}
            <div
              className={cn(
                'p-2 transition-all duration-200',
                !isAgentMode
                  ? 'bg-[#FF9800]/20 text-[#FF9800] scale-105'
                  : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50 hover:bg-light-secondary/50 dark:hover:bg-dark-secondary/50',
              )}
              onMouseEnter={() => setShowSpeedTooltip(true)}
              onMouseLeave={() => setShowSpeedTooltip(false)}
            >
              <Zap size={18} />
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-light-200 dark:bg-dark-200"></div>

            {/* Agent Mode Icon */}
            <div
              className={cn(
                'p-2 transition-all duration-200',
                isAgentMode
                  ? 'bg-[#9C27B0]/20 text-[#9C27B0] scale-105'
                  : 'text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50 hover:bg-light-secondary/50 dark:hover:bg-dark-secondary/50',
              )}
              onMouseEnter={() => setShowAgentTooltip(true)}
              onMouseLeave={() => setShowAgentTooltip(false)}
            >
              <Bot size={18} />
            </div>
          </div>

          {/* Speed Mode Tooltip */}
          {showSpeedTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 right-0 animate-in fade-in-0 duration-150">
              <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Zap size={16} className="text-[#FF9800]" />
                  <h3 className="font-medium text-sm text-black dark:text-white text-left">
                    {speedMode?.title}
                  </h3>
                </div>
                <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed text-left">
                  {speedMode?.description}
                </p>
              </div>
            </div>
          )}

          {/* Agent Mode Tooltip */}
          {showAgentTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 right-0 animate-in fade-in-0 duration-150">
              <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Bot size={16} className="text-[#9C27B0]" />
                  <h3 className="font-medium text-sm text-black dark:text-white text-left">
                    {agentMode?.title}
                  </h3>
                </div>
                <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed text-left">
                  {agentMode?.description}
                </p>
              </div>
            </div>
          )}
        </div>{' '}
        {showTitle && (
          <p className="text-xs font-medium ml-1">
            {currentMode?.title || 'Speed'}
          </p>
        )}
      </div>
    </button>
  );
};

export default Optimization;
