'use server';

import process from 'process';

export async function getServerEnv(envVar: string): Promise<string> {
  let result: string | undefined;
  switch (envVar) {
      case "BACKEND_API_URL":
          result = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
          break;
      case "BACKEND_WS_URL":
          result = process.env.BACKEND_WS_URL ?? process.env.NEXT_PUBLIC_WS_URL;
          break;
      default:
          result = process.env[envVar];
          break;
  }
  return result ?? "";
}
