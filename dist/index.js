import { config } from 'dotenv';
import { watchInbox, isPanicLocked } from './orchestrator.js';
import { encryptPayload } from './crypto.js';
import { sendToRelay } from './relay-client.js';
import { sanitizeStage1 } from './sanitizer/stage1-regex.js';
import { sanitizeStage3 } from './sanitizer/stage3-final.js';
import { distillTasks } from './workflows/task-distiller.js';
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
    onMessage: async (parsed) => {
        console.log(`\n📥 Received payload with ${parsed.messages?.length || 0} messages...`);
        try {
            console.log('🧹 Sanitizing payload...');
            // Sanitize each message preview through Stage 1 (regex) then Stage 3 (final sweep)
            if (parsed.messages && Array.isArray(parsed.messages)) {
                for (const msg of parsed.messages) {
                    if (msg.preview) {
                        const s1 = sanitizeStage1(msg.preview);
                        if (s1.blocked) {
                            console.warn('⚠️  Message blocked by Stage 1:', s1.reason);
                            msg.preview = '[BLOCKED BY SANITIZER]';
                        }
                        else {
                            const s3 = sanitizeStage3(s1.sanitized || msg.preview);
                            msg.preview = s3.sanitized;
                            if (s3.warnings && s3.warnings.length > 0) {
                                console.log('   Stage 3 warnings:', s3.warnings.join(', '));
                            }
                        }
                    }
                    // Also sanitize sender field
                    if (msg.sender) {
                        const s1s = sanitizeStage1(msg.sender);
                        if (!s1s.blocked && s1s.sanitized) {
                            const s3s = sanitizeStage3(s1s.sanitized);
                            msg.sender = s3s.sanitized;
                        }
                    }
                }
            }
            console.log('🧠 Distilling tasks...');
            const distillation = await distillTasks(parsed.messages || []);
            // Attach distillation summary to payload
            parsed.distillation = distillation;
            console.log('🔒 Encrypting payload...');
            const payloadString = JSON.stringify(parsed);
            const encrypted = encryptPayload(payloadString, CRYPTO_KEY);
            console.log('🚀 Sending to Cloudflare Relay...');
            const result = await sendToRelay(encrypted, { relayUrl: RELAY_URL });
            if (result.success && result.key) {
                console.log(`✅ Relayed successfully!`);
                console.log(`🔗 Retrieve via: ${RELAY_URL}?key=${result.key}`);
            }
            else {
                console.error(`❌ Relay failed:`, result.error);
            }
        }
        catch (e) {
            console.error('❌ Pipeline failed:', e.message);
        }
    }
}).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map