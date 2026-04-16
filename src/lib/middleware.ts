import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

// Extract token from cookie or Authorization header
function extractToken(req: NextRequest): string | null {
  const cookieToken = req.cookies.get('vane_session')?.value;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

// Returns { user, error: null } on success, or { user: null, error: Response } on failure
export async function requireAuth(req: NextRequest): Promise<
  | { success: true; user: SessionUser }
  | { success: false; error: NextResponse }
> {
  const token = extractToken(req);

  if (!token) {
    const error = NextResponse.json(
      { message: 'Authentication required' },
      { status: 401 },
    );
    return { success: false, error };
  }

  const user = await verifySession(token);

  if (!user) {
    const error = NextResponse.json(
      { message: 'Invalid or expired session' },
      { status: 401 },
    );
    return { success: false, error };
  }

  return { success: true, user };
}

// Returns { user, error: null } on success, or { user: null, error: Response } on failure
export async function requireAdmin(req: NextRequest): Promise<
  | { success: true; user: SessionUser }
  | { success: false; error: NextResponse }
> {
  const result = await requireAuth(req);

  if (!result.success) {
    return result;
  }

  if (result.user.role !== 'admin') {
    const error = NextResponse.json(
      { message: 'Admin access required' },
      { status: 403 },
    );
    return { success: false, error };
  }

  return result;
}
