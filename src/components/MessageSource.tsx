/* eslint-disable @next/next/no-img-element */
import { Document } from '@langchain/core/documents';
import { File, Zap, Microscope, FileText, Sparkles } from 'lucide-react';

interface MessageSourceProps {
  source: Document;
  index?: number;
  style?: React.CSSProperties;
  className?: string;
  oneLiner?: boolean;
}

const MessageSource = ({
  source,
  index,
  style,
  className,
  oneLiner = false,
}: MessageSourceProps) => {
  return oneLiner ? (
    <a
      className={`bg-surface hover:bg-surface-2 transition duration-200 rounded-lg p-2 flex flex-row no-underline items-center space-x-2 font-medium border border-surface-2 ${className || ''}`}
      href={source.metadata.url}
      target="_blank"
      style={style}
    >
      {source.metadata.url === 'File' ? (
        <div className="bg-surface-2 hover:bg-surface transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
          <File size={14} className="text-fg/70" />
        </div>
      ) : (
        <img
          src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
          width={20}
          height={20}
          alt="favicon"
          className="rounded-lg h-5 w-5"
        />
      )}
      <span className="text-xs text-fg/70 truncate">
        {source.metadata.title || source.metadata.url}
      </span>
    </a>
  ) : (
    <a
      className={`bg-surface hover:bg-surface-2 transition duration-200 rounded-lg p-4 flex flex-row no-underline space-x-3 font-medium border border-surface-2 ${className || ''}`}
      href={source.metadata.url}
      target="_blank"
      style={style}
    >
      {/* Left side: Favicon/Icon and source number */}
      <div className="flex flex-col items-center space-y-2 flex-shrink-0">
        {source.metadata.url === 'File' ? (
          <div className="bg-surface-2 hover:bg-surface transition duration-200 flex items-center justify-center w-8 h-8 rounded-full">
            <File size={16} className="text-fg/70" />
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
        <div className="flex flex-row items-center space-x-1 text-fg/50 text-xs">
          {typeof index === 'number' && (
            <span className="font-semibold">{index + 1}</span>
          )}
          {/* Processing type indicator */}
          {source.metadata.processingType === 'preview-only' && (
            <span title="Partial content analyzed" className="inline-flex">
              <Zap size={12} className="text-fg/40" />
            </span>
          )}
          {source.metadata.processingType === 'full-content' && (
            <span title="Full content analyzed" className="inline-flex">
              <Microscope size={12} className="text-fg/40" />
            </span>
          )}
          {source.metadata.processingType === 'url-direct-content' && (
            <span title="Direct URL content" className="inline-flex">
              <FileText size={12} className="text-fg/40" />
            </span>
          )}
          {source.metadata.processingType === 'url-content-extraction' && (
            <span title="Summarized URL content" className="inline-flex">
              <Sparkles size={12} className="text-fg/40" />
            </span>
          )}
        </div>
      </div>

      {/* Right side: Content */}
      <div className="flex-1 flex flex-col space-y-2">
        {/* Title */}
        <h3 className="text-fg text-sm font-semibold leading-tight">
          {source.metadata.title}
        </h3>

        {/* URL */}
        <p className="text-xs text-fg/50">
          {source.metadata.url.replace(/.+\/\/|www.|\..+/g, '')}
        </p>

        {/* Preview content */}
        <p
          className="text-xs text-fg/70 leading-relaxed overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {/* Use snippet for preview-only content, otherwise use pageContent */}
          {source.metadata.processingType === 'preview-only' &&
          source.metadata.snippet
            ? source.metadata.snippet
            : source.pageContent?.length > 250
              ? source.pageContent.slice(0, 250) + '...'
              : source.pageContent || 'No preview available'}
        </p>
      </div>
    </a>
  );
};

export default MessageSource;
