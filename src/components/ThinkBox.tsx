'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, BrainCircuit } from 'lucide-react';

interface ThinkBoxProps {
  content: ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}

const ThinkBox = ({ content, expanded, onToggle }: ThinkBoxProps) => {
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Don't render anything if content is empty
  if (!content) {
    return null;
  }

  // Use external expanded state if provided, otherwise use internal state
  const isExpanded = expanded !== undefined ? expanded : internalExpanded;
  const handleToggle =
    onToggle || (() => setInternalExpanded(!internalExpanded));

  return (
    <div className="my-4 bg-surface/50 rounded-xl border border-surface-2 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-4 text-fg/90 hover:bg-surface-2 transition duration-200"
      >
        <div className="flex items-center space-x-2">
          <BrainCircuit size={20} className="text-[#9C27B0]" />
          <span className="font-medium text-sm">Thinking Process</span>
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-fg/70" />
        ) : (
          <ChevronDown size={18} className="text-fg/70" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 text-fg/80 text-sm border-t border-surface-2 bg-surface/50 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
};

export default ThinkBox;
