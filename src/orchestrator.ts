import chokidar, { FSWatcher } from 'chokidar';
import { validateSchema } from './schema-validator.js';
import type { ValidationResult } from './schema-validator.js';
import { moveFile } from './file-operations.js';
import { resolve, basename, extname, dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { encryptPayload } from './crypto.js';
import { sendToRelay } from './relay-client.js';

let watcher: FSWatcher | null = null;
let processedCount = 0;
let lastHourCount = 0;
let lastHourReset = Date.now();

const PANIC_THRESHOLD = 20;
const PANIC_WINDOW_MS = 60 * 60 * 1000;
const PROCESSED_DIR = 'processed';
const REJECTED_DIR = 'rejected';

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || dirname(dirname(process.execPath));
const GREENKEEPER_DIR = resolve(HOME_DIR, '.greenkeeper');
const PANIC_LOCK_PATH = resolve(GREENKEEPER_DIR, 'panic.lock');
const RELAY_URL = process.env.RELAY_URL || 'https://relay.example.com/api/messages';

export interface OrchestratorOptions {
  inbox: string;
  processedDir?: string;
  rejectedDir?: string;
  encryptionKey?: string;
  onMessage?: (parsed: unknown) => Promise<void>;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function isPanicLocked(): boolean {
  return existsSync(PANIC_LOCK_PATH);
}

export function activatePanic(key: string): void {
  ensureDir(GREENKEEPER_DIR);
  writeFileSync(PANIC_LOCK_PATH, JSON.stringify({
    activatedAt: new Date().toISOString(),
    keyPrefix: key.substring(0, 8)
  }), { mode: 0o600 });
}

async function emitSystemSignal(key: string): Promise<void> {
  const signalPayload = {
    type: 'SYSTEM_SIGNAL',
    signal: 'PANIC_ACTIVATED',
    timestamp: new Date().toISOString(),
    keyPrefix: key.substring(0, 8)
  };
  
  try {
    await sendToRelay(encryptPayload(JSON.stringify(signalPayload), key), {
      relayUrl: RELAY_URL,
      maxRetries: 2,
      timeout: 5000
    });
  } catch {
    // Best-effort signal emission - panic still proceeds
  }
}

export function clearPanicLock(): void {
  if (existsSync(PANIC_LOCK_PATH)) {
    unlinkSync(PANIC_LOCK_PATH);
  }
}

export async function triggerPanic(key: string): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  
  await emitSystemSignal(key);
  activatePanic(key);
}

export function isValidFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath);
  
  if (ext !== '.json') return false;
  if (name.startsWith('.')) return false;
  
  return true;
}

function checkPanicThreshold(): boolean {
  const now = Date.now();
  
  if (now - lastHourReset > PANIC_WINDOW_MS) {
    lastHourCount = 0;
    lastHourReset = now;
  }
  
  lastHourCount++;
  processedCount++;
  
  return lastHourCount > PANIC_THRESHOLD;
}

export async function watchInbox(options: OrchestratorOptions): Promise<void> {
  if (isPanicLocked()) {
    throw new Error('PANIC_MODE_ACTIVE: Greenkeeper is locked. Remove ~/.greenkeeper/panic.lock to override.');
  }
  
  if (!options.encryptionKey) {
    throw new Error('Encryption key required for panic signal emission');
  }
  
  const inboxPath = resolve(options.inbox);
  const processedPath = resolve(options.processedDir || PROCESSED_DIR);
  const rejectedPath = resolve(options.rejectedDir || REJECTED_DIR);
  
  ensureDir(processedPath);
  ensureDir(rejectedPath);
  
  watcher = chokidar.watch(inboxPath, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    },
    ignoreInitial: true,
    depth: 0
  });
  
  watcher.on('add', async (filePath: string) => {
    if (!isValidFile(filePath)) return;
    
    const result = validateFile(filePath);
    
    if (result.valid && result.parsed) {
      const isPanic = checkPanicThreshold();
      if (isPanic) {
        await triggerPanic(options.encryptionKey!);
        await moveFile(filePath, resolve(rejectedPath, 'quarantine', basename(filePath)));
        return;
      }
      
      if (options.onMessage) {
        await options.onMessage(result.parsed);
      }
      
      await moveFile(filePath, resolve(processedPath, `${Date.now()}-${basename(filePath)}`));
    } else {
      console.error(`❌ Validation failed for ${basename(filePath)}: ${result.error}`);
      await moveFile(filePath, resolve(rejectedPath, basename(filePath)));
    }
  });
  
  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });
}

function validateFile(filePath: string): ValidationResult {
  const content = readFileSync(filePath, 'utf-8');
  return validateSchema(content);
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

export function getProcessedCount(): number {
  return processedCount;
}

export function resetProcessedCount(): void {
  processedCount = 0;
  lastHourCount = 0;
}
