import { rename, mkdir, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

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
