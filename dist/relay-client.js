export class RelayError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RelayError';
    }
}
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 10000;
export async function sendToRelay(payload, options) {
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(options.relayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    key: data.key ?? ''
                };
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');
            if (error instanceof Error && error.name === 'AbortError') {
                continue;
            }
        }
    }
    return {
        success: false,
        error: lastError?.message ?? 'Max retries exceeded'
    };
}
//# sourceMappingURL=relay-client.js.map