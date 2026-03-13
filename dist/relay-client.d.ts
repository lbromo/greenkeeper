import type { EncryptedPayload } from './crypto.js';
export declare class RelayError extends Error {
    constructor(message: string);
}
export interface RelayOptions {
    relayUrl: string;
    maxRetries?: number;
    timeout?: number;
}
export interface RelayResult {
    success: boolean;
    key?: string;
    error?: string;
}
export declare function sendToRelay(payload: EncryptedPayload, options: RelayOptions): Promise<RelayResult>;
