import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeIntent } from '../../src/workflows/opencode-runner.js';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import * as notifier from '../../src/notifier.js';
import * as relayClient from '../../src/relay-client.js';

vi.mock('child_process');
vi.mock('../../src/notifier.js');
vi.mock('../../src/relay-client.js');

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';
const GREENKEEPER_DIR = resolve(HOME_DIR, '.greenkeeper');
const LOGS_DIR = resolve(GREENKEEPER_DIR, 'logs');
const ALIASES_FILE = resolve(process.cwd(), 'aliases.json');
const CRYPTO_KEY = '00'.repeat(32);
const RELAY_URL = 'https://example.com/api';

describe('OpenCode Runner (Contract 45)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup aliases.json for testing
    if (!existsSync(process.cwd())) mkdirSync(process.cwd(), { recursive: true });
    writeFileSync(ALIASES_FILE, JSON.stringify({
      "1": { command: ["/usr/bin/echo", "Success!"], timeout: 1000 },
      "2": { command: ["/usr/bin/false"], timeout: 1000 }
    }));
  });

  afterEach(() => {
    if (existsSync(ALIASES_FILE)) unlinkSync(ALIASES_FILE);
  });

  it('TC-45.1: should successfully execute command and upload logs', async () => {
    const taskId = 'task-123';
    const mockChild = {
      pid: 1234,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
      unref: vi.fn()
    };

    // Simulate child process behavior
    (spawn as any).mockReturnValue(mockChild);
    
    // Mock stdout data event
    mockChild.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') cb('Hello world');
    });

    // Mock close event
    mockChild.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });

    (relayClient.sendToRelay as any).mockResolvedValue({ success: true });

    await executeIntent(1, taskId, CRYPTO_KEY, RELAY_URL);

    // Give it a bit more time for the 'close' event handler to run
    await new Promise(r => setTimeout(r, 100));

    expect(spawn).toHaveBeenCalledWith('/usr/bin/echo', ['Success!', taskId], expect.any(Object));
    expect(relayClient.sendToRelay).toHaveBeenCalled();
    expect(notifier.notify).toHaveBeenCalledWith(expect.stringContaining('complete'));
    
    const logPath = resolve(LOGS_DIR, `${taskId}.log`);
    expect(existsSync(logPath)).toBe(true);
    const logContent = readFileSync(logPath, 'utf-8');
    expect(logContent).toContain('Hello world');
  });

  it('TC-45.3: should reject invalid taskId format', async () => {
    const invalidTaskId = 'task!!!';
    await executeIntent(1, invalidTaskId, CRYPTO_KEY, RELAY_URL);
    
    expect(spawn).not.toHaveBeenCalled();
    expect(notifier.notify).toHaveBeenCalledWith(expect.stringContaining('Invalid taskId'));
  });

  it('TC-45.4: should handle missing alias', async () => {
    const taskId = 'task-454';
    await executeIntent(999, taskId, CRYPTO_KEY, RELAY_URL);
    
    expect(spawn).not.toHaveBeenCalled();
    expect(notifier.notify).toHaveBeenCalledWith(expect.stringContaining('Unknown intent'));
  });

  it('TC-45.5: should handle child process errors', async () => {
    const taskId = 'task-455';
    const mockChild = {
      pid: 1235,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    };
    (spawn as any).mockReturnValue(mockChild);

    mockChild.on.mockImplementation((event, cb) => {
      if (event === 'error') cb(new Error('Spawn failed'));
    });

    await executeIntent(1, taskId, CRYPTO_KEY, RELAY_URL);
    await new Promise(r => setTimeout(r, 50));

    expect(notifier.notify).toHaveBeenCalledWith(expect.stringContaining('failed (spawn error)'));
  });

  it('TC-45.6: should timeout and kill process group', async () => {
    const taskId = 'task-456';
    const mockChild = {
      pid: 1236,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn()
    };
    (spawn as any).mockReturnValue(mockChild);
    
    // Create a spy for process.kill
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as any);

    // Mock aliases with short timeout
    writeFileSync(ALIASES_FILE, JSON.stringify({
      "1": { command: ["/usr/bin/sleep", "10"], timeout: 10 }
    }));

    await executeIntent(1, taskId, CRYPTO_KEY, RELAY_URL);
    
    // Wait for timeout to trigger
    await new Promise(r => setTimeout(r, 100));

    expect(killSpy).toHaveBeenCalledWith(-1236, 'SIGKILL');
    
    killSpy.mockRestore();
  });
});
