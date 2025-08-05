import React, { HTMLProps } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  coldarkDark,
  coldarkCold,
} from 'react-syntax-highlighter/dist/esm/styles/prism';

export const SyntaxHighlightedCode = (props: HTMLProps<HTMLDivElement>) => {
  const isDarkTheme = document.documentElement.classList.contains('dark');
  const language = props.className?.match(/lang-([a-zA-Z0-9_-]+)/)![1];

  return language ? (
    <div className="not-prose">
      <SyntaxHighlighter
        customStyle={{
          margin: 0,
          backgroundColor: isDarkTheme ? '#111111' : '#f3f3ee',
        }}
        language={language}
        style={isDarkTheme ? coldarkDark : coldarkCold}
      >
        {props.children as string}
      </SyntaxHighlighter>
    </div>
  ) : (
    <code className="inline bg-light-100 dark:bg-dark-100 px-2 py-1 rounded-lg text-sm not-prose">
      {props.children}
    </code>
  );
};
