/* eslint-disable @next/next/no-img-element */
'use client';

import { getSuggestions } from '@/lib/actions';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  ImagesIcon,
  Layers3,
  Plus,
  Sparkles,
  StopCircle,
  VideoIcon,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSpeech } from 'react-text-to-speech';
import { Message } from './ChatWindow';
import MarkdownRenderer from './MarkdownRenderer';
import Copy from './MessageActions/Copy';
import ModelInfoButton from './MessageActions/ModelInfo';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import SearchVideos from './SearchVideos';
import MessageBoxLoading from './MessageBoxLoading';
import { Document } from '@langchain/core/documents';

type TabType = 'text' | 'sources' | 'images' | 'videos';

interface SearchTabsProps {
  chatHistory: Message[];
  query: string;
  messageId: string;
  message: Message;
  isLast: boolean;
  loading: boolean;
  rewrite: (messageId: string) => void;
  sendMessage: (
    message: string,
    options?: {
      messageId?: string;
      rewriteIndex?: number;
      suggestions?: string[];
    },
  ) => void;
  onThinkBoxToggle: (
    messageId: string,
    thinkBoxId: string,
    expanded: boolean,
  ) => void;
  analysisProgress?: {
    message: string;
    current: number;
    total: number;
    subMessage?: string;
  } | null;
  modelStats?: {
    usage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
    usageChat?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
    usageSystem?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
  } | null;
  gatheringSources?: Array<{
    searchQuery: string;
    sources: Document[];
  }>;
  actionMessageId?: string;
}

const MessageTabs = ({
  chatHistory,
  query,
  messageId,
  message,
  isLast,
  loading,
  rewrite,
  sendMessage,
  onThinkBoxToggle,
  analysisProgress,
  modelStats,
  gatheringSources,
  actionMessageId,
}: SearchTabsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [imageCount, setImageCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [parsedMessage, setParsedMessage] = useState(message.content);
  const [speechMessage, setSpeechMessage] = useState(message.content);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });

  // Callback functions to update counts
  const updateImageCount = (count: number) => {
    setImageCount(count);
  };

  const updateVideoCount = (count: number) => {
    setVideoCount(count);
  };

  // Load suggestions handling
  const handleLoadSuggestions = useCallback(async () => {
    if (
      loadingSuggestions ||
      (message?.suggestions && message.suggestions.length > 0)
    )
      return;

    setLoadingSuggestions(true);
    try {
      const suggestions = await getSuggestions([...chatHistory, message]);
      // Update the message.suggestions property through parent component
      sendMessage('', { messageId: message.messageId, suggestions });
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [loadingSuggestions, message, chatHistory, sendMessage]);

  // Process message content
  useEffect(() => {
    const regex = /\[(\d+)\]/g;
    let processedMessage = message.content;

    if (message.role === 'assistant' && message.content.includes('<think>')) {
      const openThinkTag = processedMessage.match(/<think>/g)?.length || 0;
      const closeThinkTag = processedMessage.match(/<\/think>/g)?.length || 0;

      if (openThinkTag > closeThinkTag) {
        processedMessage += '</think> <a> </a>'; // The extra <a> </a> is to prevent the think component from looking bad
      }
    }

    if (
      message.role === 'assistant' &&
      message?.sources &&
      message.sources.length > 0
    ) {
      setParsedMessage(
        processedMessage.replace(regex, (_, capturedContent: string) => {
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
                return `<a href="${url}" target="_blank" data-citation="${number}" className="bg-surface px-1 rounded ml-1 no-underline text-xs relative hover:bg-surface-2 transition-colors duration-200">${numStr}</a>`;
              } else {
                return `[${numStr}]`;
              }
            })
            .join('');

          return linksHtml;
        }),
      );
      setSpeechMessage(message.content.replace(regex, ''));
      return;
    }

    setSpeechMessage(message.content.replace(regex, ''));
    setParsedMessage(processedMessage);
  }, [message.content, message.sources, message.role]);

  // Auto-suggest effect (similar to MessageBox)
  useEffect(() => {
    const autoSuggestions = localStorage.getItem('autoSuggestions');
    if (
      isLast &&
      message.role === 'assistant' &&
      !loading &&
      autoSuggestions === 'true'
    ) {
      handleLoadSuggestions();
    }
  }, [isLast, loading, message.role, handleLoadSuggestions]);

  return (
    <div className="flex flex-col w-full">
      {/* Tabs */}
      <div className="flex border-b border-accent overflow-x-auto no-scrollbar sticky top-0 z-10 -mx-4 px-4 mb-2">
        <button
          onClick={() => setActiveTab('text')}
          className={cn(
            'flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 relative',
            activeTab === 'text'
              ? 'border-b-2 border-accent text-accent bg-surface-2'
              : 'hover:bg-surface-2',
          )}
          aria-selected={activeTab === 'text'}
          role="tab"
        >
          <Disc3 size={16} className="mr-2" />
          <span className="whitespace-nowrap">Answer</span>
        </button>

        {message.sources && message.sources.length > 0 && (
          <button
            onClick={() => setActiveTab('sources')}
            className={cn(
              'flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-all duration-200 relative',
              activeTab === 'sources'
                ? 'border-b-2 border-accent text-accent bg-surface-2'
                : 'hover:bg-surface-2',
            )}
            aria-selected={activeTab === 'sources'}
            role="tab"
          >
            <BookCopy size={16} />
            <span className="whitespace-nowrap">Sources</span>
            <span
              className={cn(
                'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                activeTab === 'sources'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-2 text-fg/70',
              )}
            >
              {message.sources.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('images')}
          className={cn(
            'flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-all duration-200 relative',
            activeTab === 'images'
              ? 'border-b-2 border-accent text-accent bg-surface-2'
              : 'hover:bg-surface-2',
          )}
          aria-selected={activeTab === 'images'}
          role="tab"
        >
          <ImagesIcon size={16} />
          <span className="whitespace-nowrap">Images</span>
          {imageCount > 0 && (
            <span
              className={cn(
                'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                activeTab === 'images'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-2 text-fg/70',
              )}
            >
              {imageCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('videos')}
          className={cn(
            'flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-all duration-200 relative',
            activeTab === 'videos'
              ? 'border-b-2 border-accent text-accent bg-surface-2'
              : 'hover:bg-surface-2',
          )}
          aria-selected={activeTab === 'videos'}
          role="tab"
        >
          <VideoIcon size={16} />
          <span className="whitespace-nowrap">Videos</span>
          {videoCount > 0 && (
            <span
              className={cn(
                'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                activeTab === 'videos'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-2 text-fg/70',
              )}
            >
              {videoCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="transition-all duration-200 ease-in-out" role="tabpanel">
        {/* Answer Tab */}
        {activeTab === 'text' && (
          <div className="flex flex-col space-y-4 animate-fadeIn">
            {loading && isLast && (
              <MessageBoxLoading
                progress={analysisProgress || null}
                modelStats={modelStats}
                actionMessageId={actionMessageId}
                gatheringSources={gatheringSources}
              />
            )}
            <MarkdownRenderer
              content={parsedMessage}
              className="px-4"
              messageId={message.messageId}
              expandedThinkBoxes={message.expandedThinkBoxes}
              onThinkBoxToggle={onThinkBoxToggle}
              showThinking={true}
              sources={message.sources}
            />{' '}
            {loading && isLast ? null : (
              <div className="flex flex-row items-center justify-between w-full px-4 py-4">
                <div className="flex flex-row items-center space-x-1">
                  <Rewrite rewrite={rewrite} messageId={message.messageId} />
                  {message.modelStats && (
                    <ModelInfoButton modelStats={message.modelStats} />
                  )}
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
                    className="p-2 opacity-70 rounded-xl hover:bg-surface-2 transition duration-200"
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
            {loading && isLast && (
              <div className="pl-3 flex items-center justify-start">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-[high-bounce_1s_infinite] [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-[high-bounce_1s_infinite] [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-[high-bounce_1s_infinite]"></div>
                </div>
              </div>
            )}
            {isLast && message.role === 'assistant' && !loading && (
              <>
                <div className="border-t border-surface-2 px-4 pt-4 mt-4">
                  <div className="flex flex-row items-center space-x-2 mb-3">
                    <Layers3 size={20} />
                    <h3 className="text-xl font-medium">Related</h3>

                    {(!message.suggestions ||
                      message.suggestions.length === 0) && (
                      <button
                        onClick={handleLoadSuggestions}
                        disabled={loadingSuggestions}
                        className="px-4 py-2 flex flex-row items-center justify-center space-x-2 rounded-lg bg-surface hover:bg-surface-2 transition duration-200"
                      >
                        {loadingSuggestions ? (
                          <div className="w-4 h-4 border-2 border-t-transparent border-fg/40 rounded-full animate-spin" />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        <span>
                          {loadingSuggestions
                            ? 'Loading suggestions...'
                            : 'Load suggestions'}
                        </span>
                      </button>
                    )}
                  </div>

                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="flex flex-col space-y-3 mt-2">
                      {message.suggestions.map((suggestion, i) => (
                        <div
                          className="flex flex-col space-y-3 text-sm"
                          key={i}
                        >
                          <div className="h-px w-full bg-surface-2" />
                          <div
                            onClick={() => {
                              sendMessage(suggestion);
                            }}
                            className="cursor-pointer flex flex-row justify-between font-medium space-x-2 items-center"
                          >
                            <p className="transition duration-200 hover:text-accent">
                              {suggestion}
                            </p>
                            <Plus
                              size={20}
                              className="text-accent flex-shrink-0"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Sources Tab */}
        {activeTab === 'sources' &&
          message.sources &&
          message.sources.length > 0 && (
            <div className="p-4 animate-fadeIn">
              {message.searchQuery && (
                <div className="mb-4 text-sm bg-surface rounded-lg p-3">
                  <span className="font-medium opacity-70">Search query:</span>{' '}
                  {message.searchUrl ? (
                    <a
                      href={message.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {message.searchQuery}
                    </a>
                  ) : (
                    <span>{message.searchQuery}</span>
                  )}
                </div>
              )}
              <MessageSources sources={message.sources} />
            </div>
          )}

        {/* Images Tab */}
        {activeTab === 'images' && (
          <div className="p-3 animate-fadeIn">
            <SearchImages
              query={query}
              chatHistory={chatHistory}
              messageId={messageId}
              onImagesLoaded={updateImageCount}
            />
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div className="p-3 animate-fadeIn">
            <SearchVideos
              query={query}
              chatHistory={chatHistory}
              messageId={messageId}
              onVideosLoaded={updateVideoCount}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageTabs;
