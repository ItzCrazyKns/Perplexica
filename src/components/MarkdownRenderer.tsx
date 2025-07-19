/* eslint-disable @next/next/no-img-element */
'use client';

import { cn } from '@/lib/utils';
import { CheckCheck, Copy as CopyIcon, Brain } from 'lucide-react';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTheme } from 'next-themes';
import ThinkBox from './ThinkBox';

// Helper functions for think overlay
const extractThinkContent = (content: string): string | null => {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const matches = content.match(thinkRegex);
  if (!matches) return null;

  // Extract content between think tags and join if multiple
  const extractedContent = matches
    .map((match) => match.replace(/<\/?think>/g, ''))
    .join('\n\n');

  // Return null if content is empty or only whitespace
  return extractedContent.trim().length === 0 ? null : extractedContent;
};

const removeThinkTags = (content: string): string => {
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
};

const ThinkTagProcessor = ({
  children,
  isOverlayMode = false,
}: {
  children: React.ReactNode;
  isOverlayMode?: boolean;
}) => {
  // In overlay mode, don't render anything (content will be handled by overlay)
  if (isOverlayMode) {
    return null;
  }
  return <ThinkBox content={children} />;
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

interface MarkdownRendererProps {
  content: string;
  className?: string;
  thinkOverlay?: boolean;
}

const MarkdownRenderer = ({
  content,
  className,
  thinkOverlay = false,
}: MarkdownRendererProps) => {
  const [showThinkBox, setShowThinkBox] = useState(false);

  // Extract think content from the markdown
  const thinkContent = thinkOverlay ? extractThinkContent(content) : null;
  const contentWithoutThink = thinkOverlay ? removeThinkTags(content) : content;
  // Markdown formatting options
  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      think: {
        component: ({ children }) => (
          <ThinkTagProcessor isOverlayMode={thinkOverlay}>
            {children}
          </ThinkTagProcessor>
        ),
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
        component: (props) => (
          <a {...props} target='_blank' rel='noopener noreferrer' />
        ),
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
      {/* Think box when expanded - shows above markdown */}
      {thinkOverlay && thinkContent && showThinkBox && (
        <div className="mb-4">
          <ThinkBox
            content={thinkContent}
            expanded={true}
            onToggle={() => setShowThinkBox(false)}
          />
        </div>
      )}

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
        {thinkOverlay ? contentWithoutThink : content}
      </Markdown>

      {/* Overlay icon when think box is collapsed */}
      {thinkOverlay && thinkContent && !showThinkBox && (
        <button
          onClick={() => setShowThinkBox(true)}
          className="absolute top-2 right-2 p-2 rounded-lg bg-black/20 dark:bg-white/20 backdrop-blur-sm opacity-30 hover:opacity-100 transition-opacity duration-200 group"
          title="Show thinking process"
        >
          <Brain
            size={16}
            className="text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
          />
        </button>
      )}
    </div>
  );
};

export default MarkdownRenderer;
