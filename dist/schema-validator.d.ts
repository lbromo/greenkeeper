export interface ValidationResult {
    valid: boolean;
    error?: string;
    parsed?: unknown;
}
export declare function validateSchema(content: string): ValidationResult;
