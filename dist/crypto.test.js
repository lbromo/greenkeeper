import { describe, it, expect } from 'vitest';
import { encryptPayload, decryptPayload, CryptoError } from './crypto.js';
const TEST_KEY = '3132333435363738393031323334353637383930313233343536373839303132'; // 32 bytes in hex
describe('Contract 8: Crypto Layer Initialization', () => {
    describe('TC-8.1: Different IVs for identical plaintexts', () => {
        it('should produce different ciphertexts for same plaintext', () => {
            const plaintext = 'Hello World';
            const key = TEST_KEY;
            const result1 = encryptPayload(plaintext, key);
            const result2 = encryptPayload(plaintext, key);
            expect(result1.ciphertext).not.toBe(result2.ciphertext);
        });
    });
    describe('TC-8.2: Ciphertext includes authentication tag', () => {
        it('should include auth tag in output', () => {
            const result = encryptPayload('Test message', TEST_KEY);
            expect(result.authTag).toBeDefined();
            expect(result.authTag.length).toBeGreaterThan(0);
        });
    });
    describe('TC-8.3: Invalid key length', () => {
        it('should reject key that is not 32 bytes', () => {
            expect(() => encryptPayload('test', 'shortkey')).toThrow(CryptoError);
        });
    });
    describe('Decryption', () => {
        it('should decrypt encrypted payload correctly', () => {
            const original = 'Secret message';
            const encrypted = encryptPayload(original, TEST_KEY);
            const decrypted = decryptPayload(encrypted, TEST_KEY);
            expect(decrypted).toBe(original);
        });
    });
});
//# sourceMappingURL=crypto.test.js.map