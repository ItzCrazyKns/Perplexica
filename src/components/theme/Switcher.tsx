'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import Select from '../ui/Select';

type Theme = 'dark' | 'light' | 'system';

const ThemeSwitcher = ({ className }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid Hydration Mismatch
  if (!mounted) {
    return null;
  }

  return (
    <Select
      className={className}
      value={theme}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => setTheme(e.target.value as Theme)}
      options={[
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
    />
  );
};

export default ThemeSwitcher;
