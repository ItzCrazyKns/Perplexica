import type { CSSProperties } from 'react';

const darkTheme = {
  'hljs-comment': {
    color: '#8b949e',
  },
  'hljs-quote': {
    color: '#8b949e',
  },
  'hljs-variable': {
    color: '#ff7b72',
  },
  'hljs-template-variable': {
    color: '#ff7b72',
  },
  'hljs-tag': {
    color: '#ff7b72',
  },
  'hljs-name': {
    color: '#ff7b72',
  },
  'hljs-selector-id': {
    color: '#ff7b72',
  },
  'hljs-selector-class': {
    color: '#ff7b72',
  },
  'hljs-regexp': {
    color: '#ff7b72',
  },
  'hljs-deletion': {
    color: '#ff7b72',
  },
  'hljs-number': {
    color: '#f2cc60',
  },
  'hljs-built_in': {
    color: '#f2cc60',
  },
  'hljs-builtin-name': {
    color: '#f2cc60',
  },
  'hljs-literal': {
    color: '#f2cc60',
  },
  'hljs-type': {
    color: '#f2cc60',
  },
  'hljs-params': {
    color: '#f2cc60',
  },
  'hljs-meta': {
    color: '#f2cc60',
  },
  'hljs-link': {
    color: '#f2cc60',
  },
  'hljs-attribute': {
    color: '#58a6ff',
  },
  'hljs-string': {
    color: '#7ee787',
  },
  'hljs-symbol': {
    color: '#7ee787',
  },
  'hljs-bullet': {
    color: '#7ee787',
  },
  'hljs-addition': {
    color: '#7ee787',
  },
  'hljs-title': {
    color: '#79c0ff',
  },
  'hljs-section': {
    color: '#79c0ff',
  },
  'hljs-keyword': {
    color: '#c297ff',
  },
  'hljs-selector-tag': {
    color: '#c297ff',
  },
  hljs: {
    display: 'block',
    overflowX: 'auto',
    background: '#0d1117',
    color: '#c9d1d9',
    padding: '0.75em',
    border: '1px solid #21262d',
    borderRadius: '10px',
  },
  'hljs-emphasis': {
    fontStyle: 'italic',
  },
  'hljs-strong': {
    fontWeight: 'bold',
  },
} satisfies Record<string, CSSProperties>;

export default darkTheme;
