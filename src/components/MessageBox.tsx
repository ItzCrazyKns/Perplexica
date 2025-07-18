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
                className="w-full p-3 text-lg bg-light-100 dark:bg-dark-100 rounded-lg border border-light-secondary dark:border-dark-secondary text-black dark:text-white focus:outline-none focus:border-[#24A0ED] transition duration-200 min-h-[120px] font-medium"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder="Edit your message..."
                autoFocus
              />
              <div className="flex flex-row space-x-2 mt-3 justify-end">
                <button
                  onClick={cancelEditMessage}
                  className="p-2 rounded-full bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={saveEditMessage}
                  className="p-2 rounded-full bg-[#24A0ED] hover:bg-[#1a8ad3] transition duration-200 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Save changes"
                  title="Save changes"
                  disabled={!editedContent.trim()}
                >
                  <Check size={18} className="text-white" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center">
                <h2
                  className="text-black dark:text-white font-medium text-3xl"
                  onClick={startEditMessage}
                >
                  {message.content}
                </h2>
                <button
                  onClick={startEditMessage}
                  className="ml-3 p-2 rounded-xl bg-light-secondary dark:bg-dark-secondary text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white flex-shrink-0"
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
        />
      )}
    </div>
  );
};

export default MessageBox;
