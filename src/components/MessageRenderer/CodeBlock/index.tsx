'use client';

import { CheckIcon, CopyIcon, XIcon } from '@phosphor-icons/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import SyntaxHighlighter from 'react-syntax-highlighter';
import darkTheme from './CodeBlockDarkTheme';
import lightTheme from './CodeBlockLightTheme';

const SyntaxHighlighterComponent =
  SyntaxHighlighter as unknown as React.ComponentType<any>;

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
};

const CodeBlock = ({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syntaxTheme = useMemo(() => {
    if (!mounted) return lightTheme;
    return resolvedTheme === 'dark' ? darkTheme : lightTheme;
  }, [mounted, resolvedTheme]);

  return (
    <div className="relative">
      <button
        className="absolute top-2 right-2 p-1.5 rounded-md z-10 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition duration-200"
        onClick={async () => {
          const ok = await copyToClipboard(children as string);
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } else {
            setFailed(true);
            setTimeout(() => setFailed(false), 2000);
          }
        }}
        title={copied ? 'Copied!' : failed ? 'Copy failed' : 'Copy code'}
      >
        {copied ? (
          <CheckIcon
            size={16}
            className="text-green-500"
          />
        ) : failed ? (
          <XIcon
            size={16}
            className="text-red-500"
          />
        ) : (
          <CopyIcon
            size={16}
            className="transition duration-200 text-black/70 dark:text-white/70"
          />
        )}
      </button>
      <SyntaxHighlighterComponent
        language={language}
        style={syntaxTheme}
        showInlineLineNumbers
      >
        {children as string}
      </SyntaxHighlighterComponent>
    </div>
  );
};

export default CodeBlock;
