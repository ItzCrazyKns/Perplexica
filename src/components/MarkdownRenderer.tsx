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
} from 'lucide-react';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTheme } from 'next-themes';
import ThinkBox from './ThinkBox';
import { Document } from '@langchain/core/documents';
import CitationLink from './CitationLink';

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
  count,
  children,
}: {
  type?: string;
  query?: string;
  urls?: string;
  count?: string;
  children?: React.ReactNode;
}) => {
  const getIcon = (toolType: string) => {
    switch (toolType) {
      case 'search':
      case 'web_search':
        return (
          <Search size={16} className="text-blue-600 dark:text-blue-400" />
        );
      case 'file':
      case 'file_search':
        return (
          <FileText size={16} className="text-green-600 dark:text-green-400" />
        );
      case 'url':
      case 'url_summarization':
        return (
          <Globe size={16} className="text-purple-600 dark:text-purple-400" />
        );
      default:
        return (
          <Settings size={16} className="text-gray-600 dark:text-gray-400" />
        );
    }
  };

  const formatToolMessage = () => {
    if (type === 'search' || type === 'web_search') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span className="text-black/60 dark:text-white/60">Web search:</span>
          <span className="ml-2 px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded font-mono text-sm">
            {query || children}
          </span>
        </>
      );
    }

    if (type === 'file' || type === 'file_search') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span className="text-black/60 dark:text-white/60">File search:</span>
          <span className="ml-2 px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded font-mono text-sm">
            {query || children}
          </span>
        </>
      );
    }

    if (type === 'url' || type === 'url_summarization') {
      const urlCount = count ? parseInt(count) : 1;
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span className="text-black/60 dark:text-white/60">
            Analyzing {urlCount} web page{urlCount === 1 ? '' : 's'} for
            additional details
          </span>
        </>
      );
    }

    // Fallback for unknown tool types
    return (
      <>
        <span className="mr-2">{getIcon(type || 'default')}</span>
        <span className="text-black/60 dark:text-white/60">Using tool:</span>
        <span className="ml-2 px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded font-mono text-sm border">
          {type || 'unknown'}
        </span>
      </>
    );
  };

  return (
    <div className="my-3 px-4 py-3 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200/30 dark:border-blue-700/30 rounded-lg">
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
  const { theme } = useTheme();

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

  // Choose syntax highlighting style based on theme
  const syntaxStyle = theme === 'light' ? oneLight : oneDark;
  const backgroundStyle = theme === 'light' ? '#fafafa' : '#1c1c1c';

  return (
    <div className="rounded-md overflow-hidden my-4 relative group border border-light-200 dark:border-dark-secondary">
      <div className="flex justify-between items-center px-4 py-2 bg-light-100 dark:bg-dark-200 border-b border-light-200 dark:border-dark-secondary text-xs text-black/70 dark:text-white/70 font-mono">
        <span>{language}</span>
        <button
          onClick={handleCopyCode}
          className="p-1 rounded-md hover:bg-light-200 dark:hover:bg-dark-secondary transition duration-200"
          aria-label="Copy code to clipboard"
        >
          {isCopied ? (
            <CheckCheck size={14} className="text-green-500" />
          ) : (
            <CopyIcon size={14} className="text-black/70 dark:text-white/70" />
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
        wrapLines={true}
        wrapLongLines={true}
        showLineNumbers={language !== '' && content.split('\n').length > 1}
        useInlineStyles={true}
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
            <code className="px-1.5 py-0.5 rounded bg-light-200 dark:bg-dark-secondary text-black dark:text-white font-mono text-sm">
              {children}
            </code>
          );
        },
      },
      strong: {
        component: ({ children }) => (
          <strong className="font-bold text-black dark:text-white">
            {children}
          </strong>
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
    <div className="relative">
      <Markdown
        className={cn(
          'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
          'prose-code:bg-transparent prose-code:p-0 prose-code:text-inherit prose-code:font-normal prose-code:before:content-none prose-code:after:content-none',
          'prose-pre:bg-transparent prose-pre:border-0 prose-pre:m-0 prose-pre:p-0',
          'prose-strong:text-black dark:prose-strong:text-white prose-strong:font-bold',
          'break-words text-black dark:text-white max-w-full',
          className,
        )}
        options={markdownOverrides}
      >
        {contentToRender}
      </Markdown>
    </div>
  );
};

export default MarkdownRenderer;
