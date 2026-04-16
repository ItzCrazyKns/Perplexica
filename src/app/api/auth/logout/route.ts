import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { invalidateSession } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = async (req: NextRequest) => {
  try {
    const auth = await requireAuth(req);

    if (!auth.success) {
      // Not authenticated, just return success to clear cookie
      const response = NextResponse.json({ message: 'Logged out' });
      response.cookies.set('vane_session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
      return response;
    }

    // Invalidate the session in the database
    await invalidateSession(auth.user.sessionId);

    const response = NextResponse.json({ message: 'Logged out' });

    // Clear the cookie
    response.cookies.set('vane_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Logout error:', err);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
};
