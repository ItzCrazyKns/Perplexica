'use client';
import { useEffect, useState } from 'react';

export type AppTheme = 'light' | 'dark' | 'custom';

type Props = {
  children: React.ReactNode;
};

export default function ThemeController({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = (localStorage.getItem('appTheme') as AppTheme) || 'dark';
    const userBg = localStorage.getItem('userBg') || '';
    const userAccent = localStorage.getItem('userAccent') || '';
    applyTheme(savedTheme, userBg, userAccent);
  }, []);

  const applyTheme = (mode: AppTheme, bg?: string, accent?: string) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    if (mode === 'custom') {
      if (bg) {
        root.style.setProperty('--color-bg', normalizeColor(bg));
        // decide foreground based on luminance
        const luminance = getLuminance(bg);
        root.style.setProperty(
          '--color-fg',
          luminance > 0.5 ? '#000000' : '#ffffff',
        );
        // surfaces
        const surface = adjustLightness(bg, luminance > 0.5 ? -0.06 : 0.08);
        const surface2 = adjustLightness(bg, luminance > 0.5 ? -0.1 : 0.12);
        root.style.setProperty('--color-surface', surface);
        root.style.setProperty('--color-surface-2', surface2);
        root.classList.toggle('dark', luminance <= 0.5);
      }
      if (accent) {
        const a600 = normalizeColor(accent);
        const a700 = adjustLightness(a600, -0.1);
        const a500 = adjustLightness(a600, 0.1);
        root.style.setProperty('--color-accent-600', a600);
        root.style.setProperty('--color-accent-700', a700);
        root.style.setProperty('--color-accent-500', a500);
        root.style.setProperty('--color-accent', a600);
        // Map default blue to accent to minimize code changes
        root.style.setProperty('--color-blue-600', a600);
        root.style.setProperty('--color-blue-700', a700);
        root.style.setProperty('--color-blue-500', a500);
        root.style.setProperty('--color-blue-50', adjustLightness(a600, 0.92));
        root.style.setProperty('--color-blue-900', adjustLightness(a600, -0.4));
      }
    } else {
      // Clear any inline custom overrides so stylesheet tokens take effect
      const toClear = [
        '--user-bg',
        '--user-accent',
        '--color-bg',
        '--color-fg',
        '--color-surface',
        '--color-surface-2',
        '--color-accent-600',
        '--color-accent-700',
        '--color-accent-500',
        '--color-accent',
        '--color-blue-600',
        '--color-blue-700',
        '--color-blue-500',
        '--color-blue-50',
        '--color-blue-900',
      ];
      toClear.forEach((name) => root.style.removeProperty(name));
      root.classList.toggle('dark', mode === 'dark');
    }
  };

  useEffect(() => {
    (window as any).__setAppTheme = (
      mode: AppTheme,
      bg?: string,
      accent?: string,
    ) => {
      localStorage.setItem('appTheme', mode);
      if (mode === 'custom') {
        if (bg) localStorage.setItem('userBg', bg);
        if (accent) localStorage.setItem('userAccent', accent);
      }
      applyTheme(mode, bg, accent);
    };
  }, []);

  if (!mounted) return null;
  return <>{children}</>;
}

// helpers
function normalizeColor(c: string): string {
  if (c.startsWith('#') && (c.length === 4 || c.length === 7)) return c;
  try {
    // Attempt to parse rgb(...) or other; create a canvas to normalize
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return c;
    ctx.fillStyle = c;
    const v = ctx.fillStyle as string;
    // convert to hex
    const m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (m) {
      const r = Number(m[1]),
        g = Number(m[2]),
        b = Number(m[3]);
      return rgbToHex(r, g, b);
    }
    return c;
  } catch {
    return c;
  }
}

function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [R, G, B] = [r, g, b].map((v) => {
    const srgb = v / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function adjustLightness(hex: string, delta: number): string {
  // delta in [-1, 1] add to perceived lightness roughly
  const { r, g, b } = hexToRgb(hex);
  // convert to HSL
  let { h, s, l } = rgbToHsl(r, g, b);
  l = Math.max(0, Math.min(1, l + delta));
  const { r: nr, g: ng, b: nb } = hslToRgb(h, s, l);
  return rgbToHex(nr, ng, nb);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
