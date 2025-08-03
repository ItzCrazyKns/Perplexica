/* eslint-disable @next/next/no-img-element */
import { Document } from '@langchain/core/documents';
import { File, Zap, Microscope, FileText, Sparkles } from 'lucide-react';

const MessageSources = ({ sources }: { sources: Document[] }) => {
  return (
    <div className="flex flex-col space-y-3">
      {sources.map((source, i) => (
        <a
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-4 flex flex-row space-x-3 font-medium"
          key={i}
          href={source.metadata.url}
          target="_blank"
        >
          {/* Left side: Favicon/Icon and source number */}
          <div className="flex flex-col items-center space-y-2 flex-shrink-0">
            {source.metadata.url === 'File' ? (
              <div className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-8 h-8 rounded-full">
                <File size={16} className="text-white/70" />
              </div>
            ) : (
              <img
                src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
                width={28}
                height={28}
                alt="favicon"
                className="rounded-lg h-7 w-7"
              />
            )}
            <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
              <span className="font-semibold">{i + 1}</span>
              {/* Processing type indicator */}
              {source.metadata.processingType === 'preview-only' && (
                <span title="Partial content analyzed" className="inline-flex">
                  <Zap
                    size={12}
                    className="text-black/40 dark:text-white/40"
                  />
                </span>
              )}
              {source.metadata.processingType === 'full-content' && (
                <span title="Full content analyzed" className="inline-flex">
                  <Microscope
                    size={12}
                    className="text-black/40 dark:text-white/40"
                  />
                </span>
              )}
              {source.metadata.processingType === 'url-direct-content' && (
                <span title="Direct URL content" className="inline-flex">
                  <FileText
                    size={12}
                    className="text-black/40 dark:text-white/40"
                  />
                </span>
              )}
              {source.metadata.processingType === 'url-content-extraction' && (
                <span title="Summarized URL content" className="inline-flex">
                  <Sparkles
                    size={12}
                    className="text-black/40 dark:text-white/40"
                  />
                </span>
              )}
            </div>
          </div>

          {/* Right side: Content */}
          <div className="flex-1 flex flex-col space-y-2">
            {/* Title */}
            <h3 className="dark:text-white text-sm font-semibold leading-tight">
              {source.metadata.title}
            </h3>
            
            {/* URL */}
            <p className="text-xs text-black/50 dark:text-white/50">
              {source.metadata.url.replace(/.+\/\/|www.|\..+/g, '')}
            </p>

            {/* Preview content */}
            <p className="text-xs text-black/70 dark:text-white/70 leading-relaxed overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {/* Use snippet for preview-only content, otherwise use pageContent */}
              {source.metadata.processingType === 'preview-only' && source.metadata.snippet
                ? source.metadata.snippet
                : source.pageContent?.length > 250 
                  ? source.pageContent.slice(0, 250) + '...'
                  : source.pageContent || 'No preview available'
              }
            </p>
          </div>
        </a>
      ))}
    </div>
  );
};

export default MessageSources;
