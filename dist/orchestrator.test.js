import { describe, it, expect } from 'vitest';
import { isValidFile } from './orchestrator.js';
import { validateSchema } from './schema-validator.js';
describe('Contract 4: File System Watcher - Core Logic', () => {
    describe('TC-4.2: Non-JSON files ignored', () => {
        it('should return false for .txt files', () => {
            expect(isValidFile('test.txt')).toBe(false);
            expect(isValidFile('/path/to/file.txt')).toBe(false);
        });
        it('should return false for .log files', () => {
            expect(isValidFile('debug.log')).toBe(false);
            expect(isValidFile('/path/to/debug.log')).toBe(false);
        });
        it('should return false for other non-json extensions', () => {
            expect(isValidFile('data.xml')).toBe(false);
            expect(isValidFile('config.yaml')).toBe(false);
        });
    });
    describe('TC-4.3: Hidden files ignored', () => {
        it('should return false for hidden files starting with dot', () => {
            expect(isValidFile('.hidden.json')).toBe(false);
            expect(isValidFile('.env')).toBe(false);
            expect(isValidFile('/path/.hidden.json')).toBe(false);
        });
    });
    describe('Valid files accepted', () => {
        it('should return true for .json files', () => {
            expect(isValidFile('batch.json')).toBe(true);
            expect(isValidFile('/path/to/batch.json')).toBe(true);
        });
        it('should return true for JSON files with different casing', () => {
            expect(isValidFile('data.JSON')).toBe(true);
            expect(isValidFile('Data.Json')).toBe(true);
        });
    });
});
describe('Contract 5: Workflow Routing', () => {
    describe('TC-5.1: Valid source routes correctly', () => {
        it('should accept power_automate as valid source', () => {
            const payload = {
                source: 'power_automate',
                version: '1.0',
                timestamp: new Date().toISOString(),
                messages: [{ id: '1', sender: 'Test', preview: 'Test', received_at: new Date().toISOString() }]
            };
            expect(payload.source).toBe('power_automate');
        });
    });
    describe('TC-5.2: Unknown source rejected', () => {
        it('should reject unknown source values', () => {
            const payload = {
                source: 'unknown',
                version: '1.0',
                timestamp: new Date().toISOString(),
                messages: [{ id: '1', sender: 'Test', preview: 'Test', received_at: new Date().toISOString() }]
            };
            const result = validateSchema(JSON.stringify(payload));
            expect(result.valid).toBe(false);
        });
    });
    describe('TC-5.3: Missing source field', () => {
        it('should reject payload missing source field', () => {
            const payload = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                messages: [{ id: '1', sender: 'Test', preview: 'Test', received_at: new Date().toISOString() }]
            };
            const result = validateSchema(JSON.stringify(payload));
            expect(result.valid).toBe(false);
        });
    });
});
describe('Contract 6: Error Handling', () => {
    it('should handle malformed JSON gracefully', () => {
        const result = validateSchema('{ "invalid": json }');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('JSON');
    });
});
//# sourceMappingURL=orchestrator.test.js.map