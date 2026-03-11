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

export async function sanitizePipeline(
  content: string,
  options?: SanitizerPipelineOptions
): Promise<SanitizerPipelineResult> {
  const stage1Result = sanitizeStage1(content);
  
  if (stage1Result.blocked) {
    return {
      success: false,
      blocked: true,
      reason: stage1Result.reason || 'Blocked by stage 1'
    };
  }
  
  let currentContent = stage1Result.sanitized || content;
  let stage2Result: Stage2Result | undefined;
  
  if (!options?.skipStage2) {
    stage2Result = await sanitizeStage2(currentContent, options?.stage2);
    
    if (!stage2Result.success) {
      return {
        success: false,
        blocked: false,
        reason: stage2Result.error || 'Stage 2 failed',
        stage2Result
      };
    }
    
    currentContent = stage2Result.redacted || currentContent;
  }
  
  const stage3Result = sanitizeStage3(currentContent);
  
  return {
    success: true,
    blocked: false,
    sanitized: stage3Result.sanitized,
    stage2Result: stage2Result ?? undefined,
    stage3Result
  };
}

export { sanitizeStage1, sanitizeStage2, sanitizeStage3 };
export type { Stage1Result, Stage2Result, Stage2Options, Stage3Result };
