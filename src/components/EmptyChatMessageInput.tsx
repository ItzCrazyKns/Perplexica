import { ArrowRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import Sources from './MessageInputActions/Sources';
import Optimization from './MessageInputActions/Optimization';
import Attach from './MessageInputActions/Attach';
import Notion from './MessageInputActions/Notion';
import { useChat } from '@/lib/hooks/useChat';
import ModelSelector from './MessageInputActions/ChatModelSelector';
import { SiNotion } from '@icons-pack/react-simple-icons';

const EmptyChatMessageInput = () => {
  const { sendMessage, notionPages, setNotionPages } = useChat();

  /* const [copilotEnabled, setCopilotEnabled] = useState(false); */
  const [message, setMessage] = useState('');

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

    inputRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sendMessage(message);
        setMessage('');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(message);
          setMessage('');
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col bg-light-secondary dark:bg-dark-secondary px-3 pt-5 pb-3 rounded-2xl w-full border border-light-200 dark:border-dark-200 shadow-sm shadow-light-200/10 dark:shadow-black/20 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-dark-300">
        <TextareaAutosize
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minRows={2}
          className="px-2 bg-transparent placeholder:text-[15px] placeholder:text-black/50 dark:placeholder:text-white/50 text-sm text-black dark:text-white resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
          placeholder="Ask anything..."
        />
        {notionPages.length > 0 && (
          <div className="flex flex-row flex-wrap gap-1.5 px-2 pb-1 pt-2">
            {notionPages.map((page) => (
              <span
                key={page.id}
                className="flex flex-row items-center space-x-1 rounded-full bg-light-100 dark:bg-dark-100 px-2.5 py-1 text-[11px] text-black/70 dark:text-white/70"
              >
                <SiNotion size={11} className="text-sky-500" />
                <span className="max-w-[140px] truncate">{page.title}</span>
                <button
                  type="button"
                  onClick={() =>
                    setNotionPages(notionPages.filter((p) => p.id !== page.id))
                  }
                  className="hover:text-black dark:hover:text-white transition duration-200"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-row items-center justify-between mt-4">
          <Optimization />
          <div className="flex flex-row items-center space-x-2">
            <div className="flex flex-row items-center space-x-1">
              <Sources />
              <Notion />
              <ModelSelector />
              <Attach />
            </div>
            <button
              disabled={message.trim().length === 0}
              className="bg-sky-500 text-white disabled:text-black/50 dark:disabled:text-white/50 disabled:bg-[#e0e0dc] dark:disabled:bg-[#ececec21] hover:bg-opacity-85 transition duration-100 rounded-full p-2"
            >
              <ArrowRight className="bg-background" size={17} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default EmptyChatMessageInput;
