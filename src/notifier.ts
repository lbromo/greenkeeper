import { config } from 'dotenv';

// Load .env variables locally for initialization
config();

const NTFY_TOPIC = process.env.NTFY_TOPIC;
const NTFY_ENABLED = process.env.NTFY_ENABLED === 'true';

let isTopicValid = false;

if (NTFY_ENABLED) {
  if (!NTFY_TOPIC || NTFY_TOPIC.length < 32) {
    console.error('[Notifier] 🚨 Error: NTFY_TOPIC must be >= 32 chars. Notifications DISABLED.');
  } else {
    isTopicValid = true;
  }
}

/**
 * Sends a structural ping to ntfy.sh
 * No corporate data or message previews are allowed here.
 */
export async function notify(message: string): Promise<void> {
  if (!NTFY_ENABLED || !isTopicValid) {
    return;
  }

  try {
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': 'Greenkeeper',
        'Priority': '3',
        'Tags': 'seedling'
      },
      body: message
    });

    if (!response.ok) {
      console.error(`[Notifier] ❌ Failed to send ping (Topic: [REDACTED]): ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Notifier] 📬 Ping sent: ${message}`);
    }
  } catch (error: any) {
    console.error(`[Notifier] ❌ Network error (Topic: [REDACTED]): ${error.message}`);
  }
}
