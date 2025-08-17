'use client';
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'custom';

const ThemeSwitcher = ({ className }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [bg, setBg] = useState<string>('');
  const [accent, setAccent] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    const t = (localStorage.getItem('appTheme') as Theme) || 'dark';
    const b = localStorage.getItem('userBg') || '#0f0f0f';
    const a = localStorage.getItem('userAccent') || '#2563eb';
    setTheme(t);
    setBg(b);
    setAccent(a);
  }, []);

  const apply = (next: Theme, nextBg = bg, nextAccent = accent) => {
    (window as any).__setAppTheme?.(next, nextBg, nextAccent);
    setTheme(next);
    if (next === 'light' || next === 'dark') {
      // Refresh local color inputs from storage so UI shows current defaults
      const b = localStorage.getItem('userBg') || '#0f0f0f';
      const a = localStorage.getItem('userAccent') || '#2563eb';
      setBg(b);
      setAccent(a);
    }
  };

  if (!mounted) return null;

  return (
    <div className={className}>
      <div className="flex gap-2">
        <select
          className="bg-surface text-fg px-3 py-2 rounded-lg border border-surface-2 text-sm"
          value={theme}
          onChange={(e) => apply(e.target.value as Theme)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="custom">Custom</option>
        </select>
        {theme === 'custom' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-foreground/70">Background</label>
            <input
              type="color"
              value={bg}
              onChange={(e) => {
                const v = e.target.value;
                setBg(v);
                apply('custom', v, accent);
              }}
            />
            <label className="text-xs text-foreground/70">Accent</label>
            <input
              type="color"
              value={accent}
              onChange={(e) => {
                const v = e.target.value;
                setAccent(v);
                apply('custom', bg, v);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeSwitcher;
