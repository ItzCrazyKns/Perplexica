import { NextRequest, NextResponse } from 'next/server';

/*
 * The API has no auth layer, so any website a user visits could fire
 * state-changing requests at a locally running instance. Browsers
 * always attach Origin to cross-origin mutating requests; rejecting
 * a mismatched Origin blocks that class of CSRF while leaving curl
 * and same-origin app traffic untouched.
 */

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function middleware(req: NextRequest) {
  if (!MUTATING_METHODS.has(req.method)) return NextResponse.next();

  const origin = req.headers.get('origin');
  if (!origin || origin === 'null') {
    return origin === 'null'
      ? NextResponse.json(
          { message: 'Cross-origin request rejected.' },
          { status: 403 },
        )
      : NextResponse.next();
  }

  const host = req.headers.get('host');

  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json(
        { message: 'Cross-origin request rejected.' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { message: 'Invalid Origin header.' },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
