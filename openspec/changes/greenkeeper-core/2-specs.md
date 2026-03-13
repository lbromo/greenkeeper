# 2-specs.md (Greenkeeper Core)

## System Overview
A stealthy, outbound-only multi-agent orchestrator that reads batched corporate M365 data from a local OneDrive sync folder, sanitizes it via Azure AI Foundry, and securely transmits encrypted summaries to a Cloudflare KV relay worker for consumption by a personal device via PWA.

**Phase 2 Extension:** The system adds an inbound intent channel and task execution capability, enabling the user to confirm/reject/defer extracted tasks and trigger local automation via OpenCode Runner.

## Specifications

### 1. Ingestion Boundary (OneDrive)
- The system SHALL ingest data exclusively by watching a local directory (`~/OneDrive/Greenkeeper/inbox/`) using `fs.watch` or a cron-based filesystem read.
- The system SHALL NOT make direct network requests to Microsoft Graph API for ingestion.
- The system SHALL NOT store, request, or manage M365 authentication tokens.
- The system SHALL validate all incoming files against a strict JSON schema. Files failing validation MUST be quarantined to a `rejected/` directory.

### 2. The 3-Stage Sanitizer (Blood-Brain Barrier)
- **Stage 1 (Deterministic Blocklist):** The system SHALL execute a regex-based hard-credential sweeper against all text before LLM processing (Contract 12).
- **Stage 2 (Semantic Redaction):** The system SHALL pass the Stage 1 output to Azure AI Foundry with a system prompt strictly dictating the redaction of customer names, IP addresses, proprietary project names, and financial data (Contract 13).
- **Stage 3 (Safety Net):** The system SHALL execute a final regex sweeper over the LLM output and enforce a strict character-length limit (e.g., 2000 chars) to prevent massive hallucination leaks (Contract 17).
- **Strict Typing:** Output from the sanitizer MUST conform strictly to the `SignalOutput` typescript interface (either `Signal` or `SystemSignal`). Raw strings are forbidden at the barrier boundary.

### 3. Relay and Encryption
- The system SHALL encrypt all `SignalOutput` payloads locally using `AES-256-GCM` before network transmission.
- The system SHALL include an anti-replay nonce and timestamp *inside* the encrypted envelope.
- The system SHALL transmit the encrypted payload to a Cloudflare Worker KV store using standard HTTPS.
- The Cloudflare Worker SHALL enforce a strict Time-To-Live (TTL) of 20 minutes on all payloads.
- The Cloudflare Worker SHALL implement **consume-on-read**: upon GET request, the blob MUST be deleted immediately after retrieval to prevent replay attacks.
- The Cloudflare Worker SHALL act as a "dumb" key-value store and MUST NOT possess decryption keys.

### 4. PWA Dashboard (The Glass) — Phase 2
- The end-user client SHALL be a Progressive Web App (PWA) (`dashboard/index.html`).
- **Key Storage (Contract 22):**
  - The decryption key SHALL be stored strictly in `sessionStorage` and MUST NOT persist to disk.
  - The key MUST be re-prompted on fresh page load.
  - The key MUST be at least 32 bytes (validated client-side).
  - The system SHOULD warn if the key has low entropy (e.g., repeated characters).
  
- **XSS Prevention (Contract 23):**
  - The dashboard MUST NOT use `innerHTML` for rendering decrypted content.
  - The dashboard SHALL use `textContent` or `createElement()` for all user-supplied data.
  - The dashboard SHALL enforce a Content Security Policy (CSP):
    ```
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src https://*.workers.dev;
    ```
  - The dashboard SHALL escape all HTML entities before display.

- **Decryption (Contract 24):**
  - The dashboard SHALL use Web Crypto API (`SubtleCrypto`) for AES-256-GCM decryption.
  - The dashboard MUST validate the authentication tag during decryption.
  - The dashboard SHALL handle decryption failures gracefully (display error, do not crash).

- **Network Integration (Contract 25):**
  - The dashboard SHALL fetch encrypted blobs from the Cloudflare Worker via GET with `?key=` parameter.
  - The dashboard SHALL enforce a 10-second timeout on all network requests.
  - The dashboard SHALL handle HTTP errors (404, 500, timeout) with user-friendly messages.

- **Message Rendering (Contract 27):**
  - The dashboard SHALL truncate messages longer than 2000 characters with "...".
  - The dashboard SHALL NOT auto-link URLs (display as plain text).
  - The dashboard SHALL display timestamps in local timezone.

### 5. Inbound Intent Channel — Phase 2
- **Intent Mapping (`aliases.json`):**
  - Inbound intents from the PWA MUST be integer-only indices (e.g., `1` = confirm, `2` = reject, `3` = defer).
  - The system SHALL maintain a static mapping file (`aliases.json`) that maps integer intents to predefined, parameter-less actions.
  - The system SHALL REJECT any intent not defined in `aliases.json`.
  - The system MUST NOT execute arbitrary strings from LLM output (`suggested_action` is for display only).

- **Intent Encryption:**
  - Intents MUST be encrypted with the same AES-256-GCM key used for outbound signals.
  - Intents MUST include a nonce and timestamp to prevent replay attacks.

- **Intent Delivery:**
  - The PWA SHALL POST encrypted intents to the Cloudflare Worker (`POST /intent`).
  - The Cloudflare Worker SHALL store encrypted intents with a TTL.
  - The local orchestrator SHALL poll for new intents periodically (or piggyback on file events).
  - The orchestrator SHALL decrypt and validate intents before routing to workflows.
  - The orchestrator MUST reject payloads with timestamp > 5 minutes old (Replay Protection).
  - The orchestrator MUST maintain an LRU cache of recently processed nonces.
  - The orchestrator MUST wrap decryption in a non-fatal try/catch to silently drop malformed poisons.
  - The polling mechanism MUST use randomized jitter (e.g., 6-14 minute intervals) to evade beaconing detection.
  - The execution runner MUST use `child_process.spawn` or `execFile` with `shell: false`.

### 6. Task Distiller Workflow — Phase 2
- The system SHALL implement a `task-distiller.ts` workflow that extracts actionable tasks from sanitized message batches.
- The distiller SHALL call Azure AI Foundry with a strict prompt template.
- The distiller SHALL output structured JSON conforming to:
  ```typescript
  interface DistilledTask {
    id: string;
    summary: string;            // max 200 chars, sanitized
    source_message_id: string;
    urgency: 'low' | 'normal' | 'high';
    suggested_action: string;   // max 200 chars, DISPLAY ONLY
    confidence: number;         // 0-1, LLM self-assessed
  }
  ```
- The `suggested_action` field is for DISPLAY ONLY and MUST NOT be executed directly.

### 7. OpenCode Runner Workflow — Phase 2
- The system SHALL implement an `opencode-runner.ts` workflow for executing confirmed tasks.
- **Zero-Trust Execution:**
  - The runner MUST only execute tasks that map to predefined scripts in `aliases.json`.
  - The runner MUST NOT execute arbitrary strings from `suggested_action`.
  - The runner MUST spawn OpenCode as an isolated subprocess with a hard timeout (5 minutes).
  
- **Sandboxing:**
  - The runner SHALL constrain OpenCode to specific project directories.
  - The runner SHALL capture stdout/stderr and sanitize output before relay.
  - The runner SHALL kill the subprocess on timeout and emit a `SystemSignal`.

### 8. Deployment & Execution
- The orchestrator SHALL be written in TypeScript running on Node.js to minimize EDR-visible artifacts.
- The orchestrator SHALL limit its file footprint (target: 15 source files for Phase 2).
- Processed OneDrive ingestion files SHALL be moved to an `archive/` folder, not deleted, to evade ransomware-heuristic EDR flags.
- Sub-agents (like OpenCode) SHALL be spawned as isolated subprocesses with strict timeouts, not imported as libraries.

### 9. Volume Threshold Monitoring (Panic Switch)
- The system SHALL monitor the rate of file creation in the ingest directory.
- IF the system detects an anomalous volume of new files (e.g., > 20 files within a 1-hour window), it MUST immediately halt processing.
- The system SHALL call `watcher.close()` to permanently halt the file watcher.
- The system SHALL create a `~/.greenkeeper/panic.lock` file to prevent restart.
- The system SHALL emit an encrypted `SystemSignal` to the Cloudflare Worker.
- The system MUST NOT resume until the panic lock is manually removed.

---

**Vár — OpenSpec 2-specs.md updated for Phase 2.**
