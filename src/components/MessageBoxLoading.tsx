import TokenPill from '@/components/common/TokenPill';
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
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
}

const MessageBoxLoading = ({
  progress,
  modelStats,
}: MessageBoxLoadingProps) => {
  return (
    <div className="flex flex-col space-y-4 w-full lg:w-9/12">
      {progress && progress.current !== progress.total ? (
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
      ) : (
        <div className="pl-3 flex items-center justify-start">
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-[high-bounce_1s_infinite] [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-[high-bounce_1s_infinite] [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-[high-bounce_1s_infinite]"></div>
          </div>
        </div>
      )}
    </div>
  );
};

// TokenPill moved to shared component

function PhaseTimeline({ percent }: { percent: number }) {
  const phases = ['Plan', 'Search', 'Read', 'Cluster', 'Synthesize', 'Review'];
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
