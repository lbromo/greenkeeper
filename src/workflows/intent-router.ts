import type { IntentPayload } from '../intent-poller.js';

const FORGE_CHANNEL_ID = '1481782767632126143';

export async function routeIntent(payload: IntentPayload, discordWebhookUrl: string): Promise<void> {
  const { intent, context } = payload;

  switch (intent) {
    case 'confirm':
      await sendToDiscord(context, discordWebhookUrl);
      break;
    case 'reject':
      console.log('[IntentRouter] Intent REJECTED. Logging only.');
      break;
    case 'defer':
      console.log('[IntentRouter] Intent DEFERRED. Logging only.');
      break;
    default:
      console.warn(`[IntentRouter] Unknown intent: ${intent}`);
  }
}

async function sendToDiscord(context: any, webhookUrl: string) {
  if (!webhookUrl) {
    console.error('[IntentRouter] DISCORD_WEBHOOK_URL is not defined.');
    return;
  }

  const content = `<@&${FORGE_CHANNEL_ID}> - Intent confirmed. Executing context:
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\``;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      console.error(`[IntentRouter] Discord Webhook failed: ${response.status} ${response.statusText}`);
    } else {
      console.log('[IntentRouter] Successfully sent confirm intent to Discord.');
    }
  } catch (error) {
    console.error('[IntentRouter] Error sending to Discord:', error);
  }
}
