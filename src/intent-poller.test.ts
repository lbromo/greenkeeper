import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentPoller, IntentPayload } from './intent-poller.js';
import { encryptPayload } from './crypto.js';

describe('IntentPoller', () => {
  const cryptoKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let poller: IntentPoller;
  let mockHandler: any;

  beforeEach(() => {
    mockHandler = vi.fn().mockResolvedValue(undefined);
    poller = new IntentPoller(cryptoKey, mockHandler);
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should process valid intents', async () => {
    const rawPayload = {
      taskId: '123',
      intent: 1, // 1 maps to confirm
      nonce: 'unique-nonce-123',
      timestamp: new Date().toISOString()
    };
    const encrypted = encryptPayload(JSON.stringify(rawPayload), cryptoKey);

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ intents: [encrypted] })
    });

    await (poller as any).poll();

    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'confirm',
      context: { taskId: '123' }
    }));
  });

  it('should skip invalid/undefined intent payloads gracefully', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ intents: [undefined, { ciphertext: 'invalid' }, null] })
    });

    await (poller as any).poll();

    expect(mockHandler).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('should handle 404 responses silently', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 404
    });

    await (poller as any).poll();

    expect(mockHandler).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should support legacy dashboard intent format', async () => {
    const legacyPayload = {
      taskId: 'task-123',
      intent: 1,
      timestamp: new Date().toISOString(),
      nonce: 'random-uuid-456'
    };
    const encrypted = encryptPayload(JSON.stringify(legacyPayload), cryptoKey);

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ intents: [encrypted] })
    });

    await (poller as any).poll();

    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'confirm',
      context: { taskId: 'task-123' }
    }));
  });
});
