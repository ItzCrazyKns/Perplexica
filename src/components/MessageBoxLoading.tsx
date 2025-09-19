import TokenPill from '@/components/common/TokenPill';
import { Document } from '@langchain/core/documents';
import MessageSource from './MessageSource';
import { useState } from 'react';

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface SourceGroup {
  searchQuery: string;
  sources: Document[];
}

interface MessageBoxLoadingProps {
  progress: {
    message: string;
    current: number;
    total: number;
    subMessage?: string;
  } | null;
  modelStats?: {
    usage?: TokenUsage; // legacy single total
    usageChat?: TokenUsage;
    usageSystem?: TokenUsage;
  } | null;
  actionMessageId?: string;
  onAnswerNow?: () => void;
  gatheringSources?: SourceGroup[];
}

const MessageBoxLoading = ({
  progress,
  modelStats,
  actionMessageId,
  onAnswerNow,
  gatheringSources = [],
}: MessageBoxLoadingProps) => {
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const [isAnsweringNow, setIsAnsweringNow] = useState(false);
  const isAnswering = progress?.message === 'Starting Answer phase';
  return (
    <div className="flex flex-col space-y-4 w-full lg:w-9/12">
      {progress && progress.current !== progress.total && !isAnswering && (
        <div className="bg-surface rounded-lg p-4 border border-surface-2">
          <div className="flex flex-col space-y-3">
            <p className="text-base font-semibold">{progress.message}</p>
            {progress.subMessage && (
              <p className="text-xs mt-1" title={progress.subMessage}>
                {progress.subMessage}
              </p>
            )}
            {/* Phase timeline */}
            <PhaseTimeline percent={progress.current} />
            <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full bg-accent transition-all duration-300 ease-in-out ${
                  progress.current === progress.total ? '' : 'animate-pulse'
                }`}
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
            {/* Token counters */}
            {(modelStats?.usageChat ||
              modelStats?.usageSystem ||
              modelStats?.usage) && (
              <div className="flex flex-col gap-1 pt-1 text-xs text-fg/80">
                {modelStats?.usageChat && (
                  <div className="flex flex-row gap-2 items-center">
                    <span className="opacity-70 w-14">Chat</span>
                    <TokenPill
                      label="In"
                      value={modelStats.usageChat.input_tokens}
                    />
                    <TokenPill
                      label="Out"
                      value={modelStats.usageChat.output_tokens}
                    />
                    <TokenPill
                      label="Total"
                      value={modelStats.usageChat.total_tokens}
                      highlight
                    />
                  </div>
                )}
                {modelStats?.usageSystem && (
                  <div className="flex flex-row gap-2 items-center">
                    <span className="opacity-70 w-14">System</span>
                    <TokenPill
                      label="In"
                      value={modelStats.usageSystem.input_tokens}
                    />
                    <TokenPill
                      label="Out"
                      value={modelStats.usageSystem.output_tokens}
                    />
                    <TokenPill
                      label="Total"
                      value={modelStats.usageSystem.total_tokens}
                      highlight
                    />
                  </div>
                )}
                {!modelStats?.usageChat &&
                  !modelStats?.usageSystem &&
                  modelStats?.usage && (
                    <div className="flex flex-row gap-2 items-center">
                      <TokenPill
                        label="Input"
                        value={modelStats.usage.input_tokens}
                      />
                      <TokenPill
                        label="Output"
                        value={modelStats.usage.output_tokens}
                      />
                      <TokenPill
                        label="Total"
                        value={modelStats.usage.total_tokens}
                        highlight
                      />
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sources gathered during search phase */}
      {gatheringSources.length > 0 && !isAnswering && (
        <div className="bg-surface rounded-lg p-4 border border-surface-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
                className="flex items-center gap-1 text-sm font-semibold text-fg/90 hover:text-fg transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isSourcesExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Relevant Sources Gathered (
                {gatheringSources.reduce(
                  (acc, group) => acc + group.sources.length,
                  0,
                )}
                )
              </button>
            </div>
            {/* Answer now control */}
            {actionMessageId && gatheringSources.length > 0 && !isAnswering && (
              <div className="">
                <button
                  type="button"
                  onClick={async (e) => {
                    try {
                      // Disable the button immediately to prevent double clicks
                      (e.currentTarget as HTMLButtonElement).disabled = true;
                      setIsAnsweringNow(true);
                      if (onAnswerNow) {
                        onAnswerNow();
                      } else {
                        await fetch('/api/respond-now', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ messageId: actionMessageId }),
                        });
                      }
                    } catch (e) {
                      // no-op
                    }
                  }}
                  disabled={isAnsweringNow}
                  className="text-xs px-3 py-1 w-28 h-8 rounded-md bg-accent text-fg hover:bg-opacity-90 transition disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-1"
                >
                  {isAnsweringNow ? (
                    <>
                      <svg
                        className="animate-spin w-6 h-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="2"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </>
                  ) : (
                    'Answer now'
                  )}
                </button>
              </div>
            )}
          </div>
          {isSourcesExpanded && (
            <div className="mt-4 space-y-4">
              {gatheringSources.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-2">
                  <div className="text-xs font-medium text-fg/70 bg-surface-2 px-2 py-1 rounded">
                    Search: "{group.searchQuery}"
                  </div>
                  <div className="grid gap-2">
                    {group.sources.map((source, sourceIndex) => (
                      <MessageSource
                        key={`${groupIndex}-${sourceIndex}`}
                        source={source}
                        className="text-xs p-2"
                        style={{ minHeight: 'auto' }}
                        oneLiner
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// TokenPill moved to shared component

function PhaseTimeline({ percent }: { percent: number }) {
  const phases = ['Plan', 'Search', 'Analyze', 'Answer'];
  const stepPct = 100 / phases.length;
  const completed = Math.floor(percent / stepPct + 0.0001);
  return (
    <div className="flex items-center gap-2 text-[11px] text-fg/70">
      {phases.map((p, i) => {
        const isDone = i < completed;
        const isCurrent = i === completed;
        return (
          <div key={p} className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${
                isDone
                  ? 'bg-accent'
                  : isCurrent
                    ? 'bg-accent/60'
                    : 'bg-surface-2'
              }`}
              title={p}
            />
            <span
              className={`${isDone || isCurrent ? 'text-fg/90' : 'text-fg/50'}`}
            >
              {p}
            </span>
            {i < phases.length - 1 && (
              <div className="w-4 h-[1px] bg-surface-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MessageBoxLoading;
