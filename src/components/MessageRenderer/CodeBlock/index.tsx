'use client';

import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import darkTheme from './CodeBlockDarkTheme';
import lightTheme from './CodeBlockLightTheme';
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import ts from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import java from 'react-syntax-highlighter/dist/esm/languages/hljs/java';
import c from 'react-syntax-highlighter/dist/esm/languages/hljs/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/hljs/csharp';
import go from 'react-syntax-highlighter/dist/esm/languages/hljs/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/hljs/rust';
import ruby from 'react-syntax-highlighter/dist/esm/languages/hljs/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/hljs/php';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import markdown from 'react-syntax-highlighter/dist/esm/languages/hljs/markdown';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/hljs/kotlin';
import swift from 'react-syntax-highlighter/dist/esm/languages/hljs/swift';

/* Light build: the root import registers all ~190 hljs languages into
   the client bundle. Unregistered languages render unhighlighted. */
const languages: Record<string, any> = {
  javascript: js,
  js,
  jsx: js,
  typescript: ts,
  ts,
  tsx: ts,
  python,
  py: python,
  java,
  c,
  cpp,
  'c++': cpp,
  csharp,
  cs: csharp,
  go,
  golang: go,
  rust,
  rs: rust,
  ruby,
  rb: ruby,
  php,
  bash,
  sh: bash,
  shell: bash,
  zsh: bash,
  json,
  yaml,
  yml: yaml,
  xml,
  html: xml,
  css,
  sql,
  markdown,
  md: markdown,
  kotlin,
  swift,
};

Object.entries(languages).forEach(([name, lang]) =>
  SyntaxHighlighter.registerLanguage(name, lang),
);

const SyntaxHighlighterComponent =
  SyntaxHighlighter as unknown as React.ComponentType<any>;

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
        className="absolute top-2 right-2 p-1"
        onClick={() => {
          navigator.clipboard.writeText(children as string);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <CheckIcon
            size={16}
            className="absolute top-2 right-2 text-black/70 dark:text-white/70"
          />
        ) : (
          <CopyIcon
            size={16}
            className="absolute top-2 right-2 transition duration-200 text-black/70 dark:text-white/70 hover:text-gray-800/70 hover:dark:text-gray-300/70"
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
