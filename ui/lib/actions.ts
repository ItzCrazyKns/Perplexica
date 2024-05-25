import { Message } from '@/components/ChatWindow';
import { Settings } from '@/types/Settings';

export const getSuggestions = async (chatHistory: Message[]) => {
  const chatModel = localStorage.getItem('chatModel');
  const chatModelProvider = localStorage.getItem('chatModelProvider');

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_history: chatHistory,
      chat_model: chatModel,
      chat_model_provider: chatModelProvider,
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};

export async function getConfig() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/config`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return (await res.json()) as Settings;
}
