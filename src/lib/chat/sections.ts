import { Message, Widget } from '@/components/ChatWindow';
import { Block } from '@/lib/types';

export type Section = {
  message: Message;
  widgets: Widget[];
  parsedTextBlocks: string[];
  speechMessage: string;
  thinkingEnded: boolean;
  suggestions?: string[];
};

/* Pure per-message derivation; the provider caches results by message
   identity so a streaming token only rebuilds its own section. */
export const buildSection = (msg: Message): Section => {
  const textBlocks: string[] = [];
  let speechMessage = '';
  let thinkingEnded = false;
  let suggestions: string[] = [];

  const sourceBlocks = msg.responseBlocks.filter(
    (block): block is Block & { type: 'source' } => block.type === 'source',
  );
  const sources = sourceBlocks.flatMap((block) => block.data);

  const widgetBlocks = msg.responseBlocks
    .filter((b) => b.type === 'widget')
    .map((b) => b.data) as Widget[];

  msg.responseBlocks.forEach((block) => {
    if (block.type === 'text') {
      let processedText = block.data;
      const citationRegex = /\[([^\]]+)\]/g;
      const regex = /\[(\d+)\]/g;

      if (processedText.includes('<think>')) {
        const openThinkTag = processedText.match(/<think>/g)?.length || 0;
        const closeThinkTag = processedText.match(/<\/think>/g)?.length || 0;

        if (openThinkTag && !closeThinkTag) {
          processedText += '</think> <a> </a>';
        }
      }

      if (block.data.includes('</think>')) {
        thinkingEnded = true;
      }

      if (sources.length > 0) {
        processedText = processedText.replace(
          citationRegex,
          (_, capturedContent: string) => {
            const numbers = capturedContent
              .split(',')
              .map((numStr) => numStr.trim());

            const linksHtml = numbers
              .map((numStr) => {
                const number = parseInt(numStr);

                if (isNaN(number) || number <= 0) {
                  return `[${numStr}]`;
                }

                const source = sources[number - 1];
                const url = source?.metadata?.url;

                if (url) {
                  return `<citation href="${url}">${numStr}</citation>`;
                } else {
                  return ``;
                }
              })
              .join('');

            return linksHtml;
          },
        );
        speechMessage += block.data.replace(regex, '');
      } else {
        processedText = processedText.replace(regex, '');
        speechMessage += block.data.replace(regex, '');
      }

      textBlocks.push(processedText);
    } else if (block.type === 'suggestion') {
      suggestions = block.data;
    }
  });

  return {
    message: msg,
    parsedTextBlocks: textBlocks,
    speechMessage,
    thinkingEnded,
    suggestions,
    widgets: widgetBlocks,
  };
};
