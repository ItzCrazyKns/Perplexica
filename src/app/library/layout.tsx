import { Metadata } from 'next';
import React from 'react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.library');
  return {
    title: `${t('title')} - Perplexica`,
  };
}

const Layout = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

export default Layout;
