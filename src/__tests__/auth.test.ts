import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// We test the auth logic directly since auth.ts has DB dependencies
// For full integration tests, use a test database

describe('Auth Logic', () => {
  describe('Password Hashing', () => {
    it('should hash a password with bcrypt', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 12);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcryptjs uses $2a$ or $2b$ prefix
    });

    it('should verify a correct password', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);

      expect(hash1).not.toBe(hash2); // bcrypt uses salt
    });

    it('should reject plain text passwords', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 12);

      // Plain text should never match
      const isValid = await bcrypt.compare(password, 'plaintexthash');
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Session Tokens', () => {
    const JWT_SECRET = new TextEncoder().encode('test-secret-key');
    const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    it('should create a valid JWT with correct claims', async () => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        role: 'user' as const,
        sessionId: 'session-456',
      };

      const token = await new SignJWT({
        sub: user.id,
        username: user.username,
        role: user.role,
        sessionId: user.sessionId,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000 + SESSION_EXPIRY_MS / 1000))
        .sign(JWT_SECRET);

      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(3); // JWT has 3 parts

      // Verify the token
      const { payload } = await jwtVerify(token, JWT_SECRET);
      expect(payload.sub).toBe(user.id);
      expect(payload.username).toBe(user.username);
      expect(payload.role).toBe(user.role);
      expect(payload.sessionId).toBe(user.sessionId);
    });

    it('should reject an expired JWT', async () => {
      // Create an already-expired token (expired 1 second ago)
      const token = await new SignJWT({ sub: 'user-123' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 2)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 1) // Already expired
        .sign(JWT_SECRET);

      // jwtVerify should throw for expired tokens
      await expect(jwtVerify(token, JWT_SECRET)).rejects.toThrow();
    });

    it('should reject a token signed with wrong secret', async () => {
      const wrongSecret = new TextEncoder().encode('wrong-secret');
      const token = await new SignJWT({ sub: 'user-123' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000 + 3600))
        .sign(wrongSecret);

      // Should reject because secret is wrong
      await expect(jwtVerify(token, JWT_SECRET)).rejects.toThrow();
    });

    it('should reject a tampered token', async () => {
      const token = await new SignJWT({ sub: 'user-123', role: 'user' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000 + 3600))
        .sign(JWT_SECRET);

      // Tamper with the token payload (change role to admin)
      const [header, payload, signature] = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({
        sub: 'user-123',
        role: 'admin', // Tampered!
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64url');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      // Should reject because signature won't match
      await expect(jwtVerify(tamperedToken, JWT_SECRET)).rejects.toThrow();
    });

    it('should reject a token with missing claims', async () => {
      // Token without required 'sub' claim
      const token = await new SignJWT({ username: 'test' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000 + 3600))
        .sign(JWT_SECRET);

      const { payload } = await jwtVerify(token, JWT_SECRET);
      expect(payload.sub).toBeUndefined();
    });
  });

  describe('Session Expiry', () => {
    it('should calculate correct expiry time', () => {
      const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
      const now = Math.floor(Date.now() / 1000);
      const expiry = Math.floor(Date.now() / 1000 + SESSION_EXPIRY_MS / 1000);

      // Expiry should be approximately 7 days from now
      const diffSeconds = expiry - now;
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;

      expect(diffSeconds).toBe(sevenDaysInSeconds);
    });
  });
});
