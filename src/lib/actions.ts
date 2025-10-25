import { Message } from '@/components/ChatWindow';

export const getSuggestions = async (
  chatHistory: Message[],
  locale?: string,
) => {
  const chatModel = localStorage.getItem('chatModel');
  const chatModelProvider = localStorage.getItem('chatModelProvider');

  const res = await fetch(`/api/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatHistory: chatHistory,
      chatModel: {
        providerId: chatModelProvider,
        key: chatModel,
      },
      locale,
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};
