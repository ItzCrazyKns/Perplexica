'use client';

import {
  RefreshCw,
  Edit,
  Trash2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Widget } from '@/lib/types/widget';
import { useState } from 'react';

interface WidgetDisplayProps {
  widget: Widget;
  onEdit: (widget: Widget) => void;
  onDelete: (widgetId: string) => void;
  onRefresh: (widgetId: string) => void;
}

const WidgetDisplay = ({
  widget,
  onEdit,
  onDelete,
  onRefresh,
}: WidgetDisplayProps) => {
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getRefreshFrequencyText = () => {
    return `Every ${widget.refreshFrequency} ${widget.refreshUnit}`;
  };

  return (
    <Card className="flex flex-col h-full w-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {/* Drag Handle */}
            <div
              className="widget-drag-handle flex-shrink-0 p-1 rounded hover:bg-light-secondary dark:hover:bg-dark-secondary cursor-move transition-colors"
              title="Drag to move widget"
            >
              <GripVertical
                size={16}
                className="text-gray-400 dark:text-gray-500"
              />
            </div>

            <CardTitle className="text-lg font-medium truncate">
              {widget.title}
            </CardTitle>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Last updated date with refresh frequency tooltip */}
            <span
              className="text-xs text-gray-500 dark:text-gray-400"
              title={getRefreshFrequencyText()}
            >
              {formatLastUpdated(widget.lastUpdated)}
            </span>

            {/* Refresh button */}
            <button
              onClick={() => onRefresh(widget.id)}
              disabled={widget.isLoading}
              className="p-1.5 hover:bg-light-secondary dark:hover:bg-dark-secondary rounded transition-colors disabled:opacity-50"
              title="Refresh Widget"
            >
              <RefreshCw
                size={16}
                className={`text-gray-600 dark:text-gray-400 ${widget.isLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {widget.isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" />
              <span>Loading content...</span>
            </div>
          ) : widget.error ? (
            <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
              <AlertCircle
                size={16}
                className="text-red-500 mt-0.5 flex-shrink-0"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Error Loading Content
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {widget.error}
                </p>
              </div>
            </div>
          ) : widget.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRenderer content={widget.content} thinkOverlay={true} />
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <p className="text-sm">No content yet</p>
                <p className="text-xs mt-1">Click refresh to load content</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Collapsible footer with sources and actions */}
      <div className="bg-light-secondary/30 dark:bg-dark-secondary/30 flex-shrink-0">
        <button
          onClick={() => setIsFooterExpanded(!isFooterExpanded)}
          className="w-full px-4 py-2 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors"
        >
          {isFooterExpanded ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
          <span>Sources & Actions</span>
        </button>

        {isFooterExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {/* Sources */}
            {widget.sources.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Sources:
                </p>
                <div className="space-y-1">
                  {widget.sources.map((source, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 text-xs"
                    >
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-gray-600 dark:text-gray-300 truncate">
                        {source.url}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">
                        ({source.type})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => onEdit(widget)}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-light-secondary dark:hover:bg-dark-secondary rounded transition-colors"
              >
                <Edit size={12} />
                <span>Edit</span>
              </button>

              <button
                onClick={() => onDelete(widget.id)}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default WidgetDisplay;
