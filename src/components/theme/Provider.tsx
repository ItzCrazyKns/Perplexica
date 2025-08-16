'use client';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

const ThemeProviderComponent = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider attribute="class" enableSystem={true} defaultTheme="system">
      {children}
    </ThemeProvider>
  );
};

export default ThemeProviderComponent;
