import { ArrowRight, ArrowUp, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { File } from './ChatWindow';
import Attach from './MessageInputActions/Attach';
import Focus from './MessageInputActions/Focus';
import ModelSelector from './MessageInputActions/ModelSelector';
import Optimization from './MessageInputActions/Optimization';
import SystemPromptSelector from './MessageInputActions/SystemPromptSelector'; // Import new component

const MessageInput = ({
  sendMessage,
  loading,
  fileIds,
  setFileIds,
  files,
  setFiles,
  optimizationMode,
  setOptimizationMode,
  focusMode,
  setFocusMode,
  firstMessage,
  onCancel,
  systemPromptIds,
  setSystemPromptIds,
}: {
  sendMessage: (
    message: string,
    options?: {
      messageId?: string; // For rewrites/edits
      selectedSystemPromptIds?: string[];
    },
  ) => void;
  loading: boolean;
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  optimizationMode: string;
  setOptimizationMode: (mode: string) => void;
  focusMode: string;
  setFocusMode: (mode: string) => void;
  firstMessage: boolean;
  onCancel?: () => void;
  systemPromptIds: string[];
  setSystemPromptIds: (ids: string[]) => void;
}) => {
  const [message, setMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  } | null>(null);

  useEffect(() => {
    // Load saved model preferences from localStorage
    const chatModelProvider = localStorage.getItem('chatModelProvider');
    const chatModel = localStorage.getItem('chatModel');

    if (chatModelProvider && chatModel) {
      setSelectedModel({
        provider: chatModelProvider,
        model: chatModel,
      });
    }

    const storedPromptIds = localStorage.getItem('selectedSystemPromptIds');
    if (storedPromptIds) {
      try {
        const parsedIds = JSON.parse(storedPromptIds);
        if (Array.isArray(parsedIds)) {
          setSystemPromptIds(parsedIds);
        }
      } catch (e) {
        console.error(
          'Failed to parse selectedSystemPromptIds from localStorage',
          e,
        );
        localStorage.removeItem('selectedSystemPromptIds'); // Clear corrupted data
      }
    }
  }, [setSystemPromptIds]);

  useEffect(() => {
    if (systemPromptIds.length > 0) {
      localStorage.setItem(
        'selectedSystemPromptIds',
        JSON.stringify(systemPromptIds),
      );
    } else {
      // Remove from localStorage if no prompts are selected to keep it clean
      localStorage.removeItem('selectedSystemPromptIds');
    }
  }, [systemPromptIds]);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable');
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Function to handle message submission
  const handleSubmitMessage = () => {
    // Only submit if we have a non-empty message and not currently loading
    if (loading || message.trim().length === 0) return;

    // Make sure the selected model is used when sending a message
    if (selectedModel) {
      localStorage.setItem('chatModelProvider', selectedModel.provider);
      localStorage.setItem('chatModel', selectedModel.model);
    }

    sendMessage(message);
    setMessage('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmitMessage();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmitMessage();
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col bg-light-secondary dark:bg-dark-secondary px-5 pt-5 pb-2 rounded-lg w-full border border-light-200 dark:border-dark-200">
        <TextareaAutosize
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minRows={2}
          className="bg-transparent placeholder:text-black/50 dark:placeholder:text-white/50 text-sm text-black dark:text-white resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
          placeholder={firstMessage ? 'Ask anything...' : 'Ask a follow-up'}
        />
        <div className="flex flex-row items-center justify-between mt-4">
          <div className="flex flex-row items-center space-x-2">
            <Focus focusMode={focusMode} setFocusMode={setFocusMode} />
            <Attach
              fileIds={fileIds}
              setFileIds={setFileIds}
              files={files}
              setFiles={setFiles}
              optimizationMode={optimizationMode}
            />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <ModelSelector
              selectedModel={selectedModel}
              setSelectedModel={(selectedModel) => {
                setSelectedModel(selectedModel);
                localStorage.setItem(
                  'chatModelProvider',
                  selectedModel.provider,
                );
                localStorage.setItem('chatModel', selectedModel.model);
              }}
            />
            <SystemPromptSelector
              selectedPromptIds={systemPromptIds}
              onSelectedPromptIdsChange={setSystemPromptIds}
            />
            <Optimization
              optimizationMode={optimizationMode}
              setOptimizationMode={(optimizationMode) => {
                setOptimizationMode(optimizationMode);
                localStorage.setItem('optimizationMode', optimizationMode);
              }}
            />
            {loading ? (
              <button
                type="button"
                className="bg-red-700 text-white hover:bg-red-800 transition duration-100 rounded-full p-2 relative group"
                onClick={onCancel}
                aria-label="Cancel"
              >
                {loading && (
                  <div className="absolute inset-0 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                )}
                <span className="relative flex items-center justify-center w-[17px] h-[17px]">
                  <Square size={17} className="text-white" />
                </span>
              </button>
            ) : (
              <button
                disabled={message.trim().length === 0}
                className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 disabled:bg-[#e0e0dc] dark:disabled:bg-[#ececec21] hover:bg-opacity-85 transition duration-100 rounded-full p-2"
                type="submit"
              >
                {firstMessage ? (
                  <ArrowRight className="bg-background" size={17} />
                ) : (
                  <ArrowUp className="bg-background" size={17} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

export default MessageInput;
