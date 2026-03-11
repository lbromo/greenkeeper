export interface TeamsMessage {
  type: 'message' | 'alert' | 'summary';
  title?: string;
  body: string;
  priority?: 'normal' | 'high' | 'critical';
}

export interface TeamsReplierOptions {
  webhookUrl?: string;
  channel?: string;
  enabled?: boolean;
}

export class TeamsReplier {
  private webhookUrl: string;
  private channel: string;
  private enabled: boolean;

  constructor(options: TeamsReplierOptions = {}) {
    this.webhookUrl = options.webhookUrl || process.env.TEAMS_WEBHOOK_URL || '';
    this.channel = options.channel || 'general';
    this.enabled = options.enabled ?? (!!this.webhookUrl);
  }

  async send(message: TeamsMessage): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const payload = this.buildPayload(message);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private buildPayload(message: TeamsMessage): object {
    const themeColor = message.priority === 'critical' ? 'FF0000' 
      : message.priority === 'high' ? 'FFA500'
      : '0078D4';

    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor,
      summary: message.title || 'Greenkeeper Alert',
      sections: [{
        activityTitle: message.title || 'Greenkeeper Notification',
        text: message.body,
        markdown: true
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'View in Greenkeeper',
        targets: [{ os: 'default', uri: process.env.GREENKEEPER_UI_URL || 'http://localhost:3000' }]
      }]
    };
  }

  async sendPanicAlert(keyPrefix: string): Promise<boolean> {
    return this.send({
      type: 'alert',
      title: '🔒 PANIC MODE ACTIVATED',
      body: `Greenkeeper has entered panic mode. Key prefix: ${keyPrefix}. Immediate attention required.`,
      priority: 'critical'
    });
  }

  async sendErrorAlert(error: string): Promise<boolean> {
    return this.send({
      type: 'alert',
      title: '⚠️ Error Alert',
      body: error,
      priority: 'high'
    });
  }
}
