import { Message } from '@/components/ChatWindow';

export const getSuggestions = async (chatHisory: Message[]) => {
  const chatModel = sessionStorage.getItem('chatModel');
  const chatModelProvider = sessionStorage.getItem('chatModelProvider');

  const customOpenAIKey = sessionStorage.getItem('openAIApiKey');
  const customOpenAIBaseURL = sessionStorage.getItem('openAIBaseURL');

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
      },
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};
