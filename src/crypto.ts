import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
  timestamp: string;
}

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

export function encryptPayload(plaintext: string, key: string): EncryptedPayload {
  if (key.length !== KEY_LENGTH) {
    throw new CryptoError(`Encryption key must be exactly ${KEY_LENGTH} bytes`);
  }
  
  const keyBuffer = Buffer.from(key, 'utf-8');
  const iv = randomBytes(IV_LENGTH);
  const timestamp = new Date().toISOString();
  
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  
  const payloadWithTimestamp = JSON.stringify({
    content: plaintext,
    timestamp
  });
  
  const ciphertext = Buffer.concat([
    cipher.update(payloadWithTimestamp, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    timestamp
  };
}

export function decryptPayload(payload: EncryptedPayload, key: string): string {
  if (key.length !== KEY_LENGTH) {
    throw new CryptoError(`Encryption key must be exactly ${KEY_LENGTH} bytes`);
  }
  
  const keyBuffer = Buffer.from(key, 'utf-8');
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  
  const parsed = JSON.parse(decrypted.toString('utf8')) as { content: string; timestamp: string };
  
  return parsed.content;
}
