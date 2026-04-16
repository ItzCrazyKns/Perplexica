import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createUser, getUserByUsername } from '@/lib/auth';
import db from '@/lib/db';
import { sql } from 'drizzle-orm';
import { users } from '@/lib/db/schema';

// Rate limiting for registration (bcrypt is CPU-intensive)
const registerAttempts = new Map<string, { count: number; resetAt: number }>();
const REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REGISTER_PER_WINDOW = 3;

function checkRegisterRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now();
  const record = registerAttempts.get(ip);

  if (!record || now > record.resetAt) {
    registerAttempts.set(ip, { count: 1, resetAt: now + REGISTER_RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REGISTER_PER_WINDOW - 1 };
  }

  if (record.count >= MAX_REGISTER_PER_WINDOW) {
    return { allowed: false, remaining: 0, retryAfterMs: record.resetAt - now };
  }

  record.count++;
  return { allowed: true, remaining: MAX_REGISTER_PER_WINDOW - record.count };
}

export const runtime = 'nodejs';

const registerSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parse = registerSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { message: 'Invalid request', errors: parse.error.issues },
        { status: 400 },
      );
    }

    const { username, password } = parse.data;

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             || req.headers.get('x-real-ip')
             || 'unknown';
    const rateLimit = checkRegisterRateLimit(ip);

    const headers = {
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Limit': String(MAX_REGISTER_PER_WINDOW),
      ...(rateLimit.retryAfterMs ? { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } : {}),
    };

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers },
      );
    }

    // Check if username already taken
    const existing = await getUserByUsername(username);
    if (existing) {
      return NextResponse.json(
        { message: 'Username already exists' },
        { status: 409 },
      );
    }

    // Check if any users exist (for determining initial role)
    let isFirstUser = false;
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(users);
      isFirstUser = (result[0]?.count ?? 0) === 0;
    } catch {
      isFirstUser = false;
    }

    // Registration disabled after first user exists
    if (!isFirstUser) {
      return NextResponse.json(
        { message: 'Registration is disabled. Please contact your administrator.' },
        { status: 403 },
      );
    }

    // First user must be admin - use transaction to minimize race condition
    try {
      const user = await createUser(username, password, 'admin');
      return NextResponse.json({ user }, { status: 201 });
    } catch (err: any) {
      // Handle race condition: if UNIQUE constraint failed, username was taken
      if (err?.message?.includes('UNIQUE') || err?.code === 'SQLITE_CONSTRAINT') {
        return NextResponse.json(
          { message: 'Username already exists' },
          { status: 409 },
        );
      }
      // Handle race condition: another user was created between check and insert
      const result = await db.select({ count: sql<number>`count(*)` }).from(users);
      if ((result[0]?.count ?? 0) > 1) {
        return NextResponse.json(
          { message: 'Registration is disabled. Please contact your administrator.' },
          { status: 403 },
        );
      }
      throw err;
    }
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
};
