export const getSuggestions = async (chatHistory: [string, string][]) => {
  const chatModel = localStorage.getItem('chatModelKey');
  const chatModelProvider = localStorage.getItem('chatModelProviderId');

  const res = await fetch(`/api/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatHistory,
      chatModel: {
        providerId: chatModelProvider,
        key: chatModel,
      },
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};

export const getApproxLocation = async () => {
  const res = await fetch('https://free.freeipapi.com/api/json', {
    method: 'GET',
  });

  const data = await res.json();

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    city: data.cityName,
  };
};
