/* eslint-disable @next/next/no-img-element */
'use client';

import { cn } from '@/lib/utils';
import {
  CheckCheck,
  Copy as CopyIcon,
  Search,
  FileText,
  Globe,
  Settings,
  Image as ImageIcon,
  BotIcon,
  TvIcon,
} from 'lucide-react';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import ThinkBox from './ThinkBox';
import { Document } from '@langchain/core/documents';
import CitationLink from './CitationLink';
import { decodeHtmlEntities } from '@/lib/utils/html';

// Helper functions for think overlay
const extractThinkContent = (content: string): string | null => {
  const thinkRegex = /<think[^>]*>([\s\S]*?)<\/think>/g;
  const matches = content.match(thinkRegex);
  if (!matches) return null;

  // Extract content between think tags and join if multiple
  const extractedContent = matches
    .map((match) => match.replace(/<\/?think[^>]*>/g, ''))
    .join('\n\n');

  // Return null if content is empty or only whitespace
  return extractedContent.trim().length === 0 ? null : extractedContent;
};

const removeThinkTags = (content: string): string => {
  return content.replace(/<think[^>]*>[\s\S]*?<\/think>/g, '').trim();
};

// Add stable IDs to think tags if they don't already have them
const addThinkBoxIds = (content: string): string => {
  let thinkCounter = 0;
  return content.replace(/<think(?![^>]*\sid=)/g, () => {
    return `<think id="think-${thinkCounter++}"`;
  });
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showThinking?: boolean;
  messageId?: string;
  expandedThinkBoxes?: Set<string>;
  onThinkBoxToggle?: (
    messageId: string,
    thinkBoxId: string,
    expanded: boolean,
  ) => void;
  sources?: Document[];
}

// Custom ToolCall component for markdown
const ToolCall = ({
  type,
  query,
  urls,
  url,
  videoId,
  count,
  children,
}: {
  type?: string;
  query?: string;
  urls?: string;
  url?: string;
  videoId?: string;
  count?: string;
  children?: React.ReactNode;
}) => {
  const getIcon = (toolType: string) => {
    switch (toolType) {
      case 'search':
      case 'web_search':
        return <Search size={16} className="text-accent" />;
      case 'file':
      case 'file_search':
        return <FileText size={16} className="text-green-600" />;
      case 'url':
      case 'url_summarization':
        return <Globe size={16} className="text-purple-600" />;
      case 'image':
      case 'image_search':
        return <ImageIcon size={16} className="text-blue-600" />;
      case 'firefoxAI':
        return <BotIcon size={16} className="text-indigo-600" />;
      case 'youtube_transcript':
        return <TvIcon size={16} className="text-red-600" />;
      case 'pdf_loader':
        return <FileText size={16} className="text-red-600" />;
      default:
        return <Settings size={16} className="text-fg/70" />;
    }
  };

  const formatToolMessage = () => {
    if (type === 'search' || type === 'web_search') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>Web search:</span>
          <span className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm">
            {decodeHtmlEntities(query || (children as string))}
          </span>
        </>
      );
    }

    if (type === 'file' || type === 'file_search') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>File search:</span>
          <span className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm">
            {decodeHtmlEntities(query || (children as string))}
          </span>
        </>
      );
    }

    if (type === 'url' || type === 'url_summarization') {
      const urlCount = count ? parseInt(count) : 1;
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>
            Analyzing {urlCount} web page{urlCount === 1 ? '' : 's'} for
            additional details
          </span>
        </>
      );
    }

    if (type === 'pdf_loader' && url) {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>Loading PDF document:</span>
          <a target='_blank' href={decodeHtmlEntities(url)} className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm">
            {decodeHtmlEntities(url)}
          </a>
        </>
      );
    }

    if (type === 'image' || type === 'image_search') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>Image search:</span>
          <span className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm">
            {decodeHtmlEntities(query || (children as string))}
          </span>
        </>
      );
    }

    if (type === 'firefoxAI') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>Firefox AI detected, tools disabled</span>
        </>
      );
    }

    if (type === 'youtube_transcript' && videoId) {
      console.log('Rendering YouTube transcript tool with video ID:', videoId);
      return (
        <div className="w-full">
          <div className="flex items-center mb-2">
            <span className="mr-2">{getIcon(type)}</span>
            <span>Retrieved YouTube Transcript</span>
          </div>
          <div className="mt-2 rounded">
            <div className="w-full">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                className="w-full aspect-video rounded-2xl"
                allowFullScreen
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </div>
        </div>
      );
    }

    // Fallback for unknown tool types
    return (
      <>
        <span className="mr-2">{getIcon(type || 'default')}</span>
        <span>Using tool:</span>
        <span className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm border border-surface-2">
          {type || 'unknown'}
        </span>
      </>
    );
  };

  return (
    <div className="my-3 px-4 py-3 bg-surface border border-surface-2 rounded-lg">
      <div className="flex items-center text-sm font-medium">
        {formatToolMessage()}
      </div>
    </div>
  );
};

const ThinkTagProcessor = ({
  children,
  id,
  isExpanded,
  onToggle,
}: {
  children: React.ReactNode;
  id?: string;
  isExpanded?: boolean;
  onToggle?: (thinkBoxId: string, expanded: boolean) => void;
}) => {
  return (
    <ThinkBox
      content={children}
      expanded={isExpanded}
      onToggle={() => {
        if (id && onToggle) {
          onToggle(id, !isExpanded);
        }
      }}
    />
  );
};
const CodeBlock = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  // Extract language from className (format could be "language-javascript" or "lang-javascript")
  let language = '';
  if (className) {
    if (className.startsWith('language-')) {
      language = className.replace('language-', '');
    } else if (className.startsWith('lang-')) {
      language = className.replace('lang-', '');
    }
  }

  const content = children as string;
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const root = document.documentElement;
  const isDark = root.classList.contains('dark');

  const syntaxStyle = isDark ? oneDark : oneLight;
  const backgroundStyle = isDark ? '#1c1c1c' : '#fafafa';

  return (
    <div className="rounded-md overflow-hidden my-4 relative group border border-surface-2">
      <div className="flex justify-between items-center px-4 py-2 bg-surface-2 border-b border-surface-2 text-xs text-fg/70 font-mono">
        <span>{language}</span>
        <button
          onClick={handleCopyCode}
          className="p-1 rounded-md hover:bg-surface transition duration-200"
          aria-label="Copy code to clipboard"
        >
          {isCopied ? (
            <CheckCheck size={14} className="text-green-500" />
          ) : (
            <CopyIcon size={14} className="text-fg" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={syntaxStyle}
        customStyle={{
          margin: 0,
          padding: '1rem',
          borderRadius: 0,
          backgroundColor: backgroundStyle,
        }}
        wrapLines
        wrapLongLines
        showLineNumbers={language !== '' && content.split('\n').length > 1}
        useInlineStyles
        PreTag="div"
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownRenderer = ({
  content,
  className,
  showThinking = true,
  messageId,
  expandedThinkBoxes,
  onThinkBoxToggle,
  sources,
}: MarkdownRendererProps) => {
  // Preprocess content to add stable IDs to think tags
  const processedContent = addThinkBoxIds(content);

  // Check if a think box is expanded
  const isThinkBoxExpanded = (thinkBoxId: string) => {
    return expandedThinkBoxes?.has(thinkBoxId) || false;
  };

  // Handle think box toggle
  const handleThinkBoxToggle = (thinkBoxId: string, expanded: boolean) => {
    if (messageId && onThinkBoxToggle) {
      onThinkBoxToggle(messageId, thinkBoxId, expanded);
    }
  };

  // Determine what content to render based on showThinking parameter
  const contentToRender = showThinking
    ? processedContent
    : removeThinkTags(processedContent);
  // Markdown formatting options
  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      ToolCall: {
        component: ToolCall,
      },
      think: {
        component: ({ children, id, ...props }) => {
          // Use the id from the HTML attribute
          const thinkBoxId = id || 'think-unknown';
          const isExpanded = isThinkBoxExpanded(thinkBoxId);

          return (
            <ThinkTagProcessor
              id={thinkBoxId}
              isExpanded={isExpanded}
              onToggle={handleThinkBoxToggle}
            >
              {children}
            </ThinkTagProcessor>
          );
        },
      },
      code: {
        component: ({ className, children }) => {
          // Check if it's an inline code block or a fenced code block
          if (className) {
            // This is a fenced code block (```code```)
            return <CodeBlock className={className}>{children}</CodeBlock>;
          }
          // This is an inline code block (`code`)
          return (
            <code className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-sm">
              {children}
            </code>
          );
        },
      },
      strong: {
        component: ({ children }) => (
          <strong className="font-bold">{children}</strong>
        ),
      },
      pre: {
        component: ({ children }) => children,
      },
      a: {
        component: (props) => {
          // Check if this is a citation link with data-citation attribute
          const citationNumber = props['data-citation'];

          if (sources && citationNumber) {
            const number = parseInt(citationNumber);
            const source = sources[number - 1];

            if (source) {
              return (
                <CitationLink
                  number={number.toString()}
                  source={source}
                  url={props.href}
                />
              );
            }
          }

          // Default link behavior
          return <a {...props} target="_blank" rel="noopener noreferrer" />;
        },
      },
      // Prevent rendering of certain HTML elements for security
      iframe: () => null, // Don't render iframes
      script: () => null, // Don't render scripts
      object: () => null, // Don't render objects
      style: () => null, // Don't render styles
    },
  };

  return (
    contentToRender &&
    contentToRender.length > 0 && (
      <div className="relative">
        <Markdown
          className={cn(
            'prose prose-theme dark:prose-invert prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] prose-p:leading-relaxed prose-pre:p-0 font-[400]',
            'prose-code:bg-transparent prose-code:p-0 prose-code:text-inherit prose-code:font-normal prose-code:before:content-none prose-code:after:content-none',
            'prose-pre:bg-transparent prose-pre:border-0 prose-pre:m-0 prose-pre:p-0',
            'prose-strong:font-bold',
            'break-words max-w-full',
            className,
          )}
          options={markdownOverrides}
        >
          {contentToRender}
        </Markdown>
      </div>
    )
  );
};

export default MarkdownRenderer;
