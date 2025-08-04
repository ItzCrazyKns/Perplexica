import { Document } from '@langchain/core/documents';
import { useState } from 'react';
import MessageSource from './MessageSource';

interface CitationLinkProps {
  number: string;
  source?: Document;
  url?: string;
}

const CitationLink = ({ number, source, url }: CitationLinkProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const linkContent = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 relative hover:bg-light-200 dark:hover:bg-dark-200 transition-colors duration-200"
    >
      {number}
    </a>
  );

  // If we have source data, wrap with tooltip
  if (source) {
    return (
      <div className="relative inline-block">
        <div
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {linkContent}
        </div>

        {showTooltip && (
          <div className="absolute z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 animate-in fade-in-0 duration-150">
            <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 shadow-lg w-96">
              <MessageSource
                source={source}
                className="shadow-none border-none bg-transparent hover:bg-transparent dark:hover:bg-transparent cursor-pointer"
              />
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-light-200 dark:border-t-dark-200"></div>
          </div>
        )}
      </div>
    );
  }

  // Otherwise, just return the plain link
  return linkContent;
};

export default CitationLink;
