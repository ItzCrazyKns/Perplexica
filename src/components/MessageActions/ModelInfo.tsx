'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import { ModelStats } from '../ChatWindow';
import { cn } from '@/lib/utils';
import TokenPill from '@/components/common/TokenPill';

interface ModelInfoButtonProps {
  modelStats: ModelStats | null;
}

const ModelInfoButton: React.FC<ModelInfoButtonProps> = ({ modelStats }) => {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Always render, using "Unknown" as fallback if model info isn't available
  const modelName = modelStats?.modelName || modelStats?.modelNameChat || 'Unknown';

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
          className="absolute z-10 left-8 bottom-0 w-96 rounded-md shadow-lg border border-surface-2 bg-surface"
        >
          <div className="py-2 px-3">
            <h4 className="text-sm font-medium mb-2">Model Information</h4>
            {/* Table-like grid */}
            <div className="text-xs grid grid-cols-[auto,1fr] gap-x-3 gap-y-2 items-center">
              {/* Legacy single-name fallback */}
              {!modelStats?.modelNameChat && modelName && (
                <>
                  <div className="opacity-70">Model</div>
                  <div className="font-medium truncate" title={modelName}>{modelName}</div>
                </>
              )}

              {/* Chat row */}
              {modelStats?.modelNameChat && (
                <>
                  <div className="opacity-70">Chat model</div>
                  <div className="font-medium truncate" title={modelStats.modelNameChat}>{modelStats.modelNameChat}</div>
                </>
              )}
              {modelStats?.usageChat && (
                <>
                  <div className="opacity-70">Chat tokens (est)</div>
                  <div className="flex flex-wrap gap-2">
                    <TokenPill label="In" value={modelStats.usageChat.input_tokens} />
                    <TokenPill label="Out" value={modelStats.usageChat.output_tokens} />
                    <TokenPill label="Total" value={modelStats.usageChat.total_tokens} highlight />
                  </div>
                </>
              )}

              {/* System row */}
              {modelStats?.modelNameSystem && (
                <>
                  <div className="opacity-70">System model</div>
                  <div className="font-medium truncate" title={modelStats.modelNameSystem}>{modelStats.modelNameSystem}</div>
                </>
              )}
              {modelStats?.usageSystem && (
                <>
                  <div className="opacity-70">System tokens (est)</div>
                  <div className="flex flex-wrap gap-2">
                    <TokenPill label="In" value={modelStats.usageSystem.input_tokens} />
                    <TokenPill label="Out" value={modelStats.usageSystem.output_tokens} />
                    <TokenPill label="Total" value={modelStats.usageSystem.total_tokens} highlight />
                  </div>
                </>
              )}

              {/* Legacy single-usage fallback */}
              {!modelStats?.usageChat && !modelStats?.usageSystem && modelStats?.usage && (
                <>
                  <div className="opacity-70">Tokens (est)</div>
                  <div className="flex flex-wrap gap-2">
                    <TokenPill label="In" value={modelStats.usage.input_tokens} />
                    <TokenPill label="Out" value={modelStats.usage.output_tokens} />
                    <TokenPill label="Total" value={modelStats.usage.total_tokens} highlight />
                  </div>
                </>
              )}

              {/* Response time */}
              {modelStats?.responseTime && (
                <>
                  <div className="opacity-70">Response time</div>
                  <div className="font-medium">{(modelStats.responseTime / 1000).toFixed(2)}s</div>
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
