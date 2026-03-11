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
