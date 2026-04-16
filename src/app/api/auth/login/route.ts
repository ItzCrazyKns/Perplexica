import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByUsername, verifyPassword, createSession, hashPassword } from '@/lib/auth';
import { SESSION_EXPIRY_MS } from '@/lib/auth';

// Hardcoded dummy hash to equalize response time when user not found
// This prevents timing attacks that can enumerate valid usernames
const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FRDfjl2jtTjLHC';

// Rate limiting state (in production, use Redis or similar)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 5;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS_PER_WINDOW - 1 };
  }

  if (record.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, retryAfterMs: record.resetAt - now };
  }

  record.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS_PER_WINDOW - record.count };
}

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const runtime = 'nodejs';

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parse = loginSchema.safeParse(body);

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
    const rateLimit = checkRateLimit(ip);

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Limit': String(MAX_ATTEMPTS_PER_WINDOW),
      ...(rateLimit.retryAfterMs ? { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } : {}),
    };

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many login attempts. Please try again later.' },
        { status: 429, headers },
      );
    }

    const user = await getUserByUsername(username);

    if (!user) {
      // Dummy password comparison to equalize response time (prevents timing attack)
      await verifyPassword(password, DUMMY_HASH);
      return NextResponse.json(
        { message: 'Invalid username or password' },
        { status: 401, headers },
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json(
        { message: 'Invalid username or password' },
        { status: 401 },
      );
    }

    const token = await createSession({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });

    // Set HTTP-only cookie — maxAge aligned with JWT expiry (7 days)
    response.cookies.set('vane_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.floor(SESSION_EXPIRY_MS / 1000), // 7 days in seconds
      path: '/',
    });

    // Clear rate limit on successful login
    loginAttempts.delete(ip);

    return response;

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
};
