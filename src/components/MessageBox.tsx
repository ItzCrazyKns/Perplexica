import { cn } from '@/lib/utils';
import { CheckCheck, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Message } from './ChatWindow';
import MessageTabs from './MessageTabs';
import ThinkBox from './ThinkBox';

const ThinkTagProcessor = ({ children }: { children: React.ReactNode }) => {
  return <ThinkBox content={children as string} />;
};

const CodeBlock = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  // Extract language from className (format could be "language-javascript" or "lang-javascript")
  let language = '';
  if (className) {
    if (className.startsWith('language-')) {
      language = className.replace('language-', '');
    } else if (className.startsWith('lang-')) {
      language = className.replace('lang-', '');
    }
  }

  const content = children as string;

  const [isCopied, setIsCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  console.log('Code block language:', language, 'Class name:', className); // For debugging

  return (
    <div className="rounded-md overflow-hidden my-4 relative group border border-dark-secondary">
      <div className="flex justify-between items-center px-4 py-2 bg-dark-200 border-b border-dark-secondary text-xs text-white/70 font-mono">
        <span>{language}</span>
        <button
          onClick={handleCopyCode}
          className="p-1 rounded-md hover:bg-dark-secondary transition duration-200"
          aria-label="Copy code to clipboard"
        >
          {isCopied ? (
            <CheckCheck size={14} className="text-green-500" />
          ) : (
            <CopyIcon size={14} className="text-white/70" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          borderRadius: 0,
          backgroundColor: '#1c1c1c',
        }}
        wrapLines={true}
        wrapLongLines={true}
        showLineNumbers={language !== '' && content.split('\n').length > 1}
        useInlineStyles={true}
        PreTag="div"
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
};

const MessageBox = ({
  message,
  messageIndex,
  history,
  loading,
  isLast,
  rewrite,
  sendMessage,
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
}) => {
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
