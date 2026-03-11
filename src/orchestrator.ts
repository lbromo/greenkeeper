import chokidar, { FSWatcher } from 'chokidar';
import { validateSchema } from './schema-validator.js';
import type { ValidationResult } from './schema-validator.js';
import { moveFile } from './file-operations.js';
import { resolve, basename, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';

let watcher: FSWatcher | null = null;
let processedCount = 0;
let lastHourCount = 0;
let lastHourReset = Date.now();

const PANIC_THRESHOLD = 20;
const PANIC_WINDOW_MS = 60 * 60 * 1000;
const PROCESSED_DIR = 'processed';
const REJECTED_DIR = 'rejected';

export interface OrchestratorOptions {
  inbox: string;
  processedDir?: string;
  rejectedDir?: string;
  onMessage?: (parsed: unknown) => Promise<void>;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
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
        await moveFile(filePath, resolve(rejectedPath, 'quarantine', basename(filePath)));
        return;
      }
      
      if (options.onMessage) {
        await options.onMessage(result.parsed);
      }
      
      await moveFile(filePath, resolve(processedPath, `${Date.now()}-${basename(filePath)}`));
    } else {
      await moveFile(filePath, resolve(rejectedPath, basename(filePath)));
    }
  });
  
  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });
}

function validateFile(filePath: string): ValidationResult {
  const { readFileSync } = require('fs');
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
