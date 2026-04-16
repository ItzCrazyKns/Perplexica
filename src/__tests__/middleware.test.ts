import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock the entire auth module since verifySession requires DB
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual('@/lib/auth');
  return {
    ...actual as any,
    verifySession: vi.fn(),
  };
});

import { requireAuth, requireAdmin } from '@/lib/middleware';
import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';

function makeMockRequest(cookie?: string, authHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', `vane_session=${cookie}`);
  if (authHeader) headers.set('authorization', authHeader);

  return new NextRequest('http://localhost/', { headers }) as unknown as NextRequest;
}

describe('Middleware — requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token provided', async () => {
    const req = makeMockRequest();
    const result = await requireAuth(req);

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(401);
    const body = await result.error?.json();
    expect(body.message).toBe('Authentication required');
  });

  it('returns 401 when token is invalid', async () => {
    vi.mocked(verifySession).mockResolvedValue(null);

    const req = makeMockRequest('invalid-token');
    const result = await requireAuth(req);

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(401);
    const body = await result.error?.json();
    expect(body.message).toBe('Invalid or expired session');
  });

  it('returns user when token is valid', async () => {
    const mockUser = { id: 'user-123', username: 'test', role: 'user', sessionId: 'sess-456' };
    vi.mocked(verifySession).mockResolvedValue(mockUser);

    const req = makeMockRequest('valid-token');
    const result = await requireAuth(req);

    expect(result.success).toBe(true);
    expect(result.user).toEqual(mockUser);
  });

  it('accepts Bearer token from Authorization header', async () => {
    const mockUser = { id: 'user-123', username: 'test', role: 'user', sessionId: 'sess-456' };
    vi.mocked(verifySession).mockResolvedValue(mockUser);

    const req = makeMockRequest(undefined, 'Bearer my-jwt-token');
    const result = await requireAuth(req);

    expect(result.success).toBe(true);
    expect(verifySession).toHaveBeenCalledWith('my-jwt-token');
  });
});

describe('Middleware — requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token (delegates to requireAuth)', async () => {
    const req = makeMockRequest();
    const result = await requireAdmin(req);

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    vi.mocked(verifySession).mockResolvedValue(null);

    const req = makeMockRequest('invalid-token');
    const result = await requireAdmin(req);

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    const nonAdminUser = { id: 'user-123', username: 'test', role: 'user', sessionId: 'sess-456' };
    vi.mocked(verifySession).mockResolvedValue(nonAdminUser);

    const req = makeMockRequest('valid-user-token');
    const result = await requireAdmin(req);

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(403);
    const body = await result.error?.json();
    expect(body.message).toBe('Admin access required');
  });

  it('returns user when admin token is valid', async () => {
    const adminUser = { id: 'admin-123', username: 'admin', role: 'admin', sessionId: 'sess-789' };
    vi.mocked(verifySession).mockResolvedValue(adminUser);

    const req = makeMockRequest('valid-admin-token');
    const result = await requireAdmin(req);

    expect(result.success).toBe(true);
    expect(result.user?.role).toBe('admin');
  });
});
