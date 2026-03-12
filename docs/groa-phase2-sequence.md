# Gróa — Phase 2 Build Sequence
_Project Greenkeeper ⛳ | 2026-03-12_

---

## Current State

Phase 0/1 delivered a **blind pipe**: Power Automate → OneDrive → daemon → encrypt → CF Worker → consume-on-read GET.

The daemon currently encrypts the **raw payload** (all messages verbatim) and relays it. There is no summarization, no task extraction, no inbound intent channel, and no dashboard to read the output. The sanitizer stages exist but aren't wired into the main pipeline in `index.ts`.

---

## Phase 2 Goal

Transform the blind pipe into an **intelligent pipe** with two use cases:
- **UC1 (Tasks):** Distill Teams/Email messages into actionable tasks, surface them to Lasse, execute confirmed tasks via OpenCode.
- **UC2 (Updates):** On-demand project status summaries.

---

## Build Sequence

### Step 1: PWA Dashboard (the Glass)
**Why first:** Without a readable frontend, every subsequent feature is unverifiable by Lasse. He currently has to manually `curl` the CF Worker and decrypt with CLI tools. The dashboard is the **feedback loop** that unblocks all testing of downstream features.

**Scope:**
- Static HTML/JS page (already stubbed in `dashboard/index.html`)
- Fetch blob from CF Worker URL
- Prompt for AES key (stored in `sessionStorage`, never persisted)
- Decrypt with Web Crypto API (AES-256-GCM)
- Render decrypted JSON as readable message cards
- Host: local file or GitHub Pages (no server needed)

**New files:** Update `dashboard/index.html` (already in manifest)
**Unblocks:** Visual verification of every subsequent pipeline change

---

### Step 2: Wire the Sanitizer into the Pipeline
**Why second:** The sanitizer stages exist but `index.ts` bypasses them — it encrypts raw payloads directly. Before we add LLM summarization, the regex stages (1 and 3) must be in the critical path so the blood-brain barrier is active.

**Scope:**
- Import `sanitizePipeline` from `sanitizer/sanitizer.ts` into `index.ts`
- Route each message through Stage 1 → Stage 3 (skip Stage 2 LLM for now — it's a stub)
- If Stage 1 blocks a message, log it and exclude from relay payload
- Encrypt the sanitized output, not the raw input

**New files:** None — wiring change in `index.ts`
**Unblocks:** Safe data flow for all subsequent features

---

### Step 3: Task Distiller (Azure AI Foundry)
**Why third:** This is the "brain" — the LLM that reads sanitized messages and extracts structured tasks. It replaces the `simulateLLMRedaction` stub in Stage 2 with real Azure AI calls, and adds a new `task-distiller.ts` workflow.

**Scope:**
- `src/workflows/task-distiller.ts` — new file
  - Input: sanitized message batch
  - LLM prompt: "Extract actionable tasks from these messages. Output structured JSON."
  - Output: `DistilledTask[]` — `{ id, summary, source_message_id, urgency, suggested_action }`
- Wire `stage2-llm.ts` to real Azure AI Foundry endpoint
- Task output gets encrypted and relayed alongside summaries

**New files:** `src/workflows/task-distiller.ts`
**Unblocks:** UC1 task extraction

**Interface:**
```typescript
interface DistilledTask {
  id: string;
  summary: string;            // max 200 chars, sanitized
  source_message_id: string;
  urgency: 'low' | 'normal' | 'high';
  suggested_action: string;   // max 200 chars
  confidence: number;         // 0-1, LLM self-assessed
}

interface DistillerOutput {
  tasks: DistilledTask[];
  summary: string;            // max 500 chars, human-readable batch summary
  model: string;              // which Azure model was used
  timestamp: string;
}
```

---

### Step 4: Inbound Intent Channel (aliases.json + PWA buttons)
**Why fourth:** Once Lasse can see tasks on the dashboard, he needs to **respond** — confirm, reject, or modify. This is the reverse channel.

**Scope:**
- Create `aliases.json` — integer-only intent mapping (e.g., `1` = confirm, `2` = reject, `3` = defer)
- Add buttons to PWA dashboard that POST encrypted intents back to CF Worker
- New CF Worker route: `POST /intent` — stores encrypted intent blob
- Daemon polls `/intent` on a timer (or piggybacks on next file event)
- `src/intent-handler.ts` — decrypts and routes intents to workflows

**New files:** `aliases.json`, `src/intent-handler.ts`, CF Worker route update
**Unblocks:** UC1 task confirmation loop

---

### Step 5: OpenCode Runner
**Why last:** This is the highest-risk component (executes code on the corporate Mac). It must only activate after the full confirmation loop is proven reliable.

**Scope:**
- `src/workflows/opencode-runner.ts` — subprocess wrapper
- Only executes confirmed tasks (intent = `1`)
- Directory sandboxing: can only write to designated project dirs
- Timeout kill: 5 minutes max
- Output captured, sanitized, encrypted, relayed

**New files:** `src/workflows/opencode-runner.ts`
**Unblocks:** UC1 full automation

---

## Sequence Diagram

```
Step 1: Dashboard ──► Lasse can READ output
         │
Step 2: Wire Sanitizer ──► Blood-brain barrier ACTIVE
         │
Step 3: Task Distiller ──► LLM extracts tasks
         │
Step 4: Inbound Intents ──► Lasse can RESPOND
         │
Step 5: OpenCode Runner ──► Confirmed tasks EXECUTE
```

Each step is independently deployable and testable. No step requires the next to deliver value.

---

## File Manifest Update

Phase 1 manifest was 11 files. Phase 2 adds:
- `src/workflows/task-distiller.ts` (Step 3)
- `src/intent-handler.ts` (Step 4)
- `aliases.json` (Step 4)
- `src/workflows/opencode-runner.ts` (Step 5)

**New total: 15 source files.** Still auditable.

---

## ADR: Why Dashboard First

The tempting order is "build the brain first" (Task Distiller). But without the Glass, every test requires:
1. `curl` the CF Worker
2. Copy the ciphertext
3. Decrypt with a CLI script
4. Parse the JSON manually

This friction will slow iteration on Steps 3-5 dramatically. The dashboard is 2-3 hours of work and pays dividends on every subsequent test cycle.
