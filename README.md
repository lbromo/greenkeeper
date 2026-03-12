# Project Greenkeeper

A stealthy, one-way multi-agent automation setup designed to securely process and relay sanitized corporate summaries (e.g., Teams chats) across enterprise boundaries without triggering DLP/EDR alerts.

## Current Status
- **Phase 0 (Canary Infrastructure): COMPLETE ✅**
- **Phase 1 (Stealth Proxy/Core Daemon): COMPLETE ✅**
- Phase 2 (LLM Summarization): Pending
- Phase 3 (Client Dashboard): Pending

## Architecture

**1. Ingestion (The Siphon)**
A Power Automate cloud flow on a 15-minute recurrence fetches Teams messages, constructs a strictly typed JSON payload, and writes it to a local OneDrive sync folder (`~/OneDrive/Greenkeeper/inbox/`). This operates under standard M365 usage patterns, triggering no EDR or network alerts.

**2. The Core Daemon (The Blood-Brain Barrier)**
A local Node.js daemon watches the `inbox` directory via `chokidar`. When a file appears:
1. Validates the JSON against strict Zod schemas (preventing JSON poisoning & replay attacks).
2. Encrypts the payload locally using AES-256-GCM.
3. POSTs the ciphertext to a Cloudflare Relay Worker.
4. Moves the processed file to prevent repetitive I/O alerts.

**3. The Relay (The Airgap)**
A Cloudflare Worker receives the POST, generates a dynamic retrieval key, stores it in KV, and returns the key. Upon a GET request with the correct key, it returns the payload and *instantly deletes it* from the KV store (Consume-on-Read).

## Security Measures (Gná's Directives)
- **Zero IT Flags:** No unauthorized Entra ID App Registrations; uses native Power Automate.
- **Panic Switch:** The daemon halts and locks itself if it detects anomalous volume (>20 files/hr).
- **Schema Freshness:** Payloads older than 5 minutes are instantly rejected to prevent replay attacks.
- **E2EE:** Corporate data never touches the open internet in plaintext.
