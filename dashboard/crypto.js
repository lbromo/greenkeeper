async function encryptPayload(data, keyHex) {
  const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(16)); // BUG 1: Use 16-byte IV
  const timestamp = new Date().toISOString();
  
  // BUG 2: Wrap data in { content, timestamp } envelope
  const envelope = JSON.stringify({
    content: JSON.stringify(data),
    timestamp: timestamp
  });
  
  const encoder = new TextEncoder();
  const encoded = encoder.encode(envelope);

  const encrypted = await window.crypto.subtle.encrypt(
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
    nonce: window.crypto.randomUUID()
  };
}

async function decryptPayload(payload, keyHex) {
  try {
    const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    const cryptoKey = await window.crypto.subtle.importKey(
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

    const decryptedBuffer = await window.crypto.subtle.decrypt(
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
