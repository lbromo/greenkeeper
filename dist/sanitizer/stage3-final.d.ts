export interface Stage3Result {
    sanitized: string;
    modified: boolean;
    warnings?: string[];
}
export declare function sanitizeStage3(content: string): Stage3Result;
