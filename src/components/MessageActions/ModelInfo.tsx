'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import { ModelStats } from '../ChatWindow';
import { cn } from '@/lib/utils';

interface ModelInfoButtonProps {
  modelStats: ModelStats | null;
}

const ModelInfoButton: React.FC<ModelInfoButtonProps> = ({ modelStats }) => {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Always render, using "Unknown" as fallback if model info isn't available
  const modelName = modelStats?.modelName || 'Unknown';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className="p-1 ml-1 text-black/50 dark:text-white/50 rounded-full hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
        onClick={() => setShowPopover(!showPopover)}
        aria-label="Show model information"
      >
        <Info size={14} />
      </button>
      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute z-10 left-6 top-0 w-64 rounded-md shadow-lg bg-white dark:bg-dark-secondary border border-light-200 dark:border-dark-200"
        >
          <div className="py-2 px-3">
            <h4 className="text-sm font-medium mb-2 text-black dark:text-white">
              Model Information
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-black/70 dark:text-white/70">Model:</span>
                <span className="text-black dark:text-white font-medium">
                  {modelName}
                </span>
              </div>
              {modelStats?.responseTime && (
                <div className="flex justify-between">
                  <span className="text-black/70 dark:text-white/70">Response time:</span>
                  <span className="text-black dark:text-white font-medium">
                    {(modelStats.responseTime / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelInfoButton;
