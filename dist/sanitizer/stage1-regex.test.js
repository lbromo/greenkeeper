import { describe, it, expect } from 'vitest';
import { sanitizeStage1 } from './stage1-regex.js';
describe('Contract 12: Stage 1 - Regex Blocklist', () => {
    describe('TC-12.1: API Key Detection', () => {
        it('should reject message containing ghp_ token', () => {
            const result = sanitizeStage1('Here is my token ghp_abcdefghijk');
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('API key');
        });
        it('should reject message containing sk-proj-', () => {
            const result = sanitizeStage1('Token: sk-proj-abcdefghijk');
            expect(result.blocked).toBe(true);
        });
        it('should reject message containing AKIA prefix', () => {
            const result = sanitizeStage1('AWS Key: AKIAIOSFODNN7EXAMPLE');
            expect(result.blocked).toBe(true);
        });
    });
    describe('TC-12.2: Grundfos Email Detection', () => {
        it('should reject john.doe@grundfos.com', () => {
            const result = sanitizeStage1('Contact john.doe@grundfos.com for help');
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('email');
        });
        it('should reject other grundfos domain emails', () => {
            const result = sanitizeStage1('Email me at lasse@grundfos.com');
            expect(result.blocked).toBe(true);
        });
        it('should accept non-grundfos emails', () => {
            const result = sanitizeStage1('Email me at john@gmail.com');
            expect(result.blocked).toBe(false);
        });
    });
    describe('TC-12.3: Credit Card Detection (Luhn validated)', () => {
        it('should reject valid Luhn credit card', () => {
            const result = sanitizeStage1('Card: 4532015112830366');
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('credit card');
        });
        it('should reject formatted credit card', () => {
            const result = sanitizeStage1('Card: 4532-0151-1283-0366');
            expect(result.blocked).toBe(true);
        });
        it('should accept invalid Luhn number', () => {
            const result = sanitizeStage1('Number: 1234567890123456');
            expect(result.blocked).toBe(false);
        });
    });
    describe('TC-12.4: IP Address Detection', () => {
        it('should reject IPv4 address', () => {
            const result = sanitizeStage1('Server at 192.168.1.100');
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('IP');
        });
        it('should reject IPv6 address', () => {
            const result = sanitizeStage1('Server at 2001:0db8::1');
            expect(result.blocked).toBe(true);
        });
        it('should reject IPv6 with full format', () => {
            const result = sanitizeStage1('IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334');
            expect(result.blocked).toBe(true);
        });
    });
    describe('TC-12.5: File Path Detection', () => {
        it('should reject /Users/ path', () => {
            const result = sanitizeStage1('File at /Users/lasse/secrets.txt');
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('file path');
        });
        it('should reject C:\\ Windows path', () => {
            const result = sanitizeStage1('Path: C:\\Users\\admin\\data.txt');
            expect(result.blocked).toBe(true);
        });
        it('should reject UNC network path', () => {
            const result = sanitizeStage1('UNC: \\\\server\\share\\file.txt');
            expect(result.blocked).toBe(true);
        });
    });
    describe('SSN Detection', () => {
        it('should reject SSN pattern', () => {
            const result = sanitizeStage1('SSN: 123-45-6789');
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('SSN');
        });
    });
    describe('Safe Content', () => {
        it('should accept normal work message', () => {
            const result = sanitizeStage1('Meeting at 2pm to discuss Q1 planning');
            expect(result.blocked).toBe(false);
        });
        it('should accept message with public email domain', () => {
            const result = sanitizeStage1('Contact john@gmail.com for the report');
            expect(result.blocked).toBe(false);
        });
        it('should accept message with non-grundfos domain', () => {
            const result = sanitizeStage1('Email team@company.com about the project');
            expect(result.blocked).toBe(false);
        });
    });
});
//# sourceMappingURL=stage1-regex.test.js.map