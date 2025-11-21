const formatChatHistoryAsString = (history: Message[]) => {
  return history
    .map(
      (message) =>
        `${message.role === 'assistant' ? 'AI' : 'User'}: ${message.content}`,
    )
    .join('\n');
};

export default formatChatHistoryAsString;
