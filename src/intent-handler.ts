import { z } from 'zod';

const IntentSchema = z.object({
  taskId: z.string().regex(/^[a-zA-Z0-9-_]+$/),
  intent: z.number().int().min(1).max(3),
  timestamp: z.string().datetime(),
  nonce: z.string().min(1)
});

export type Intent = z.infer<typeof IntentSchema>;

// In-memory nonce cache for replay protection
const nonceCache = new Set<string>();
const MAX_NONCE_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function validateIntent(data: any): Intent {
  const result = IntentSchema.safeParse(data);
  
  if (!result.success) {
    throw new Error(`Invalid intent format: ${result.error.message}`);
  }

  const intent = result.data;
  const now = new Date();
  const intentTime = new Date(intent.timestamp);
  
  // TC-43.4: Reject if > 5 minutes old
  const diffMs = Math.abs(now.getTime() - intentTime.getTime());
  if (diffMs > 5 * 60 * 1000) {
    throw new Error('Intent timestamp expired');
  }

  // TC-43.5: Reject duplicate nonce
  if (nonceCache.has(intent.nonce)) {
    throw new Error('Duplicate nonce detected');
  }
  
  nonceCache.add(intent.nonce);
  
  // Simple cleanup to prevent memory leak
  setTimeout(() => {
    nonceCache.delete(intent.nonce);
  }, MAX_NONCE_AGE_MS);

  return intent;
}
