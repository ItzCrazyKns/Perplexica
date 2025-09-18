"use client";

import { useEffect, useState } from 'react';

const FirecrawlToggle = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('useFirecrawl');
    if (stored === null) {
      localStorage.setItem('useFirecrawl', 'true');
      setEnabled(true);
    } else {
      setEnabled(stored === 'true');
    }
  }, []);

  const onToggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem('useFirecrawl', next ? 'true' : 'false');
  };

  return (
    <div className="fixed top-3 right-3 z-40 flex items-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 backdrop-blur px-3 py-2 text-sm">
      <label htmlFor="toggle-firecrawl" className="select-none">
        Use Firecrawl
      </label>
      <button
        id="toggle-firecrawl"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
};

export default FirecrawlToggle;

