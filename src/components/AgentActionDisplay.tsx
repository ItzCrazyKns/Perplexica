'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  Bot,
  Search,
  Zap,
  Microscope,
  Ban,
  CircleCheck,
  ListPlus,
} from 'lucide-react';
import { AgentActionEvent } from './ChatWindow';

interface AgentActionDisplayProps {
  events: AgentActionEvent[];
  messageId: string;
  isLoading: boolean;
}

const AgentActionDisplay = ({
  events,
  messageId,
  isLoading,
}: AgentActionDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get the most recent event for collapsed view
  const latestEvent = events[events.length - 1];

  // Common function to format action names
  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ').toLocaleLowerCase();
  };

  // Function to get appropriate icon based on action type
  const getActionIcon = (action: string, size: number = 20) => {
    switch (action) {
      case 'ANALYZING_PREVIEW_CONTENT':
        return <Search size={size} className="text-[#9C27B0]" />;
      case 'PROCESSING_PREVIEW_CONTENT':
        return <Zap size={size} className="text-[#9C27B0]" />;
      case 'PROCEEDING_WITH_FULL_ANALYSIS':
        return <Microscope size={size} className="text-[#9C27B0]" />;
      case 'SKIPPING_IRRELEVANT_SOURCE':
        return <Ban size={size} className="text-red-600 dark:text-red-500" />;
      case 'CONTEXT_UPDATED':
        return (
          <ListPlus
            size={size}
            className="text-green-600 dark:text-green-500"
          />
        );
      case 'INFORMATION_GATHERING_COMPLETE':
        return (
          <CircleCheck
            size={size}
            className="text-green-600 dark:text-green-500"
          />
        );
      default:
        return <Bot size={size} className="text-[#9C27B0]" />;
    }
  };

  if (!latestEvent) {
    return null;
  }

  return (
    <div className="my-4 bg-light-secondary/50 dark:bg-dark-secondary/50 rounded-xl border border-light-200 dark:border-dark-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-black/90 dark:text-white/90 hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200"
      >
        <div className="flex items-center space-x-2">
          {getActionIcon(latestEvent.action)}
          <span className="font-medium text-base text-black/70 dark:text-white/70 tracking-wide capitalize flex items-center">
            {!isLoading ||
            latestEvent.action === 'INFORMATION_GATHERING_COMPLETE'
              ? 'Agent Log'
              : formatActionName(latestEvent.action)}
            {/* {isLoading &&
              latestEvent.action !== 'INFORMATION_GATHERING_COMPLETE' && (
                <span className="ml-2 inline-block align-middle">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-t-transparent border-[#9C27B0] rounded-full align-middle"></span>
                </span>
              )} */}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-black/70 dark:text-white/70" />
        ) : (
          <ChevronDown size={18} className="text-black/70 dark:text-white/70" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 text-black/80 dark:text-white/80 text-base border-t border-light-200 dark:border-dark-200 bg-light-100/50 dark:bg-dark-100/50">
          <div className="space-y-3">
            {events.map((event, index) => (
              <div
                key={`${messageId}-${index}-${event.action}`}
                className="flex flex-col space-y-1 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-light-200/50 dark:border-dark-200/50"
              >
                <div className="flex items-center space-x-2">
                  {getActionIcon(event.action, 16)}
                  <span className="font-medium text-sm text-black/70 dark:text-white/70 capitalize tracking-wide">
                    {formatActionName(event.action)}
                  </span>
                </div>

                {event.message && event.message.length > 0 && (
                  <p className="text-base">{event.message}</p>
                )}

                {/* Display relevant details based on event type */}
                {event.details && Object.keys(event.details).length > 0 && (
                  <div className="mt-2 text-sm text-black/60 dark:text-white/60">
                    {event.details.sourceUrl && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Source:
                        </span>
                        <span className="truncate">
                          <a href={event.details.sourceUrl} target="_blank">
                            {event.details.sourceUrl}
                          </a>
                        </span>
                      </div>
                    )}
                    {event.details.skipReason && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Reason:
                        </span>
                        <span>{event.details.skipReason}</span>
                      </div>
                    )}
                    {event.details.searchQuery &&
                      event.details.searchQuery !== event.details.query && (
                        <div className="flex space-x-1">
                          <span className="font-bold whitespace-nowrap">
                            Search Query:
                          </span>
                          <span className="italic">
                            &quot;{event.details.searchQuery}&quot;
                          </span>
                        </div>
                      )}
                    {event.details.sourcesFound !== undefined && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Sources Found:
                        </span>
                        <span>{event.details.sourcesFound}</span>
                      </div>
                    )}
                    {/* {(event.details.documentCount !== undefined && event.details.documentCount > 0) && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">Documents:</span>
                        <span>{event.details.documentCount}</span>
                      </div>
                    )} */}
                    {event.details.contentLength !== undefined && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Content Length:
                        </span>
                        <span>{event.details.contentLength} characters</span>
                      </div>
                    )}
                    {event.details.searchInstructions !== undefined && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Search Instructions:
                        </span>
                        <span>{event.details.searchInstructions}</span>
                      </div>
                    )}
                    {/* {event.details.previewCount !== undefined && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">Preview Sources:</span>
                        <span>{event.details.previewCount}</span>
                      </div>
                    )} */}
                    {event.details.processingType && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Processing Type:
                        </span>
                        <span className="capitalize">
                          {event.details.processingType.replace('-', ' ')}
                        </span>
                      </div>
                    )}
                    {event.details.insufficiencyReason && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Reason:
                        </span>
                        <span>{event.details.insufficiencyReason}</span>
                      </div>
                    )}
                    {event.details.reason && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Reason:
                        </span>
                        <span>{event.details.reason}</span>
                      </div>
                    )}
                    {/* {event.details.taskCount !== undefined && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">Tasks:</span>
                        <span>{event.details.taskCount}</span>
                      </div>
                    )} */}
                    {event.details.currentTask && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Current Task:
                        </span>
                        <span className="italic">
                          &quot;{event.details.currentTask}&quot;
                        </span>
                      </div>
                    )}
                    {event.details.nextTask && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Next:
                        </span>
                        <span className="italic">
                          &quot;{event.details.nextTask}&quot;
                        </span>
                      </div>
                    )}
                    {event.details.currentSearchFocus && (
                      <div className="flex space-x-1">
                        <span className="font-bold whitespace-nowrap">
                          Search Focus:
                        </span>
                        <span className="italic">
                          &quot;{event.details.currentSearchFocus}&quot;
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentActionDisplay;
