# 4-tasks.md (Implementation Tasks)

## Phase 0: Canary Validation & Foundation (COMPLETE)

### Infrastructure & Flow (Manual Setup)
- [x] **Task 0.1:** Lasse created Power Automate flow triggered on 15-minute recurrence.
- [x] **Task 0.2:** Flow action: Gather unread Teams messages.
- [x] **Task 0.3:** Flow action: Format payload using Compose block (NO string interpolation).
- [x] **Task 0.4:** Flow action: Save output to ~/OneDrive/Greenkeeper/inbox/.

### Daemon & Core Architecture
- [x] **Task 1.1:** Initialize TypeScript project.
- [x] **Task 1.2:** Implement schema-validator.ts (Contract 19).
- [x] **Task 1.3:** Implement orchestrator.ts with chokidar.
- [x] **Task 1.4:** Implement Volume Threshold Monitoring (Panic Switch).
- [x] **Task 1.5:** Implement post-processing routing (move to processed/rejected/).

### Encryption & Delivery
- [x] **Task 3.1:** Implement crypto.ts (AES-256-GCM).
- [x] **Task 3.2:** Implement relay-worker/index.ts (CF Worker KV + consume-on-read + CORS).
- [x] **Task 3.3:** Implement network push from orchestrator to CF Worker.
- [x] **Task 3.4:** Full E2E integration test (Encrypt->POST->GET->Decrypt->404).
- [x] **Task 3.5:** src/e2e-crypto.test.ts (Node encrypt <-> Browser decrypt proof).

---

## Phase 2: Orchestration Expansion (CURRENT)

### Step 1: Client Dashboard — The Glass (COMPLETE)
- [x] **Task 4.1:** Rewrite dashboard/index.html (replace innerHTML with safe DOM creation).
- [x] **Task 4.2:** One-shot fetch model (URL = the key, no /keys endpoint).
- [x] **Task 4.3:** Hex key input support (matches .env CRYPTO_KEY format).
- [x] **Task 4.4:** Remove stale URL caching from sessionStorage.
- [x] **Task 4.5:** Pretty-render decrypted messages[] as individual cards (sender, timestamp, preview).
- [x] **Task 4.6:** Implement Vitest + happy-dom test suite for dashboard contracts (TC-22 to TC-28).

### Step 2: Wire Sanitizer into Orchestrator
- [x] **Task 2.1:** Implement sanitizer/stage1-regex.ts (Deterministic blocklist).
- [x] **Task 2.4:** Implement sanitizer/stage3-final.ts (Length limit + final regex sweep).
- [x] **Task 2.2:** Wire full Sanitizer pipeline (Stage 1->3) into orchestrator.ts (scrub BEFORE encryption).
- [x] **Task 2.3:** Implement sanitizer/stage2-llm.ts (Azure AI Foundry) — deferred until corporate Mac.

### Step 3: Intents & Execution (In Progress)
- [ ] **Task 5.1 (Part 1):** CF Worker `POST /intent` & `GET /intents` (KV consume-on-read).
- [ ] **Task 5.1 (Part 2):** PWA Intent Emission (Encrypt JSON + POST to CF Worker).
- [ ] **Task 5.1 (Part 3):** Daemon Poller (Jitter, try/catch decryption, nonce cache, timestamp checks).
- [ ] **Task 5.2:** Implement `aliases.json` routing for deterministic execution.
- [ ] **Task 5.3:** Implement OpenCode Runner (`shell: false`, regex strict args).

### Step 4: Task Distillation (Phase 2 Additions)
- [x] **Task 6.1:** Implement \`src/workflows/task-distiller.ts\` to connect to Azure Anthropic.
- [x] **Task 6.2:** Define Zod schema \`DistilledTaskSchema\` following blood-brain barrier policy.
- [x] **Task 6.3:** Wire task distiller into \`src/index.ts\` (orchestrator).
- [x] **Task 6.4:** Update \`dashboard/index.html\` to render the distillation summary card.
