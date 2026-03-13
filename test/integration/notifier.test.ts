import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Notifier Integration (TC-44)', () => {
  const validTopic = 'a'.repeat(32); // 32 chars
  const weakTopic = 'too-short';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('TC-44.1: POST to correct topic with required headers', async () => {
    process.env.NTFY_ENABLED = 'true';
    process.env.NTFY_TOPIC = validTopic;
    
    // Re-import to trigger initialization with new env
    const { notify } = await import('../../src/notifier.js');
    
    await notify('Test message');

    expect(global.fetch).toHaveBeenCalledWith(
      `https://ntfy.sh/${validTopic}`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Title': 'Greenkeeper',
          'Priority': '3',
          'Tags': 'seedling'
        },
        body: 'Test message'
      })
    );
  });

  it('TC-44.3: NTFY_ENABLED flag respected (no HTTP when false)', async () => {
    process.env.NTFY_ENABLED = 'false';
    process.env.NTFY_TOPIC = validTopic;

    const { notify } = await import('../../src/notifier.js');
    
    await notify('Should not send');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('TC-44.4: Network error handling (non-blocking, logged)', async () => {
    process.env.NTFY_ENABLED = 'true';
    process.env.NTFY_TOPIC = validTopic;

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));

    const { notify } = await import('../../src/notifier.js');
    
    // Should not throw
    await expect(notify('Test error')).resolves.not.toThrow();
    
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[REDACTED]')
    );
  });

  it('TC-44.5: Topic entropy validation at startup (reject < 32 chars)', async () => {
    process.env.NTFY_ENABLED = 'true';
    process.env.NTFY_TOPIC = weakTopic;

    const { notify } = await import('../../src/notifier.js');
    
    await notify('Should be disabled');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('NTFY_TOPIC must be >= 32 chars')
    );
  });
  
  it('TC-44.2: No payload data leakage (Structural pings only - verified by usage)', async () => {
    // This is more of a policy check, but we can verify that the notify function 
    // accepts exactly what we give it and doesn't append extra info.
    process.env.NTFY_ENABLED = 'true';
    process.env.NTFY_TOPIC = validTopic;

    const { notify } = await import('../../src/notifier.js');
    const structuralPing = '✅ Intent \'confirm\' received';
    
    await notify(structuralPing);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: structuralPing
      })
    );
  });
});
