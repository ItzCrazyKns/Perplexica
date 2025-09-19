import { cn } from '@/lib/utils';
import { Check, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Message } from './ChatWindow';
import MessageTabs from './MessageTabs';
import { Document } from '@langchain/core/documents';

const MessageBox = ({
  message,
  messageIndex,
  history,
  loading,
  isLast,
  rewrite,
  sendMessage,
  handleEditMessage,
  onThinkBoxToggle,
  analysisProgress,
  modelStats,
  gatheringSources,
  actionMessageId,
}: {
  message: Message;
  messageIndex: number;
  history: Message[];
  loading: boolean;
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
  handleEditMessage: (messageId: string, content: string) => void;
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
}) => {
  // Local state for editing functionality
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  // State for truncation toggle of long user prompts
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLHeadingElement | null>(null);

  // Measure overflow compared to a 3-line clamped state
  useEffect(() => {
    const measureOverflow = () => {
      const el = contentRef.current;
      if (!el) return;
      const hadClamp = el.classList.contains('line-clamp-3');
      if (!hadClamp) el.classList.add('line-clamp-3');
      const overflowing = el.scrollHeight > el.clientHeight + 1;
      setIsOverflowing(overflowing);
      if (!hadClamp) el.classList.remove('line-clamp-3');
    };

    measureOverflow();
    window.addEventListener('resize', measureOverflow);
    return () => {
      window.removeEventListener('resize', measureOverflow);
    };
  }, [message.content]);

  // Initialize editing
  const startEditMessage = () => {
    setIsEditing(true);
    setEditedContent(message.content);
  };

  // Cancel editing
  const cancelEditMessage = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  // Save edits
  const saveEditMessage = () => {
    handleEditMessage(message.messageId, editedContent);
    setIsEditing(false);
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
          {isEditing ? (
            <div className="w-full">
              <textarea
                className="w-full p-3 text-lg bg-surface rounded-lg transition duration-200 min-h-[120px] font-medium text-fg placeholder:text-fg/40 border border-surface-2 focus:outline-none focus:ring-2 focus:ring-accent/40"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder="Edit your message..."
                autoFocus
              />
              <div className="flex flex-row space-x-2 mt-3 justify-end">
                <button
                  onClick={cancelEditMessage}
                  className="p-2 rounded-full bg-surface hover:bg-surface-2 border border-surface-2 transition duration-200 text-fg/80"
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={saveEditMessage}
                  className="p-2 rounded-full bg-accent hover:bg-accent-700 transition duration-200 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Save changes"
                  title="Save changes"
                  disabled={!editedContent.trim()}
                >
                  <Check size={18} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start">
                <div className="flex-1 min-w-0">
                  <h2
                    className={cn(
                      'font-medium text-3xl',
                      !isExpanded && 'line-clamp-3',
                    )}
                    id={`user-msg-${message.messageId}`}
                    ref={contentRef}
                    onClick={startEditMessage}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (e.key === ' ') e.preventDefault();
                        startEditMessage();
                      }
                    }}
                  >
                    {message.content}
                  </h2>
                  {isOverflowing && (
                    <button
                      type="button"
                      className="mt-2 text-sm text-accent hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded((v) => !v);
                      }}
                      aria-expanded={isExpanded}
                      aria-controls={`user-msg-${message.messageId}`}
                      title={isExpanded ? 'Show less' : 'Show more'}
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
                <button
                  onClick={startEditMessage}
                  className="ml-3 p-2 rounded-xl bg-surface hover:bg-surface-2 border border-surface-2 flex-shrink-0"
                  aria-label="Edit message"
                  title="Edit message"
                >
                  <Pencil size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {message.role === 'assistant' && (
        <MessageTabs
          query={history[messageIndex - 1].content}
          chatHistory={history.slice(0, messageIndex - 1)}
          messageId={message.messageId}
          message={message}
          isLast={isLast}
          loading={loading}
          rewrite={rewrite}
          sendMessage={sendMessage}
          onThinkBoxToggle={onThinkBoxToggle}
          analysisProgress={analysisProgress}
          modelStats={modelStats}
          gatheringSources={gatheringSources}
          actionMessageId={actionMessageId}
        />
      )}
    </div>
  );
};

export default MessageBox;
