import { decryptPayload, EncryptedPayload } from './crypto.js';

const RELAY_INTENT_URL = 'https://greenkeeper-relay.greenkeeper.workers.dev/intents';
const POLL_INTERVAL_MS = 15000;

export interface IntentPayload {
  intent: 'confirm' | 'reject' | 'defer';
  context: any;
  timestamp: string;
}

export type IntentHandler = (intent: IntentPayload) => Promise<void>;

export class IntentPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private cryptoKey: string,
    private onIntent: IntentHandler
  ) {}

  start() {
    if (this.intervalId) return;
    
    console.log('[IntentPoller] Starting poller (15s interval)...');
    this.poll(); // Initial poll
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[IntentPoller] Poller stopped.');
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const response = await fetch(RELAY_INTENT_URL);
      
      if (!response.ok) {
        if (response.status !== 404) {
          console.error(`[IntentPoller] Fetch failed: ${response.status} ${response.statusText}`);
        }
        return;
      }

      const { intents } = (await response.json()) as { intents: EncryptedPayload[] };
      
      if (!intents || intents.length === 0) {
        return;
      }

      for (const encryptedPayload of intents) {
        try {
          const decryptedJson = decryptPayload(encryptedPayload, this.cryptoKey);
          const intentPayload = JSON.parse(decryptedJson) as IntentPayload;

          console.log(`[IntentPoller] Received intent: ${intentPayload.intent}`);
          await this.onIntent(intentPayload);
        } catch (err) {
          console.error('[IntentPoller] Failed to decrypt or process intent:', err);
        }
      }

    } catch (error) {
      console.error('[IntentPoller] Error during poll:', error);
    } finally {
      this.isPolling = false;
    }
  }
}
