import React, { useEffect, useRef } from 'react';
import hljs from 'highlight.js';

const CodeBlock = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ref.current && className?.includes('lang-')) {
      hljs.highlightElement(ref.current);
      // hljs won't reprocess the element unless this attribute is removed
      ref.current.removeAttribute('data-highlighted');
    }
  }, [children, className]);
  return (
    <code className={className} ref={ref}>
      {children}
    </code>
  );
};

export default CodeBlock;
