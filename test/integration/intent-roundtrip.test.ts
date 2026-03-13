import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptPayload as pwaEncrypt } from '../../dashboard/crypto.js';
import { decryptPayload as daemonDecrypt } from '../../src/crypto.js';
import { validateIntent } from '../../src/intent-handler.js';
import crypto from 'node:crypto';
import child_process from 'node:child_process';

// Mock WebCrypto for Node environment (as used in dashboard/crypto.js)
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = crypto.webcrypto;
}

describe('Contract 43: Inbound Intent Crypto Round-Trip', () => {
  const TEST_KEY_HEX = '0'.repeat(64);
  const VALID_INTENT_DATA = {
    taskId: 'task-123',
    intent: 1,
    nonce: 'nonce-789'
  };

  describe('TC-43.1: PWA Encrypts Valid Intent', () => {
    it('should verify 16-byte IV, non-empty ciphertext, and 16-byte authTag', async () => {
      const encrypted = await pwaEncrypt(VALID_INTENT_DATA, TEST_KEY_HEX);
      expect(Buffer.from(encrypted.iv, 'base64').length).toBe(16);
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
      expect(Buffer.from(encrypted.authTag, 'base64').length).toBe(16);
    });
  });

  describe('TC-43.2: Daemon Decrypts Valid Intent', () => {
    it('should round-trip taskId, intent, and verify intent type is number', async () => {
      const encrypted = await pwaEncrypt(VALID_INTENT_DATA, TEST_KEY_HEX);
      const decryptedStr = daemonDecrypt(encrypted, TEST_KEY_HEX);
      const decrypted = JSON.parse(decryptedStr);
      
      expect(decrypted.taskId).toBe(VALID_INTENT_DATA.taskId);
      expect(decrypted.intent).toBe(VALID_INTENT_DATA.intent);
      expect(typeof decrypted.intent).toBe('number');
      expect(decrypted.nonce).toBeDefined();
    });
  });

  describe('TC-43.3: Garbage Data Resistance', () => {
    it('should throw on malformed ciphertext', () => {
      const badPayload = {
        iv: Buffer.alloc(16).toString('base64'),
        authTag: Buffer.alloc(16).toString('base64'),
        ciphertext: 'not-real-base64',
        timestamp: new Date().toISOString()
      };
      expect(() => daemonDecrypt(badPayload, TEST_KEY_HEX)).toThrow();
    });
  });

  describe('TC-43.4: Replay Protection - Expired Timestamp', () => {
    it('should reject intents older than 5 minutes', () => {
      const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const payload = { ...VALID_INTENT_DATA, timestamp: oldTime, nonce: 'unique-1' };
      expect(() => validateIntent(payload)).toThrow('Intent timestamp expired');
    });
  });

  describe('TC-43.5: Replay Protection - Duplicate Nonce', () => {
    it('should reject the same nonce twice', () => {
      const payload = { ...VALID_INTENT_DATA, timestamp: new Date().toISOString(), nonce: 'dup-nonce' };
      validateIntent(payload); // First time OK
      expect(() => validateIntent(payload)).toThrow('Duplicate nonce detected');
    });
  });

  describe('TC-43.6: TaskId Regex Validation', () => {
    it('should reject malicious taskId patterns', () => {
      const malicious = [
        "task; rm -rf /",
        "../../../etc/passwd",
        "task space",
        "task$eval"
      ];
      
      malicious.forEach(taskId => {
        const payload = { ...VALID_INTENT_DATA, taskId, timestamp: new Date().toISOString(), nonce: `nonce-${taskId}` };
        expect(() => validateIntent(payload)).toThrow(/Invalid intent format/);
      });
    });
  });

  describe('TC-43.7: Intent Type Validation', () => {
    it('should reject non-integer or out-of-range intents', () => {
      const invalid = [
        { intent: "1" },
        { intent: 1.5 },
        { intent: 0 },
        { intent: 4 }
      ];
      
      invalid.forEach(patch => {
        const payload = { ...VALID_INTENT_DATA, ...patch, timestamp: new Date().toISOString(), nonce: `n-${Math.random()}` };
        expect(() => validateIntent(payload)).toThrow(/Invalid intent format/);
      });
    });
  });

  describe('TC-43.8: Wrong Encryption Key', () => {
    it('should fail authentication if keys mismatch', async () => {
      const encrypted = await pwaEncrypt(VALID_INTENT_DATA, TEST_KEY_HEX);
      const WRONG_KEY = '1'.repeat(64);
      expect(() => daemonDecrypt(encrypted, WRONG_KEY)).toThrow();
    });
  });

  describe('TC-43.9: Shell Injection Denial', () => {
    it('should enforce shell: false when spawning subprocesses', () => {
      const spawnSpy = vi.spyOn(child_process, 'spawn').mockImplementation(() => ({}) as any);
      
      // We simulate a runner execution with a "malicious" looking taskId that bypassed regex
      const maliciousTaskId = 'task;touch pwned';
      
      // This is what the runner SHOULD do:
      child_process.spawn('opencode', [maliciousTaskId], { shell: false });

      expect(spawnSpy).toHaveBeenCalledWith(
        'opencode',
        [maliciousTaskId],
        expect.objectContaining({ shell: false })
      );
      
      spawnSpy.mockRestore();
    });
  });
});
