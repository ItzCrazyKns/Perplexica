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
        <div className="bg-light-primary dark:bg-dark-primary rounded-lg p-4">
          <div className="flex flex-col space-y-3">
            <p className="text-base font-semibold text-black dark:text-white">
              {progress.message}
            </p>
            {progress.subMessage && (
              <p
                className="text-xs text-black/40 dark:text-white/40 mt-1"
                title={progress.subMessage}
              >
                {progress.subMessage}
              </p>
            )}
            <div className="w-full bg-light-secondary dark:bg-dark-secondary rounded-full h-2 overflow-hidden">
              <div
                className={`h-full bg-[#24A0ED] transition-all duration-300 ease-in-out ${
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
        <div className="bg-light-primary dark:bg-dark-primary animate-pulse rounded-lg py-3">
          <div className="h-2 rounded-full w-full bg-light-secondary dark:bg-dark-secondary" />
          <div className="h-2 mt-2 rounded-full w-9/12 bg-light-secondary dark:bg-dark-secondary" />
          <div className="h-2 mt-2 rounded-full w-10/12 bg-light-secondary dark:bg-dark-secondary" />
        </div>
      )}
    </div>
  );
};

export default MessageBoxLoading;
