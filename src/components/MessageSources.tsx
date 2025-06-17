/* eslint-disable @next/next/no-img-element */
import { Document } from '@langchain/core/documents';
import { File, Zap, Microscope } from 'lucide-react';

const MessageSources = ({ sources }: { sources: Document[] }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {sources.map((source, i) => (
        <a
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
          key={i}
          href={source.metadata.url}
          target="_blank"
        >
          <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
            {source.metadata.title}
          </p>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center space-x-1">
              {source.metadata.url === 'File' ? (
                <div className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
                  <File size={12} className="text-white/70" />
                </div>
              ) : (
                <img
                  src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
                  width={16}
                  height={16}
                  alt="favicon"
                  className="rounded-lg h-4 w-4"
                />
              )}
              <p className="text-xs text-black/50 dark:text-white/50 overflow-hidden whitespace-nowrap text-ellipsis">
                {source.metadata.url.replace(/.+\/\/|www.|\..+/g, '')}
              </p>
            </div>
            <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
              <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
              <span>{i + 1}</span>
              {/* Processing type indicator */}
              {source.metadata.processingType === 'preview-only' && (
                <span title="Partial content analyzed" className="inline-flex">
                  <Zap size={14} className="text-black/40 dark:text-white/40 ml-1" />
                </span>
              )}
              {source.metadata.processingType === 'full-content' && (
                <span title="Full content analyzed" className="inline-flex">
                  <Microscope size={14} className="text-black/40 dark:text-white/40 ml-1" />
                </span>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
};

export default MessageSources;
