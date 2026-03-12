import { config } from 'dotenv';
import { watchInbox, isPanicLocked } from './orchestrator.js';

// Load .env variables
config();

const WATCH_DIR = process.env.WATCH_DIR;
const CRYPTO_KEY = process.env.CRYPTO_KEY;

if (!WATCH_DIR || !CRYPTO_KEY) {
  console.error('Missing WATCH_DIR or CRYPTO_KEY in .env');
  process.exit(1);
}

console.log('🌱 Starting Greenkeeper Daemon...');
console.log(`📂 Watching: ${WATCH_DIR}`);

if (isPanicLocked()) {
  console.error('🚨 PANIC LOCK ACTIVE! Daemon refuses to start.');
  console.error('Please resolve the issue and manually remove ~/.greenkeeper/panic.lock');
  process.exit(1);
}

watchInbox({
  inbox: WATCH_DIR,
  encryptionKey: CRYPTO_KEY
}).catch((err: any) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
