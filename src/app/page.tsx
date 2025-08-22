import ChatWindow from '@/components/ChatWindow';
import { ChatProvider } from '@/lib/hooks/useChat';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.home');
  return {
    title: t('title'),
    description: t('description'),
  };
}

const Home = () => {
  return (
    <div>
      <Suspense>
        <ChatProvider>
          <ChatWindow />
        </ChatProvider>
      </Suspense>
    </div>
  );
};

export default Home;
