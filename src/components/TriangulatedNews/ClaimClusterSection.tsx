'use client';

import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ClaimCluster, Lane } from '@/types/newsTriangulate';

interface ClaimClusterSectionProps {
  title: string;
  icon: React.ReactNode;
  clusters: ClaimCluster[];
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
 * Displays a section of claim clusters (shared facts, conflicts, or unique angles).
 * Each cluster shows the representative claim text, lane coverage, and source count.
 */
const ClaimClusterSection = ({
  title,
  icon,
  clusters,
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
            <div
              key={cluster.clusterId}
              className={cn(
                'bg-light-100 dark:bg-dark-100 rounded-lg p-3 border-l-4 space-y-2',
                styles.accent,
              )}
            >
              <p className="text-sm text-black/90 dark:text-white/90 leading-relaxed">
                {cluster.representativeText}
              </p>

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

                {/* Source count and agreement level */}
                <div className="flex items-center gap-2 text-[10px] text-black/50 dark:text-white/50">
                  <span>
                    {cluster.supportingClaims.length} source
                    {cluster.supportingClaims.length !== 1 ? 's' : ''}
                  </span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded font-medium uppercase tracking-wide',
                      cluster.agreementLevel === 'high' &&
                        'bg-green-500/10 text-green-600 dark:text-green-400',
                      cluster.agreementLevel === 'medium' &&
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                      cluster.agreementLevel === 'low' &&
                        'bg-gray-500/10 text-gray-600 dark:text-gray-400',
                    )}
                  >
                    {cluster.agreementLevel}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClaimClusterSection;

