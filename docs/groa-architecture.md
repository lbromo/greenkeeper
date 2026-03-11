# Gróa — Architecture Design Document
_Project Greenkeeper ⛳ | Final — 2026-03-11_

---

## 1. Executive Summary

Greenkeeper is a covert multi-agent automation system running on a corporate Mac.
It watches a local OneDrive folder for batched JSON files written by Power Automate,
processes them through workflows and a 3-stage sanitizer, encrypts the output, and
relays it to a personal PWA via a Cloudflare Worker.

The daemon makes **zero** direct API calls to Microsoft. All M365 data arrives via
the native OneDrive sync client — invisible to EDR.

---

## 2. Why This Architecture (Decision Record)

### The Problem
Grundfos Conditional Access blocks all direct Graph API access from local tools:
- `az` CLI: 403 — scopes limited to Azure management
- `Connect-MgGraph`: Hard "Approval Required" admin consent screen
- App Registration: Would create an IT-auditable artifact

### The Solution
Use Power Automate (a first-party M365 service with implicit auth) to write data
to OneDrive. The local daemon reads files from a synced folder. No tokens. No
Graph calls. No PowerShell.

### Options Evaluated

| Option | Auth | EDR Risk | IT Visibility | Verdict |
|--------|------|----------|---------------|---------|
| `az` CLI token | ❌ Blocked | Medium | Low | Dead |
| MgGraph PowerShell | ❌ Blocked | High (AMSI) | Medium | Dead |
| teams-mcp (App Reg) | ⚠️ Requires admin | Low | **High** | Last resort |
| **Power Automate + OneDrive** | ✅ Implicit | **None** | Medium | **Selected** |

---

## 3. System Architecture

```
┌─────────────────── M365 CLOUD (Grundfos Tenant) ───────────────────┐
│                                                                      │
│   Power Automate Flows (personal, no admin approval needed)          │
│                                                                      │
│   ┌─────────────────────┐  ┌─────────────────────┐                  │
│   │ "Personal chat       │  │ "Task sync to        │                  │
│   │  backup"             │  │  OneDrive"           │  ... (future)    │
│   │                      │  │                      │                  │
│   │ Trigger: Schedule    │  │ Trigger: Schedule    │                  │
│   │ (every 15 min)       │  │ (every 15 min)       │                  │
│   │                      │  │                      │                  │
│   │ Action: Get unread   │  │ Action: Get assigned │                  │
│   │ Teams messages       │  │ Planner tasks        │                  │
│   │                      │  │                      │                  │
│   │ Action: Compose JSON │  │ Action: Compose JSON │                  │
│   │ (NOT string interp!) │  │ (NOT string interp!) │                  │
│   │                      │  │                      │                  │
│   │ Action: Create file  │  │ Action: Create file  │                  │
│   │ → OneDrive           │  │ → OneDrive           │                  │
│   └─────────┬────────────┘  └─────────┬────────────┘                  │
│             │                         │                               │
│             └────────┬────────────────┘                               │
│                      ▼                                                │
│        OneDrive / Greenkeeper / inbox /                               │
│        ├── batch-2026-03-11T22-00.json                                │
│        ├── batch-2026-03-11T22-15.json                                │
│        └── ...                                                        │
│                                                                      │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
          OneDrive sync (native macOS client)
          ─────────── INVISIBLE TO EDR ───────────
                       │
┌──────────────────────▼───────────────────────────────────────────────┐
│                                                                       │
│                     CORPORATE MAC (Lasse's machine)                   │
│                                                                       │
│  ~/OneDrive/Greenkeeper/                                              │
│  ├── inbox/          ← new batched JSON files land here               │
│  ├── processed/      ← successfully handled (weekly cleanup)          │
│  └── rejected/       ← invalid/malformed (quarantined)                │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    ORCHESTRATOR (Node.js / launchd)              │  │
│  │                                                                  │  │
│  │  fs.watch(~/OneDrive/Greenkeeper/inbox/)                         │  │
│  │       │                                                          │  │
│  │       ▼                                                          │  │
│  │  ┌──────────────────┐                                            │  │
│  │  │ SCHEMA VALIDATOR  │  ← Trust boundary.                        │  │
│  │  │                   │     Rejects: malformed JSON, >1MB,        │  │
│  │  │ - File size check │     stale timestamps (>5min),             │  │
│  │  │ - JSON parse      │     unknown source types,                 │  │
│  │  │ - Field types     │     field length overflows.               │  │
│  │  │ - Length limits   │                                           │  │
│  │  │ - Timestamp check │  Invalid → mv to rejected/                │  │
│  │  └────────┬─────────┘                                            │  │
│  │           │ valid                                                 │  │
│  │           ▼                                                      │  │
│  │  ┌──────────────────┐                                            │  │
│  │  │ VOLUME THRESHOLD  │  ← Panic switch.                          │  │
│  │  │ (rate limiter)    │     >20 files/hour: halt daemon,          │  │
│  │  │                   │     quarantine inbox/, emit encrypted      │  │
│  │  └────────┬─────────┘     alert to personal device.              │  │
│  │           │ ok                                                   │  │
│  │           ▼                                                      │  │
│  │  ┌──────────────────────────────────────────────────────┐        │  │
│  │  │ WORKFLOW ROUTER                                       │        │  │
│  │  │                                                       │        │  │
│  │  │ source: "teams"   → teams-replier.ts                  │        │  │
│  │  │ source: "planner" → task-tracker.ts                   │        │  │
│  │  │ source: "email"   → email-drafter.ts                  │        │  │
│  │  │ (future)          → opencode-runner.ts, demo-gen.ts   │        │  │
│  │  │                                                       │        │  │
│  │  │         ┌────────────────────┐                        │        │  │
│  │  │         │  AZURE AI FOUNDRY  │  Enterprise-approved   │        │  │
│  │  │         │  (summarize,       │  LLM. Used for both    │        │  │
│  │  │         │   draft replies,   │  workflow processing    │        │  │
│  │  │         │   classify)        │  and Stage 2 redaction. │        │  │
│  │  │         └────────────────────┘                        │        │  │
│  │  └──────────────────────┬───────────────────────────────┘        │  │
│  │                         │ workflow output                        │  │
│  │                         ▼                                        │  │
│  │  ┌──────────────────────────────────────────────────────┐        │  │
│  │  │ 3-STAGE SANITIZER (Blood-Brain Barrier)               │        │  │
│  │  │                                                       │        │  │
│  │  │  Stage 1: Regex Blocklist                             │        │  │
│  │  │  ├── IPs, UUIDs, connection strings                   │        │  │
│  │  │  ├── Email addresses, phone numbers                   │        │  │
│  │  │  ├── Code blocks, API keys, tokens                    │        │  │
│  │  │  └── Customer PII patterns                            │        │  │
│  │  │           │                                           │        │  │
│  │  │  Stage 2: LLM Semantic Redactor (Azure AI)            │        │  │
│  │  │  ├── Catches what regex misses (semantic leaks)       │        │  │
│  │  │  └── Subject to prompt injection — hence Stage 3      │        │  │
│  │  │           │                                           │        │  │
│  │  │  Stage 3: Final Regex Sweep                           │        │  │
│  │  │  ├── Re-run Stage 1 (catch LLM hallucinations)        │        │  │
│  │  │  └── Enforce max output length                        │        │  │
│  │  └──────────────────────┬───────────────────────────────┘        │  │
│  │                         │ sanitized output                       │  │
│  │                         ▼                                        │  │
│  │  ┌──────────────────────────────────────────────────────┐        │  │
│  │  │ CRYPTO (AES-256-GCM)                                  │        │  │
│  │  │                                                       │        │  │
│  │  │  Envelope: { iv, ciphertext, tag, timestamp, nonce }  │        │  │
│  │  │  Replay protection: reject if age > 20 min            │        │  │
│  │  │  Key: pre-shared, never transmitted over network      │        │  │
│  │  └──────────────────────┬───────────────────────────────┘        │  │
│  │                         │ encrypted blob                         │  │
│  │                         ▼                                        │  │
│  │            HTTPS POST → CF Worker                                │  │
│  │                                                                  │  │
│  │  mv original file → processed/                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKER (Dumb Pipe)                     │
│                                                                       │
│  PUT /blob/{id}  → Store encrypted blob in KV (TTL: 20 min)         │
│  GET /blob/{id}  → Return blob + DELETE from KV                      │
│                                                                       │
│  Zero knowledge: cannot decrypt. Stores opaque bytes.                │
│  No auth beyond the blob ID (unguessable UUID).                      │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
          Discord webhook: "📬 New summary available"
          (batched windows: 08:00, 12:00, 16:00 only)
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     PWA (Personal Phone)                              │
│                                                                       │
│  Fetches blob from CF Worker → decrypts locally with pre-shared key  │
│  Displays sanitized summary                                          │
│                                                                       │
│  Inbound intents: integer-only aliases (mapped via aliases.json)      │
│  e.g. { "intent": 1 } = "approve Teams reply"                       │
│       { "intent": 2 } = "dismiss"                                    │
│  No free text crosses the barrier inbound.                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Manifest (11 Files)

```
greenkeeper/
├── orchestrator.ts            # fs.watch loop, workflow router, panic switch
│                              # Runs as launchd daemon. NO network calls to Microsoft.
│
├── schema-validator.ts        # Trust boundary: validates OneDrive JSON files
│                              # File size <1MB, strict field types, length limits,
│                              # timestamp freshness <5min, source enum whitelist.
│
├── crypto.ts                  # AES-256-GCM encrypt/decrypt
│                              # Pre-shared key. Envelope: iv, tag, timestamp, nonce.
│                              # Replay protection: reject >20min. node:crypto only.
│
├── aliases.json               # Integer → intent mapping for inbound commands
│                              # No free text allowed inbound.
│
├── workflows/
│   ├── teams-replier.ts       # Phase 0. Summarize Teams messages, draft replies.
│   ├── task-tracker.ts        # Phase 1. Track Planner tasks, generate status.
│   ├── email-drafter.ts       # Phase 2. Draft responses to flagged emails.
│   ├── demo-gen.ts            # Phase 2. Generate demo content.
│   └── opencode-runner.ts     # Phase 3. Spawn OpenCode subprocess (sandboxed).
│
├── sanitizer/
│   ├── sanitizer.ts           # Pipeline coordinator: Stage 1 → 2 → 3
│   ├── stage1-regex.ts        # Deterministic blocklist
│   ├── stage2-llm.ts          # Semantic redactor via Azure AI Foundry
│   └── stage3-final.ts        # Final sweep + length enforcement
│
├── relay-worker/
│   └── index.ts               # CF Worker: KV PUT/GET, 20-min TTL, zero-knowledge
│
└── dashboard/
    └── index.html             # PWA: fetch, decrypt, display, send intents
```

---

## 5. Data Interfaces

### OneDrive Ingest Schema (Teams batch)
```typescript
interface OneDriveTeamsPayload {
  source: "power_automate";
  version: "1.0";
  timestamp: string;           // ISO 8601, must be <5min old
  messages: Array<{
    id: string;                // max 128 chars
    sender: string;            // display name only, max 100 chars
    preview: string;           // max 280 chars
    received_at: string;       // ISO 8601
    chat_id?: string;          // optional, max 128 chars
    urgency?: "low" | "normal" | "high";
  }>;
}
```

### Outbound Signal (sanitized, encrypted)
```typescript
interface SignalOutput {
  type: "summary" | "alert" | "draft";
  sender_tier: "manager" | "peer" | "external" | "system";
  urgency: "low" | "normal" | "high" | "critical";
  topic: string;               // sanitized topic label
  action: "reply" | "review" | "acknowledge" | "none";
  time_window: "now" | "today" | "this_week";
  channel: "teams" | "email" | "planner";
  count: number;
}
```

### System Signal
```typescript
interface SystemSignal {
  type: "system";
  status: "auth_expired" | "source_error" | "rate_limited"
        | "timeout" | "unknown" | "source_offline" | "panic_halt";
  timestamp_utc: string;
}
```

### Inbound Intent (from PWA)
```typescript
interface InboundIntent {
  intent: number;              // integer alias only
}
// No free text. No strings. No injection surface.
```

---

## 6. Security Properties

### What the daemon NEVER does:
- Make API calls to Microsoft Graph
- Store or cache Microsoft auth tokens
- Open inbound network ports
- Send unencrypted data outside the corporate boundary
- Delete files immediately after reading (ransomware heuristic)

### What makes it invisible:
- OneDrive sync = native OS traffic, not daemon-initiated
- Node.js process watching a folder = indistinguishable from dev tooling
- Azure AI Foundry calls = approved enterprise endpoint
- Outbound HTTPS to CF Worker = single POST, looks like any SaaS call

### What could expose it:
- Power Automate flow audit (mitigated: innocuous naming, M365 connectors only)
- High-frequency file creation (mitigated: 15-min batched triggers)
- Node.js running continuously (mitigated: launchd, normal for developers)

---

## 7. Phased Rollout

```
Phase 0 — Canary (2 weeks)
├── Deploy: orchestrator + schema-validator + teams-replier + sanitizer + crypto
├── Power Automate: Teams flow only ("Personal chat backup")
├── Gate: Zero EDR alerts, stable OneDrive sync, 50 manual audits
└── This IS the production test suite.

Phase 1 — Foundation (2 weeks)
├── Add: task-tracker + Planner flow
├── Gate: No new alerts, barrier audit clean
└── Cumulative: 2 workflows

Phase 2 — Automation (2 weeks)
├── Add: email-drafter + demo-gen + Email flow
├── Gate: Human-in-the-loop verified on all draft actions
└── Cumulative: 4 workflows

Phase 3 — Autonomy (ongoing)
├── Add: opencode-runner (subprocess, sandboxed, timeout-killed)
├── Gate: Full 81-test suite passes, barrier proven over 6+ weeks
└── Cumulative: 5 workflows
```

---

## 8. ADR Appendix: Options Explored & Killed

### A. teams-mcp (floriscornel)
Full MCP server for Graph API. Has read-only mode.
**Requires Azure AD App Registration.** Killed: creates IT-auditable artifact.

### B. Microsoft Enterprise MCP Server
Official Microsoft product. **Requires admin provisioning.**
Killed: not possible without IT cooperation.

### C. Direct Graph API via `az` CLI
LOTL pattern using `az account get-access-token`.
**Empirically verified dead.** 403 on Chat.Read — scopes limited to Azure management.

### D. MgGraph PowerShell SDK
Broader scope consent via different first-party app ID.
**Empirically verified dead.** Grundfos requires admin consent. "Approval Required" screen.

### E. Power Automate + OneDrive (Selected)
First-party M365 service with implicit auth. Personal flows need no admin approval.
Trades endpoint stealth for cloud artifact visibility (mitigated via naming + batching).
**The only viable path.**
