export const getSuggestions = async (chatHistory: [string, string][]) => {
  const chatTurns = chatHistory.map(([role, content]) => {
    if (role === 'human') {
      return { role: 'user', content };
    } else {
      return { role: 'assistant', content };
    }
  });

  const chatModel = localStorage.getItem('chatModelKey');
  const chatModelProvider = localStorage.getItem('chatModelProviderId');

  const res = await fetch(`/api/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatHistory: chatTurns,
      chatModel: {
        providerId: chatModelProvider,
        key: chatModel,
      },
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};
