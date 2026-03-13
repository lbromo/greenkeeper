# Council Reflections
_Project Greenkeeper ⛳ — Architectural, Security, and Quality Decisions_

This document records the Council's deliberations, decisions, and rationale for the Project Greenkeeper architecture.

---

## 2026-03-13: Phase 2 Local Testing Infrastructure

### Context
During Phase 2 Inbound Intent Channel implementation, we encountered recurring crypto envelope format mismatches between the PWA Dashboard and the Node daemon. Every mismatch required a full deploy cycle (PWA → CF Worker → Daemon) to discover, making iteration extremely slow.

### Problem Statement
The feedback loop for debugging crypto and routing was too slow and fragile:
- Manual PWA button clicks required
- Production Cloudflare deployment required for each test
- Log inspection on corporate Mac required
- 10+ minute iteration cycles

### Decision: Headless Local Testing (No CF Worker Required)

**Proposed by:** Gróa (Architect)  
**Date:** 2026-03-13 13:26 GMT+1

---

## Gróa — Architecture: Headless E2E Testing

### Core Insight
The Cloudflare Worker is a "dumb KV pipe" — it stores and retrieves encrypted blobs without understanding them. We don't need to simulate the Worker to test the crypto envelope.

### Solution: Function-to-Function Testing
Replace the full pipeline (PWA → Worker → Daemon) with direct module imports in Vitest:

```
1. Import encryptPayload from dashboard/crypto.js (PWA module)
2. Import decryptPayload from src/crypto.ts (Daemon module)
3. Test key: crypto.randomBytes(32)
4. Execute round-trip in memory (no network)
```

### Architecture Changes Required
1. **Extract PWA crypto to `dashboard/crypto.js`** — Move inline `<script>` encryption logic to standalone module for import
2. **Standardize IV encoding** — Use base64 (not hex) to match existing outbound format
3. **Standardize envelope wrapper** — PWA must wrap as `{content: JSON.stringify(data), timestamp}` before encryption

### Benefits
- **No network required** — Tests run in <5 seconds
- **No browser required** — Node's `crypto.webcrypto` is identical to browser WebCrypto
- **No CF Worker required** — Worker routing tested separately (already working in production)
- **Deterministic** — Same input always produces same validation result
- **CI-friendly** — Runs in GitHub Actions without external dependencies

### Separation of Concerns
- **Crypto envelope tests** — `test/integration/intent-roundtrip.test.ts` (this contract)
- **CF Worker routing tests** — `wrangler dev` + fetch tests (separate, if needed)
- **UI interaction tests** — Playwright/Cypress (not needed for crypto validation)

**Status:** Approved by Council (Gróa, Gná, Vár)

---

## Gná — Security: Crypto Parity & ACE Prevention

### Mandatory Security Constraints

#### 1. Cryptographic Parity
The PWA and Daemon crypto modules MUST use identical parameters:
- **Algorithm:** AES-256-GCM
- **IV Length:** 16 bytes (128 bits)
- **Auth Tag:** 16 bytes (128 bits)
- **Encoding:** Base64 (for IV, ciphertext, authTag)
- **Envelope:** `{content: string, timestamp: string}` wrapper inside ciphertext

**Rationale:** Mismatched parameters cause silent decryption failures. By testing both modules in the same test suite, we enforce parity by construction.

#### 2. Web Crypto Mocking
Node's `crypto.webcrypto` API is functionally identical to browser `window.crypto.subtle`. The test harness MUST use `crypto.webcrypto` (not `crypto.createCipheriv`) to accurately mirror the PWA's behavior.

**Rationale:** Subtle implementation differences between Node's legacy crypto and WebCrypto could mask bugs that only appear in the browser.

#### 3. Zero-Trust Execution Boundary
The test suite MUST include an Arbitrary Code Execution (ACE) prevention test that proves `child_process.spawn` is called with `{shell: false}`.

**Test Case TC-43.9 (Mandatory):**
```gherkin
GIVEN: Intent with malicious taskId ("task; rm -rf /")
WHEN: Intent passes through validation and reaches runner
THEN: MUST spawn subprocess with shell: false
  AND: MUST pass taskId as array argument (not string concat)
  AND: MUST NOT execute shell metacharacters
```

**Implementation:** Use `vi.spyOn(child_process, 'spawn')` to assert `shell: false`.

**Rationale:** Rejecting bad `taskId` via regex is defense-in-depth, but it's not sufficient. Even with perfect validation, a future alias mapping mistake could introduce ACE. The runner itself must be provably shell-safe.

#### 4. Replay Protection Test Coverage
The test suite MUST verify:
- Timestamp validation (reject if > 5 minutes old)
- Nonce deduplication (reject if seen before)
- Nonce cache persistence (survives daemon restart)

**Rationale:** Replay attacks are a primary threat vector for inbound command channels. Without these tests, an attacker could replay a captured "Confirm" intent indefinitely.

**Status:** Approved by Gná (Security Specialist)

---

## Vár — Quality: Contract 43 Test Specification

### Contract 43: Local Crypto Round-Trip (Integration)

**Component:** Inbound Intent Channel  
**Test File:** `test/integration/intent-roundtrip.test.ts`  
**Test Count:** 9 (all automated)

### Test Cases

#### TC-43.1: PWA Encrypts Valid Intent
- Verify 16-byte IV (base64-encoded, per Gróa's correction)
- Verify non-empty ciphertext
- Verify 16-byte authTag

#### TC-43.2: Daemon Decrypts Valid Intent
- Round-trip validation (encrypt → decrypt)
- Verify `taskId`, `intent`, `timestamp`, `nonce` survive round-trip
- Verify intent type is `number` (not string)

#### TC-43.3: Daemon Rejects Garbage Data
- Malformed ciphertext must throw
- Error must be caught (no crash)
- Poison resistance validated

#### TC-43.4: Daemon Rejects Expired Timestamp
- Payload with 10-minute-old timestamp → rejected
- 5-minute window enforced

#### TC-43.5: Daemon Rejects Duplicate Nonce
- Same nonce processed twice → second rejected
- Nonce cache validated

#### TC-43.6: TaskId Regex Validation (ACE Prevention)
- `taskId: "task; rm -rf /"` → rejected
- `taskId: "../../../etc/passwd"` → rejected
- Only `^[a-zA-Z0-9-_]+$` accepted

#### TC-43.7: Intent Type Validation
- String `"1"` → rejected (must be integer)
- Float `1.5` → rejected
- Integer `99` → rejected (out of range 1-3)

#### TC-43.8: Wrong Encryption Key Fails
- Encrypt with key A, decrypt with key B → auth tag failure
- No partial plaintext exposure

#### TC-43.9: Shell Injection Denial (Added per Gná)
- Mock `aliases.json` with OpenCode runner mapping
- Spy on `child_process.spawn`
- Assert `{shell: false}` and array arguments
- **Critical:** Proves runner is shell-safe even if validation is bypassed

### Corrections Applied

**Gróa's IV Encoding Correction:**
- Original spec assumed hex encoding (`16 * 2 = 32 hex chars`)
- Corrected to base64 encoding to match existing outbound format
- Assertion updated: `expect(Buffer.from(encrypted.iv, 'base64').length).toBe(16)`

**Gná's ACE Test Requirement:**
- Added TC-43.9 to prove `shell: false` enforcement
- Uses `vi.spyOn` to inspect subprocess invocation
- Validates both validation layer (regex) and execution layer (spawn options)

### Acceptance Criteria
- [ ] All 9 test cases pass
- [ ] `npm test` completes in <5 seconds (no network)
- [ ] PWA crypto extracted to `dashboard/crypto.js`
- [ ] `validateIntent()` function exists in `src/intent-handler.ts`
- [ ] Tests run in CI without external dependencies

**Status:** Contract 43 finalized and approved by Council

---

**Council Members:**
- **Gróa** (1481243736758292502) — Architecture Specialist
- **Gná** (1481244011368022139) — Security Specialist  
- **Vár** (1481244153017798708) — Test Specialist

**Moderator:** Aria (1478861544816115935)

---

## Gróa — Headless E2E Testing Architecture (2026-03-13)

### Decision: Function-to-function testing, no network simulation

The repeated crypto envelope mismatches (3 occurrences across Phase 0 and Phase 2) share a root cause: two independent implementations of the same wire protocol with no shared source of truth and no round-trip test.

**Architecture:**
- No Miniflare, no Wrangler dev, no ports, no browser. The CF Worker is a dumb KV pipe — we test around it.
- Extract PWA crypto from inline `<script>` in `dashboard/index.html` into `dashboard/crypto.js` (importable by Vitest).
- Test file: `test/integration/intent-roundtrip.test.ts` — 9 test cases (Contract 43).
- All tests run under `npm test` in < 5 seconds with zero network dependencies.

**Wire format standardization:**
- IV: 16 bytes, base64-encoded (matching existing outbound format)
- Envelope: `{ iv, ciphertext, authTag, timestamp, nonce }` — all base64
- Inner plaintext: `{ content: JSON.stringify(payload), timestamp }` — matching daemon's `decryptPayload` expectations

**Lesson codified:** Every new encrypt→decrypt path gets a round-trip test BEFORE deployment. No exceptions.

### Gná - Security Mandates for Phase 2 Alerting (ntfy.sh) (2026-03-13)
The use of `ntfy.sh` as a public message bus for outbound alerting is approved under Option 1a (Plaintext Pings), provided it strictly adheres to the following threat mitigations:
1. **No Context Leakage**: The alert string must be purely structural (e.g., "📬 3 new tasks distilled"). It must NEVER contain user names, project names, email subjects, or any sensitive context from the task payload.
2. **Topic Secrecy (Anti-Enumeration)**: The `NTFY_TOPIC` environment variable must be a high-entropy string (e.g., a 32-character hex string or UUID). It must not be guessable. If discovered, an attacker will only see meaningless numerical pings.
3. **No Action Links**: The notification payload must not contain any URLs with sensitive authentication tokens. The user must manually open their local PWA to authenticate and view the decrypted data.

---

## Gróa — ntfy.sh Outbound Alerting Architecture (2026-03-13)

### Decision: Option 1a — Plaintext structural pings via ntfy.sh

**Rationale:** The ntfy iOS app cannot decrypt AES-GCM payloads. Encrypting the notification would render it unreadable on the lock screen. Since the alert contains zero corporate data (just a count like "📬 3 new tasks"), plaintext is acceptable per the Blood-Brain Barrier policy.

**Architecture:**
- New file: `src/notifier.ts` (~20 lines)
- Called from `orchestrator.ts` after successful distillation
- Plain HTTP POST to `https://ntfy.sh/{NTFY_TOPIC}`
- Headers: `Title: Greenkeeper`, `Priority: 3`, `Tags: seedling`
- Body: structural ping only, e.g. "📬 3 new tasks distilled"

**Configuration:**
- `NTFY_TOPIC`: 32-char hex string from CSPRNG (`crypto.randomBytes(16).toString('hex')`)
- `NTFY_ENABLED`: boolean toggle in `.env`
- No other ntfy config needed

**Constraints:**
- Alert body MUST be structural (counts, statuses). NEVER include names, subjects, content, or identifiers from corporate data.
- No URLs with tokens in the notification body.
- The Glass (PWA) remains the sole interface for reading actual content and submitting intents.
- ntfy is a "go check" signal, not a data channel.

**Phase 3/4 note:** Native iOS app (Expo/React Native) with APNs, Secure Enclave key storage, and FaceID gating is the long-term replacement for both ntfy and the PWA.

---

## 2026-03-13: Phase 2 Outbound Alerting (ntfy.sh)

### Context
The daemon currently falls back to a Discord webhook for alerting when new distillations are ready. Discord sees the payload in plaintext, which violates the Blood-Brain Barrier principle.

### Problem Statement
We need an out-of-band notification system to alert Lasse when:
- New task distillations are ready
- Task execution completes
- Panic switch triggers

### Decision: ntfy.sh with Plaintext Structural Pings (Option 1a)

**Proposed by:** Gróa (Architect)  
**Security Approved by:** Gná (Security Specialist)  
**Date:** 2026-03-13 20:50 GMT+1

---

## Gróa — Architecture: ntfy.sh Integration

### Core Insight
Notifications are pings, not data channels. The Cloudflare Worker relay already handles encrypted payload delivery. We just need a lightweight way to tell Lasse "go check the Glass."

### Solution: Plaintext Structural Pings to Secret Topic
Send generic status pings (no corporate data) to a high-entropy ntfy.sh topic. The iOS ntfy app displays the notification, user taps, and opens the PWA Dashboard.

### Architecture
```
Daemon detects new distillation
  → Compose alert string: "📬 3 new tasks distilled"
  → POST to https://ntfy.sh/{NTFY_TOPIC}
  → ntfy pushes to iOS app via APNs
  → User taps → opens PWA dashboard
```

### Implementation
**One new file:** `src/notifier.ts` (~20 lines)

```typescript
export async function notify(message: string): Promise<void> {
  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: {
      'Title': 'Greenkeeper',
      'Priority': '3',
      'Tags': 'seedling'
    },
    body: message
  });
}
```

### Configuration
Two new `.env` variables:
- `NTFY_TOPIC` — 32-char hex string (generated via `crypto.randomBytes(16).toString('hex')`)
- `NTFY_ENABLED=true` — Feature flag

### Why Not E2EE?
The iOS ntfy app cannot decrypt AES-GCM payloads. Sending encrypted blobs would display gibberish on the lock screen. A generic structural ping contains no sensitive data, so encryption adds complexity for zero security gain.

### Allowed Notification Formats
- ✅ "📬 3 new tasks distilled"
- ✅ "✅ Task execution complete"
- ✅ "🚨 Panic switch triggered"
- ❌ "📬 Email from John Doe about Project X"

**Status:** Approved by Council

---

## Gná — Security: ntfy.sh Threat Model

### Threat Assessment
Using a public push server (ntfy.sh) introduces a metadata exposure risk, but it is acceptable under the following constraints.

### What ntfy.sh Sees
1. **IP Address** — The daemon's public IP (corporate network egress)
2. **Timestamp** — When the notification was sent
3. **Topic Name** — The random string used as the channel identifier
4. **Notification Body** — The plaintext ping message

### What ntfy.sh Does NOT See
- The actual distilled task content (stored in CF Worker KV, E2EE)
- The encryption key
- The PWA dashboard URL
- The corporate message source data

### Mandatory Security Guardrails

#### 1. No Context Leakage
Alert strings must be strictly structural with no corporate context.

**ALLOWED:**
- "📬 2 new tasks distilled"
- "✅ Task #abc123 complete"
- "🚨 Panic switch triggered"

**DENIED:**
- "📬 Email from John Doe about Grundfos Project X"
- "✅ Task: Update customer database with PII"
- "🚨 Detected anomalous volume in inbox"

**Enforcement:** The `notify()` function must never receive the actual payload data. It only receives pre-sanitized structural strings from the orchestrator.

#### 2. Topic Secrecy
The `NTFY_TOPIC` must be a high-entropy string to prevent brute-force discovery.

**Requirements:**
- Minimum 32 characters
- Generated via CSPRNG (e.g., `crypto.randomBytes(16).toString('hex')`)
- Never logged or committed to Git
- Stored in `.env` (excluded via `.gitignore`)

**Threat Model:** If an attacker discovers the topic, they see meaningless pings like "📬 3 new tasks." Without access to the CF Worker KV or the encryption key, the pings provide no actionable intelligence.

#### 3. No Action Links
Notifications must NOT contain URLs with sensitive tokens or parameters.

**DENIED:**
- "New tasks: https://dashboard.example.com?key=abc123"
- "Click here: https://relay.workers.dev/intent?token=xyz"

**ALLOWED:**
- Plain text notification with no links
- User manually opens PWA from home screen

**Rationale:** A URL with embedded secrets could leak via notification history, system logs, or analytics.

### Risk Acceptance
The metadata exposure (IP, timestamp, structural ping) is acceptable for a Phase 2 alerting mechanism. The notification contains zero corporate data, and the topic is secret.

For Phase 3/4, we will evaluate a native iOS app with APNs and Secure Enclave, which eliminates the third-party relay entirely.

**Status:** Security constraints approved by Gná

---

## Vár — Quality: Contract 44 Test Specification

### Contract 44: Outbound Notification (ntfy.sh)

**Component:** Outbound Alerting  
**Test File:** `src/notifier.test.ts`  
**Test Count:** 5 (all automated, no production alerts during tests)

### Test Cases

#### TC-44.1: Notification Sends to Correct Topic
```gherkin
GIVEN: notifier.ts configured with test topic
WHEN: notify(message) called
THEN: MUST POST to https://ntfy.sh/{NTFY_TOPIC}
  AND: MUST include Title: "Greenkeeper" header
  AND: MUST include Priority: "3" header
  AND: MUST include Tags: "seedling" header
```

**Implementation:** Mock `fetch` using `vi.spyOn(global, 'fetch')`

#### TC-44.2: No Payload Data Leakage
```gherkin
GIVEN: Orchestrator has distilled task with content "Email from John Doe"
WHEN: notify() called from orchestrator
THEN: Message body MUST NOT contain "John Doe"
  AND: Message body MUST be structural only (e.g., "📬 2 new tasks")
  AND: MUST NOT contain raw payload fields
```

**Critical:** This test proves the Blood-Brain Barrier is maintained.

#### TC-44.3: Notification Disabled Flag
```gherkin
GIVEN: NTFY_ENABLED=false in .env
WHEN: notify() called
THEN: MUST NOT send HTTP request
  AND: MUST log "Notifications disabled"
```

#### TC-44.4: Network Error Handling
```gherkin
GIVEN: ntfy.sh is unreachable (timeout/500 error)
WHEN: notify() called
THEN: MUST log error
  AND: MUST NOT crash daemon
  AND: MUST NOT retry infinitely
```

**Rationale:** Notification failures must not block the orchestrator loop.

#### TC-44.5: Topic Entropy Validation
```gherkin
GIVEN: NTFY_TOPIC in .env
WHEN: notifier.ts loads configuration
THEN: MUST reject topics with < 32 characters
  AND: MUST reject topics with only alphanumeric (no entropy)
  AND: MUST accept 32-char hex strings
```

**Implementation:** Validate during module initialization, refuse to start if weak.

### Local Testing Strategy
All tests use mocked `fetch` via `vi.spyOn(global, 'fetch')`. No actual HTTP requests are made during `npm test`.

**Test topic:** Use `NTFY_TOPIC=test-greenkeeper-local-do-not-use` in test environment.

### Acceptance Criteria
- [ ] All 5 test cases pass
- [ ] No production HTTP requests during `npm test`
- [ ] `notify()` function never receives raw payload data (code review + test)
- [ ] Topic entropy validated at startup

**Status:** Contract 44 finalized by Vár

---

**Council Members:**
- **Gróa** (1481243736758292502) — Architecture Specialist
- **Gná** (1481244011368022139) — Security Specialist  
- **Vár** (1481244153017798708) — Test Specialist

**Moderator:** Aria (1478861544816115935)
