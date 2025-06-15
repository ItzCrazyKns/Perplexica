'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Bot } from 'lucide-react';
import { AgentActionEvent } from './ChatWindow';

interface AgentActionDisplayProps {
  events: AgentActionEvent[];
  messageId: string;
}

const AgentActionDisplay = ({ events, messageId }: AgentActionDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get the most recent event for collapsed view
  const latestEvent = events[events.length - 1];

  // Common function to format action names
  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ').toLocaleLowerCase();
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
          <Bot size={20} className="text-[#9C27B0]" />
          <span className="font-medium text-base text-black/70 dark:text-white/70 tracking-wide capitalize">
            {latestEvent.action === 'SYNTHESIZING_RESPONSE' ? 'Agent Log' : formatActionName(latestEvent.action)}
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
                  <Bot size={16} className="text-[#9C27B0]" />
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
                        <span className="font-bold">Source:</span>
                        <span className="truncate"><a href={event.details.sourceUrl} target='_blank'>{event.details.sourceUrl}</a></span>
                      </div>
                    )}
                    {event.details.skipReason && (
                      <div className="flex space-x-1">
                        <span className="font-bold">Reason:</span>
                        <span>{event.details.skipReason}</span>
                      </div>
                    )}
                    {event.details.searchQuery && event.details.searchQuery !== event.details.query && (
                      <div className="flex space-x-1">
                        <span className="font-bold">Search Query:</span>
                        <span className="italic">&quot;{event.details.searchQuery}&quot;</span>
                      </div>
                    )}
                    {event.details.sourcesFound !== undefined && (
                      <div className="flex space-x-1">
                        <span className="font-bold">Sources Found:</span>
                        <span>{event.details.sourcesFound}</span>
                      </div>
                    )}
                    {/* {(event.details.documentCount !== undefined && event.details.documentCount > 0) && (
                      <div className="flex space-x-1">
                        <span className="font-bold">Documents:</span>
                        <span>{event.details.documentCount}</span>
                      </div>
                    )} */}
                    {event.details.contentLength !== undefined && (
                      <div className="flex space-x-1">
                        <span className="font-bold">Content Length:</span>
                        <span>{event.details.contentLength} chars</span>
                      </div>
                    )}
                    {event.details.searchInstructions !== undefined && (
                      <div className="flex space-x-1">
                        <span className="font-bold">Search Instructions:</span>
                        <span>{event.details.searchInstructions}</span>
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
