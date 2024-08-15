import ChatWindow from '@/components/ChatWindow';
import { FC } from 'react';
import process from 'process';
import { GetServerSideProps } from 'next';

interface PageProps {
  backendApiUrl: string;
  params: {
    chatId: string;
  };
}

export async function getServerSideProps(context): GetServerSideProps<PageProps> {
  const backendApiUrl = process.env.BACKEND_API_URL;
  const { chatId } = context.params || {};

  return {
    props: {
      backendApiUrl,
      params: {
        chatId: chatId || '',
      },
    },
  };
}

const Page: FC<PageProps> = ({ params, backendApiUrl }) => {
  return <ChatWindow id={params.chatId} backendApiUrl={backendApiUrl} />;
};

export default Page;
