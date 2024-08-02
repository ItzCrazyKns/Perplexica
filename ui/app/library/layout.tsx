import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Library - Perplexica',
};

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/config/preferences`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const data = await res.json();

  const { isLibraryEnabled } = data;

  if (!isLibraryEnabled) {
    return (
      <div className="flex flex-row items-center justify-center min-h-screen w-full">
        <p className="text-lg dark:text-white/70 text-black/70">
          Library is disabled
        </p>
      </div>
    );
  }

  return <div>{children}</div>;
};

export default Layout;
