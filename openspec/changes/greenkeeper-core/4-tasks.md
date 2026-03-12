# 4-tasks.md (Implementation Tasks)

## Phase 0: Canary Validation & Foundation (COMPLETE)

### Infrastructure & Flow (Manual Setup)
- [x] **Task 0.1:** Lasse created Power Automate flow (`Personal chat backup`) triggered on 15-minute recurrence.
- [x] **Task 0.2:** Flow action: Gather unread Teams messages (using specific channel scopes).
- [x] **Task 0.3:** Flow action: Format payload using the "Compose" block (NO string interpolation to prevent JSON poisoning/injection).
- [x] **Task 0.4:** Flow action: Save output to `~/OneDrive/Greenkeeper/inbox/batch-{utcNow()}.json`.

### Daemon & Core Architecture
- [x] **Task 1.1:** Initialize TypeScript project (max ~10 files).
- [x] **Task 1.2:** Implement `schema-validator.ts` implementing `Contract 19` (max 1MB size, 10KB body limit, 2000-char preview, schema match, 5-min freshness).
- [x] **Task 1.3:** Implement `orchestrator.ts` with chokidar targeting `~/OneDrive/Greenkeeper/inbox/`.
- [x] **Task 1.4:** Implement Volume Threshold Monitoring (Panic Switch): Halt if >20 files/hour, move to `quarantine/`, emit E2EE `SystemSignal`.
- [x] **Task 1.5:** Implement post-processing routing: Move successfully processed files out of OneDrive, invalid to `rejected/`.

### Encryption & Delivery
- [x] **Task 3.1:** Implement `crypto.ts` (AES-256-GCM encryption with embedded nonce/timestamp).
- [x] **Task 3.2:** Implement `relay-worker/index.ts` (Cloudflare Worker KV with consume-on-read).
- [x] **Task 3.3:** Implement network push from `orchestrator.ts` to CF Worker.

---

## Phase 2: Orchestration Expansion (CURRENT)

### Client Dashboard (PWA) (Step 1)
- [ ] **Task 4.1:** Fix `dashboard/index.html` vulnerability (replace `innerHTML` with DOM creation).
- [ ] **Task 4.2:** Implement Vitest test suite for dashboard contracts (TC-22 to TC-28).

### The Sanitizer Pipeline (Step 2 & 3)
- [x] **Task 2.1:** Implement `sanitizer/stage1-regex.ts` (Deterministic blocklist).
- [ ] **Task 2.2:** Wire the Sanitizer into `orchestrator.ts` (currently bypassed).
- [ ] **Task 2.3:** Implement `sanitizer/stage2-llm.ts` (Azure AI Foundry API integration with strict redactor prompt).
- [x] **Task 2.4:** Implement `sanitizer/stage3-final.ts` (Length limit + final regex sweep).

### Intents & Execution (Step 4 & 5)
- [ ] **Task 5.1:** Implement `aliases.json` for deterministic inbound intents.
- [ ] **Task 5.2:** Implement OpenCode Runner.
