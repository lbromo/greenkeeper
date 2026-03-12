# Project Greenkeeper ⛳

_"Bring work to the golf course."_

A multi-agent system running on a corporate Mac that automates daily work — collecting tasks, implementing code, and delivering sanitized updates — all behind a blood-brain barrier that keeps corporate data safe.

## Primary Use Cases

### UC1: Task Collection & Execution

**Input:** Incoming emails, Teams messages, Teams tasks/planner
**Output:** Distilled actionable tasks → confirmation → autonomous execution → status report

**Flow:**
1. **Collect** — Scan incoming emails, Teams messages, and planner tasks
2. **Distill** — Extract actionable items (e.g. "Get autotune working on Straton")
3. **Ping** — Notify me with the tasks and a proposed execution plan
4. **Confirm** — Wait for my go-ahead before executing
5. **Execute** — Upon confirmation:
   - A local council plans the approach (lives on the MBP or encrypted group chat only)
   - OpenCode implements the changes (e.g. working in `~/Documents/autotune-project/`)
   - Git workflow: branch → commit → PR
6. **Report** — Note down status in a format I can share with the project team

**Example:**
> 📬 "Hey Lasse, I found 3 actionable items from today's Teams activity:
> 1. Get autotune working on Straton (from email thread with PM)
> 2. Review PLC spec changes (Teams message from Henrik)
> 3. Update Q1 demo slides (Planner task, due Friday)
>
> I have context on #1 — there's an autotune project under ~/Documents/. Want me to plan and implement?"

### UC2: Project Updates

**Input:** A question like "What's the status on Project X?"
**Output:** Concise project update sourced from emails, Teams, and task history

**Flow:**
1. **Query** — I ask for a status update on a specific project
2. **Gather** — Search recent emails, Teams messages, and task completions for context
3. **Summarize** — Produce a concise status update
4. **Draft** — If needed, draft a response (email or Teams message) for my review — never auto-send

**Example:**
> 📊 "Autotune project status:
> - Last activity: PR #42 merged (Tuesday)
> - Henrik asked about test results in Teams (unanswered)
> - Next milestone: Demo to PM on Friday
>
> Want me to draft a reply to Henrik?"

---

## Architecture

```
┌─────────────────── Corporate Network ───────────────────┐
│                                                          │
│  Teams/Email/Tasks ──→ [Ingestion]                      │
│                              │                           │
│                     [Task Distiller]                     │
│                              │                           │
│                    ┌─────────┴──────────┐                │
│                    │                    │                 │
│              [Notify Lasse]    [Local Council + OpenCode]│
│                    │                    │                 │
│              (confirm/reject)    (plan → implement → PR) │
│                              │                           │
│                        [Sanitizer]                       │
│                     (strip code/creds)                   │
│                              │                           │
└──────────────────────────────┼───────────────────────────┘
                               │ HTTPS (outbound only)
                               ▼
                     [Encrypted Channel]
                               │
                          Lasse 🏌️
```

## Blood-Brain Barrier

**Policy: Loose**
- ✅ Full text summaries, task names, status updates, meeting notes
- ✅ Anonymized or generalized references where appropriate
- ❌ No source code, credentials, API keys, tokens
- ❌ No raw data exports, database contents, file attachments
- ❌ No customer/partner identifiable data unless already public

## Infrastructure (Phase 0+1 — Complete ✅)

**Ingestion (The Siphon):**
Power Automate cloud flow on 15-min recurrence → fetches Teams messages → writes typed JSON to ~/OneDrive/Greenkeeper/inbox/

**Core Daemon (The Blood-Brain Barrier):**
Local Node.js daemon watches inbox via chokidar → validates JSON (Zod schemas) → encrypts AES-256-GCM → POSTs to Cloudflare Relay Worker

**Relay (The Airgap):**
Cloudflare Worker → dynamic retrieval key → KV store → consume-on-read (instant delete after GET)

## Security Measures
- **Zero IT Flags:** No unauthorized Entra ID App Registrations; uses native Power Automate
- **Panic Switch:** Daemon halts if >20 files/hr (anomalous volume)
- **Schema Freshness:** Payloads older than 5 minutes rejected (replay prevention)
- **E2EE:** Corporate data never touches the open internet in plaintext
- **Human-in-the-loop:** No auto-execution without confirmation. No auto-sending messages.

## Constraints

1. No inbound ports — outbound HTTPS only
2. Approved models only — Azure AI Foundry (any model, full access)
3. GitHub Copilot available for coding tasks
4. OpenCode for implementation
5. Cron-based polling (no external real-time triggers)
6. Local council deliberation stays on MBP or encrypted channel only

## The Council

| Agent | Role | Focus |
|-------|------|-------|
| **Lasse** | Architect | Final authority, veto power, corporate environment setup |
| **Aria** (Frigg) | Orchestrator | System synthesis, workflow management, agent mediation |
| **Gróa** | Architecture | System design, data flow, integrations (Teams/Email), language choices |
| **Gná** | Security | Threat modeling, blood-brain barrier enforcement, encryption, sanitization |
| **Vár** | Testing | GIVEN-WHEN-THEN contracts, leak detection, workflow validation |

## Open Questions

- [ ] Encrypted channel design for council deliberation (local-only vs. E2EE group chat)
- [ ] Cron frequency — how often to scan for new tasks?
- [ ] Demo format — video? slides? markdown report?
- [ ] Language choice — TypeScript vs Python? (Gróa to recommend)
