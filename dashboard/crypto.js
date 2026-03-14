// Robust Base64 to Uint8Array helper
function fromB64(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Robust Uint8Array to Base64 helper
function toB64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function encryptPayload(data, keyStr) {
  // Handles both Hex (64 chars) and Base64
  let keyBuffer;
  if (keyStr.length === 64 && /^[0-9a-fA-F]+$/.test(keyStr)) {
    keyBuffer = new Uint8Array(keyStr.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  } else {
    keyBuffer = fromB64(keyStr);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(16)); 
  const timestamp = new Date().toISOString();
  
  const envelope = JSON.stringify({
    content: JSON.stringify(data),
    timestamp: timestamp
  });
  
  const encoder = new TextEncoder();
  const encoded = encoder.encode(envelope);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded
  );

  const combined = new Uint8Array(encrypted);
  const ciphertext = combined.slice(0, -16);
  const authTag = combined.slice(-16);

  return {
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
    authTag: toB64(authTag),
    timestamp,
    nonce: crypto.randomUUID()
  };
}

async function decryptPayload(payload, keyStr) {
  try {
    // 1. Convert Key (Handles both Hex and Base64)
    let keyBuffer;
    if (keyStr.length === 64 && /^[0-9a-fA-F]+$/.test(keyStr)) {
      keyBuffer = new Uint8Array(keyStr.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    } else {
      keyBuffer = fromB64(keyStr);
    }

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 2. Decode Base64 safely
    const ivBuffer = fromB64(payload.iv);
    const ciphertextBuffer = fromB64(payload.ciphertext);
    const authTagBuffer = fromB64(payload.authTag);

    // 3. Concatenate [ciphertext][authTag] for SubtleCrypto
    const combinedBuffer = new Uint8Array(ciphertextBuffer.length + authTagBuffer.length);
    combinedBuffer.set(ciphertextBuffer);
    combinedBuffer.set(authTagBuffer, ciphertextBuffer.length);

    // 4. Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer, tagLength: 128 },
      cryptoKey,
      combinedBuffer
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch (e) {
    console.error('Decryption error details:', e);
    throw new Error('Decryption failed. Check key or payload format.');
  }
}

if (typeof window !== 'undefined') {
  window.encryptPayload = encryptPayload;
  window.decryptPayload = decryptPayload;
}

if (typeof exports !== 'undefined' || (typeof module !== 'undefined' && module.exports)) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { encryptPayload, decryptPayload };
  }
}
