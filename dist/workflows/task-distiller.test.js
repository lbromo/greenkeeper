import { describe, it, expect, vi, beforeEach } from 'vitest';
import { distillTasks } from './task-distiller.js';
describe('distillTasks', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.AZURE_ANTHROPIC_API_KEY = 'test-key';
        // Clear the endpoint to use the default or a test value
        delete process.env.AZURE_ANTHROPIC_ENDPOINT;
    });
    it('attempts to call the expected Azure AI Foundry endpoint', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                content: [{
                        text: JSON.stringify({
                            tasks: [],
                            summary: "Test summary"
                        })
                    }]
            })
        });
        global.fetch = mockFetch;
        await distillTasks([{ id: '1', body: { content: 'hello' } }]);
        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toBe("https://appliedcontrol-resource.services.ai.azure.com/anthropic/v1/messages");
    });
    it('respects AZURE_ANTHROPIC_ENDPOINT environment variable', async () => {
        const customEndpoint = "https://custom.endpoint/v1/messages";
        process.env.AZURE_ANTHROPIC_ENDPOINT = customEndpoint;
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                content: [{
                        text: JSON.stringify({
                            tasks: [],
                            summary: "Test summary"
                        })
                    }]
            })
        });
        global.fetch = mockFetch;
        await distillTasks([]);
        expect(mockFetch).toHaveBeenCalledWith(customEndpoint, expect.any(Object));
    });
});
//# sourceMappingURL=task-distiller.test.js.map