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
    const intent: IntentPayload = {
      intent: 'confirm',
      context: { taskId: '123' },
      timestamp: new Date().toISOString()
    };
    const encrypted = encryptPayload(JSON.stringify(intent), cryptoKey);

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
    // Simulate the "undefined is not valid JSON" error by providing a non-JSON or malformed payload
    // The issue reported was "undefined" is not valid JSON, 
    // likely from JSON.parse(decryptPayload(undefined, ...))
    
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
});
