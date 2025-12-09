'use client';

import { cn } from '@/lib/utils';
import {
  BookCopy,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Scale,
} from 'lucide-react';
import LaneIndicator from './LaneIndicator';
import ClaimClusterSection from './ClaimClusterSection';
import TriangulatedNewsSources from './TriangulatedNewsSources';
import type {
  ClaimCluster,
  Lane,
  NewsSource,
} from '@/types/newsTriangulate';

interface TriangulatedNewsData {
  sources: NewsSource[];
  sharedFacts: ClaimCluster[];
  conflicts: ClaimCluster[];
  uniqueAngles: ClaimCluster[];
  lanes: Array<{ lane: Lane; count: number }>;
}

interface TriangulatedNewsResultProps {
  data: TriangulatedNewsData;
  className?: string;
}

/**
 * Main component for displaying triangulated news results.
 * Shows sources with lane tags, claim clusters organized by category,
 * and a lane distribution indicator.
 */
const TriangulatedNewsResult = ({
  data,
  className,
}: TriangulatedNewsResultProps) => {
  const { sources, sharedFacts, conflicts, uniqueAngles, lanes } = data;

  const hasClaimData =
    sharedFacts.length > 0 || conflicts.length > 0 || uniqueAngles.length > 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Lane Balance Indicator */}
      {lanes.length > 0 && (
        <div className="bg-light-100 dark:bg-dark-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scale size={18} className="text-black dark:text-white" />
            <h4 className="text-black dark:text-white font-medium text-sm">
              Perspective Balance
            </h4>
          </div>
          <LaneIndicator lanes={lanes} />
        </div>
      )}

      {/* Sources Section */}
      {sources.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookCopy size={18} className="text-black dark:text-white" />
            <h3 className="text-black dark:text-white font-medium text-lg">
              Sources
            </h3>
            <span className="text-xs text-black/40 dark:text-white/40 bg-light-200 dark:bg-dark-200 px-2 py-0.5 rounded-full">
              {sources.length}
            </span>
          </div>
          <TriangulatedNewsSources sources={sources} />
        </div>
      )}

      {/* Claim Analysis Sections */}
      {hasClaimData && (
        <div className="space-y-5 pt-2">
          <ClaimClusterSection
            title="Shared Facts"
            icon={<CheckCircle2 size={18} />}
            clusters={sharedFacts}
            variant="shared"
          />

          <ClaimClusterSection
            title="Conflicting Reports"
            icon={<AlertTriangle size={18} />}
            clusters={conflicts}
            variant="conflict"
          />

          <ClaimClusterSection
            title="Unique Angles"
            icon={<Lightbulb size={18} />}
            clusters={uniqueAngles}
            variant="unique"
          />
        </div>
      )}

      {/* Empty state */}
      {!hasClaimData && sources.length === 0 && (
        <div className="text-center py-8 text-black/50 dark:text-white/50">
          <p>No triangulated news data available.</p>
        </div>
      )}
    </div>
  );
};

export default TriangulatedNewsResult;

