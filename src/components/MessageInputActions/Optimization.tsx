import { Zap, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const OptimizationModes = [
  {
    key: 'speed',
    title: 'Speed',
    description:
      'Prioritize speed and get the quickest possible answer. Uses only web search results - attached files will not be processed.',
    icon: <Zap size={20} className="text-accent" />,
  },
  {
    key: 'agent',
    title: 'Agent (Experimental)',
    description:
      'Use an agentic workflow to answer complex multi-part questions. This mode may take longer and is experimental. It requires a model that supports tool calling.',
    icon: <Bot size={20} className="text-accent" />,
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
      className="text-fg/50 rounded-xl hover:bg-surface-2 active:scale-95 transition duration-200 hover:text-fg"
    >
      <div className="flex flex-row items-center space-x-1">
        <div className="relative">
          <div className="flex items-center border border-surface-2 rounded-lg overflow-hidden">
            {/* Speed Mode Icon */}
            <div
              className={cn(
                'p-2 transition-all duration-200',
                !isAgentMode
                  ? 'bg-surface-2 text-accent scale-105'
                  : 'text-fg/30 hover:text-fg/50 hover:bg-surface-2/50',
              )}
              onMouseEnter={() => setShowSpeedTooltip(true)}
              onMouseLeave={() => setShowSpeedTooltip(false)}
            >
              <Zap size={18} />
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-surface-2"></div>

            {/* Agent Mode Icon */}
            <div
              className={cn(
                'p-2 transition-all duration-200',
                isAgentMode
                  ? 'bg-surface-2 text-accent scale-105'
                  : 'text-fg/30 hover:text-fg/50 hover:bg-surface-2/50',
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
              <div className="bg-surface border rounded-lg border-surface-2 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Zap size={16} className="text-accent" />
                  <h3 className="font-medium text-sm text-fg text-left">
                    {speedMode?.title}
                  </h3>
                </div>
                <p className="text-sm text-fg/70 leading-relaxed text-left">
                  {speedMode?.description}
                </p>
              </div>
            </div>
          )}

          {/* Agent Mode Tooltip */}
          {showAgentTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 right-0 animate-in fade-in-0 duration-150">
              <div className="bg-surface border rounded-lg border-surface-2 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Bot size={16} className="text-accent" />
                  <h3 className="font-medium text-sm text-fg text-left">
                    {agentMode?.title}
                  </h3>
                </div>
                <p className="text-sm text-fg/70 leading-relaxed text-left">
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
