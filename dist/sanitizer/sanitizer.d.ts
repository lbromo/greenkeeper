import { sanitizeStage1, type Stage1Result } from './stage1-regex.js';
import { sanitizeStage2, type Stage2Options, type Stage2Result } from './stage2-llm.js';
import { sanitizeStage3, type Stage3Result } from './stage3-final.js';
export interface SanitizerPipelineOptions {
    stage2?: Stage2Options;
    skipStage2?: boolean;
}
export interface SanitizerPipelineResult {
    success: boolean;
    blocked: boolean;
    reason?: string;
    sanitized?: string;
    stage1Warnings?: string[];
    stage2Result?: Stage2Result | null | undefined;
    stage3Result?: Stage3Result;
}
export declare function sanitizePipeline(content: string, options?: SanitizerPipelineOptions): Promise<SanitizerPipelineResult>;
export { sanitizeStage1, sanitizeStage2, sanitizeStage3 };
export type { Stage1Result, Stage2Result, Stage2Options, Stage3Result };
