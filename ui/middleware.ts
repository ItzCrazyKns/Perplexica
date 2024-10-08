import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const decodeBase64 = (encoded: string): { username: string; password: string } | null => {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');
    if (username && password) {
      return { username, password };
    }
    return null;
  } catch {
    return null;
  }
};

const verifyPassword = (inputPassword: string, storedPassword: string): boolean => {
  return inputPassword === storedPassword;
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Extract cookies from the request
  const cookies = request.headers.get('cookie');
  let authEnabled = false;
  let authUsername = '';
  let authPassword = '';

  if (cookies) {
    const parsedCookies = Object.fromEntries(cookies.split('; ').map(c => c.split('=')));
    authEnabled = parsedCookies['authEnabled'] === 'true';
    authUsername = parsedCookies['authUsername'] || '';
    authPassword = parsedCookies['authPassword'] || '';
  }

  if (authEnabled) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      const headers = new Headers();
      headers.set('WWW-Authenticate', 'Basic realm="Restricted Area"');
      return new NextResponse('Authentication Required', { status: 401, headers });
    }

    const encodedCredentials = authHeader.split(' ')[1];
    const credentials = decodeBase64(encodedCredentials);

    if (
      !credentials ||
      credentials.username !== authUsername ||
      !verifyPassword(credentials.password, authPassword)
    ) {
      const headers = new Headers();
      headers.set('WWW-Authenticate', 'Basic realm="Restricted Area"');
      return new NextResponse('Invalid Credentials', { status: 401, headers });
    }

    // Credentials are valid; allow access
    return response;
  }

  // Authentication not enabled; allow access
  return response;
}

export const config = {
  matcher: '/:path*',
};