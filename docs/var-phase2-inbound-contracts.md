# Vár — Phase 2 Inbound Intent Channel Test Contracts
_Project Greenkeeper ⛳ — Inbound Intent Channel & OpenCode Runner_  
**Date:** 2026-03-13  
**Status:** Draft for Review

---

## Contract Overview

**Components:**
- Cloudflare Worker (`relay-worker/index.ts`) — new routes: `POST /intent`, `GET /intents`
- PWA Dashboard (`dashboard/index.html`) — intent encryption and transmission
- Local Daemon (`src/intent-handler.ts`) — intent polling, decryption, validation
- OpenCode Runner (`src/workflows/opencode-runner.ts`) — zero-trust execution boundary

**Risk Level:** 🔴 High → 💀 Critical (per Gná's assessment)  
**Total Test Cases:** 45 (39 automated, 6 manual)

---

## Part 1: Cloudflare Worker Contracts (Contracts 32-34)

### Contract 32: POST /intent Endpoint
```gherkin
GIVEN: PWA sends encrypted intent payload
WHEN: CF Worker receives POST /intent
THEN: MUST store payload in KV with key prefix "in:"
  AND: MUST generate unique key: "in:{timestamp}-{random}"
  AND: MUST set TTL to 20 minutes
  AND: MUST return {success: true} on valid POST
  AND: MUST accept any payload (blind relay, no validation)
```

**Test Cases:**
- **TC-32.1 (Automated):** Valid encrypted payload → stored with `in:` prefix
- **TC-32.2 (Automated):** Key format matches `in:{timestamp}-{random}`
- **TC-32.3 (Automated):** KV entry has TTL of 1200 seconds (20 min)
- **TC-32.4 (Automated):** Response is `{success: true, key: "..."}`
- **TC-32.5 (Automated):** Garbage data accepted (blind relay)
- **TC-32.6 (Automated):** POST without body → 400 error

---

### Contract 33: GET /intents Endpoint
```gherkin
GIVEN: Daemon polls for pending intents
WHEN: CF Worker receives GET /intents
THEN: MUST return array of all "in:*" keys
  AND: MUST NOT decrypt or validate payloads
  AND: MUST return empty array if no intents pending
  AND: MUST NOT delete keys (daemon consumes individually)
```

**Test Cases:**
- **TC-33.1 (Automated):** 3 intents stored → returns array of 3 keys
- **TC-33.2 (Automated):** No intents → returns `{keys: []}`
- **TC-33.3 (Automated):** Only `in:*` keys returned (not `out:*`)
- **TC-33.4 (Automated):** Keys sorted by timestamp (oldest first)

---

### Contract 34: Individual Intent Consumption
```gherkin
GIVEN: Daemon fetches intent by key
WHEN: Daemon sends GET /intent?key={key}
THEN: MUST return encrypted payload
  AND: MUST immediately DELETE key from KV (consume-on-read)
  AND: MUST return 404 if key already consumed or expired
```

**Test Cases:**
- **TC-34.1 (Automated):** GET with valid key → returns payload, key deleted
- **TC-34.2 (Automated):** Second GET with same key → 404 (already consumed)
- **TC-34.3 (Automated):** GET with expired key → 404
- **TC-34.4 (Automated):** GET with non-existent key → 404

---

## Part 2: PWA Dashboard Intent Emission (Contract 35)

### Contract 35: Intent Encryption & Transmission
```gherkin
GIVEN: User clicks Confirm/Reject/Defer button
WHEN: PWA encrypts and sends intent
THEN: MUST create payload: {taskId, intent, timestamp, nonce}
  AND: MUST encrypt with same AES-256-GCM key from sessionStorage
  AND: MUST generate unique nonce (UUID v4)
  AND: MUST include ISO 8601 timestamp
  AND: MUST POST to CF Worker /intent endpoint
  AND: MUST handle network errors gracefully
```

**Test Cases:**
- **TC-35.1 (Automated):** Confirm button → intent=1, valid payload
- **TC-35.2 (Automated):** Reject button → intent=2, valid payload
- **TC-35.3 (Automated):** Defer button → intent=3, valid payload
- **TC-35.4 (Automated):** Nonce is unique UUID v4 format
- **TC-35.5 (Automated):** Timestamp is valid ISO 8601
- **TC-35.6 (Automated):** Encryption uses same key as decryption
- **TC-35.7 (Automated):** POST timeout → error displayed to user
- **TC-35.8 (Automated):** POST 500 error → user-friendly message

---

## Part 3: Daemon Intent Handler (Contracts 36-39)

### Contract 36: Intent Polling Mechanism
```gherkin
GIVEN: Daemon is running
WHEN: File event triggers or 5-minute idle timer expires
THEN: MUST poll GET /intents from CF Worker
  AND: MUST add random jitter (±30 seconds)
  AND: MUST handle network errors gracefully (no crash)
  AND: MUST continue polling on next interval
```

**Test Cases:**
- **TC-36.1 (Automated):** New file event → triggers poll
- **TC-36.2 (Automated):** 5 minutes idle → triggers poll
- **TC-36.3 (Automated):** Jitter applied: interval between 4:30 and 5:30
- **TC-36.4 (Automated):** Network timeout → logs error, continues polling
- **TC-36.5 (Manual):** Observe 10 poll intervals → confirm randomized jitter

---

### Contract 37: Intent Decryption & Schema Validation
```gherkin
GIVEN: Daemon retrieves encrypted intent from CF Worker
WHEN: Daemon decrypts and validates payload
THEN: MUST decrypt with AES-256-GCM
  AND: MUST validate JSON schema: {taskId, intent, timestamp, nonce}
  AND: MUST validate taskId against regex: ^[a-zA-Z0-9-_]+$
  AND: MUST validate intent is integer (1, 2, or 3)
  AND: MUST validate timestamp is ISO 8601 format
  AND: MUST validate nonce is UUID format
```

**Test Cases:**
- **TC-37.1 (Automated):** Valid payload → decryption succeeds
- **TC-37.2 (Automated):** Wrong key → decryption fails, intent dropped
- **TC-37.3 (Automated):** Missing `taskId` → schema validation fails
- **TC-37.4 (Automated):** `taskId` contains `/` → regex validation fails
- **TC-37.5 (Automated):** `intent` is string "1" → type validation fails
- **TC-37.6 (Automated):** `intent` is 99 → out of range, rejected
- **TC-37.7 (Automated):** Invalid timestamp format → rejected
- **TC-37.8 (Automated):** Invalid nonce format → rejected

---

### Contract 38: Replay Protection (Gná Contract 29)
```gherkin
GIVEN: Decrypted intent with timestamp and nonce
WHEN: Daemon validates freshness
THEN: MUST reject payloads with timestamp > 5 minutes old
  AND: MUST check nonce against local cache (~/.greenkeeper/nonce-cache.json)
  AND: MUST reject duplicate nonces
  AND: MUST add processed nonce to cache (LRU, max 100 entries)
  AND: MUST prune cache entries older than 20 minutes
```

**Test Cases:**
- **TC-38.1 (Automated):** Intent with timestamp 6 minutes old → rejected
- **TC-38.2 (Automated):** Intent with timestamp 4 minutes old → accepted
- **TC-38.3 (Automated):** Duplicate nonce → rejected
- **TC-38.4 (Automated):** New nonce → accepted, added to cache
- **TC-38.5 (Automated):** Cache exceeds 100 entries → oldest evicted (LRU)
- **TC-38.6 (Automated):** Cache pruning removes entries > 20 min old
- **TC-38.7 (Manual):** Daemon restart → nonce cache persists from disk

---

### Contract 39: Poison Resistance (Gná Contract 30)
```gherkin
GIVEN: Malformed ciphertext or invalid JSON from CF Worker
WHEN: Daemon attempts to decrypt and parse
THEN: MUST wrap operation in non-fatal try/catch
  AND: MUST silently delete malformed key from KV
  AND: MUST log error to file (not console)
  AND: MUST continue processing remaining intents
  AND: MUST NOT crash orchestrator loop
```

**Test Cases:**
- **TC-39.1 (Automated):** Garbage ciphertext → caught, key deleted
- **TC-39.2 (Automated):** Valid ciphertext, invalid JSON → caught, key deleted
- **TC-39.3 (Automated):** Decryption throws error → loop continues
- **TC-39.4 (Automated):** 10 malformed intents in queue → all handled, no crash
- **TC-39.5 (Automated):** Error logged to `~/.greenkeeper/logs/intent-errors.log`

---

## Part 4: Execution Boundary (Contracts 40-42)

### Contract 40: Aliases.json Mapping (Gná Contract 31)
```gherkin
GIVEN: Validated intent with integer value
WHEN: Daemon maps intent to action
THEN: MUST read aliases.json for intent mapping
  AND: MUST reject intents not defined in aliases.json
  AND: MUST map integer to hardcoded script path or command array
  AND: MUST NEVER execute payload-provided strings
  AND: MUST log rejected intents to file
```

**Test Cases:**
- **TC-40.1 (Automated):** Intent 1 → maps to `aliases.json` entry "opencode-runner"
- **TC-40.2 (Automated):** Intent 2 → maps to "log-rejection"
- **TC-40.3 (Automated):** Intent 99 (not in aliases.json) → rejected
- **TC-40.4 (Automated):** `aliases.json` missing → daemon refuses to process intents
- **TC-40.5 (Automated):** `aliases.json` malformed → daemon refuses to start

**Required `aliases.json` structure:**
```json
{
  "1": {
    "name": "confirm-task",
    "handler": "opencode-runner",
    "description": "Execute confirmed task via OpenCode"
  },
  "2": {
    "name": "reject-task",
    "handler": "log-rejection",
    "description": "Log rejected task, no execution"
  },
  "3": {
    "name": "defer-task",
    "handler": "log-deferral",
    "description": "Log deferred task for later review"
  }
}
```

---

### Contract 41: OpenCode Runner Invocation
```gherkin
GIVEN: Intent mapped to "opencode-runner" handler
WHEN: Daemon spawns OpenCode subprocess
THEN: MUST use child_process.spawn with shell: false
  AND: MUST pass taskId as validated argument (no shell expansion)
  AND: MUST set hard timeout (5 minutes)
  AND: MUST constrain to specific project directories
  AND: MUST capture stdout/stderr
  AND: MUST kill process on timeout
```

**Test Cases:**
- **TC-41.1 (Automated):** Subprocess spawned with `shell: false`
- **TC-41.2 (Automated):** `taskId` passed as array argument (not string concatenation)
- **TC-41.3 (Automated):** Process killed after 5 minutes
- **TC-41.4 (Automated):** Process completes in 30 seconds → stdout captured
- **TC-41.5 (Automated):** Process writes to `/tmp` → blocked (directory constraint)
- **TC-41.6 (Manual):** Observe process isolation (no parent env vars leaked)

---

### Contract 42: Output Sanitization & Relay
```gherkin
GIVEN: OpenCode subprocess completes
WHEN: Daemon captures output
THEN: MUST sanitize stdout/stderr (strip secrets, paths)
  AND: MUST truncate output to max 2000 chars
  AND: MUST encrypt sanitized output
  AND: MUST relay to CF Worker as new outbound signal
  AND: MUST emit SystemSignal if process timed out
```

**Test Cases:**
- **TC-42.1 (Automated):** Output contains "API_KEY=abc123" → sanitized
- **TC-42.2 (Automated):** Output > 2000 chars → truncated with "..."
- **TC-42.3 (Automated):** Sanitized output encrypted and relayed
- **TC-42.4 (Automated):** Process timeout → `{status: "timeout"}` signal emitted
- **TC-42.5 (Automated):** Process crash → `{status: "error"}` signal emitted

---

## Summary Table

| Contract | Focus Area | Test Cases | Automated | Manual |
|:---|:---|:---:|:---:|:---:|
| 32 | CF Worker POST /intent | 6 | 6 | 0 |
| 33 | CF Worker GET /intents | 4 | 4 | 0 |
| 34 | CF Worker Consume-on-Read | 4 | 4 | 0 |
| 35 | PWA Intent Emission | 8 | 8 | 0 |
| 36 | Daemon Polling | 5 | 4 | 1 |
| 37 | Decryption & Validation | 8 | 8 | 0 |
| 38 | Replay Protection | 7 | 6 | 1 |
| 39 | Poison Resistance | 5 | 5 | 0 |
| 40 | Aliases.json Mapping | 5 | 5 | 0 |
| 41 | OpenCode Runner | 6 | 5 | 1 |
| 42 | Output Sanitization | 5 | 5 | 0 |
| **TOTALS** | | **63** | **60** | **3** |

---

## Critical Vulnerabilities in Current Codebase

**None yet — these are net-new components.**

However, the following gaps exist:
- ❌ `relay-worker/index.ts` lacks `POST /intent` and `GET /intents` routes
- ❌ `dashboard/index.html` lacks intent encryption and POST logic
- ❌ `src/intent-handler.ts` does not exist
- ❌ `src/workflows/opencode-runner.ts` does not exist
- ❌ `aliases.json` does not exist
- ❌ `~/.greenkeeper/nonce-cache.json` does not exist

---

## Acceptance Gate

**Definition of Done for Inbound Intent Channel:**
- [ ] All 60 automated tests pass at 100%
- [ ] All 3 manual tests documented and verified
- [ ] `aliases.json` created with at least 3 intent mappings
- [ ] Nonce cache persists across daemon restarts
- [ ] OpenCode runner spawned with `shell: false` (verified via test)
- [ ] Zero payload-provided strings executed (code review + test)

**Once accepted:**
- Phase 2 is complete
- Greenkeeper is a fully bidirectional encrypted task automation system
- Begin 2-week monitoring period for Phase 2 stability

---

**Vár: Phase 2 Inbound Intent contracts complete. Awaiting Council review.**
