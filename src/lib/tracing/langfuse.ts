// Centralized Langfuse tracing utility
// Provides a singleton CallbackHandler and a helper to attach callbacks

import type { Callbacks } from '@langchain/core/callbacks/manager';
import { CallbackHandler } from 'langfuse-langchain';

let handler: CallbackHandler | null = null;

export function getLangfuseHandler(): CallbackHandler | null {
  // Only initialize on server
  if (typeof window !== 'undefined') return null;

  if (handler) return handler;

  try {
    // The handler reads LANGFUSE_* env vars by default. You can also pass keys here if desired.
    handler = new CallbackHandler({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    });
  } catch (e) {
    // If initialization fails (e.g., missing envs), disable tracing gracefully
    handler = null;
  }

  return handler;
}

// Convenience helper to spread into LangChain invoke/config objects
export function getLangfuseCallbacks(): { callbacks?: Callbacks } {
  const h = getLangfuseHandler();
  return h ? { callbacks: [h] } : {};
}
