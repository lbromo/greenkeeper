export interface OrchestratorOptions {
    inbox: string;
    processedDir?: string;
    rejectedDir?: string;
    encryptionKey?: string;
    onMessage?: (parsed: unknown) => Promise<void>;
}
export declare function isPanicLocked(): boolean;
export declare function activatePanic(key: string): void;
export declare function clearPanicLock(): void;
export declare function triggerPanic(key: string): Promise<void>;
export declare function isValidFile(filePath: string): boolean;
export declare function watchInbox(options: OrchestratorOptions): Promise<void>;
export declare function stopWatching(): void;
export declare function getProcessedCount(): number;
export declare function resetProcessedCount(): void;
