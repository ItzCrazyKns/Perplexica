// lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client();

console.log('💥 AUTH0_ISSUER_BASE_URL =', process.env.AUTH0_ISSUER_BASE_URL);