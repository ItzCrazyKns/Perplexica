import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.home');
  return {
    title: t('title'),
    description: t('description'),
  };
}

const Home = () => {
  return <ChatWindow />;
};

export default Home;
