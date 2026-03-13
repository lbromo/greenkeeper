import { decryptPayload, EncryptedPayload } from './crypto.js';
import { validateIntent } from './intent-handler.js';
import { notify } from './notifier.js';
import { executeIntent } from './workflows/opencode-runner.js';

const RELAY_INTENT_URL = process.env.RELAY_INTENT_URL || 'https://greenkeeper-relay.greenkeeper.workers.dev/intents';
const RELAY_URL = process.env.RELAY_URL || 'https://relay.example.com/api/messages';
const POLL_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 2000 : 15000;

export interface IntentPayload {
  intent: 'confirm' | 'reject' | 'defer';
  intentId: number;
  taskId: string;
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
    
    console.log(`[IntentPoller] Starting poller (${POLL_INTERVAL_MS}ms interval)...`);
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
      
      if (!intents || !Array.isArray(intents) || intents.length === 0) {
        return;
      }

      for (const encryptedPayload of intents) {
        try {
          if (!encryptedPayload || !encryptedPayload.iv || !encryptedPayload.authTag || !encryptedPayload.ciphertext) {
            console.warn('[IntentPoller] Skipping invalid intent payload:', encryptedPayload);
            continue;
          }

          const decryptedJson = decryptPayload(encryptedPayload, this.cryptoKey);
          if (!decryptedJson) {
            console.warn('[IntentPoller] Decrypted payload is empty');
            continue;
          }

          const rawPayload = JSON.parse(decryptedJson);
          
          // TC-43.2 & TC-43.7: Validate and unmarshal using schema
          const validated = validateIntent(rawPayload);
          
          const intentMap: Record<number, IntentPayload['intent']> = {
            1: 'confirm',
            2: 'reject',
            3: 'defer'
          };

          const intentPayload: IntentPayload = {
            intent: intentMap[validated.intent] || 'defer',
            intentId: validated.intent,
            taskId: validated.taskId,
            context: { taskId: validated.taskId },
            timestamp: validated.timestamp
          };

          console.log(`[IntentPoller] Received intent: ${intentPayload.intent} for ${intentPayload.taskId}`);
          
          // TC-45 integration: If confirm, trigger runner
          if (intentPayload.intent === 'confirm') {
            executeIntent(intentPayload.intentId, intentPayload.taskId, this.cryptoKey, RELAY_URL).catch(err => {
               console.error('[IntentPoller] Runner execution failed:', err);
            });
          }

          await this.onIntent(intentPayload);
          
          // TC-44.2: Structural ping only
          await notify(`✅ Intent '${intentPayload.intent}' received`);
        } catch (err: any) {
          console.error('[IntentPoller] Failed to decrypt or process intent:', err.message);
        }
      }

    } catch (error) {
      console.error('[IntentPoller] Error during poll:', error);
    } finally {
      this.isPolling = false;
    }
  }
}
