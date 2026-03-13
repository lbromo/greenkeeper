import { z } from 'zod';

const MAX_FILE_SIZE = 1024 * 1024;
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

const MessageSchema = z.object({
  id: z.string().max(128),
  sender: z.string().max(100).nullable(),
  preview: z.string().max(5000),
  received_at: z.string().datetime(),
  chat_id: z.string().max(128).optional(),
  urgency: z.enum(['low', 'normal', 'high']).optional()
});

const OneDrivePayloadSchema = z.object({
  source: z.literal('power_automate'),
  version: z.literal('1.0'),
  timestamp: z.string().datetime(),
  messages: z.array(MessageSchema)
});

export interface ValidationResult {
  valid: boolean;
  error?: string;
  parsed?: unknown;
}

export function validateSchema(content: string): ValidationResult {
  if (content.length > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 1MB limit' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown parse error';
    return { valid: false, error: `JSON parse error: ${message}` };
  }

  const result = OneDrivePayloadSchema.safeParse(parsed);
  
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { valid: false, error: `Schema validation failed: ${issues}` };
  }

  const timestamp = new Date(result.data.timestamp);
  const now = new Date();
  const ageMs = now.getTime() - timestamp.getTime();
  
  if (ageMs > MAX_TIMESTAMP_AGE_MS || ageMs < -MAX_TIMESTAMP_AGE_MS) {
    return { valid: false, error: 'Timestamp validation failed: must be less than 5 minutes old' };
  }

  return { valid: true, parsed: result.data };
}
