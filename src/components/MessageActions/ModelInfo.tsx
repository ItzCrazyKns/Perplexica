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
        className="p-1 ml-1 rounded-full hover:bg-surface-2 transition duration-200"
        onClick={() => setShowPopover(!showPopover)}
        aria-label="Show model information"
      >
        <Info size={18} />
      </button>
      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute z-10 left-6 top-0 w-72 rounded-md shadow-lg border border-surface-2 bg-surface"
        >
          <div className="py-2 px-3">
            <h4 className="text-sm font-medium mb-2">Model Information</h4>
            <div className="space-y-1 text-xs">
              <div className="flex space-x-2">
                <span className="">Model:</span>
                <span className="font-medium">{modelName}</span>
              </div>
              {modelStats?.responseTime && (
                <div className="flex space-x-2">
                  <span>Response time:</span>
                  <span className="font-medium">
                    {(modelStats.responseTime / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
              {modelStats?.usage && (
                <>
                  <div className="flex space-x-2">
                    <span>Input tokens:</span>
                    <span className="font-medium">
                      {modelStats.usage.input_tokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <span>Output tokens:</span>
                    <span className="font-medium">
                      {modelStats.usage.output_tokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <span>Total tokens:</span>
                    <span className="font-medium">
                      {modelStats.usage.total_tokens.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelInfoButton;
