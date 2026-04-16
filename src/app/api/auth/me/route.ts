import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';

export const runtime = 'nodejs';

export const GET = async (req: NextRequest) => {
  try {
    const auth = await requireAuth(req);

    if (!auth.success) {
      return auth.error;
    }

    return NextResponse.json({
      user: {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      },
    });
  } catch (err) {
    console.error('Auth check error:', err);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
};
