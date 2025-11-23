'use client';

import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChat from './EmptyChat';
import NextError from 'next/error';
import { useChat } from '@/lib/hooks/useChat';
import SettingsButtonMobile from './Settings/SettingsButtonMobile';
import { Block, Chunk } from '@/lib/types';

export interface BaseMessage {
  chatId: string;
  messageId: string;
  createdAt: Date;
}

export interface Message extends BaseMessage {
  backendId: string;
  query: string;
  responseBlocks: Block[];
  status: 'answering' | 'completed' | 'error';
}

export interface UserMessage extends BaseMessage {
  role: 'user';
  content: string;
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  content: string;
  suggestions?: string[];
}

export interface SourceMessage extends BaseMessage {
  role: 'source';
  sources: Chunk[];
}

export interface SuggestionMessage extends BaseMessage {
  role: 'suggestion';
  suggestions: string[];
}

export type LegacyMessage =
  | AssistantMessage
  | UserMessage
  | SourceMessage
  | SuggestionMessage;

export type ChatTurn = UserMessage | AssistantMessage;

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

export interface Widget {
  widgetType: string;
  params: Record<string, any>;
}

const ChatWindow = () => {
  const { hasError, notFound, messages } = useChat();
  if (hasError) {
    return (
      <div className="relative">
        <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5">
          <SettingsButtonMobile />
        </div>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="dark:text-white/70 text-black/70 text-sm">
            Failed to connect to the server. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return notFound ? (
    <NextError statusCode={404} />
  ) : (
    <div>
      {messages.length > 0 ? (
        <>
          <Navbar />
          <Chat />
        </>
      ) : (
        <EmptyChat />
      )}
    </div>
  );
};

export default ChatWindow;
