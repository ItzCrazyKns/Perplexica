import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken, NotionTokenError } from './token';

const KEY = 'test-encryption-key-12345';
const PLAINTEXT = 'secret_ntkn_abc123XYZ';

describe('token encryption', () => {
  beforeEach(() => {
    process.env.NOTION_TOKEN_KEY = KEY;
  });

  afterEach(() => {
    delete process.env.NOTION_TOKEN_KEY;
  });

  it('round-trips a token through encrypt and decrypt', () => {
    const stored = encryptToken(PLAINTEXT);

    expect(stored).not.toContain(PLAINTEXT);
    expect(stored.startsWith('v1.')).toBe(true);
    expect(decryptToken(stored)).toBe(PLAINTEXT);
  });

  it('produces different ciphertext on every call (random IV)', () => {
    expect(encryptToken(PLAINTEXT)).not.toBe(encryptToken(PLAINTEXT));
  });

  it('throws a clear error when the encryption key is missing', () => {
    delete process.env.NOTION_TOKEN_KEY;

    expect(() => encryptToken(PLAINTEXT)).toThrow(NotionTokenError);
    expect(() => encryptToken(PLAINTEXT)).toThrowError(/NOTION_TOKEN_KEY/);
  });

  it('fails to decrypt with the wrong key', () => {
    const stored = encryptToken(PLAINTEXT);
    process.env.NOTION_TOKEN_KEY = 'a-completely-different-key';

    expect(() => decryptToken(stored)).toThrow(NotionTokenError);
  });

  it('rejects malformed stored tokens', () => {
    expect(() => decryptToken('garbage')).toThrow(NotionTokenError);
    expect(() => decryptToken('v2.abc.def.ghi')).toThrow(NotionTokenError);
  });
});
