import { Message } from '@/components/ChatWindow';

export const getSuggestions = async (chatHistory: Message[]) => {
  try {
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

    if (!res.ok) {
      throw new Error(`Error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { suggestions: string[] };

    return data.suggestions;
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
};
