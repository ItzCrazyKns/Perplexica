interface MessageBoxLoadingProps {
  progress: {
    message: string;
    current: number;
    total: number;
    subMessage?: string;
  } | null;
}

const MessageBoxLoading = ({ progress }: MessageBoxLoadingProps) => {
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

export default MessageBoxLoading;
