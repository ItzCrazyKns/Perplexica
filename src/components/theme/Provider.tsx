'use client';
import { ThemeProvider } from 'next-themes';

const ThemeProviderComponent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <ThemeProvider attribute="class" enableSystem={false} defaultTheme="dark" themes={['light', 'dark', 'warm']}>
      {children}
    </ThemeProvider>
  );
};

export default ThemeProviderComponent;
