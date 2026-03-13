export interface Stage1Result {
    blocked: boolean;
    reason?: string;
    sanitized?: string;
}
export declare function sanitizeStage1(content: string): Stage1Result;
