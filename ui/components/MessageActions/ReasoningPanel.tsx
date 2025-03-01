'use client';

import * as React from 'react';
import { Brain, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Markdown from 'markdown-to-jsx';
import logger from '@/lib/logger';

interface ReasoningPanelProps {
  thinking: string;
  className?: string;
  isExpanded?: boolean;
}

const ReasoningPanel = ({ thinking, className, isExpanded: propExpanded }: ReasoningPanelProps): React.ReactElement => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [detailsRefs, setDetailsRefs] = React.useState<HTMLDetailsElement[]>([]);

  React.useEffect(() => {
    if (propExpanded !== undefined) {
      setIsExpanded(propExpanded);
    }
  }, [propExpanded]);

  const addDetailsRef = React.useCallback((element: HTMLDetailsElement | null) => {
    if (element) {
      setDetailsRefs(refs => {
        if (!refs.includes(element)) {
          return [...refs, element];
        }
        return refs;
      });
    }
  }, []);

  const expandAll = () => {
    detailsRefs.forEach(ref => ref.open = true);
  };
  const collapseAll = () => {
    detailsRefs.forEach(ref => ref.open = false);
  };

  return (
    <div className={cn("flex flex-col space-y-2 mb-4", className)}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex flex-row items-center space-x-2 group text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition duration-200"
        type="button"
      >
        <Brain size={20} />
        <h3 className="font-medium text-xl">Reasoning</h3>
        <ChevronDown 
          size={16}
          className={cn(
            "transition-transform duration-200",
            isExpanded ? "rotate-180" : ""
          )} 
        />
      </button>
      
      {isExpanded && (
        <div className="rounded-lg bg-light-secondary/50 dark:bg-dark-secondary/50 p-4">
          {thinking.split('\n\n').map((paragraph, index) => {
            if (!paragraph.trim()) return null;
            
            const content = paragraph.replace(/^[•\-\d.]\s*/, '');
            
            return (
              <div key={index} className="mb-2 last:mb-0">
                <details 
                  ref={addDetailsRef}
                  className="group [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex items-center cursor-pointer list-none text-sm text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white">
                    <span className="arrow mr-2 inline-block transition-transform duration-200 group-open:rotate-90 group-open:self-start group-open:mt-1">▸</span>
                    <p className="relative whitespace-normal line-clamp-1 group-open:line-clamp-none after:content-['...'] after:inline group-open:after:hidden transition-all duration-200 text-ellipsis overflow-hidden group-open:overflow-visible">
                      {content}
                    </p>
                  </summary>
                  {/* Content is shown in the summary when expanded - no need to render it again */}
                </details>
              </div>
            );
          })}
          <div className="flex justify-end space-x-2 mt-4 text-sm text-black/70 dark:text-white/70">
            <button 
              onClick={expandAll}
              className="flex items-center space-x-1 hover:text-[#24A0ED] transition-colors"
            >
              <Maximize2 size={10} />
              <span className="text-xs">Expand all</span>
            </button>
            <span>•</span>
            <button 
              onClick={collapseAll}
              className="flex items-center space-x-1 hover:text-[#24A0ED] transition-colors"
            >
              <Minimize2 size={10} />
              <span className="text-xs">Collapse all</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReasoningPanel;
