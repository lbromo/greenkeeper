import { describe, it, expect } from 'vitest';
import { encryptPayload, decryptPayload } from './crypto.js';
import { webcrypto } from 'crypto';

// Polyfill atob/btoa for the test environment
const atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
const btoa = (bin: string) => Buffer.from(bin, 'binary').toString('base64');

// The exact functions from dashboard/crypto.js (with webcrypto swapped in)
async function browserEncrypt(data: any, keyHex: string) {
  const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = webcrypto.getRandomValues(new Uint8Array(16)); // 16-byte IV
  const timestamp = new Date().toISOString();
  
  const envelope = JSON.stringify({
    content: JSON.stringify(data),
    timestamp: timestamp
  });
  
  const encoder = new TextEncoder();
  const encoded = encoder.encode(envelope);

  const encrypted = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded
  );

  const combined = new Uint8Array(encrypted);
  const ciphertext = combined.slice(0, -16);
  const authTag = combined.slice(-16);

  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    authTag: btoa(String.fromCharCode(...authTag)),
    timestamp,
    nonce: 'test-nonce'
  };
}

async function browserDecrypt(payload: any, keyHex: string) {
  const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
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
  it('should encrypt via Node and decrypt via Web Crypto', async () => {
    const hexKey = 'e8933684ee7166bae1ae66dde587ab667a210dd1434f396560bf6c7098237c5c';
    const originalPayload = { message: 'Hello from Node!', secret: 42 };
    
    const encrypted = encryptPayload(JSON.stringify(originalPayload), hexKey);
    const decryptedWrapper = await browserDecrypt(encrypted, hexKey);
    
    expect(JSON.parse(decryptedWrapper.content)).toEqual(originalPayload);
  });

  it('should encrypt via Web Crypto (PWA) and decrypt via Node (daemon)', async () => {
    const hexKey = 'e8933684ee7166bae1ae66dde587ab667a210dd1434f396560bf6c7098237c5c';
    const originalPayload = { taskId: 'task-123', intent: 1 };

    // 1. Encrypt via Web Crypto (PWA logic)
    const encrypted = await browserEncrypt(originalPayload, hexKey);

    // 2. Decrypt via Node (daemon logic)
    const decryptedPlaintext = decryptPayload(encrypted as any, hexKey);

    // 3. Verify
    expect(JSON.parse(decryptedPlaintext)).toEqual(originalPayload);
  });
});
