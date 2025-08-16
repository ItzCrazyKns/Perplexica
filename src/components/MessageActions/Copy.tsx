'use client';

import { Check, ClipboardList } from 'lucide-react';
import { Message } from '../ChatWindow';
import { useState } from 'react';

const Copy = ({
  message,
  initialMessage,
}: {
  message: Message;
  initialMessage: string;
}) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        const citations =
          message.sources && message.sources.length > 0
            ? `\n\nCitations:\n${message.sources
                ?.map((source: any, i: number) => {
                  const url = source?.metadata?.url ?? '';
                  return `[${i + 1}] ${url}`;
                })
                .join('\n')}`
            : '';
        const contentToCopy = `${initialMessage}${citations}`;

        try {
          if (navigator?.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(contentToCopy);
          } else {
            const textArea = document.createElement('textarea');
            textArea.value = contentToCopy;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch (err) {
          console.error('Copy failed', err);
        }
      }}
      className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
    >
      {copied ? <Check size={18} /> : <ClipboardList size={18} />}
    </button>
  );
};

export default Copy;
