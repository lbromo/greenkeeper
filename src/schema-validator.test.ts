import { describe, it, expect } from 'vitest';
import { validateSchema } from './schema-validator.js';

const MAX_FILE_SIZE = 1024 * 1024;
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

describe('Contract 19: File Validation & Schema Enforcement', () => {
  describe('TC-19.1: Malicious JSON Injection', () => {
    it('should reject schema validation for missing required fields', () => {
      const maliciousPayload = JSON.stringify({
        messages: [{ id: "'; DROP TABLE--"}]
      });
      const result = validateSchema(maliciousPayload);
      expect(result.valid).toBe(false);
    });
  });

  describe('TC-19.2: Oversized File Attack', () => {
    it('should reject files larger than 1MB before parsing', () => {
      const oversizedPayload = '{ "test": "' + 'x'.repeat(1024 * 1024) + '" }';
      const result = validateSchema(oversizedPayload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size exceeds 1MB limit');
    });
  });

  describe('TC-19.3: Timestamp Replay Attack', () => {
    it('should reject files with timestamp older than 5 minutes', () => {
      const staleTimestamp = new Date(Date.now() - MAX_TIMESTAMP_AGE_MS - 60000).toISOString();
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: staleTimestamp,
        messages: [{
          id: '1',
          sender: 'Test User',
          preview: 'Test message',
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(false);
      expect(result.error?.toLowerCase()).toContain('timestamp');
    });
  });

  describe('TC-19.4: Malformed JSON', () => {
    it('should catch JSON parse errors', () => {
      const malformedJson = '{ "source": "power_automate", "messages": [';
      const result = validateSchema(malformedJson);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('JSON');
    });
  });

  describe('TC-19.5: Field Length Overflow', () => {
    it('should reject message.preview exceeding 5000 characters', () => {
      const longPreview = 'x'.repeat(5001);
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: '1',
          sender: 'Test User',
          preview: longPreview,
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('preview');
    });

    it('should reject message.id exceeding 128 characters', () => {
      const longId = 'x'.repeat(129);
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: longId,
          sender: 'Test User',
          preview: 'Short preview',
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('id');
    });

    it('should reject message.sender exceeding 100 characters', () => {
      const longSender = 'x'.repeat(101);
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: '1',
          sender: longSender,
          preview: 'Short preview',
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sender');
    });
  });

  describe('TC-19.6: Missing Required Field', () => {
    it('should reject message missing sender field', () => {
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: '1',
          preview: 'Test message',
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sender');
    });

    it('should reject message missing id field', () => {
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          sender: 'Test User',
          preview: 'Test message',
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('id');
    });

    it('should reject message missing preview field', () => {
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: '1',
          sender: 'Test User',
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('preview');
    });
  });

  describe('Valid Payload Acceptance', () => {
    it('should accept valid payload within all constraints', () => {
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: 'msg-123',
          sender: 'John Doe',
          preview: 'Hello world',
          received_at: new Date().toISOString(),
          chat_id: 'chat-456',
          urgency: 'normal' as const
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept payload with optional fields omitted', () => {
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: 'msg-123',
          sender: 'John Doe',
          preview: 'Hello world',
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(true);
    });

    it('should accept valid urgency values', () => {
      const validUrgencies = ['low', 'normal', 'high'];
      for (const urgency of validUrgencies) {
        const payload = JSON.stringify({
          source: 'power_automate',
          version: '1.0',
          timestamp: new Date().toISOString(),
          messages: [{
            id: 'msg-123',
            sender: 'John Doe',
            preview: 'Hello world',
            received_at: new Date().toISOString(),
            urgency
          }]
        });
        const result = validateSchema(payload);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid urgency value', () => {
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: 'msg-123',
          sender: 'John Doe',
          preview: 'Hello world',
          received_at: new Date().toISOString(),
          urgency: 'critical'
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(false);
    });
  });

  describe('Source Field Validation', () => {
    it('should accept source: power_automate', () => {
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: [{
          id: '1',
          sender: 'Test',
          preview: 'Test',
          received_at: new Date().toISOString()
        }]
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(true);
    });
  });

  describe('Empty messages array', () => {
    it('should accept empty messages array', () => {
      const payload = JSON.stringify({
        source: 'power_automate',
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: []
      });
      const result = validateSchema(payload);
      expect(result.valid).toBe(true);
    });
  });
});
