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

### Step 3: Intents & Execution (COMPLETE)
- [x] **Task 5.1 (Part 1):** CF Worker `POST /intent` & `GET /intent` (KV consume-on-read).
- [x] **Task 5.1 (Part 2):** PWA Intent Emission (Encrypt JSON + POST to CF Worker).
- [x] **Task 5.1 (Part 3):** Daemon Poller (`src/intent-poller.ts`). Needs to `GET /intent` from Cloudflare every 15s, decrypt the payload using the `CRYPTO_KEY`, and log the received intent (confirm/reject/defer).
- [x] **Task 5.2:** Intent Router (`src/workflows/intent-router.ts`). When an intent is confirmed, format the context and trigger a Discord Webhook to `#the-forge` (1481782767632126143) to invoke Sindri for execution.
- [x] **Task 5.3:** Implement Async OpenCode Runner (`shell: false`, strict taskId regex, `aliases.json` routing, encrypted result blob).

**Contract 45 Status:** [x] Complete — integer intent → `aliases.json` → `spawn(..., {shell:false})` → encrypted result upload

### Step 4: Task Distillation (Phase 2 Additions)

**Note:** Task 6.1 was originally specified for Azure AI Foundry, but an on-device local LLM (Ollama with `llama3.2:1b`) was implemented instead. This improves data sovereignty — no external API calls during distillation. Set `LLM_PROVIDER=ollama` in `.env.dev` to enable. This unplanned addition improves the blood-brain barrier posture.
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

### Step 6: Phase 3 — Native iOS Companion App (Test Contracts)

**Goal:** Define Phase 3 test contracts for Secure Enclave key handling, push receipt, biometric gating, and deep-link behaviour. Phase 4 PKI placeholders included.

**TC-300: Secure Enclave Keypair Generation (Ed25519)**
GIVEN: Freshly installed app on device or simulator
WHEN: App generates keypair
THEN: Private key MUST be non-exportable (simulator uses fallback file)
  AND: Public key MUST be exportable and uploaded to daemon or CF Worker via provisioning flow

**TC-301: Public Key Provisioning / QR Flow**
GIVEN: Device displays QR containing public key + metadata
WHEN: Mac scans QR or user pastes public key
THEN: Daemon MUST store public key for signature verification
  AND: Provisioning SHOULD require one-time confirmation

**TC-302: APNs Push Receipt (Structural Ping)**
GIVEN: CF Worker sends structural ping to APNs (or ntfy fallback)
WHEN: App receives push
THEN: App MUST display structural ping text (no sensitive data)
  AND: Tapping the push MUST deep-link into Glass PWA

**TC-303: Decrypt Encrypted Push Payload (AES-GCM)**
GIVEN: CF Worker sends encrypted payload to APNs
  AND: App has private key / shared secret provisioned
WHEN: App receives push and decrypts
THEN: Decryption MUST succeed and the decrypted envelope MUST validate schema
  AND: If decryption fails, app MUST show generic alert ("Open Glass")

**TC-304: FaceID Gating Before Key Use**
GIVEN: App locked with biometric policy
WHEN: App attempts to use private key for decryption or signing
THEN: FaceID prompt MUST appear
  AND: Private key operation MUST be denied on FaceID failure

**TC-305: Deep-link Behavior**
GIVEN: App receives structural ping and user taps it
WHEN: App opens Glass via deep link
THEN: The deep link MUST include opaque correlation id (no keys or payloads in URL)
  AND: Glass fetch MUST Authenticate/verify using normal relay flow (no key in URL)

**TC-306: Device Public Key Rotation Handling**
GIVEN: Device rotates its keypair (user-initiated)
WHEN: App uploads new public key and invalidates old key
THEN: Daemon MUST accept new key and reject signatures from old key
  AND: Rotation MUST be recorded with timestamp and nonce

**TC-307: Replay Protection (Phase 4 placeholder)**
GIVEN: Signed payloads from app include nonce + timestamp
WHEN: Daemon receives signed payload
THEN: Daemon MUST reject replays outside allowed window and duplicate nonces

**TC-308: Signature Verification on Daemon (Phase 4 placeholder)**
GIVEN: Signed input from device (Ed25519)
WHEN: Daemon verifies signature against stored public key
THEN: Valid signatures pass; invalid signatures are rejected and logged

**TC-309: Telemetry / EDR Constraint Tests**
GIVEN: App-to-relay communication patterns (push only; no continuous outbound socket)
WHEN: App is exercised in normal use
THEN: Must confirm that no periodic outbound persistent socket is established by daemon
  AND: Any polling cadence used by daemon (for Phase 2) must be <= 1 request / 5s and randomized jitter to avoid C2 heuristics

---

**Notes:**
- These test cases are skeletons to be refined once Gróa's Phase 3 design and Gná's security spec are finalized on disk. They will be assigned TC IDs (300-309) and expanded into automated Vitest cases where feasible (simulator fallback for Secure Enclave operations).
