import { sanitizeStage1 } from './stage1-regex.js';
import { sanitizeStage2 } from './stage2-llm.js';
import { sanitizeStage3 } from './stage3-final.js';
export async function sanitizePipeline(content, options) {
    const stage1Result = sanitizeStage1(content);
    if (stage1Result.blocked) {
        return {
            success: false,
            blocked: true,
            reason: stage1Result.reason || 'Blocked by stage 1'
        };
    }
    let currentContent = stage1Result.sanitized || content;
    let stage2Result;
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
//# sourceMappingURL=sanitizer.js.map