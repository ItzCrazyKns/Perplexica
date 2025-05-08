'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject, useEffect, useState } from 'react';
import { Message } from './ChatWindow';
import { cn } from '@/lib/utils';
import { getSuggestions } from '@/lib/actions';
import {
  BookCopy,
  Disc3,
  Volume2,
  StopCircle,
  Layers3,
  Plus,
  Sparkles,
  Copy as CopyIcon,
  CheckCheck,
} from 'lucide-react';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import ModelInfoButton from './MessageActions/ModelInfo';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import SearchVideos from './SearchVideos';
import { useSpeech } from 'react-text-to-speech';
import ThinkBox from './ThinkBox';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const ThinkTagProcessor = ({ children }: { children: React.ReactNode }) => {
  return <ThinkBox content={children as string} />;
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

  console.log('Code block language:', language, 'Class name:', className); // For debugging

  return (
    <div className="rounded-md overflow-hidden my-4 relative group border border-dark-secondary">
      <div className="flex justify-between items-center px-4 py-2 bg-dark-200 border-b border-dark-secondary text-xs text-white/70 font-mono">
        <span>{language}</span>
        <button
          onClick={handleCopyCode}
          className="p-1 rounded-md hover:bg-dark-secondary transition duration-200"
          aria-label="Copy code to clipboard"
        >
          {isCopied ? (
            <CheckCheck size={14} className="text-green-500" />
          ) : (
            <CopyIcon size={14} className="text-white/70" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          borderRadius: 0,
          backgroundColor: '#1c1c1c',
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

const MessageBox = ({
  message,
  messageIndex,
  history,
  loading,
  dividerRef,
  isLast,
  rewrite,
  sendMessage,
}: {
  message: Message;
  messageIndex: number;
  history: Message[];
  loading: boolean;
  dividerRef?: MutableRefObject<HTMLDivElement | null>;
  isLast: boolean;
  rewrite: (messageId: string) => void;
  sendMessage: (
    message: string,
    options?: {
      messageId?: string;
      rewriteIndex?: number;
      suggestions?: string[];
    },
  ) => void;
}) => {
  const [parsedMessage, setParsedMessage] = useState(message.content);
  const [speechMessage, setSpeechMessage] = useState(message.content);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [autoSuggestions, setAutoSuggestions] = useState(
    localStorage.getItem('autoSuggestions'),
  );

  const handleLoadSuggestions = async () => {
    if (
      loadingSuggestions ||
      (message?.suggestions && message.suggestions.length > 0)
    )
      return;

    setLoadingSuggestions(true);
    try {
      const suggestions = await getSuggestions([...history]);
      // We need to update the message.suggestions property through parent component
      sendMessage('', { messageId: message.messageId, suggestions });
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    const citationRegex = /\[([^\]]+)\]/g;
    const regex = /\[(\d+)\]/g;
    let processedMessage = message.content;

    if (message.role === 'assistant' && message.content.includes('<think>')) {
      const openThinkTag = processedMessage.match(/<think>/g)?.length || 0;
      const closeThinkTag = processedMessage.match(/<\/think>/g)?.length || 0;

      if (openThinkTag > closeThinkTag) {
        processedMessage += '</think> <a> </a>'; // The extra <a> </a> is to prevent the the think component from looking bad
      }
    }

    if (
      message.role === 'assistant' &&
      message?.sources &&
      message.sources.length > 0
    ) {
      setParsedMessage(
        processedMessage.replace(
          citationRegex,
          (_, capturedContent: string) => {
            const numbers = capturedContent
              .split(',')
              .map((numStr) => numStr.trim());

            const linksHtml = numbers
              .map((numStr) => {
                const number = parseInt(numStr);

                if (isNaN(number) || number <= 0) {
                  return `[${numStr}]`;
                }

                const source = message.sources?.[number - 1];
                const url = source?.metadata?.url;

                if (url) {
                  return `<a href="${url}" target="_blank" className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 relative">${numStr}</a>`;
                } else {
                  return `[${numStr}]`;
                }
              })
              .join('');

            return linksHtml;
          },
        ),
      );
      setSpeechMessage(message.content.replace(regex, ''));
      return;
    }

    setSpeechMessage(message.content.replace(regex, ''));
    setParsedMessage(processedMessage);
  }, [message.content, message.sources, message.role]);

  useEffect(() => {
    const handleStorageChange = () => {
      setAutoSuggestions(localStorage.getItem('autoSuggestions'));
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });

  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      think: {
        component: ThinkTagProcessor,
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
            <code className="px-1.5 py-0.5 rounded bg-dark-secondary text-white font-mono text-sm">
              {children}
            </code>
          );
        },
      },
      pre: {
        component: ({ children }) => children,
      },
    },
  };

  return (
    <div>
      {message.role === 'user' && (
        <div
          className={cn(
            'w-full',
            messageIndex === 0 ? 'pt-16' : 'pt-8',
            'break-words',
          )}
        >
          <h2 className="text-black dark:text-white font-medium text-3xl lg:w-9/12">
            {message.content}
          </h2>
        </div>
      )}

      {message.role === 'assistant' && (
        <div className="flex flex-col space-y-9 lg:space-y-0 lg:flex-row lg:justify-between lg:space-x-9">
          <div
            ref={dividerRef}
            className="flex flex-col space-y-6 w-full lg:w-9/12"
          >
            {message.sources && message.sources.length > 0 && (
              <div className="flex flex-col space-y-2">
                <div className="flex flex-row items-center space-x-2">
                  <BookCopy className="text-black dark:text-white" size={20} />
                  <h3 className="text-black dark:text-white font-medium text-xl">
                    Sources
                  </h3>
                </div>
                {message.searchQuery && (
                  <div className="mb-2 text-sm bg-light-secondary dark:bg-dark-secondary rounded-lg p-3">
                    <span className="font-medium text-black/70 dark:text-white/70">
                      Search query:
                    </span>{' '}
                    <span className="text-black dark:text-white">
                      {message.searchQuery}
                    </span>
                  </div>
                )}
                <MessageSources sources={message.sources} />
              </div>
            )}
            <div className="flex flex-col space-y-2">
              {' '}
              <div className="flex flex-row items-center space-x-2">
                <Disc3
                  className={cn(
                    'text-black dark:text-white',
                    isLast && loading ? 'animate-spin' : 'animate-none',
                  )}
                  size={20}
                />
                <h3 className="text-black dark:text-white font-medium text-xl">
                  Answer
                </h3>
                {message.modelStats && (
                  <ModelInfoButton modelStats={message.modelStats} />
                )}
              </div>
              <Markdown
                className={cn(
                  'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                  'prose-code:bg-transparent prose-code:p-0 prose-code:text-inherit prose-code:font-normal prose-code:before:content-none prose-code:after:content-none',
                  'prose-pre:bg-transparent prose-pre:border-0 prose-pre:m-0 prose-pre:p-0',
                  'max-w-none break-words text-white',
                )}
                options={markdownOverrides}
              >
                {parsedMessage}
              </Markdown>
              {loading && isLast ? null : (
                <div className="flex flex-row items-center justify-between w-full text-black dark:text-white py-4 -mx-2">
                  <div className="flex flex-row items-center space-x-1">
                    {/*  <button className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black text-black dark:hover:text-white">
                      <Share size={18} />
                    </button> */}
                    <Rewrite rewrite={rewrite} messageId={message.messageId} />
                  </div>
                  <div className="flex flex-row items-center space-x-1">
                    <Copy initialMessage={message.content} message={message} />
                    <button
                      onClick={() => {
                        if (speechStatus === 'started') {
                          stop();
                        } else {
                          start();
                        }
                      }}
                      className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
                    >
                      {speechStatus === 'started' ? (
                        <StopCircle size={18} />
                      ) : (
                        <Volume2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              )}
              {isLast && message.role === 'assistant' && !loading && (
                <>
                  <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
                  <div className="flex flex-col space-y-3 text-black dark:text-white">
                    <div className="flex flex-row items-center space-x-2 mt-4">
                      <Layers3 />
                      <h3 className="text-xl font-medium">Related</h3>{' '}
                      {(!autoSuggestions || autoSuggestions === 'false') &&
                      (!message.suggestions ||
                        message.suggestions.length === 0) ? (
                        <div className="bg-light-secondary dark:bg-dark-secondary">
                          <button
                            onClick={handleLoadSuggestions}
                            disabled={loadingSuggestions}
                            className="px-4 py-2 flex flex-row items-center justify-center space-x-2 rounded-lg bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
                          >
                            {loadingSuggestions ? (
                              <div className="w-4 h-4 border-2 border-t-transparent border-gray-400 dark:border-gray-500 rounded-full animate-spin" />
                            ) : (
                              <Sparkles size={16} />
                            )}
                            <span>
                              {loadingSuggestions
                                ? 'Loading suggestions...'
                                : 'Load suggestions'}
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {message.suggestions && message.suggestions.length > 0 ? (
                      <div className="flex flex-col space-y-3">
                        {message.suggestions.map((suggestion, i) => (
                          <div
                            className="flex flex-col space-y-3 text-sm"
                            key={i}
                          >
                            <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
                            <div
                              onClick={() => {
                                sendMessage(suggestion);
                              }}
                              className="cursor-pointer flex flex-row justify-between font-medium space-x-2 items-center"
                            >
                              <p className="transition duration-200 hover:text-[#24A0ED]">
                                {suggestion}
                              </p>
                              <Plus
                                size={20}
                                className="text-[#24A0ED] flex-shrink-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="lg:sticky lg:top-20 flex flex-col items-center space-y-3 w-full lg:w-3/12 z-30 h-full pb-4">
            <SearchImages
              query={history[messageIndex - 1].content}
              chatHistory={history.slice(0, messageIndex - 1)}
              messageId={message.messageId}
            />
            <SearchVideos
              chatHistory={history.slice(0, messageIndex - 1)}
              query={history[messageIndex - 1].content}
              messageId={message.messageId}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBox;
