import { describe, it, expect } from 'vitest';
import { encryptPayload } from './crypto';
import { webcrypto } from 'crypto';

// Polyfill atob for the test environment
const atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');

// The exact function from dashboard/index.html (with webcrypto swapped in)
async function decryptPayload(payload: any, keyBase64: string) {
  try {
    const keyBuffer = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const ivBuffer = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
    const ciphertextBuffer = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
    const authTagBuffer = Uint8Array.from(atob(payload.authTag), c => c.charCodeAt(0));

    const combinedBuffer = new Uint8Array(ciphertextBuffer.length + authTagBuffer.length);
    combinedBuffer.set(ciphertextBuffer);
    combinedBuffer.set(authTagBuffer, ciphertextBuffer.length);

    const decryptedBuffer = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      cryptoKey,
      combinedBuffer
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch (e) {
    throw new Error('Decryption failed. Check key or payload format.');
  }
}

describe('End-to-End Crypto', () => {
  it('should encrypt via Node and decrypt via Web Crypto using Base64 key', async () => {
    // Generate a valid 32-byte key in Base64
    const validKeyBuffer = require('crypto').randomBytes(32);
    const validBase64Key = validKeyBuffer.toString('base64');
    
    const originalPayload = { message: 'Hello from Node!', secret: 42 };

    // 1. Encrypt using the daemon's logic
    const encrypted = encryptPayload(JSON.stringify(originalPayload), validBase64Key);

    // 2. Decrypt using the browser's logic
    const decryptedWrapper = await decryptPayload(encrypted, validBase64Key);
    const decryptedPayload = JSON.parse(decryptedWrapper.content);

    // 3. Assert they match perfectly
    expect(decryptedPayload).toEqual(originalPayload);
  });
});
