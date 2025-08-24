import { Zap, Bot, Microscope } from 'lucide-react';
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
  {
    key: 'deepResearch',
    title: 'Deep Research',
    description:
      'Run a comprehensive, multi-phase research with clustering, synthesis, and inline citations. Streams progress; can take up to ~15 minutes.',
    icon: <Microscope size={20} className="text-accent" />,
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
  const isDeepMode = optimizationMode === 'deepResearch';

  const [showSpeedTooltip, setShowSpeedTooltip] = useState(false);
  const [showAgentTooltip, setShowAgentTooltip] = useState(false);
  const [showDeepTooltip, setShowDeepTooltip] = useState(false);

  const speedMode = OptimizationModes.find((mode) => mode.key === 'speed');
  const agentMode = OptimizationModes.find((mode) => mode.key === 'agent');
  const deepMode = OptimizationModes.find(
    (mode) => mode.key === 'deepResearch',
  );

  return (
    <div className="rounded-xl transition duration-200 text-fg/50">
      <div className="flex flex-row items-center space-x-1">
        <div className="relative">
          <div className="flex items-center border border-surface-2 rounded-lg overflow-hidden">
            {/* Speed Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                optimizationMode === 'speed'
                  ? 'text-accent scale-105 bg-surface-2'
                  : 'text-fg/70 hover:bg-surface-2',
              )}
              onMouseEnter={() => setShowSpeedTooltip(true)}
              onMouseLeave={() => setShowSpeedTooltip(false)}
              onClick={(e) => {
                e.stopPropagation();
                setOptimizationMode('speed');
              }}
              aria-label="Speed mode"
              type="button"
            >
              <Zap size={18} />
            </button>

            {/* Divider */}
            <div className="h-6 w-px border-l opacity-10"></div>

            {/* Agent Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                optimizationMode === 'agent'
                  ? 'text-accent scale-105 bg-surface-2'
                  : 'text-fg/70 hover:bg-surface-2',
              )}
              onMouseEnter={() => setShowAgentTooltip(true)}
              onMouseLeave={() => setShowAgentTooltip(false)}
              onClick={(e) => {
                e.stopPropagation();
                setOptimizationMode('agent');
              }}
              aria-label="Agent mode"
              type="button"
            >
              <Bot size={18} />
            </button>

            {/* Divider */}
            <div className="h-6 w-px border-l opacity-10"></div>

            {/* Deep Research Mode Icon */}
            <button
              className={cn(
                'p-2 transition-all duration-200',
                isDeepMode
                  ? 'text-accent scale-105 bg-surface-2'
                  : 'text-fg/70 hover:bg-surface-2',
              )}
              onMouseEnter={() => setShowDeepTooltip(true)}
              onMouseLeave={() => setShowDeepTooltip(false)}
              onClick={(e) => {
                e.stopPropagation();
                setOptimizationMode('deepResearch');
              }}
              aria-label="Deep Research mode"
              type="button"
            >
              <Microscope size={18} />
            </button>
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

          {/* Deep Research Tooltip */}
          {showDeepTooltip && (
            <div className="absolute z-20 bottom-[100%] mb-2 right-0 animate-in fade-in-0 duration-150">
              <div className="bg-surface border rounded-lg border-surface-2 p-4 w-80 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Microscope size={16} className="text-accent" />
                  <h3 className="font-medium text-sm text-fg text-left">
                    {deepMode?.title}
                  </h3>
                </div>
                <p className="text-sm text-fg/70 leading-relaxed text-left">
                  {deepMode?.description}
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
    </div>
  );
};

export default Optimization;
