import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedPayload {
  encrypted: Buffer;   // IV + ciphertext + authTag
  fileKey: string;     // hex-encoded encryption key (given to user, never stored)
}

// Encrypt data with a random per-file key
export function encryptBuffer(data: Buffer): EncryptedPayload {
  const key = randomBytes(KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: IV (16) + authTag (16) + ciphertext
  const encrypted = Buffer.concat([iv, authTag, ciphertext]);

  return {
    encrypted,
    fileKey: key.toString('hex'),
  };
}

// Decrypt data using the per-file key
export function decryptBuffer(encrypted: Buffer, fileKeyHex: string): Buffer {
  const key = Buffer.from(fileKeyHex, 'hex');

  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
