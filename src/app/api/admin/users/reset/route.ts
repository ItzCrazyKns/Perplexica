import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/middleware';
import { resetUserPassword } from '@/lib/auth';

export const runtime = 'nodejs';

const resetSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const POST = async (req: NextRequest) => {
  try {
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const body = await req.json();
    const parse = resetSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { message: 'Invalid request', errors: parse.error.issues },
        { status: 400 },
      );
    }

    await resetUserPassword(parse.data.userId, parse.data.newPassword);

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Admin reset password error:', err);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
};
