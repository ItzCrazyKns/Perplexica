import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';

export interface LoadedChat {
  notFound: boolean;
  messages: Message[];
  history: [string, string][];
  files: { fileName: string; fileExtension: string; fileId: string }[];
  sources: string[];
}

export const loadChat = async (chatId: string): Promise<LoadedChat> => {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 404) {
    return {
      notFound: true,
      messages: [],
      history: [],
      files: [],
      sources: [],
    };
  }

  const data = await res.json();

  const messages = data.messages as Message[];

  const history: [string, string][] = [];
  messages.forEach((msg) => {
    history.push(['human', msg.query]);

    const textBlocks = msg.responseBlocks
      .filter(
        (block): block is Block & { type: 'text' } => block.type === 'text',
      )
      .map((block) => block.data)
      .join('\n');

    if (textBlocks) {
      history.push(['assistant', textBlocks]);
    }
  });

  const files = data.chat.files.map((file: any) => {
    return {
      fileName: file.name,
      fileExtension: file.name.split('.').pop(),
      fileId: file.fileId,
    };
  });

  return {
    notFound: false,
    messages,
    history,
    files,
    sources: data.chat.sources,
  };
};
