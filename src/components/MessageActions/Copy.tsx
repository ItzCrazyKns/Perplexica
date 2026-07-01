import { Check, ClipboardList, X } from 'lucide-react';
import { Message } from '../ChatWindow';
import { useState } from 'react';
import { Section } from '@/lib/hooks/useChat';
import { SourceBlock } from '@/lib/types';
import { cn } from '@/lib/utils';

const Copy = ({
  section,
  initialMessage,
}: {
  section: Section;
  initialMessage: string;
}) => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    const sources = section.message.responseBlocks.filter(
      (b) => b.type === 'source' && b.data.length > 0,
    ) as SourceBlock[];

    const contentToCopy = `${initialMessage}${
      sources.length > 0
        ? `\n\nCitations:\n${sources
            .map((source) => source.data)
            .flat()
            .map(
              (s, i) =>
                `[${i + 1}] ${s.metadata.url.startsWith('file_id://') ? s.metadata.fileName || 'Uploaded File' : s.metadata.url}`,
            )
            .join(`\n`)}`
        : ''
    }`;

    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      try {
        const ta = document.createElement('textarea');
        ta.value = contentToCopy;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setFailed(true);
        setTimeout(() => setFailed(false), 2000);
      }
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : failed ? 'Copy failed' : 'Copy to clipboard'}
      className={cn(
        'p-2 rounded-full transition duration-200',
        copied
          ? 'text-green-500 bg-green-500/10'
          : failed
            ? 'text-red-500 bg-red-500/10'
            : 'text-black/70 dark:text-white/70 hover:bg-light-secondary dark:hover:bg-dark-secondary hover:text-black dark:hover:text-white',
      )}
    >
      {copied ? (
        <Check size={16} />
      ) : failed ? (
        <X size={16} />
      ) : (
        <ClipboardList size={16} />
      )}
    </button>
  );
};

export default Copy;
