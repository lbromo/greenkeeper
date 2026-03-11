export interface Stage3Result {
  sanitized: string;
  modified: boolean;
  warnings?: string[];
}

const MAX_LENGTH = 500;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+/gi;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const LARGE_NUMBER_PATTERN = /\b\d{5,}\b/g;
const BRACKETED_PATTERN = /\[(?![A-Z]+\])[^\]]+\]/g;
const REDACTED_PATTERN = /\[REDACTED\]/g;

export function sanitizeStage3(content: string): Stage3Result {
  const warnings: string[] = [];
  let sanitized = content;
  
  const redactedMatches = sanitized.match(REDACTED_PATTERN);
  const redactedCount = redactedMatches ? redactedMatches.length : 0;
  
  const urlMatches = sanitized.match(URL_PATTERN);
  if (urlMatches) {
    sanitized = sanitized.replace(URL_PATTERN, '');
    warnings.push('URLs removed');
  }
  
  sanitized = sanitized.replace(BRACKETED_PATTERN, '');
  
  const emailMatches = sanitized.match(EMAIL_PATTERN);
  if (emailMatches) {
    sanitized = sanitized.replace(EMAIL_PATTERN, '');
    warnings.push('Email patterns removed');
  }
  
  const largeNumMatches = sanitized.match(LARGE_NUMBER_PATTERN);
  if (largeNumMatches) {
    sanitized = sanitized.replace(LARGE_NUMBER_PATTERN, '[NUMBER]');
    warnings.push('Large numbers replaced');
  }
  
  if (redactedCount > 0) {
    sanitized = sanitized.replace(/\[REDACTED\]/g, '[REDACTED]');
    warnings.push(`${redactedCount} [REDACTED] tags preserved`);
  }
  
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  const modified = warnings.length > 0;
  
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH - 3) + '...';
  }
  
  return {
    sanitized,
    modified,
    warnings: warnings.length > 0 ? warnings : undefined
  } as Stage3Result;
}
