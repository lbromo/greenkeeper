import { describe, it, expect } from 'vitest';
import type { Stage3Result } from './stage3-final.js';
import { sanitizeStage3 } from './stage3-final.js';

describe('Contract 14: Stage 3 - Final Sweep', () => {
  describe('TC-14.1: Character limit', () => {
    it('should truncate output to 500 chars with ellipsis', () => {
      const longContent = 'A'.repeat(600);
      const result = sanitizeStage3(longContent);
      expect(result.sanitized.length).toBeLessThanOrEqual(503);
      expect(result.sanitized).toContain('...');
    });
  });

  describe('TC-14.2: URL removal', () => {
    it('should remove URLs', () => {
      const result = sanitizeStage3('Check https://example.com for more info');
      expect(result.sanitized).not.toContain('https://example.com');
      expect(result.sanitized).not.toContain('www.example.com');
    });
  });

  describe('TC-14.3: Large number replacement', () => {
    it('should replace 5-digit numbers with [NUMBER]', () => {
      const result = sanitizeStage3('The count is 12345');
      expect(result.sanitized).toContain('[NUMBER]');
      expect(result.sanitized).not.toContain('12345');
    });

    it('should allow 4-digit numbers', () => {
      const result = sanitizeStage3('Code 1234 works');
      expect(result.sanitized).toContain('1234');
    });
  });

  describe('Email pattern removal', () => {
    it('should remove email patterns', () => {
      const result = sanitizeStage3('Email test@example.com please');
      expect(result.sanitized).not.toContain('@');
    });
  });

  describe('Contract 17: Marker Preservation', () => {
    it('should preserve [PROJECT], [FINANCIAL], and [CUSTOMER] tags', () => {
      const content = 'The [PROJECT] budget was [FINANCIAL] for [CUSTOMER]';
      const result = sanitizeStage3(content);
      expect(result.sanitized).toContain('[PROJECT]');
      expect(result.sanitized).toContain('[FINANCIAL]');
      expect(result.sanitized).toContain('[CUSTOMER]');
      expect(result.sanitized).toBe(content);
    });
  });

  describe('Safe content', () => {
    it('should pass through short content unchanged', () => {
      const content = 'Meeting at 2pm';
      const result = sanitizeStage3(content);
      expect(result.sanitized).toBe(content);
    });
  });
});
