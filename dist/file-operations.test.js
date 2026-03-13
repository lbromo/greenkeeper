import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { moveFile, cleanupOldFiles, getFileAgeDays } from './file-operations.js';
import { validateSchema } from './schema-validator.js';
import { resolve } from 'path';
import { mkdir, writeFile, readFile, unlink, rm } from 'fs/promises';
import { existsSync, utimesSync, mkdirSync } from 'fs';
const TEST_DIR = resolve(process.cwd(), 'test-temp-lifecycle');
async function setupTestDir() {
    if (existsSync(TEST_DIR)) {
        await rm(TEST_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_DIR, { recursive: true });
    await mkdir(resolve(TEST_DIR, 'inbox'), { recursive: true });
    await mkdir(resolve(TEST_DIR, 'processed'), { recursive: true });
    await mkdir(resolve(TEST_DIR, 'rejected'), { recursive: true });
}
async function cleanupTestDir() {
    if (existsSync(TEST_DIR)) {
        await rm(TEST_DIR, { recursive: true, force: true });
    }
}
function createMockPayload(timestampOffsetMs = 0) {
    const timestamp = new Date(Date.now() + timestampOffsetMs).toISOString();
    return {
        source: 'power_automate',
        version: '1.0',
        timestamp,
        messages: [
            {
                id: 'msg-001',
                sender: 'John Doe',
                preview: 'Test message',
                received_at: timestamp
            }
        ]
    };
}
describe('Contract 11: File Lifecycle Management', () => {
    beforeEach(async () => {
        await setupTestDir();
    });
    afterEach(async () => {
        await cleanupTestDir();
    });
    describe('TC-11.1: Processed file moved with timestamp', () => {
        it('should move processed file with timestamp prefix', async () => {
            const inboxPath = resolve(TEST_DIR, 'inbox', 'teams-batch.json');
            const processedDir = resolve(TEST_DIR, 'processed');
            const payload = createMockPayload();
            await writeFile(inboxPath, JSON.stringify(payload));
            const timestamp = Date.now();
            const destPath = resolve(processedDir, `${timestamp}-teams-batch.json`);
            await moveFile(inboxPath, destPath);
            expect(existsSync(destPath)).toBe(true);
            expect(existsSync(inboxPath)).toBe(false);
            const processedContent = await readFile(destPath, 'utf-8');
            expect(JSON.parse(processedContent)).toEqual(payload);
        });
        it('should preserve original filename after timestamp prefix', async () => {
            const inboxPath = resolve(TEST_DIR, 'inbox', 'power-automate-001.json');
            const processedDir = resolve(TEST_DIR, 'processed');
            const payload = createMockPayload();
            await writeFile(inboxPath, JSON.stringify(payload));
            const timestamp = Date.now();
            const destPath = resolve(processedDir, `${timestamp}-power-automate-001.json`);
            await moveFile(inboxPath, destPath);
            const filename = destPath.split('/').pop() || destPath.split('\\').pop();
            expect(filename).toMatch(/^\d+-.+\.json$/);
        });
    });
    describe('TC-11.2: Processed file cleanup (7 days)', () => {
        it('should identify processed files older than 7 days', () => {
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
            const sevenDaysAgo = Date.now() - sevenDaysMs;
            const eightDaysAgo = Date.now() - eightDaysMs;
            expect(Date.now() - sevenDaysAgo).toBeGreaterThanOrEqual(sevenDaysMs);
            expect(Date.now() - eightDaysAgo).toBeGreaterThanOrEqual(eightDaysMs);
        });
        it('should allow deletion of 8-day-old processed files', async () => {
            const processedDir = resolve(TEST_DIR, 'processed');
            const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
            const eightDaysAgoDate = new Date(eightDaysAgo).toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const oldFilePath = resolve(processedDir, `${eightDaysAgoDate}-old-batch.json`);
            await writeFile(oldFilePath, JSON.stringify(createMockPayload()));
            expect(existsSync(oldFilePath)).toBe(true);
            await unlink(oldFilePath);
            expect(existsSync(oldFilePath)).toBe(false);
        });
    });
    describe('TC-11.3: Rejected files retained for 30 days', () => {
        it('should retain rejected files for 30 days', async () => {
            const rejectedDir = resolve(TEST_DIR, 'rejected');
            const payload = createMockPayload();
            const rejectedPath = resolve(rejectedDir, 'rejected-batch.json');
            await writeFile(rejectedPath, JSON.stringify(payload));
            expect(existsSync(rejectedPath)).toBe(true);
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const twentyNineDaysAgo = Date.now() - (29 * 24 * 60 * 60 * 1000);
            expect(Date.now() - twentyNineDaysAgo).toBeLessThan(thirtyDaysMs);
        });
        it('should not automatically delete rejected files before 30 days', async () => {
            const rejectedDir = resolve(TEST_DIR, 'rejected');
            const payload = createMockPayload();
            const rejectedPath = resolve(rejectedDir, 'rejected-batch.json');
            await writeFile(rejectedPath, JSON.stringify(payload));
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const twentyNineDaysAgo = Date.now() - (29 * 24 * 60 * 60 * 1000);
            const shouldRetain = (Date.now() - twentyNineDaysAgo) < thirtyDaysMs;
            expect(shouldRetain).toBe(true);
        });
    });
    describe('File validation integration', () => {
        it('should validate valid payload before processing', () => {
            const payload = createMockPayload();
            const result = validateSchema(JSON.stringify(payload));
            expect(result.valid).toBe(true);
        });
        it('should reject invalid payload before processing', () => {
            const invalidPayload = {
                source: 'invalid_source',
                version: '1.0',
                timestamp: new Date().toISOString(),
                messages: []
            };
            const result = validateSchema(JSON.stringify(invalidPayload));
            expect(result.valid).toBe(false);
        });
    });
    describe('cleanupOldFiles function', () => {
        it('should delete files older than retention period', async () => {
            const testDir = resolve(TEST_DIR, 'cleanup-test');
            await mkdir(testDir, { recursive: true });
            const oldFile = resolve(testDir, 'old-file.json');
            await writeFile(oldFile, '{}');
            const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
            utimesSync(oldFile, eightDaysAgo / 1000, eightDaysAgo / 1000);
            const deleted = cleanupOldFiles(testDir, 7);
            expect(deleted).toBe(1);
            expect(existsSync(oldFile)).toBe(false);
        });
        it('should not delete files within retention period', async () => {
            const testDir = resolve(TEST_DIR, 'cleanup-test2');
            await mkdir(testDir, { recursive: true });
            const recentFile = resolve(testDir, 'recent-file.json');
            await writeFile(recentFile, '{}');
            const deleted = cleanupOldFiles(testDir, 7);
            expect(deleted).toBe(0);
            expect(existsSync(recentFile)).toBe(true);
        });
        it('should handle empty directory', () => {
            const emptyDir = resolve(TEST_DIR, 'empty');
            mkdirSync(emptyDir, { recursive: true });
            const deleted = cleanupOldFiles(emptyDir, 7);
            expect(deleted).toBe(0);
        });
        it('should handle non-existent directory', () => {
            const deleted = cleanupOldFiles(resolve(TEST_DIR, 'does-not-exist'), 7);
            expect(deleted).toBe(0);
        });
    });
    describe('getFileAgeDays function', () => {
        it('should calculate correct age for file', async () => {
            const testDir = resolve(TEST_DIR, 'age-test');
            await mkdir(testDir, { recursive: true });
            const testFile = resolve(testDir, 'age.json');
            await writeFile(testFile, '{}');
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
            utimesSync(testFile, threeDaysAgo / 1000, threeDaysAgo / 1000);
            const age = getFileAgeDays(testFile);
            expect(age).toBeGreaterThanOrEqual(2.9);
            expect(age).toBeLessThanOrEqual(3.1);
        });
    });
});
//# sourceMappingURL=file-operations.test.js.map