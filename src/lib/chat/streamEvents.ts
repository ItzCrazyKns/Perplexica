import { Message } from '@/components/ChatWindow';
import { applyPatch } from 'rfc6902';

/*
 * Pure transforms from a stream event to the next messages array.
 * Only the target message gets a new object identity, which the
 * section cache and MessageBox memoization rely on.
 */

const updateMessage = (
  messages: Message[],
  messageId: string,
  update: (msg: Message) => Message,
): Message[] =>
  messages.map((msg) => (msg.messageId === messageId ? update(msg) : msg));

export const upsertBlock = (
  messages: Message[],
  messageId: string,
  block: any,
): Message[] =>
  updateMessage(messages, messageId, (msg) => {
    const exists = msg.responseBlocks.findIndex((b) => b.id === block.id);

    if (exists !== -1) {
      const existingBlocks = [...msg.responseBlocks];
      existingBlocks[exists] = block;
      return { ...msg, responseBlocks: existingBlocks };
    }

    return { ...msg, responseBlocks: [...msg.responseBlocks, block] };
  });

export const appendTextDelta = (
  messages: Message[],
  messageId: string,
  blockId: string,
  delta: string,
): Message[] =>
  updateMessage(messages, messageId, (msg) => ({
    ...msg,
    responseBlocks: msg.responseBlocks.map((block) =>
      block.id === blockId && block.type === 'text'
        ? { ...block, data: block.data + delta }
        : block,
    ),
  }));

export const patchBlock = (
  messages: Message[],
  messageId: string,
  blockId: string,
  patch: any[],
): Message[] =>
  updateMessage(messages, messageId, (msg) => ({
    ...msg,
    responseBlocks: msg.responseBlocks.map((block) => {
      if (block.id === blockId) {
        const updatedBlock = { ...block };
        applyPatch(updatedBlock, patch);
        return updatedBlock;
      }
      return block;
    }),
  }));

export const setMessageStatus = (
  messages: Message[],
  messageId: string,
  status: Message['status'],
): Message[] =>
  updateMessage(messages, messageId, (msg) => ({ ...msg, status }));
