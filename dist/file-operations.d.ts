export declare function moveFile(source: string, dest: string): Promise<void>;
export declare function readJsonFile(filePath: string): unknown;
export declare function writeJsonFile(filePath: string, data: unknown): void;
export declare function cleanupOldFiles(directory: string, retentionDays: number): number;
export declare function cleanupProcessedFiles(processedDir: string): number;
export declare function getFileAgeDays(filePath: string): number;
