'use client';

import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
import { getAutoMediaSearch } from '../config/clientRegistry';
import { readNdjsonStream } from '../chat/ndjson';
import { randomHex } from '../utils/randomHex';
import { buildSection, Section } from '../chat/sections';
import {
  appendTextDelta,
  patchBlock,
  setMessageStatus,
  upsertBlock,
} from '../chat/streamEvents';
import { resolveModelConfig } from '../chat/config';
import { loadChat } from '../chat/loadMessages';

export type { Section };

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

interface ChatModelProvider {
  key: string;
  providerId: string;
}

interface EmbeddingModelProvider {
  key: string;
  providerId: string;
}

/*
 * Split by update frequency so the input bar and settings UI do not
 * re-render on every streamed token:
 * - messages: changes per token
 * - status: changes a few times per message
 * - settings: changes on user interaction
 * - actions: stable identities for the whole session
 */
type ChatMessagesContext = {
  messages: Message[];
  sections: Section[];
};

type ChatStatusContext = {
  chatId: string | undefined;
  loading: boolean;
  isReady: boolean;
  hasError: boolean;
  notFound: boolean;
  isMessagesLoaded: boolean;
  messageAppeared: boolean;
  researchEnded: boolean;
  hasMessages: boolean;
};

type ChatSettingsContext = {
  files: File[];
  fileIds: string[];
  sources: string[];
  optimizationMode: string;
  chatModelProvider: ChatModelProvider;
  embeddingModelProvider: EmbeddingModelProvider;
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  setSources: (sources: string[]) => void;
  setOptimizationMode: (mode: string) => void;
  setChatModelProvider: (provider: ChatModelProvider) => void;
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void;
};

type ChatActionsContext = {
  sendMessage: (
    message: string,
    messageId?: string,
    rewrite?: boolean,
  ) => Promise<void>;
  rewrite: (messageId: string) => void;
  setResearchEnded: (ended: boolean) => void;
  getChatHistory: () => [string, string][];
};

const messagesContext = createContext<ChatMessagesContext>({
  messages: [],
  sections: [],
});

const statusContext = createContext<ChatStatusContext>({
  chatId: '',
  loading: false,
  isReady: false,
  hasError: false,
  notFound: false,
  isMessagesLoaded: false,
  messageAppeared: false,
  researchEnded: false,
  hasMessages: false,
});

const settingsContext = createContext<ChatSettingsContext>({
  files: [],
  fileIds: [],
  sources: [],
  optimizationMode: '',
  chatModelProvider: { key: '', providerId: '' },
  embeddingModelProvider: { key: '', providerId: '' },
  setFiles: () => {},
  setFileIds: () => {},
  setSources: () => {},
  setOptimizationMode: () => {},
  setChatModelProvider: () => {},
  setEmbeddingModelProvider: () => {},
});

const actionsContext = createContext<ChatActionsContext>({
  sendMessage: async () => {},
  rewrite: () => {},
  setResearchEnded: () => {},
  getChatHistory: () => [],
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const params: { chatId: string } = useParams();

  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');

  const [chatId, setChatId] = useState<string | undefined>(params.chatId);
  const [newChatCreated, setNewChatCreated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const [researchEnded, setResearchEnded] = useState(false);

  const chatHistory = useRef<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);

  const [sources, setSources] = useState<string[]>(['web']);
  const [optimizationMode, setOptimizationMode] = useState('speed');

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);

  const [notFound, setNotFound] = useState(false);

  const [chatModelProvider, setChatModelProvider] = useState<ChatModelProvider>(
    {
      key: '',
      providerId: '',
    },
  );

  const [embeddingModelProvider, setEmbeddingModelProvider] =
    useState<EmbeddingModelProvider>({
      key: '',
      providerId: '',
    });

  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const messagesRef = useRef<Message[]>([]);

  /* Keyed by message object identity: stream events replace only the
     target message, so every other section is a cache hit and its
     MessageBox can bail out of re-rendering. */
  const sectionCacheRef = useRef(new WeakMap<Message, Section>());

  const sections = useMemo<Section[]>(() => {
    return messages.map((msg) => {
      const cached = sectionCacheRef.current.get(msg);
      if (cached) return cached;

      const section = buildSection(msg);
      sectionCacheRef.current.set(msg, section);
      return section;
    });
  }, [messages]);

  const isReconnectingRef = useRef(false);
  const handledMessageEndRef = useRef<Set<string>>(new Set());

  const checkReconnect = async () => {
    if (isReconnectingRef.current) return;

    setIsReady(true);
    console.debug(new Date(), 'app:ready');

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];

      if (lastMsg.status === 'answering') {
        setLoading(true);
        setResearchEnded(false);
        setMessageAppeared(false);

        isReconnectingRef.current = true;

        const res = await fetch(`/api/reconnect/${lastMsg.backendId}`, {
          method: 'POST',
        });

        if (!res.body) throw new Error('No response body');

        const messageHandler = getMessageHandler(lastMsg);

        try {
          await readNdjsonStream(res.body, messageHandler);
        } finally {
          isReconnectingRef.current = false;
        }
      }
    }
  };

  useEffect(() => {
    resolveModelConfig()
      .then((config) => {
        setChatModelProvider(config.chatModelProvider);
        setEmbeddingModelProvider(config.embeddingModelProvider);
        setIsConfigReady(true);
      })
      .catch((err) => {
        console.error(
          'An error occurred while checking the configuration:',
          err,
        );
        toast.error(err.message);
        setIsConfigReady(false);
        setHasError(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (params.chatId && params.chatId !== chatId) {
      setChatId(params.chatId);
      setMessages([]);
      chatHistory.current = [];
      setFiles([]);
      setFileIds([]);
      setIsMessagesLoaded(false);
      setNotFound(false);
      setNewChatCreated(false);
    }
  }, [params.chatId, chatId]);

  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      loadChat(chatId).then((chat) => {
        if (chat.notFound) {
          setNotFound(true);
          setIsMessagesLoaded(true);
          return;
        }

        setMessages(chat.messages);

        console.debug(new Date(), 'app:messages_loaded');

        if (chat.messages.length > 0) {
          document.title = chat.messages[0].query;
        }

        setFiles(chat.files);
        setFileIds(chat.files.map((file) => file.fileId));

        chatHistory.current = chat.history;
        setSources(chat.sources);
        setIsMessagesLoaded(true);
      });
    } else if (!chatId) {
      setNewChatCreated(true);
      setIsMessagesLoaded(true);
      setChatId(randomHex(20));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isMessagesLoaded, newChatCreated, messages.length]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (isMessagesLoaded && isConfigReady && newChatCreated) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else if (isMessagesLoaded && isConfigReady && !newChatCreated) {
      checkReconnect();
    } else {
      setIsReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMessagesLoaded, isConfigReady, newChatCreated]);

  useEffect(() => {
    if (isReady && initialMessage && isConfigReady) {
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigReady, isReady, initialMessage]);

  const getMessageHandler = (message: Message) => {
    const messageId = message.messageId;

    return async (data: any) => {
      if (data.type === 'error') {
        toast.error(data.data);
        setLoading(false);
        setMessages((prev) => setMessageStatus(prev, messageId, 'error'));
        return;
      }

      if (data.type === 'researchComplete') {
        setResearchEnded(true);
        if (
          message.responseBlocks.find(
            (b) => b.type === 'source' && b.data.length > 0,
          )
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'block') {
        setMessages((prev) => upsertBlock(prev, messageId, data.block));

        if (
          (data.block.type === 'source' && data.block.data.length > 0) ||
          data.block.type === 'text'
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'appendText') {
        setMessages((prev) =>
          appendTextDelta(prev, messageId, data.blockId, data.delta),
        );
      }

      if (data.type === 'updateBlock') {
        setMessages((prev) =>
          patchBlock(prev, messageId, data.blockId, data.patch),
        );
      }

      if (data.type === 'messageEnd') {
        if (handledMessageEndRef.current.has(messageId)) {
          return;
        }

        handledMessageEndRef.current.add(messageId);

        const currentMsg = messagesRef.current.find(
          (msg) => msg.messageId === messageId,
        );

        const newHistory: [string, string][] = [
          ...chatHistory.current,
          ['human', message.query],
          [
            'assistant',
            currentMsg?.responseBlocks.find((b) => b.type === 'text')?.data ||
              '',
          ],
        ];

        chatHistory.current = newHistory;

        setMessages((prev) => setMessageStatus(prev, messageId, 'completed'));

        setLoading(false);

        const lastMsg = messagesRef.current[messagesRef.current.length - 1];

        const autoMediaSearch = getAutoMediaSearch();

        if (autoMediaSearch) {
          setTimeout(() => {
            document
              .getElementById(`search-images-${lastMsg.messageId}`)
              ?.click();

            document
              .getElementById(`search-videos-${lastMsg.messageId}`)
              ?.click();
          }, 200);
        }

        const hasSourceBlocks = currentMsg?.responseBlocks.some(
          (block) => block.type === 'source' && block.data.length > 0,
        );
        const hasSuggestions = currentMsg?.responseBlocks.some(
          (block) => block.type === 'suggestion',
        );

        if (hasSourceBlocks && !hasSuggestions) {
          const suggestions = await getSuggestions(newHistory);
          const suggestionBlock: Block = {
            id: randomHex(7),
            type: 'suggestion',
            data: suggestions,
          };

          setMessages((prev) => upsertBlock(prev, messageId, suggestionBlock));
        }
      }
    };
  };

  const sendMessageImpl = async (
    message: string,
    messageId?: string,
    rewrite = false,
  ) => {
    if (loading || !message) return;
    setLoading(true);
    setResearchEnded(false);
    setMessageAppeared(false);

    if (messages.length <= 1) {
      window.history.replaceState(null, '', `/c/${chatId}`);
    }

    messageId = messageId ?? randomHex(7);
    const backendId = randomHex(20);

    /* A rewrite reuses the message id, so a stale entry here would
       swallow its messageEnd and leave the UI loading forever. */
    handledMessageEndRef.current.delete(messageId);

    const newMessage: Message = {
      messageId,
      chatId: chatId!,
      backendId,
      query: message,
      responseBlocks: [],
      status: 'answering',
      createdAt: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);

    const messageIndex = messages.findIndex((m) => m.messageId === messageId);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        message: {
          messageId: messageId,
          chatId: chatId!,
          content: message,
        },
        chatId: chatId!,
        files: fileIds,
        sources: sources,
        optimizationMode: optimizationMode,
        history: rewrite
          ? chatHistory.current.slice(
              0,
              messageIndex === -1 ? undefined : messageIndex,
            )
          : chatHistory.current,
        chatModel: {
          key: chatModelProvider.key,
          providerId: chatModelProvider.providerId,
        },
        embeddingModel: {
          key: embeddingModelProvider.key,
          providerId: embeddingModelProvider.providerId,
        },
        systemInstructions: localStorage.getItem('systemInstructions'),
      }),
    });

    if (!res.body) throw new Error('No response body');

    await readNdjsonStream(res.body, getMessageHandler(newMessage));
  };

  const rewriteImpl = (messageId: string) => {
    const index = messages.findIndex((msg) => msg.messageId === messageId);

    if (index === -1) return;

    setMessages((prev) => prev.slice(0, index));

    chatHistory.current = chatHistory.current.slice(0, index * 2);

    const messageToRewrite = messages[index];
    sendMessageImpl(messageToRewrite.query, messageToRewrite.messageId, true);
  };

  /* Latest implementations behind stable identities, so memoized
     consumers of the actions context never re-render for them. */
  const sendMessageRef = useRef(sendMessageImpl);
  sendMessageRef.current = sendMessageImpl;
  const rewriteRef = useRef(rewriteImpl);
  rewriteRef.current = rewriteImpl;

  const sendMessage = useCallback(
    (message: string, messageId?: string, rewrite?: boolean) =>
      sendMessageRef.current(message, messageId, rewrite),
    [],
  );

  const rewrite = useCallback(
    (messageId: string) => rewriteRef.current(messageId),
    [],
  );

  const getChatHistory = useCallback(() => chatHistory.current, []);

  const messagesValue = useMemo<ChatMessagesContext>(
    () => ({ messages, sections }),
    [messages, sections],
  );

  const statusValue = useMemo<ChatStatusContext>(
    () => ({
      chatId,
      loading,
      isReady,
      hasError,
      notFound,
      isMessagesLoaded,
      messageAppeared,
      researchEnded,
      hasMessages: messages.length > 0,
    }),
    [
      chatId,
      loading,
      isReady,
      hasError,
      notFound,
      isMessagesLoaded,
      messageAppeared,
      researchEnded,
      messages.length > 0,
    ],
  );

  const settingsValue = useMemo<ChatSettingsContext>(
    () => ({
      files,
      fileIds,
      sources,
      optimizationMode,
      chatModelProvider,
      embeddingModelProvider,
      setFiles,
      setFileIds,
      setSources,
      setOptimizationMode,
      setChatModelProvider,
      setEmbeddingModelProvider,
    }),
    [
      files,
      fileIds,
      sources,
      optimizationMode,
      chatModelProvider,
      embeddingModelProvider,
    ],
  );

  const actionsValue = useMemo<ChatActionsContext>(
    () => ({ sendMessage, rewrite, setResearchEnded, getChatHistory }),
    [sendMessage, rewrite, getChatHistory],
  );

  return (
    <actionsContext.Provider value={actionsValue}>
      <settingsContext.Provider value={settingsValue}>
        <statusContext.Provider value={statusValue}>
          <messagesContext.Provider value={messagesValue}>
            {children}
          </messagesContext.Provider>
        </statusContext.Provider>
      </settingsContext.Provider>
    </actionsContext.Provider>
  );
};

export const useChatMessages = () => useContext(messagesContext);
export const useChatStatus = () => useContext(statusContext);
export const useChatSettings = () => useContext(settingsContext);
export const useChatActions = () => useContext(actionsContext);
