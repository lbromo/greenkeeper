# Project Greenkeeper ⛳

_"Bring work to the golf course."_

A multi-agent system running on a corporate Mac that automates daily work tasks (Teams, email, PM tracking, code, demos) and delivers sanitized summaries to your personal devices — without corporate data leaving the network boundary.

## Status
- **Phase:** Council Evaluation (initial design debate)
- **Created:** 2026-03-11

## What It Does

1. **Answer Teams messages** — agent drafts proposed replies for review/send
2. **Track PM tasks** — monitors Teams Tasks, email, and chat for action items
3. **Implement tasks** — uses OpenCode + git for coding work
4. **Stakeholder comms** — drafts emails for review before sending
5. **Demos & learnings** — generates demo materials and consolidates learnings
6. **Remote summaries** — cron-based sanitized updates delivered to Discord

## Architecture

```
┌─────────────────── Corporate Network ───────────────────┐
│                                                          │
│  Teams/Email/Tasks ──→ [Corp Agent] ──→ OpenCode + Git  │
│                              │                           │
│                        [Sanitizer]                       │
│                              │                           │
│                     (strip code/creds/data)              │
│                              │                           │
└──────────────────────────────┼───────────────────────────┘
                               │ HTTPS (outbound only)
                               ▼
                     [Discord / Encrypted Channel]
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

All processing happens locally on the corp Mac or via Azure AI Foundry (approved enterprise models). The sanitizer runs *before* anything crosses the boundary.

## Constraints

1. **No inbound ports** — all external comms are outbound HTTPS only
2. **Approved models only** — Azure AI Foundry (any model, full access)
3. **GitHub Copilot** — available for coding tasks
4. **OpenCode** — local instance for implementation
5. **Cron-based polling** — no real-time push from external triggers

## Repository Structure

```
greenkeeper/
├── README.md              # This file
├── briefs/                # Council briefing documents
├── synthesis/             # Council synthesis outputs
├── specs/                 # OpenSpec specs
└── docs/                  # Design docs, diagrams
```

## Council & Deliverables

| Agent | Role | Deliverable | Format |
|-------|------|-------------|--------|
| **Gróa** | Architecture | System design: corp-side daemon, sanitizer, data flow, OpenCode integration, Teams/email ingestion | Design doc + component diagram |
| **Gná** | Security | Threat model, sanitization rules, data classification matrix, encrypted channel recommendation | Security spec |
| **Vár** | Testing | Barrier leak tests, task tracking accuracy, git workflow validation, demo QA | Test plan (GIVEN-WHEN-THEN) |
| **Aria** | Orchestrator | Council synthesis, OpenSpec orchestration, implementation scheduling | Living doc |
| **Lasse** | Architect | Final review, veto authority, corporate environment setup | Approval / direction |

## Open Questions

- [ ] Encrypted channel design — E2E encrypted Discord channel? Matrix bridge? Signal? (Gná to recommend)
- [ ] Teams integration method — Graph API? Power Automate? MCP? (Gróa to evaluate)
- [ ] Task ingestion scope — which Teams channels/boards to monitor?
- [ ] Demo format — video? slides? markdown report?
- [ ] Cron frequency — how often should summaries fire? (hourly? 3x/day?)
- [ ] Language choice — TypeScript or Python? (Gróa to recommend based on integration findings)
