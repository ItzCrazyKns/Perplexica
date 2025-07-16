'use client';

import React, { useState } from 'react';
import { Message } from './ChatWindow';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Layers3,
  Plus,
} from 'lucide-react';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import MessageSources from './MessageSources';
import ThinkBox from './ThinkBox';

const ThinkTagProcessor = ({ children }: { children: React.ReactNode }) => {
  return <ThinkBox content={children as string} />;
};

interface MessageTabsProps {
  message: Message;
  parsedMessage: string;
  loading: boolean;
  isLast: boolean;
  sendMessage: (message: string) => void;
}

const MessageTabs = ({
  message,
  parsedMessage,
  loading,
  isLast,
  sendMessage,
}: MessageTabsProps) => {
  const [activeTab, setActiveTab] = useState<'answer' | 'sources' | 'related'>('answer');

  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      think: {
        component: ThinkTagProcessor,
      },
    },
  };

  const tabs = [
    {
      id: 'answer' as const,
      label: 'Answer',
      icon: Disc3,
      show: true,
    },
    {
      id: 'sources' as const,
      label: 'Sources',
      icon: BookCopy,
      show: message.sources && message.sources.length > 0,
    },
    {
      id: 'related' as const,
      label: 'Related',
      icon: Layers3,
      show: isLast && message.suggestions && message.suggestions.length > 0 && message.role === 'assistant' && !loading,
    },
  ].filter(tab => tab.show);

  return (
    <div className="flex flex-col space-y-4">
      {/* Tab Headers */}
      <div className="flex border-b border-light-200 dark:border-dark-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-[#24A0ED] text-[#24A0ED]'
                  : 'border-transparent text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white'
              )}
            >
              <Icon
                className={cn(
                  activeTab === tab.id && tab.id === 'answer' && isLast && loading ? 'animate-spin' : 'animate-none'
                )}
                size={18}
              />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {activeTab === 'answer' && (
          <div className="flex flex-col space-y-4">
            <Markdown
              className={cn(
                'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                'max-w-none break-words text-black dark:text-white',
              )}
              options={markdownOverrides}
            >
              {parsedMessage}
            </Markdown>
          </div>
        )}

        {activeTab === 'sources' && message.sources && message.sources.length > 0 && (
          <div className="flex flex-col space-y-4">
            <MessageSources sources={message.sources} layout="list" />
          </div>
        )}

        {activeTab === 'related' && 
         isLast &&
         message.suggestions &&
         message.suggestions.length > 0 &&
         message.role === 'assistant' &&
         !loading && (
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-3">
              {message.suggestions.map((suggestion, i) => (
                <div
                  className="flex flex-col space-y-3 text-sm"
                  key={i}
                >
                  {i > 0 && <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />}
                  <div
                    onClick={() => {
                      sendMessage(suggestion);
                    }}
                    className="cursor-pointer flex flex-row justify-between font-medium space-x-2 items-center p-3 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors"
                  >
                    <p className="transition duration-200 hover:text-[#24A0ED] text-black dark:text-white">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageTabs;
