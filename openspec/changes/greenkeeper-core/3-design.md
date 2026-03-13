# 3-design.md (Architecture & Trust Boundaries)

## 1. The Trust Model
The system operates on a strictly decaying trust model:
1.  **Corporate Boundary (High Trust, High Risk):** Data ingested from `~/OneDrive/Greenkeeper/inbox/`. This contains raw, unredacted corporate IP.
2.  **The Blood-Brain Barrier (The Sanitizer):** The pure-function boundary that executes the 3-stage sanitization. It converts high-risk raw data into sterile summaries.
3.  **The Relay (Untrusted):** The Cloudflare Worker KV store. It is treated as hostile. All data must be encrypted with AES-256-GCM before arriving here.
4.  **The Client (Low Trust):** The personal phone PWA. It cannot execute arbitrary code on the corporate Mac. It can only send integer-based intent IDs mapped via `aliases.json`.

## 2. Component Manifest (11 Files)

```text
greenkeeper/
├── orchestrator.ts          # fs.watch + workflow router (NO network code)
├── schema-validator.ts      # JSON schema validation for OneDrive files
├── crypto.ts                # AES-256-GCM encryption
├── aliases.json             # Inbound integer-to-script intent mapping
├── workflows/
│   ├── teams-replier.ts     # Handles Teams workflow
│   └── ... (future workflows)
├── sanitizer/
│   ├── sanitizer.ts         # Main orchestration pipeline
│   ├── stage1-regex.ts      # Deterministic blocklist
│   ├── stage2-llm.ts        # Azure AI Foundry semantic redactor
│   └── stage3-final.ts      # Length limits and final sweeps
├── relay-worker/
│   └── index.ts             # Cloudflare KV Worker (dumb storage)
└── dashboard/
    └── index.html           # The PWA client interface
```

## 3. Data Flow (Egress)
1.  Power Automate (M365 Cloud) writes a batched JSON file to OneDrive.
2.  macOS OneDrive client syncs the file to `~/OneDrive/Greenkeeper/inbox/`.
3.  `orchestrator.ts` detects the new file via `fs.watch`.
4.  `schema-validator.ts` verifies the JSON structure. If invalid, moves to `rejected/`.
5.  `teams-replier.ts` processes the payload.
6.  `sanitizer.ts` executes the 3-stage redaction pipeline.
7.  `crypto.ts` encrypts the resulting `SignalOutput`.
8.  `orchestrator.ts` pushes the encrypted blob to the CF Worker.
9.  `orchestrator.ts` moves the original JSON file to `~/OneDrive/Greenkeeper/processed/` (avoids read/delete ransomware heuristics).

---

# Phase 2 Architecture Addendum (Gróa, 2026-03-12)

## 4. Updated Component Manifest (15 Files)

Phase 2 expands the manifest from 11 to 15 source files:

```text
greenkeeper/
├── src/
│   ├── index.ts                 # Entry point, daemon bootstrap
│   ├── orchestrator.ts          # fs.watch + workflow router + panic switch
│   ├── schema-validator.ts      # Zod-based JSON validation (trust boundary)
│   ├── crypto.ts                # AES-256-GCM (hex/base64 key encoding)
│   ├── relay-client.ts          # HTTPS POST to CF Worker
│   ├── file-operations.ts       # Move/read/write with lifecycle management
│   ├── intent-handler.ts        # [NEW] Decrypt + route inbound intents
│   ├── workflows/
│   │   ├── teams-replier.ts     # Teams message processing
│   │   ├── task-distiller.ts    # [NEW] Azure AI → DistilledTask[] extraction
│   │   └── opencode-runner.ts   # [NEW] Sandboxed subprocess execution
│   ├── sanitizer/
│   │   ├── sanitizer.ts         # Pipeline coordinator (stage1 → stage2 → stage3)
│   │   ├── stage1-regex.ts      # Deterministic blocklist
│   │   ├── stage2-llm.ts        # Azure AI Foundry semantic redactor
│   │   └── stage3-final.ts      # Length limits + final sweep (preserves redaction markers)
├── aliases.json                 # [NEW] Integer-only inbound intent mapping
├── relay-worker/
│   └── index.ts                 # CF Worker: KV store + consume-on-read + /intent route
└── dashboard/
    └── index.html               # PWA: decrypt, render, send intents (no innerHTML)
```

## 5. Phase 2 Data Flow

### 5a. Egress (Read Path) — Enhanced

```
Power Automate → OneDrive sync → inbox/
    │
    ▼
orchestrator.ts (fs.watch)
    │
    ▼
schema-validator.ts ──invalid──► rejected/
    │ valid
    ▼
sanitizer pipeline (stage1 → stage2-llm → stage3)
    │
    ├──► task-distiller.ts (Azure AI) → DistilledTask[]
    │
    ▼
crypto.ts (AES-256-GCM encrypt)
    │
    ▼
relay-client.ts → CF Worker (POST /blob)
    │
    ▼
processed/ (local, off OneDrive)
```

### 5b. Ingress (Intent Path) — NEW

```
dashboard/index.html
    │
    │  User taps button → integer intent
    │
    ▼
crypto.ts (AES-256-GCM encrypt in browser via Web Crypto)
    │
    ▼
CF Worker (POST /intent) → KV store (20-min TTL)
    │
    ▼
orchestrator.ts polls GET /intent (piggybacks on file events)
    │
    ▼
intent-handler.ts → decrypt → validate against aliases.json
    │
    │  Integer-only. No free text. No LLM-generated strings.
    │
    ▼
workflow router (e.g., intent 1 = confirm task → opencode-runner.ts)
```

## 6. Key Interfaces (Phase 2)

```typescript
// Task Distiller output
interface DistilledTask {
  id: string;
  summary: string;            // max 200 chars, sanitized
  source_message_id: string;
  urgency: 'low' | 'normal' | 'high';
  suggested_action: string;   // max 200 chars, display-only
  confidence: number;         // 0-1
}

interface DistillerOutput {
  tasks: DistilledTask[];
  summary: string;            // max 500 chars
  model: string;
  timestamp: string;
}

// Inbound intent (integer-only, mapped via aliases.json)
interface InboundIntent {
  intent_id: number;          // maps to aliases.json
  task_id?: string;           // which task this applies to
  timestamp: string;
  nonce: string;              // replay protection
}

// aliases.json schema
interface AliasMap {
  [key: number]: {
    action: string;           // e.g., "confirm", "reject", "defer"
    workflow?: string;        // target workflow file
    requires_task_id: boolean;
  };
}
```

## 7. OpenCode Runner Constraints

- Subprocess isolation: `child_process.spawn` with `cwd` locked to allowed dirs
- Timeout: 5 minutes hard kill (`SIGKILL` after `SIGTERM` grace)
- No shell: `shell: false` — direct binary execution only
- Output captured, sanitized through full pipeline, then encrypted + relayed
- Only triggered by confirmed intents (intent_id mapped to "confirm" in aliases.json)
- Directory allowlist defined in `.env`, not in code

## 8. Build Sequence (see docs/groa-phase2-sequence.md)

1. PWA Dashboard (the Glass) — unblocks visual testing
2. Wire sanitizer into index.ts — activates blood-brain barrier
3. Task Distiller — Azure AI integration
4. Inbound Intent Channel — reverse channel via CF Worker
5. OpenCode Runner — sandboxed execution (last, highest risk)

## 9. Outbound Alerting (ntfy.sh)

Replaces the Discord webhook. The daemon sends structural pings (no corporate data) to a secret ntfy.sh topic. The ntfy iOS app displays the notification natively.

### Architecture

```
Daemon (orchestrator.ts)
  → notify("📬 3 new tasks distilled")
  → POST https://ntfy.sh/{NTFY_TOPIC}
     Headers: Title: Greenkeeper, Priority: 3, Tags: seedling
     Body: plaintext structural ping
  → ntfy.sh pushes to iOS via APNs
  → User opens PWA dashboard to read actual content
```

### New File: `src/notifier.ts`

```typescript
interface NotifierConfig {
  topic: string;      // NTFY_TOPIC from .env (32-char hex minimum)
  enabled: boolean;   // NTFY_ENABLED from .env
}

export async function notify(message: string, config: NotifierConfig): Promise<void>;
```

### Configuration (.env)

- `NTFY_TOPIC`: CSPRNG-generated 32-char hex string (`crypto.randomBytes(16).toString('hex')`)
- `NTFY_ENABLED`: boolean toggle (default: false)

### Constraints

1. **No Context Leakage:** Alert body is strictly structural — counts, statuses. NEVER task content, names, subjects, or identifiers.
   - ALLOWED: "📬 3 new tasks distilled", "✅ Intent confirmed"
   - DENIED: "📬 Email from John Doe about Project X"
2. **Topic Secrecy:** Minimum 32-char CSPRNG hex. Validated at daemon startup; abort if too short.
3. **No Action Links:** No URLs with tokens in notification body. User opens PWA manually.

### Why Not E2EE (Option 1b)

The ntfy iOS app cannot decrypt AES-GCM payloads. Encrypted notifications display as gibberish on the lock screen. Since structural pings contain zero corporate data, plaintext is acceptable per the Blood-Brain Barrier policy. E2EE alerting deferred to Phase 3/4 (native iOS app).
