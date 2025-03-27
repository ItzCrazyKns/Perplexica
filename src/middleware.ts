import { auth0 } from './lib/auth0';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


export async function middleware(request: NextRequest) {
  const res = await auth0.getSession(request);

  if (!res) {
    // not logged in, redirect to Auth0 login
    return Response.redirect(
      new URL('/auth/login', request.url),
      302
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - public files (_next, images, icons, etc.)
     * - auth routes like /auth/login and /auth/callback
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/.*).*)',
  ],
};