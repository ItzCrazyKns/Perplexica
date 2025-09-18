import ChatWindow from '@/components/ChatWindow';
import FirecrawlToggle from '@/components/FirecrawlToggle';
import { ChatProvider } from '@/lib/hooks/useChat';
import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Chat - Perplexica',
  description: 'Chat with the internet, chat with Perplexica.',
};

const Home = () => {
  return (
    <div>
      <FirecrawlToggle />
      <Suspense>
        <ChatProvider>
          <ChatWindow />
        </ChatProvider>
      </Suspense>
    </div>
  );
};

export default Home;
