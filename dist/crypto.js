import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
export class CryptoError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CryptoError';
    }
}
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
export function encryptPayload(plaintext, key) {
    const keyBuffer = key.length === KEY_LENGTH * 2
        ? Buffer.from(key, 'hex')
        : Buffer.from(key, 'base64');
    if (keyBuffer.length !== KEY_LENGTH) {
        throw new CryptoError(`Encryption key must be exactly ${KEY_LENGTH} bytes (64 hex chars or ~44 base64 chars)`);
    }
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
export function decryptPayload(payload, key) {
    const keyBuffer = key.length === KEY_LENGTH * 2
        ? Buffer.from(key, 'hex')
        : Buffer.from(key, 'base64');
    if (keyBuffer.length !== KEY_LENGTH) {
        throw new CryptoError(`Encryption key must be exactly ${KEY_LENGTH} bytes (64 hex chars or ~44 base64 chars)`);
    }
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);
    const parsed = JSON.parse(decrypted.toString('utf8'));
    return parsed.content;
}
//# sourceMappingURL=crypto.js.map