import { cn } from '@/lib/utils';
import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { Message } from './ChatWindow';
import MessageTabs from './MessageTabs';

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
}) => {
  // Local state for editing functionality
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

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
              <div className="flex items-center">
                <h2 className="font-medium text-3xl" onClick={startEditMessage}>
                  {message.content}
                </h2>
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
        />
      )}
    </div>
  );
};

export default MessageBox;
