import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/middleware';
import { changePassword } from '@/lib/auth';

export const runtime = 'nodejs';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const POST = async (req: NextRequest) => {
  try {
    const auth = await requireAuth(req);

    if (!auth.success) {
      return auth.error;
    }

    const body = await req.json();
    const parse = passwordSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { message: 'Invalid request', errors: parse.error.issues },
        { status: 400 },
      );
    }

    const result = await changePassword(
      auth.user.id,
      parse.data.currentPassword,
      parse.data.newPassword,
    );

    if (!result.success) {
      return NextResponse.json(
        { message: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
};
