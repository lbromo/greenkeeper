export interface Stage2Result {
    success: boolean;
    redacted?: string;
    error?: string;
}
export interface Stage2Options {
    azureEndpoint?: string;
    apiKey?: string;
    simulateError?: boolean;
}
export declare function sanitizeStage2(content: string, options?: Stage2Options): Promise<Stage2Result>;
