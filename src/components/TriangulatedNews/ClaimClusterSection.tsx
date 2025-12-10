'use client';

import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { ClaimCluster, Lane, NewsSource } from '@/types/newsTriangulate';

interface ClaimClusterSectionProps {
  title: string;
  icon: React.ReactNode;
  clusters: ClaimCluster[];
  sources: NewsSource[];
  variant: 'shared' | 'conflict' | 'unique';
  className?: string;
}

const LANE_BADGE_STYLES: Record<Lane, string> = {
  LEFT: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  RIGHT: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  CENTER:
    'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  UNKNOWN: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

const VARIANT_STYLES = {
  shared: {
    accent: 'border-l-green-500',
    badge: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  conflict: {
    accent: 'border-l-amber-500',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  unique: {
    accent: 'border-l-sky-500',
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
};

/**
 * Individual claim card with expandable details and source links.
 */
const ClaimCard = ({
  cluster,
  sources,
  accentClass,
}: {
  cluster: ClaimCluster;
  sources: NewsSource[];
  accentClass: string;
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const TEXT_TRUNCATE_LENGTH = 150;
  
  const isLongText = cluster.representativeText.length > TEXT_TRUNCATE_LENGTH;
  const displayText = isLongText && !detailsExpanded
    ? cluster.representativeText.slice(0, TEXT_TRUNCATE_LENGTH) + '...'
    : cluster.representativeText;

  // Get the actual source objects for this cluster
  const claimSources = cluster.supportingClaims
    .map((sc) => sources.find((s) => s.id === sc.sourceId))
    .filter((s): s is NewsSource => s !== undefined);

  return (
    <div
      className={cn(
        'bg-light-100 dark:bg-dark-100 rounded-lg p-3 border-l-4 space-y-2',
        accentClass,
      )}
    >
      {/* Claim text - clickable if truncated */}
      <button
        onClick={() => isLongText && setDetailsExpanded(!detailsExpanded)}
        className={cn(
          'text-left w-full',
          isLongText && 'cursor-pointer hover:bg-light-200/50 dark:hover:bg-dark-200/50 -m-1 p-1 rounded transition',
        )}
        disabled={!isLongText}
      >
        <p className="text-sm text-black/90 dark:text-white/90 leading-relaxed">
          {displayText}
        </p>
      </button>

      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Lane badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {cluster.lanesCovered.map((lane) => (
            <span
              key={lane}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                LANE_BADGE_STYLES[lane],
              )}
            >
              {lane === 'UNKNOWN' ? 'Other' : lane}
            </span>
          ))}
        </div>

        {/* Source count */}
        <div className="text-[10px] text-black/50 dark:text-white/50">
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="hover:text-black dark:hover:text-white transition underline"
          >
            {cluster.supportingClaims.length} source
            {cluster.supportingClaims.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Expanded source details */}
      {detailsExpanded && claimSources.length > 0 && (
        <div className="pt-2 mt-2 border-t border-light-200 dark:border-dark-200 space-y-1.5">
          <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-wide font-medium">
            Sources
          </p>
          {claimSources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition group"
            >
              <ExternalLink size={12} className="opacity-50 group-hover:opacity-100" />
              <span className="truncate flex-1">{source.title || source.domain}</span>
              <span
                className={cn(
                  'text-[9px] px-1 py-0.5 rounded border font-medium shrink-0',
                  LANE_BADGE_STYLES[source.lane || 'UNKNOWN'],
                )}
              >
                {source.lane === 'UNKNOWN' || !source.lane ? 'Other' : source.lane}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Displays a section of claim clusters (shared facts, conflicts, or unique angles).
 * Each cluster shows the representative claim text, lane coverage, and source count.
 */
const ClaimClusterSection = ({
  title,
  icon,
  clusters,
  sources,
  variant,
  className,
}: ClaimClusterSectionProps) => {
  const [expanded, setExpanded] = useState(true);

  if (clusters.length === 0) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <div className={cn('space-y-3', className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-2">
          <span className="text-black dark:text-white">{icon}</span>
          <h4 className="text-black dark:text-white font-medium text-base">
            {title}
          </h4>
          <span className="text-xs text-black/40 dark:text-white/40 bg-light-200 dark:bg-dark-200 px-2 py-0.5 rounded-full">
            {clusters.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp
            size={18}
            className="text-black/40 dark:text-white/40 group-hover:text-black dark:group-hover:text-white transition"
          />
        ) : (
          <ChevronDown
            size={18}
            className="text-black/40 dark:text-white/40 group-hover:text-black dark:group-hover:text-white transition"
          />
        )}
      </button>

      {expanded && (
        <div className="space-y-2">
          {clusters.map((cluster) => (
            <ClaimCard
              key={cluster.clusterId}
              cluster={cluster}
              sources={sources}
              accentClass={styles.accent}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClaimClusterSection;

