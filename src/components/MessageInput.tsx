import { cn } from '@/lib/utils';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import Attach from './MessageInputActions/Attach';
import CopilotToggle from './MessageInputActions/Copilot';
import { File } from './ChatWindow';
import AttachSmall from './MessageInputActions/AttachSmall';
import { useChat } from '@/lib/hooks/useChat';

const MessageInput = () => {
  const { loading, sendMessage } = useChat();

  const [copilotEnabled, setCopilotEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [textareaRows, setTextareaRows] = useState(1);
  const [mode, setMode] = useState<'multi' | 'single'>('single');
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  useEffect(() => {
    if (textareaRows >= 2 && message && mode === 'single') {
      setMode('multi');
    } else if (!message && mode === 'multi') {
      setMode('single');
    }
  }, [textareaRows, mode, message]);

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

  useEffect(() => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = "en-US";

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setMessage((prev: string) => prev + finalTranscript);
          setInterimTranscript("");
        } else {
          setInterimTranscript(interimTranscript);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        setInterimTranscript("");
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
        setInterimTranscript("");
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const startRecording = () => {
    if (recognition) {
      setIsRecording(true);
      setInterimTranscript("");
      recognition.start();
    }
  };

  const stopRecording = () => {
    if (recognition) {
      recognition.stop();
      setIsRecording(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        if (loading) return;
        e.preventDefault();
        if (isRecording) {
          stopRecording();
        }
        sendMessage(message);
        setMessage('');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !loading) {
          e.preventDefault();
          if (isRecording) {
            stopRecording();
          }
          sendMessage(message);
          setMessage('');
        }
      }}
      className={cn(
        'bg-light-secondary dark:bg-dark-secondary p-4 flex items-center overflow-hidden border border-light-200 dark:border-dark-200',
        mode === 'multi' ? 'flex-col rounded-lg' : 'flex-row rounded-full',
      )}
    >
      {mode === 'single' && <AttachSmall />}
      <TextareaAutosize
        ref={inputRef}
        value={message + interimTranscript}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const newValue = e.target.value;
          if (newValue.length >= message.length) {
            setMessage(newValue.slice(0, newValue.length - interimTranscript.length));
          } else {
            setMessage(newValue);
          }
        }}
        onHeightChange={(height, props) => {
          setTextareaRows(Math.ceil(height / props.rowHeight));
        }}
        className="transition bg-transparent dark:placeholder:text-white/50 placeholder:text-sm text-sm dark:text-white resize-none focus:outline-none w-full px-2 max-h-24 lg:max-h-36 xl:max-h-48 flex-grow flex-shrink"
        placeholder="Ask a follow-up"
      />
      {mode === 'single' && (
        <div className="flex flex-row items-center space-x-4">
          <CopilotToggle
            copilotEnabled={copilotEnabled}
            setCopilotEnabled={setCopilotEnabled}
          />
          {recognition && (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`${
                isRecording ? "bg-red-500 hover:bg-red-600" : "bg-gray-500 hover:bg-gray-600"
              } text-white transition duration-100 rounded-full p-2`}
              title={isRecording ? "Stop recording" : "Start voice recording"}
            >
              {isRecording ? <Square size={17} /> : <Mic size={17} />}
            </button>
          )}
          <button
            disabled={message.trim().length === 0 || loading}
            className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
          >
            <ArrowUp className="bg-background" size={17} />
          </button>
        </div>
      )}
      {mode === 'multi' && (
        <div className="flex flex-row items-center justify-between w-full pt-2">
          <AttachSmall />
          <div className="flex flex-row items-center space-x-4">
            <CopilotToggle
              copilotEnabled={copilotEnabled}
              setCopilotEnabled={setCopilotEnabled}
            />
            {recognition && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`${
                  isRecording ? "bg-red-500 hover:bg-red-600" : "bg-gray-500 hover:bg-gray-600"
                } text-white transition duration-100 rounded-full p-2`}
                title={isRecording ? "Stop recording" : "Start voice recording"}
              >
                {isRecording ? <Square size={17} /> : <Mic size={17} />}
              </button>
            )}
            <button
              disabled={message.trim().length === 0 || loading}
              className="bg-[#24A0ED] text-white text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
            >
              <ArrowUp className="bg-background" size={17} />
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

export default MessageInput;
