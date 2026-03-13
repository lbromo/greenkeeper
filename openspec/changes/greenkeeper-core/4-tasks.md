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
- [x] **Task 5.1 (Part 1):** CF Worker `POST /intent` & `GET /intent` (KV consume-on-read).
- [x] **Task 5.1 (Part 2):** PWA Intent Emission (Encrypt JSON + POST to CF Worker).
- [x] **Task 5.1 (Part 3):** Daemon Poller (`src/intent-poller.ts`). Needs to `GET /intent` from Cloudflare every 15s, decrypt the payload using the `CRYPTO_KEY`, and log the received intent (confirm/reject/defer).
- [x] **Task 5.2:** Intent Router (`src/workflows/intent-router.ts`). When an intent is confirmed, format the context and trigger a Discord Webhook to `#the-forge` (1481782767632126143) to invoke Sindri for execution.
- [ ] **Task 5.3:** Implement OpenCode Runner (`shell: false`, regex strict args).

### Step 4: Task Distillation (Phase 2 Additions)
- [x] **Task 6.1:** Implement \`src/workflows/task-distiller.ts\` to connect to Azure Anthropic.
- [x] **Task 6.2:** Define Zod schema \`DistilledTaskSchema\` following blood-brain barrier policy.
- [x] **Task 6.3:** Wire task distiller into \`src/index.ts\` (orchestrator).
- [x] **Task 6.4:** Update \`dashboard/index.html\` to render the distillation summary card.

### Step 5: Outbound Alerting (ntfy.sh)

**Goal:** Replace Discord webhook with E2EE-ready push notification system for out-of-band alerting.

- [ ] **Task 4.4:** Implement Outbound Notification Module

**Contract 44: Notification Module (`src/notifier.ts`)**

**Requirements:**
1. Read `NTFY_TOPIC` and `NTFY_ENABLED` from environment variables
2. Validate topic entropy (minimum 32 characters) at module initialization
3. If entropy check fails, log error and disable notifications
4. Expose `notify(message: string): Promise<void>` function
5. POST plaintext message to `https://ntfy.sh/{NTFY_TOPIC}` with headers:
   - `Title: Greenkeeper`
   - `Priority: 3`
   - `Tags: seedling`
6. Gracefully handle network errors (log, do not crash)
7. Replace Discord webhook calls in `src/index.ts` and `src/intent-poller.ts` with `notify()` calls

**Allowed Notification Formats (Structural Pings Only):**
- ✅ "📬 3 new tasks distilled"
- ✅ "✅ Task execution complete"
- ✅ "🚨 Panic switch triggered"
- ❌ "📬 Email from John Doe about Project X" (context leakage)

**Acceptance Criteria:**
- [ ] TC-44.1: POST to correct topic with required headers
- [ ] TC-44.2: No payload data leakage (Blood-Brain Barrier enforcement)
- [ ] TC-44.3: NTFY_ENABLED flag respected (no HTTP when false)
- [ ] TC-44.4: Network error handling (non-blocking, logged)
- [ ] TC-44.5: Topic entropy validation at startup (reject < 32 chars)

**Test File:** `test/integration/notifier.test.ts`  
**Implementation File:** `src/notifier.ts`

**Testing Strategy:**
- Use `vi.spyOn(global, 'fetch')` to mock HTTP requests
- No production HTTP requests during `npm test`
- Test topic: `test-greenkeeper-local-do-not-use`

**Security Guardrails (Enforced by Gná):**
1. **No Context Leakage:** Message must be structural only, no corporate data
2. **Topic Secrecy:** 32-char minimum, CSPRNG-generated (e.g., `crypto.randomBytes(16).toString('hex')`)
3. **No Action Links:** No URLs with tokens in notification body

**Configuration:**
Add to `.env.example`:
```bash
# Outbound Alerting (ntfy.sh)
NTFY_ENABLED=true
NTFY_TOPIC=your-32-char-random-hex-string-here
```

**Implementation Notes:**
- Module must fail gracefully if `NTFY_TOPIC` is missing or weak
- Notifications are fire-and-forget (no retry queue)
- Error logs must not expose the topic name (use `[REDACTED]`)

---

## Phase 3: Future Roadmap (Not Yet Specified)

### Potential Features
- Native iOS App (Expo + APNs + Secure Enclave FaceID)
- Web Push API Integration (Service Worker + VAPID)
- Multi-tenant support (multiple corporate accounts)
