import process from 'process';

export async function getServerEnv(envVar: string) {
  return process.env[envVar];
}