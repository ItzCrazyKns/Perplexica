import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/middleware';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
  UserRole,
} from '@/lib/auth';

export const runtime = 'nodejs';

const createUserSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'user']),
});

const updateUserSchema = z.object({
  username: z.string().min(2).optional(),
  role: z.enum(['admin', 'user']).optional(),
});

export const GET = async (req: NextRequest) => {
  try {
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const users = await listUsers();

    return NextResponse.json({ users });
  } catch (err) {
    console.error('Admin list users error:', err);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const body = await req.json();
    const parse = createUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { message: 'Invalid request', errors: parse.error.issues },
        { status: 400 },
      );
    }

    const user = await createUser(
      parse.data.username,
      parse.data.password,
      parse.data.role as UserRole,
    );

    return NextResponse.json({ user }, { status: 201 });
  } catch (err: any) {
    console.error('Admin create user error:', err);
    if (err?.message?.includes('UNIQUE')) {
      return NextResponse.json(
        { message: 'Username already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
};

export const PUT = async (req: NextRequest) => {
  try {
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    if (userId === auth.user.id) {
      return NextResponse.json(
        { message: 'Cannot modify your own admin role' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parse = updateUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { message: 'Invalid request', errors: parse.error.issues },
        { status: 400 },
      );
    }

    if (!parse.data.username && !parse.data.role) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await getUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    await updateUser(userId, parse.data);

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (err: any) {
    console.error('Admin update user error:', err);
    if (err?.message?.includes('UNIQUE')) {
      return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
};

export const DELETE = async (req: NextRequest) => {
  try {
    const auth = await requireAdmin(req);
    if (!auth.success) return auth.error;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    if (userId === auth.user.id) {
      return NextResponse.json({ message: 'Cannot delete yourself' }, { status: 403 });
    }

    // Verify target user exists
    const targetUser = await getUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    await deleteUser(userId);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
};
