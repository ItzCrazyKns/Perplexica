'use client';

/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { ExternalLink } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import type { Lane, NewsSource } from '@/types/newsTriangulate';

interface TriangulatedNewsSourcesProps {
  sources: NewsSource[];
  className?: string;
}

const LANE_BADGE_STYLES: Record<Lane, string> = {
  LEFT: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  RIGHT: 'bg-red-500/10 text-red-600 dark:text-red-400',
  CENTER: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  UNKNOWN: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

const LANE_LABELS: Record<Lane, string> = {
  LEFT: 'L',
  RIGHT: 'R',
  CENTER: 'C',
  UNKNOWN: '?',
};

/**
 * Displays news sources with lane tags in a grid layout.
 * Shows first 3 sources with a "View more" button for additional sources.
 */
const TriangulatedNewsSources = ({
  sources,
  className,
}: TriangulatedNewsSourcesProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeModal = () => {
    setIsDialogOpen(false);
    document.body.classList.remove('overflow-hidden-scrollable');
  };

  const openModal = () => {
    setIsDialogOpen(true);
    document.body.classList.add('overflow-hidden-scrollable');
  };

  // Cleanup: ensure body scroll class is removed if component unmounts while dialog is open
  useEffect(() => {
    return () => {
      document.body.classList.remove('overflow-hidden-scrollable');
    };
  }, []);

  const SourceCard = ({
    source,
    index,
    compact = false,
  }: {
    source: NewsSource;
    index: number;
    compact?: boolean;
  }) => {
    const lane = source.lane ?? 'UNKNOWN';

    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200',
          'transition duration-200 rounded-lg p-3 flex flex-col font-medium group',
          compact ? 'space-y-1.5' : 'space-y-2',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'dark:text-white overflow-hidden text-ellipsis',
              compact
                ? 'text-xs line-clamp-1'
                : 'text-xs line-clamp-2 leading-relaxed',
            )}
          >
            {source.title}
          </p>
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0',
              LANE_BADGE_STYLES[lane],
            )}
            title={lane === 'UNKNOWN' ? 'Unknown bias' : `${lane} leaning`}
          >
            {LANE_LABELS[lane]}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <img
              src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.url}`}
              width={14}
              height={14}
              alt="favicon"
              className="rounded h-3.5 w-3.5"
            />
            <p className="text-[10px] text-black/50 dark:text-white/50 overflow-hidden whitespace-nowrap text-ellipsis max-w-[100px]">
              {source.domain}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-black/40 dark:text-white/40">
            <span className="text-[10px]">{index + 1}</span>
            <ExternalLink
              size={10}
              className="opacity-0 group-hover:opacity-100 transition"
            />
          </div>
        </div>
      </a>
    );
  };

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-2', className)}>
      {sources.slice(0, 3).map((source, i) => (
        <SourceCard key={source.id} source={source} index={i} />
      ))}

      {sources.length > 3 && (
        <button
          onClick={openModal}
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
        >
          <div className="flex flex-row items-center space-x-1">
            {sources.slice(3, 6).map((source) => (
              <img
                key={source.id}
                src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.url}`}
                width={14}
                height={14}
                alt="favicon"
                className="rounded h-3.5 w-3.5"
              />
            ))}
          </div>
          <p className="text-xs text-black/50 dark:text-white/50">
            View {sources.length - 3} more
          </p>
        </button>
      )}

      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-lg transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle className="text-lg font-medium leading-6 dark:text-white mb-4">
                    All Sources ({sources.length})
                  </DialogTitle>
                  <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[400px] pr-2">
                    {sources.map((source, i) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        index={i}
                        compact
                      />
                    ))}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default TriangulatedNewsSources;
