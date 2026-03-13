import { encryptPayload } from '../../dist/crypto.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const key = process.env.CRYPTO_KEY;

const mockPayload = {
  distillation: {
    summary: "This is a mock distillation pushed for local E2E testing.",
    tasks: [
      {
        id: "test-task-" + Date.now(),
        title: "Test Task",
        urgency: "High",
        description: "This task was injected locally.",
      }
    ]
  },
  messages: []
};

async function run() {
  console.log("Encrypting mock payload...");
  const encrypted = encryptPayload(JSON.stringify(mockPayload), key);
  
  console.log("Pushing to http://localhost:3333/mock-push");
  const res = await fetch("http://localhost:3333/mock-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encrypted)
  });
  console.log("Response:", await res.text());
}
run();
