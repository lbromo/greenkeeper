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
export declare function sendTeamsMessage(message: TeamsMessage, options?: TeamsReplyOptions): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function replyToTeamsThread(threadId: string, message: string): Promise<{
    success: boolean;
    error?: string;
}>;
