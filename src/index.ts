import { config } from 'dotenv';
import { watchInbox, isPanicLocked } from './orchestrator.js';
import { encryptPayload } from './crypto.js';
import { sendToRelay } from './relay-client.js';

// Load .env variables
config();

const WATCH_DIR = process.env.WATCH_DIR;
const CRYPTO_KEY = process.env.CRYPTO_KEY;
const RELAY_URL = process.env.RELAY_URL;

if (!WATCH_DIR || !CRYPTO_KEY || !RELAY_URL) {
  console.error('Missing WATCH_DIR, CRYPTO_KEY, or RELAY_URL in .env');
  process.exit(1);
}

console.log('🌱 Starting Greenkeeper Daemon...');
console.log(`📂 Watching: ${WATCH_DIR}`);
console.log(`🌐 Target: ${RELAY_URL}`);

if (isPanicLocked()) {
  console.error('🚨 PANIC LOCK ACTIVE! Daemon refuses to start.');
  console.error('Please resolve the issue and manually remove ~/.greenkeeper/panic.lock');
  process.exit(1);
}

watchInbox({
  inbox: WATCH_DIR,
  encryptionKey: CRYPTO_KEY,
  onMessage: async (parsed: any) => {
    console.log(`\n📥 Received payload with ${parsed.messages?.length || 0} messages...`);
    
    try {
      console.log('🔒 Encrypting payload...');
      // crypto.ts expects a string
      const payloadString = JSON.stringify(parsed);
      const encrypted = encryptPayload(payloadString, CRYPTO_KEY);
      
      console.log('🚀 Sending to Cloudflare Relay...');
      const result = await sendToRelay(encrypted, { relayUrl: RELAY_URL });
      
      if (result.success && result.key) {
        console.log(`✅ Relayed successfully!`);
        console.log(`🔗 Retrieve via: ${RELAY_URL}?key=${result.key}`);
      } else {
        console.error(`❌ Relay failed:`, result.error);
      }
    } catch (e: any) {
      console.error('❌ Pipeline failed:', e.message);
    }
  }
}).catch((err: any) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
