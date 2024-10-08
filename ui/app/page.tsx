import ChatWindow from '@/components/ChatWindow';
import AuthSettingsHandler from '@/components/AuthSettingsHandler';
import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Chat - Perplexica',
  description: 'Chat with the internet, chat with Perplexica.',
};

export default function Home() {
  return (
    <div>
      <AuthSettingsHandler />
      <Suspense>
        <ChatWindow />
      </Suspense>
    </div>
  );
}