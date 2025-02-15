import { Message } from '@/components/ChatWindow';

export const getSuggestions = async (chatHisory: Message[]) => {
  const chatModel = localStorage.getItem('chatModel');
  const chatModelProvider = localStorage.getItem('chatModelProvider');

  const customOpenAIKey = localStorage.getItem('openAIApiKey');
  const customOpenAIBaseURL = localStorage.getItem('openAIBaseURL');
  const ollamaContextWindow =
    localStorage.getItem('ollamaContextWindow') || '2048';

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatHistory: chatHisory,
      chatModel: {
        provider: chatModelProvider,
        model: chatModel,
        ...(chatModelProvider === 'custom_openai' && {
          customOpenAIKey,
          customOpenAIBaseURL,
        }),
        ...(chatModelProvider === 'ollama' && {
          ollamaContextWindow: parseInt(ollamaContextWindow),
        }),
      },
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};
