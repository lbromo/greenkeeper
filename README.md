# Project Greenkeeper ⛳

_"Bring work to the golf course."_

A multi-agent system running on a corporate Mac that automates daily work tasks (Teams, email, PM tracking, code, demos) and securely delivers sanitized summaries to your personal devices — without corporate data ever leaving the enterprise boundary.

## Status
- **Phase:** Phase 1 Implementation (Complete & Verified)
- **Phase 0 Canary:** Pending Deployment
- **Created:** 2026-03-11

## Core Architecture (The Stealth Proxy)

Greenkeeper uses a strict outbound-only, zero-admin-consent architecture to evade EDR and DLP triggers. 

```
┌──────────────────────── Corporate Network ────────────────────────┐
│                                                                 │
│ [M365 Cloud] (Teams/Emails)                                     │
│      │                                                          │
│   (Power Automate - Batched 15m)                                │
│      ▼                                                          │
│ [OneDrive/Greenkeeper/inbox/] ──(fs.watch)──┐                   │
│                                             ▼                   │
│                                      [Node Daemon]              │
│                                             │                   │
│                                      [Sanitizer Pipeline]       │
│                                      1. Regex Blocklist         │
│                                      2. Azure AI Foundry LLM    │
│                                      3. Safety Net Limits       │
│                                             │                   │
│                                      [AES-256-GCM Crypto]       │
│                                             │                   │
└─────────────────────────────────────────────┼───────────────────┘
                                              │ (Outbound HTTPS)
                                              ▼
                                 [Cloudflare KV Relay Worker] (20m TTL, Consume-on-Read)
                                              │ (Outbound HTTPS)
                                              ▼
                                     [E2EE PWA Client]
                                          Lasse 🏌️
```

## Security Posture: The Blood-Brain Barrier

**Policy: Zero Trust Egress**
- ✅ Encrypted JSON payloads containing strictly typed Enum statuses and sanitized strings.
- ❌ **No inbound ports.** All traffic is outbound HTTPS.
- ❌ **No Graph API App Registrations.** Avoids triggering M365 Admin Consent alerts.
- ❌ **No Webhooks.** Power Automate writes strictly to a local OneDrive sync folder.
- ❌ **No persistent payloads.** Cloudflare KV acts as a dumb relay; payloads are burned upon read.
- ❌ **No plain-text C2.** Inbound intent is integer-indexed against a local `aliases.json` file.
- 🔴 **Panic Switch:** System halts, locks, and alerts via E2EE if anomalous file volume is detected (>20 files/hr).

## Council Architecture Sign-off

The system architecture and strict constraints were debated, stress-tested, and ratified by the AI Council:
- **Gróa (Architecture):** Designed the `fs.watch` ingestion boundary and Cloudflare relay.
- **Gná (Security):** Enforced the strict Blood-Brain Barrier, Panic Switch, and consume-on-read relay logic.
- **Vár (Testing):** Formulated and verified the 77-test suite validating schema compliance and cryptographic entropy.
- **Aria (Orchestration):** Managed the OpenCode sub-agent to strictly implement the Council's boundaries.

## Repository Structure

```
greenkeeper/
├── README.md              # This file
├── docs/                  # Architectural and Security reflections
├── openspec/              # OpenSpec GIVEN/WHEN/THEN contracts
├── src/                   # The core Node daemon
│   ├── orchestrator.ts    # File watcher and Panic Switch
│   ├── schema-validator.ts# Zod payload validation
│   ├── crypto.ts          # AES-256-GCM encryption layer
│   └── sanitizer/         # 3-Stage Pipeline
├── relay-worker/          # Cloudflare Worker code
└── dashboard/             # PWA Client code (pending Phase 2)
```
