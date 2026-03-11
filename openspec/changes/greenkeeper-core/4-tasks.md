# 4-tasks.md (Implementation Tasks)

## Phase 0: Canary Validation (Teams Replier Only)

### Infrastructure & Flow (Manual Setup)
- [ ] **Task 0.1:** Lasse to create Power Automate flow (`Personal chat backup`) triggered on 15-minute recurrence.
- [ ] **Task 0.2:** Flow action: Gather unread Teams messages (using specific channel scopes).
- [ ] **Task 0.3:** Flow action: Format payload using the "Compose" block (NO string interpolation to prevent JSON poisoning/injection).
- [ ] **Task 0.4:** Flow action: Save output to `~/OneDrive/Greenkeeper/inbox/batch-{utcNow()}.json`.

### Daemon & Core Architecture
- [ ] **Task 1.1:** Initialize TypeScript project (max ~10 files).
- [x] **Task 1.2:** Implement `schema-validator.ts` implementing `Contract 19` (max 1MB size, 10KB body limit, 280-char preview, schema match).
- [x] **Task 1.3:** Implement `orchestrator.ts` with chokidar targeting `~/OneDrive/Greenkeeper/inbox/`.
- [x] **Task 1.4:** Implement Volume Threshold Monitoring (Panic Switch): Halt if >20 files/hour, move to `quarantine/`, emit E2EE `SystemSignal`.
- [x] **Task 1.5:** Implement post-processing routing: Move successfully processed files to `processed/` and invalid ones to `rejected/`.

### The Sanitizer Pipeline
- [x] **Task 2.1:** Implement `sanitizer/stage1-regex.ts` (Deterministic blocklist).
- [x] **Task 2.2:** Implement `sanitizer/stage2-llm.ts` (Azure AI Foundry API integration with strict redactor prompt).
- [x] **Task 2.3:** Implement `sanitizer/stage3-final.ts` (Length limit + final regex sweep).

### Encryption & Delivery
- [x] **Task 3.1:** Implement `crypto.ts` (AES-256-GCM encryption with embedded nonce/timestamp).
- [x] **Task 3.2:** Implement `relay-worker/index.ts` (Cloudflare Worker KV with 20-min TTL).
- [x] **Task 3.3:** Implement network push from `orchestrator.ts` to CF Worker.

### Client Dashboard (PWA)
- [x] **Task 4.1:** Build `dashboard/index.html` (Local decryption via `sessionStorage`).
