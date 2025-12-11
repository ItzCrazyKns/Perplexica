'use client';

/* eslint-disable @next/next/no-img-element */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Scale,
  ExternalLink,
} from 'lucide-react';
import LaneIndicator from './LaneIndicator';
import ClaimClusterSection from './ClaimClusterSection';
import TriangulatedNewsSources from './TriangulatedNewsSources';
import type { ClaimCluster, Lane, NewsSource } from '@/types/newsTriangulate';

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
 * Picks the best hero image from sources - prioritizes high-credibility sources with images.
 * Uses og:image/thumbnails from search results which are safe for preview use.
 */
const pickHeroImage = (sources: NewsSource[]): NewsSource | null => {
  const withImages = sources.filter((s) => s.imageUrl);
  if (withImages.length === 0) return null;

  // Sort by credibility (highest first), then pick the first
  const sorted = [...withImages].sort(
    (a, b) => (b.credibilityScore ?? 0) - (a.credibilityScore ?? 0),
  );
  return sorted[0];
};

/**
 * TriangulatedNewsResult
 * Renders the full triangulation output: hero image, lane balance, sources, and clustered claims.
 */
const TriangulatedNewsResult = ({
  data,
  className,
}: TriangulatedNewsResultProps) => {
  const {
    sources = [],
    sharedFacts = [],
    conflicts = [],
    uniqueAngles = [],
    lanes = [],
  } = data || {};

  const hasClaimData =
    sharedFacts.length > 0 || conflicts.length > 0 || uniqueAngles.length > 0;

  // Pick best image for hero (from high-credibility source)
  const heroSource = useMemo(() => pickHeroImage(sources), [sources]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Hero Image - og:image from highest credibility source */}
      {heroSource?.imageUrl && (
        <a
          href={heroSource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative group overflow-hidden rounded-xl"
        >
          <img
            src={heroSource.imageUrl}
            alt={heroSource.title}
            className="w-full h-48 md:h-64 object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              // Hide image if it fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {/* Gradient overlay with attribution */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white/90 text-sm font-medium line-clamp-2 mb-1">
              {heroSource.title}
            </p>
            <div className="flex items-center gap-1.5 text-white/60 text-xs">
              <span>{heroSource.domain}</span>
              <ExternalLink size={12} />
            </div>
          </div>
        </a>
      )}

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
            sources={sources}
            variant="shared"
          />

          <ClaimClusterSection
            title="Conflicting Reports"
            icon={<AlertTriangle size={18} />}
            clusters={conflicts}
            sources={sources}
            variant="conflict"
          />

          <ClaimClusterSection
            title="Unique Angles"
            icon={<Lightbulb size={18} />}
            clusters={uniqueAngles}
            sources={sources}
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
