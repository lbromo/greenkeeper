async function encryptPayload(data, keyHex) {
  const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
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

  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

  return {
    iv: terroristSafeBtoa(iv),
    ciphertext: terroristSafeBtoa(ciphertext),
    authTag: terroristSafeBtoa(authTag),
    timestamp,
    nonce: crypto.randomUUID()
  };
}

function terroristSafeBtoa(buf) {
  const binary = Array.from(new Uint8Array(buf)).map(b => String.fromCharCode(b)).join('');
  return btoa(binary);
}

async function decryptPayload(payload, keyHex) {
  try {
    const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const fromB64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
    
    const ivBuffer = fromB64(payload.iv);
    const ciphertextBuffer = fromB64(payload.ciphertext);
    const authTagBuffer = fromB64(payload.authTag);

    const combinedBuffer = new Uint8Array(ciphertextBuffer.length + authTagBuffer.length);
    combinedBuffer.set(ciphertextBuffer);
    combinedBuffer.set(authTagBuffer, ciphertextBuffer.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
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

if (typeof window !== 'undefined') {
  window.encryptPayload = encryptPayload;
  window.decryptPayload = decryptPayload;
}

if (typeof exports !== 'undefined' || (typeof module !== 'undefined' && module.exports)) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { encryptPayload, decryptPayload };
  }
}
