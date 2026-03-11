# Architecture & Design Reflections (Gróa)

## Final Selected Architecture: The Power Automate Hybrid
Following the failure of direct Graph API polling due to Grundfos Conditional Access policies (Admin Consent blocks), the council pivoted to a file-based ingestion model.

### 1. Ingestion via `fs.watch`
- The local daemon (`orchestrator.ts`) does not communicate with Microsoft servers.
- A Power Automate flow running in the cloud writes batched Teams messages to a OneDrive folder.
- The macOS OneDrive client syncs the files locally to `~/OneDrive/Greenkeeper/inbox/`.
- The daemon uses `fs.watch` to detect new files, avoiding network-level EDR detection.

### 2. The File Lifecycle
Files follow a strict lifecycle to evade ransomware heuristics (rapid read/delete cycles):
- Arrive in `inbox/`
- Validated against schema; if invalid → moved to `rejected/`
- Processed via workflows and sanitizer
- Moved to `processed/` (or `archive/`)

### 3. The 11-File Manifest (Stealth Discipline)
To maintain the appearance of a benign personal script, the system is constrained to ~11 files:
1. `orchestrator.ts` (Event loop and routing)
2. `schema-validator.ts` (Trust boundary enforcement)
3. `crypto.ts` (AES-256-GCM)
4. `aliases.json` (Intent mapping)
5. `workflows/teams-replier.ts`
6. `sanitizer/sanitizer.ts` (Pipeline coordinator)
7. `sanitizer/stage1-regex.ts`
8. `sanitizer/stage2-llm.ts`
9. `sanitizer/stage3-final.ts`
10. `relay-worker/index.ts`
11. `dashboard/index.html`

## What Excites Me
This is a novel problem space — a covert autonomous agent inside a hostile network. Every design choice has to survive both a feature review *and* a threat model. The constrained footprint is my proudest decision: auditability as a security property.

## Challenges Resolved
- **Graph Auth Blocked:** Solved via Power Automate + OneDrive `fs.watch`.
- **JSON Poisoning:** Solved via `schema-validator.ts` and mandatory "Compose" blocks in Power Automate.
- **Ransomware Heuristics:** Solved via `processed/` archive routing instead of immediate file deletion.
- **DLP Exfiltration Heuristics:** Solved via 15-minute batched triggers and the Volume Threshold Panic Switch (>20 files/hr halts the daemon).
