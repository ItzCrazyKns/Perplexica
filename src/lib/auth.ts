import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { SignJWT, jwtVerify } from 'jose';
import { eq, and, gt, lt } from 'drizzle-orm';
import db from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';

// Ensure JWT_SECRET is set in production
const jwtSecretEnv = process.env.JWT_SECRET;
if (!jwtSecretEnv) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  // Only use fallback in development
  console.warn('WARNING: Using fallback JWT_SECRET in development only. Set JWT_SECRET for production.');
}
const JWT_SECRET = new TextEncoder().encode(
  jwtSecretEnv || 'vane-mu-secret-key-change-in-production-dev-only',
);
export const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface SessionUser extends AuthUser {
  sessionId: string;
}

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify a password
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create a new user (admin only)
export async function createUser(
  username: string,
  password: string,
  role: UserRole = 'user',
): Promise<AuthUser> {
  const id = uuidv4();
  const passwordHash = await hashPassword(password);
  const createdAt = new Date().toISOString();

  await db.insert(users).values({
    id,
    username,
    passwordHash,
    role,
    createdAt,
  });

  return { id, username, role };
}

// Get user by username
export async function getUserByUsername(
  username: string,
): Promise<(AuthUser & { passwordHash: string }) | null> {
  const result = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!result) return null;

  return {
    id: result.id,
    username: result.username,
    role: result.role as UserRole,
    passwordHash: result.passwordHash,
  };
}

// Get user by ID
export async function getUserById(id: string): Promise<AuthUser | null> {
  const result = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!result) return null;

  return {
    id: result.id,
    username: result.username,
    role: result.role as UserRole,
  };
}

// Create a session and return the JWT
export async function createSession(user: AuthUser): Promise<string> {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();
  const createdAt = new Date().toISOString();

  // Store in DB
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
    createdAt,
  });

  // Create JWT
  const token = await new SignJWT({
    sub: user.id,
    username: user.username,
    role: user.role,
    sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000 + SESSION_EXPIRY_MS / 1000))
    .sign(JWT_SECRET);

  return token;
}

// Verify JWT and return the session user
export async function verifySession(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const sessionId = payload.sessionId as string;
    const userId = payload.sub as string;

    // Check session exists and not expired
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        gt(sessions.expiresAt, new Date().toISOString()),
      ),
    });

    if (!session) return null;

    return {
      id: userId,
      username: payload.username as string,
      role: payload.role as UserRole,
      sessionId,
    };
  } catch {
    return null;
  }
}

// Invalidate a session (logout)
export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// Invalidate all sessions for a user
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// List all sessions for a user
export async function listUserSessions(
  userId: string,
): Promise<{ id: string; expiresAt: string; createdAt: string }[]> {
  const result = await db.query.sessions.findMany({
    where: eq(sessions.userId, userId),
  });

  return result.map((s) => ({
    id: s.id,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
  }));
}

// Get all users (admin only)
export async function listUsers(): Promise<AuthUser[]> {
  const result = await db.query.users.findMany();

  return result.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role as UserRole,
  }));
}

// Update user
export async function updateUser(
  id: string,
  data: { username?: string; role?: UserRole },
): Promise<void> {
  // If role is changing, invalidate all existing sessions to force re-authentication
  if (data.role !== undefined) {
    const existingUser = await getUserById(id);
    if (existingUser && existingUser.role !== data.role) {
      await invalidateAllUserSessions(id);
    }
  }
  await db.update(users).set(data).where(eq(users.id, id));
}

// Reset user password (admin only)
export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// Delete user
export async function deleteUser(id: string): Promise<void> {
  // Delete all sessions first
  await db.delete(sessions).where(eq(sessions.userId, id));
  await db.delete(users).where(eq(users.id, id));
}

// Change own password
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUserById(userId);
  if (!user) return { success: false, error: 'User not found' };

  // Get the full user with hash
  const fullUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!fullUser) return { success: false, error: 'User not found' };

  const valid = await verifyPassword(currentPassword, fullUser.passwordHash);
  if (!valid) return { success: false, error: 'Current password is incorrect' };

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  return { success: true };
}

// Clean up expired sessions (call periodically)
export async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date().toISOString();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}
