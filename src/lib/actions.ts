import { Message } from '@/components/ChatWindow';

export const getSuggestions = async (chatHisory: Message[]) => {
  const chatModel = localStorage.getItem('chatModel');
  const chatModelProvider = localStorage.getItem('chatModelProvider');

  const customOpenAIKey = localStorage.getItem('openAIApiKey');
  const customOpenAIBaseURL = localStorage.getItem('openAIBaseURL');
  const ollamaContextWindow =
    localStorage.getItem('ollamaContextWindow') || '2048';

  // Get selected system prompt IDs from localStorage
  const storedPromptIds = localStorage.getItem('selectedSystemPromptIds');
  let selectedSystemPromptIds: string[] = [];
  if (storedPromptIds) {
    try {
      selectedSystemPromptIds = JSON.parse(storedPromptIds);
    } catch (e) {
      console.error(
        'Failed to parse selectedSystemPromptIds from localStorage',
        e,
      );
    }
  }

  const res = await fetch(`/api/suggestions`, {
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
      selectedSystemPromptIds: selectedSystemPromptIds,
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};
