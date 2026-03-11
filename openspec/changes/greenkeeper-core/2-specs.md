# 2-specs.md (Greenkeeper Core)

## System Overview
A stealthy, outbound-only multi-agent orchestrator that reads batched corporate M365 data from a local OneDrive sync folder, sanitizes it via Azure AI Foundry, and securely transmits encrypted summaries to a Cloudflare KV relay worker for consumption by a personal device via PWA.

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
- The Cloudflare Worker SHALL act as a "dumb" key-value store and MUST NOT possess decryption keys.

### 4. PWA Client
- The end-user client SHALL be a Progressive Web App (PWA).
- The decryption key SHALL be stored strictly in the client device's `sessionStorage` and MUST NOT be transmitted over the network.
- Inbound intents from the client to the orchestrator (if implemented) MUST be integer-based indices mapping to pre-defined local scripts (`aliases.json`) to eliminate prompt injection / C2 risks.

### 5. Deployment & Execution
- The orchestrator SHALL be written in TypeScript running on Node.js to minimize EDR-visible artifacts.
- The orchestrator SHALL limit its file footprint (target: ~10 files).
- Processed OneDrive ingestion files SHALL be moved to an `archive/` folder, not deleted, to evade ransomware-heuristic EDR flags.
- Sub-agents (like OpenCode) SHALL be spawned as isolated subprocesses with strict timeouts, not imported as libraries.

### 6. Volume Threshold Monitoring (Panic Switch)
- The system SHALL monitor the rate of file creation in the ingest directory.
- IF the system detects an anomalous volume of new files (e.g., > 20 files within a 1-hour window), it MUST immediately halt processing.
- The system MUST move all pending files to a `quarantine/` directory.
- The system MUST emit a high-priority `SystemSignal` (e.g., `{"status": "quarantine", "reason": "anomalous_volume_detected"}`) and await an explicit resume intent before processing resumes.
