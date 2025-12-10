'use client';

import { cn } from '@/lib/utils';
import type { Lane } from '@/types/newsTriangulate';

interface LaneCount {
  lane: Lane;
  count: number;
}

interface LaneIndicatorProps {
  lanes: LaneCount[];
  className?: string;
}

const LANE_COLORS: Record<Lane, { bg: string; bar: string; text: string; label: string }> = {
  LEFT: {
    bg: 'bg-blue-500/30 dark:bg-blue-500/40',
    bar: 'bg-blue-500 dark:bg-blue-400',
    text: 'text-blue-500 dark:text-blue-400',
    label: 'Left',
  },
  RIGHT: {
    bg: 'bg-red-500/30 dark:bg-red-500/40',
    bar: 'bg-red-500 dark:bg-red-400',
    text: 'text-red-500 dark:text-red-400',
    label: 'Right',
  },
  CENTER: {
    bg: 'bg-purple-500/30 dark:bg-purple-500/40',
    bar: 'bg-purple-500 dark:bg-purple-400',
    text: 'text-purple-500 dark:text-purple-400',
    label: 'Center',
  },
  UNKNOWN: {
    bg: 'bg-slate-500/30 dark:bg-slate-500/40',
    bar: 'bg-slate-400 dark:bg-slate-500',
    text: 'text-slate-500 dark:text-slate-400',
    label: 'Other',
  },
};

/**
 * Displays the distribution of sources across political lanes.
 * Shows a horizontal bar with proportional segments for each lane.
 */
const LaneIndicator = ({ lanes, className }: LaneIndicatorProps) => {
  const total = lanes.reduce((sum, l) => sum + l.count, 0);
  if (total === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs text-black/60 dark:text-white/60">
        <span className="font-medium">Source Balance</span>
        <span>{total} sources</span>
      </div>

      {/* Proportional bar - vibrant colors */}
      <div className="flex h-3 rounded-full overflow-hidden bg-light-200 dark:bg-dark-200">
        {lanes
          .filter((l) => l.count > 0)
          .map((lane) => {
            const width = (lane.count / total) * 100;
            return (
              <div
                key={lane.lane}
                className={cn(LANE_COLORS[lane.lane].bar, 'transition-all')}
                style={{ width: `${width}%` }}
                title={`${LANE_COLORS[lane.lane].label}: ${lane.count}`}
              />
            );
          })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {lanes
          .filter((l) => l.count > 0)
          .map((lane) => (
            <div key={lane.lane} className="flex items-center gap-1.5">
              <div
                className={cn(
                  'w-3 h-3 rounded-full',
                  LANE_COLORS[lane.lane].bar,
                )}
              />
              <span className={cn(LANE_COLORS[lane.lane].text, 'font-medium')}>
                {LANE_COLORS[lane.lane].label}
              </span>
              <span className="text-black/50 dark:text-white/50">
                ({lane.count})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default LaneIndicator;

