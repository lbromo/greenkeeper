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
