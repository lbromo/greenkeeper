import { describe, it, expect } from 'vitest';
import { encryptPayload } from './crypto';
import { webcrypto } from 'crypto';

// Polyfill atob for the test environment
const atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');

// The exact function from dashboard/index.html (with webcrypto swapped in)
async function browserDecrypt(payload: any, keyBase64: string) {
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
}

describe('End-to-End Crypto', () => {
  it('should encrypt via Node and decrypt via Web Crypto using Base64 key', async () => {
    const validBase64Key = require('crypto').randomBytes(32).toString('base64');
    const originalPayload = { message: 'Hello from Node!', secret: 42 };
    const encrypted = encryptPayload(JSON.stringify(originalPayload), validBase64Key);
    const decryptedWrapper = await browserDecrypt(encrypted, validBase64Key);
    const decryptedPayload = JSON.parse(decryptedWrapper.content);
    expect(decryptedPayload).toEqual(originalPayload);
  });

  it('should encrypt via Node (hex key) and decrypt via Web Crypto (base64 of same bytes)', async () => {
    // This is the ACTUAL key from the .env file
    const hexKey = 'e8933684ee7166bae1ae66dde587ab667a210dd1434f396560bf6c7098237c5c';
    const originalPayload = { message: 'Real integration test!', secret: 99 };

    // Node daemon encrypts with the hex key
    const encrypted = encryptPayload(JSON.stringify(originalPayload), hexKey);

    // Browser needs the SAME 32 bytes, but as base64 (since atob decodes base64)
    const base64Key = Buffer.from(hexKey, 'hex').toString('base64');
    console.log('Base64 key for browser:', base64Key);

    const decryptedWrapper = await browserDecrypt(encrypted, base64Key);
    const decryptedPayload = JSON.parse(decryptedWrapper.content);
    expect(decryptedPayload).toEqual(originalPayload);
  });
});
