'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject, useEffect, useState } from 'react';
import { Message } from './ChatWindow';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Volume2,
  StopCircle,
  Layers3,
  Plus,
} from 'lucide-react';
import Markdown from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import SearchVideos from './SearchVideos';
import { useSpeech } from 'react-text-to-speech';
import ThinkBox from './ThinkBox';

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
  sendMessage: (message: string) => void;
}) => {
  const [parsedMessage, setParsedMessage] = useState(message.content);
  const [speechMessage, setSpeechMessage] = useState(message.content);

  useEffect(() => {
    const regex = /\[(\d+)\]/g;

    if (
      message.role === 'assistant' &&
      message?.sources &&
      message.sources.length > 0
    ) {
      return setParsedMessage(
        message.content.replace(
          regex,
          (_, number) =>
            `<a href="${message.sources?.[number - 1]?.metadata?.url}" target="_blank" className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 relative">${number}</a>`,
        ),
      );
    }

    setSpeechMessage(message.content.replace(regex, ''));
    setParsedMessage(message.content);
  }, [message.content, message.sources, message.role]);

  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });


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
                <MessageSources sources={message.sources} />
              </div>
            )}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2 mb-2">
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 200 200" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0"
                >
                  <circle cx="100" cy="100" r="97.5" fill="#ED1C24"/>
                  <path id="Leica" d="m157.14 110.77c-2.959 0-2.959-3.251-2.959-4.195 0-2.482 1.948-12.354 7.313-12.354 2.257 0 3.47 1.904 3.47 3.328-1e-3 0.296-1.364 13.221-7.824 13.221m-75.542-16.798c1.616 0.097 2.704 1.253 2.647 2.435-0.266 7.629-9.671 6.447-9.671 6.447s1.535-9.218 7.024-8.882zm98.424 14.081s-2.54 1.83-4.343 1.83c-1.367 0-2.116-1.142-2.116-2.395 0-2.818 4.414-16.707 4.414-16.707l-10.799 0.144-0.564 1.878s-1.575-3.185-7.242-3.185c-10.994 0-17.02 9.479-17.282 15.052-0.047 1.209-0.061 1.381-0.061 1.381-0.255 0.295-4.142 4.719-8.911 4.719-3.816 0-4.451-3.197-4.451-5.239 0-2.218 1.844-10.981 7.047-10.981 2.832 0 4.565 2.463 4.565 2.463l1.528-5.016s-2.415-1.877-7.346-1.891c-10.628-0.014-17.887 7.968-18.142 15.156-0.047 1.071-0.087 1.424-0.074 1.491-0.353 0.427-2.973 3.439-6.373 3.439-2.324 0-2.324-1.813-2.324-2.62 0-1.085 4.595-16.731 4.595-16.731l-12.012 0.182-4.286 15.183s-6.583 4.767-15.788 5.426c-4.746 0.325-6.382-2.551-6.382-4.243v-0.702s1.931 0.125 3.382 0.125c1.128 0 15.156-0.971 15.156-9.557 0-4.904-4.897-6.775-11.108-6.775-11.461 0-19.5 7.111-19.5 15.545 0 7.699 6.584 11.008 15.069 11.008 9.617 0 19.005-5.889 19.005-5.889s0.524 5.889 8.119 5.889c7.836 0 13.97-5.889 13.97-5.889s3.413 5.664 11.209 5.664c7.964 0 14.081-6.443 14.081-6.443s2.133 6.077 10.023 6.077c6.164 0 9.473-4.044 9.473-4.044s1.76 4.044 7.135 4.044c6.553 0 11.475-4.622 11.475-4.622zm-152.85 14.531c-3.033 0.088-5.008-1.928-5.008-3.057 0-2.496 3.063-2.889 5.008-2.751 4.706 0.255 8.75 1.864 8.75 1.864s-4.773 3.82-8.75 3.944m44.8-58.454c3.534 0 4.706 2.868 4.41 5.448-1.72 15.143-16.758 18.609-16.758 18.609s3.735-24.057 12.348-24.057zm110.22 54.202s-25.24 8.793-73.396 8.199c-33.214-0.406-58.538-10.215-58.538-10.215s0.819-1.596 1.357-2.671c3.329-6.788 7.255-20.561 7.255-20.561s22.828-6.361 22.828-24.49c0-5.736-5.334-9.432-10.601-9.657-18.397-0.716-23.5 25.502-24.628 29.96-0.071 0.322-0.098 0.42-0.098 0.42-5.68-0.787-8.881-1.941-8.881-1.941l-1.3 3.537c3.833 1.816 9.405 2.408 9.405 2.408-1.102 7.023-6.557 20.325-6.557 20.325s-5.035-1.669-11.29-1.669c-8.109 0-10.896 3.859-11.095 6.281-0.538 6.258 7.333 9.197 12.828 9.197 10.726 0 16.298-5.788 16.298-5.788s30.167 11.394 61.632 11.394c41.186 0 75.915-10.967 75.915-10.967zm-73.678-41.73c-3.826 0-6.647 1.556-6.647 5.146 0 3.625 3.262 4.622 6.647 4.622 3.406 0 6.507-1.603 6.507-5.298 0-3.708-3.736-4.47-6.507-4.47" fill="#fff"/>
                </svg>
                <span className="text-sm font-medium text-black/70 dark:text-white/70">Answer</span>
              </div>

              <Markdown
                className={cn(
                  'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                  'max-w-none break-words text-black dark:text-white',
                )}
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
              {isLast &&
                message.suggestions &&
                message.suggestions.length > 0 &&
                message.role === 'assistant' &&
                !loading && (
                  <>
                    <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
                    <div className="flex flex-col space-y-3 text-black dark:text-white">
                      <div className="flex flex-row items-center space-x-2 mt-4">
                        <Layers3 />
                        <h3 className="text-xl font-medium">Related</h3>
                      </div>
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
                    </div>
                  </>
                )}
            </div>
          </div>
          <div className="lg:sticky lg:top-20 flex flex-col items-center space-y-3 w-full lg:w-3/12 z-30 h-full pb-4">
            <SearchImages
              query={history[messageIndex - 1].content}
              chatHistory={history.slice(0, messageIndex - 1)}
            />
            <SearchVideos
              chatHistory={history.slice(0, messageIndex - 1)}
              query={history[messageIndex - 1].content}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBox;
