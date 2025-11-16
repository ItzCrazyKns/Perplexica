import { Dialog, DialogPanel } from '@headlessui/react';
import { Clapperboard, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

interface SummarizeVideoProps {
  variant?: 'icon' | 'button';
}

const SummarizeVideo = ({ variant = 'icon' }: SummarizeVideoProps) => {
  const { summarizeYoutubeVideo, loading } = useChat();
  const [open, setOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const success = await summarizeYoutubeVideo(videoUrl);

    if (success) {
      setVideoUrl('');
      setOpen(false);
    }
    setSubmitting(false);
  };

  const buttonClasses =
    variant === 'icon'
      ? 'flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white p-1'
      : 'flex flex-row items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm border border-light-200 dark:border-dark-200 text-black dark:text-white hover:bg-light-secondary hover:dark:bg-dark-secondary transition duration-200';

  const isDisabled = loading || submitting;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonClasses, isDisabled && 'opacity-60 cursor-not-allowed')}
        disabled={isDisabled}
      >
        {submitting ? (
          <Loader2 size={variant === 'icon' ? 16 : 18} className="animate-spin" />
        ) : (
          <Clapperboard size={variant === 'icon' ? 16 : 18} />
        )}
        {variant === 'button' && <span>Summarise video</span>}
      </button>

      <Dialog
        open={open}
        onClose={() => {
          if (!submitting) setOpen(false);
        }}
        className="relative z-40"
      >
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center px-4">
          <DialogPanel className="w-full max-w-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-lg">
            <form onSubmit={handleSubmit} className="flex flex-col space-y-4 p-6">
              <div>
                <h3 className="text-base font-medium text-black dark:text-white">
                  Summarise YouTube video
                </h3>
                <p className="text-xs text-black/60 dark:text-white/60 mt-1">
                  Paste a YouTube link. Perplexica will fetch the transcript and share the main takeaways.
                </p>
              </div>
              <label className="flex flex-col space-y-2 text-xs text-black/70 dark:text-white/70">
                <span>Video URL</span>
                <input
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 text-sm text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors"
                />
              </label>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!submitting) setOpen(false);
                  }}
                  className="px-4 py-2 text-sm rounded-lg border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm rounded-lg bg-sky-500 text-white font-medium hover:opacity-90 transition duration-200 disabled:opacity-70 flex items-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Summarising…</span>
                    </>
                  ) : (
                    <span>Summarise</span>
                  )}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
};

export default SummarizeVideo;

