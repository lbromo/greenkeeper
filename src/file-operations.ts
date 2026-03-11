import { rename, mkdir, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'fs';
import { dirname, resolve } from 'path';

const PROCESSED_RETENTION_DAYS = 7;
const REJECTED_RETENTION_DAYS = 30;

export async function moveFile(source: string, dest: string): Promise<void> {
  const destDir = dirname(dest);
  
  await new Promise<void>((resolve, reject) => {
    mkdir(destDir, { recursive: true }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise<void>((resolve, reject) => {
    rename(source, dest, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function readJsonFile(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function cleanupOldFiles(directory: string, retentionDays: number): number {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const cutoff = now - (retentionDays * msPerDay);
  
  let deletedCount = 0;
  
  try {
    const files = readdirSync(directory);
    
    for (const file of files) {
      const filePath = resolve(directory, file);
      
      try {
        const stats = statSync(filePath);
        
        if (stats.isFile() && stats.mtimeMs < cutoff) {
          unlinkSync(filePath);
          deletedCount++;
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return deletedCount;
}

export function cleanupProcessedFiles(processedDir: string): number {
  return cleanupOldFiles(processedDir, PROCESSED_RETENTION_DAYS);
}

export function getFileAgeDays(filePath: string): number {
  const stats = statSync(filePath);
  const msPerDay = 24 * 60 * 60 * 1000;
  return (Date.now() - stats.mtimeMs) / msPerDay;
}
