import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { encryptPayload } from '../crypto.js';
import { sendToRelay } from '../relay-client.js';
import { notify } from '../notifier.js';

interface AliasConfig {
  command: string[];
  timeout?: number;
  description?: string;
}

interface RunnerConfig {
  [key: string]: AliasConfig;
}

const TASK_ID_REGEX = /^[a-zA-Z0-9-_]+$/;
const DEFAULT_TIMEOUT = 300000; // 5 minutes

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';
const GREENKEEPER_DIR = resolve(HOME_DIR, '.greenkeeper');
const LOGS_DIR = resolve(GREENKEEPER_DIR, 'logs');

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export async function executeIntent(intent_id: number, taskId: string, cryptoKey: string, relayUrl: string): Promise<void> {
  console.log(`[Runner] Executing intent ${intent_id} for task ${taskId}`);

  // 1. Validate taskId
  if (!TASK_ID_REGEX.test(taskId)) {
    console.error(`[Runner] Invalid taskId format: ${taskId}`);
    await notify(`❌ Task execution failed: Invalid taskId`);
    return;
  }

  // 2. Load aliases.json
  const aliasesPath = resolve(process.cwd(), 'aliases.json');
  if (!existsSync(aliasesPath)) {
    console.error('[Runner] aliases.json not found');
    await notify(`❌ Task execution failed: Missing aliases.json`);
    return;
  }

  const aliases: RunnerConfig = JSON.parse(readFileSync(aliasesPath, 'utf-8'));
  const config = aliases[intent_id.toString()];

  if (!config) {
    console.error(`[Runner] No alias found for intent ${intent_id}`);
    await notify(`❌ Task execution failed: Unknown intent ${intent_id}`);
    return;
  }

  // 3. Prepare logs
  ensureDir(LOGS_DIR);
  const logFile = resolve(LOGS_DIR, `${taskId}.log`);
  const logStream = {
    write: (data: string) => {
      writeFileSync(logFile, data, { flag: 'a' });
    }
  };

  // 4. Spawn process
  const [cmd, ...args] = config.command;
  const fullArgs = [...args, taskId];
  
  console.log(`[Runner] Spawning: ${cmd} ${fullArgs.join(' ')}`);
  
  const child = spawn(cmd, fullArgs, {
    shell: false,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const timeout = config.timeout || DEFAULT_TIMEOUT;
  const timeoutId = setTimeout(() => {
    console.warn(`[Runner] Task ${taskId} timed out after ${timeout}ms. Killing...`);
    try {
      // Kill the entire process group if detached: true
      process.kill(-child.pid!, 'SIGKILL');
    } catch (e) {
      child.kill('SIGKILL');
    }
    logStream.write(`\n--- TIMEOUT AFTER ${timeout}ms ---\n`);
  }, timeout);

  child.stdout.on('data', (data) => logStream.write(data.toString()));
  child.stderr.on('data', (data) => logStream.write(data.toString()));

  child.on('close', async (code) => {
    clearTimeout(timeoutId);
    console.log(`[Runner] Task ${taskId} finished with code ${code}`);

    try {
      // 5. Read log and encrypt
      const logContent = readFileSync(logFile, 'utf-8');
      const resultBlob = {
        log: logContent,
        exitCode: code,
        timestamp: new Date().toISOString(),
        taskId
      };

      const encrypted = encryptPayload(JSON.stringify(resultBlob), cryptoKey);

      // 6. Upload to CF Worker KV
      // Result key: result:{taskId}
      const relayResult = await sendToRelay(encrypted, {
        relayUrl: `${relayUrl}/result:${taskId}`
      });

      if (relayResult.success) {
        console.log(`[Runner] Result for ${taskId} uploaded successfully.`);
        await notify(`✅ Task ${taskId} complete`);
      } else {
        console.error(`[Runner] Failed to upload result for ${taskId}: ${relayResult.error}`);
        await notify(`❌ Task ${taskId} failed (upload error)`);
      }
    } catch (err: any) {
      console.error(`[Runner] Error during cleanup/upload for ${taskId}:`, err.message);
      await notify(`❌ Task ${taskId} failed (internal error)`);
    }
  });

  child.on('error', async (err) => {
    clearTimeout(timeoutId);
    console.error(`[Runner] Process error for ${taskId}:`, err.message);
    logStream.write(`\n--- PROCESS ERROR: ${err.message} ---\n`);
    await notify(`❌ Task ${taskId} failed (spawn error)`);
  });
}
