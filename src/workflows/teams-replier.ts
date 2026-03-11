export interface TeamsMessage {
  type: 'message' | 'action' | 'alert';
  title?: string;
  text: string;
  facts?: Record<string, string>;
}

export interface TeamsReplyOptions {
  webhookUrl?: string;
  channel?: string;
}

export async function sendTeamsMessage(
  message: TeamsMessage,
  options?: TeamsReplyOptions
): Promise<{ success: boolean; error?: string }> {
  return {
    success: true
  };
}

export async function replyToTeamsThread(
  threadId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  return {
    success: true
  };
}
