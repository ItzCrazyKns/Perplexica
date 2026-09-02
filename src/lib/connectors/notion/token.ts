import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

/**
 * Encrypts and decrypts the Notion access token at rest.
 *
 * The encryption key comes from the NOTION_TOKEN_KEY env var; the token
 * itself is never stored in env files, code, or logs (see ADR-0002).
 * Storage format is versioned: `v1.<iv>.<authTag>.<ciphertext>` (base64).
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_ENV = 'NOTION_TOKEN_KEY';
const SALT = 'vane-notion-connector-v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = 'v1';

export class NotionTokenError extends Error {}

function getKey(): Buffer {
  const secret = process.env[KEY_ENV];
  if (!secret || secret.length === 0) {
    throw new NotionTokenError(
      `Encryption key ${KEY_ENV} is not set; set it before connecting Notion`,
    );
  }
  return scryptSync(secret, SALT, KEY_BYTES);
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decryptToken(stored: string): string {
  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new NotionTokenError('Malformed encrypted token');
  }

  const [, ivB64, authTagB64, dataB64] = parts;

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    if (err instanceof NotionTokenError) throw err;
    throw new NotionTokenError(
      'Failed to decrypt token (wrong key or corrupt data)',
    );
  }
}
