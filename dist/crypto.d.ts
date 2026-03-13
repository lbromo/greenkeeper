export declare class CryptoError extends Error {
    constructor(message: string);
}
export interface EncryptedPayload {
    iv: string;
    authTag: string;
    ciphertext: string;
    timestamp: string;
}
export declare function encryptPayload(plaintext: string, key: string): EncryptedPayload;
export declare function decryptPayload(payload: EncryptedPayload, key: string): string;
