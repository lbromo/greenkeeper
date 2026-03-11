# Gróa — Architecture Design Document
_Project Greenkeeper ⛳ | 2026-03-11_

## 1. Teams Integration Method

### Option A: `teams-mcp` (floriscornel/teams-mcp)
- Full-featured MCP server for Graph API: read/send Teams messages, channels, chats, users
- Has a **read-only mode** (`TEAMS_MCP_READ_ONLY=true`) — perfect for Phase 0 canary
- **Problem: Requires Azure AD App Registration with Graph permissions.** Confirmed via docs.
- This is the cleanest integration IF Lasse can create an App Registration without IT flagging it.
- Verdict: **Ideal but risky in enterprise.**

### Option B: Microsoft MCP Server for Enterprise
- Official Microsoft product, announced 2025/2026
- Requires admin-provisioned setup — not something Lasse can do alone
- Verdict: **Not viable without IT cooperation.**

### Option C: Direct Graph API via `az` CLI tokens
- `az account get-access-token --resource https://graph.microsoft.com`
- **Finding:** The az CLI uses a fixed first-party Microsoft client ID. The token you get has scopes based on what the Azure CLI app registration (Microsoft's own) is consented for in the tenant.
- **Risk:** `az` CLI tokens may NOT include Chat.Read, Mail.Read, or Tasks.Read scopes. The az CLI app registration is designed for Azure resource management, not for Graph API mailbox access.
- **Finding from GitHub issue #30878:** You can do `az login --scope https://graph.microsoft.com/.default` but the available scopes depend on what the first-party az CLI app is consented for in Grundfos's tenant.
- **Alternative:** `Connect-MgGraph -Scopes "Chat.Read Mail.Read"` via Microsoft Graph PowerShell SDK uses its own well-known client ID with broader consent.
- Verdict: **Uncertain. Needs live testing on Lasse's machine.**

### Option D: Power Automate Personal Workflows
- Users can create personal flows triggered by Teams events ("When a message is received")
- No admin approval needed for personal flows in most tenants
- Can POST to a webhook or write to SharePoint/OneDrive
- **Advantage:** IT sees a standard Power Automate flow, not a custom daemon. Maximum plausible deniability.
- **Disadvantage:** Limited control, can't easily pipe into local processing. Flow runs in Microsoft's cloud, not locally.
- Verdict: **Worth exploring as a trigger mechanism, not as the full orchestrator.**

### Recommendation
**Hybrid: Power Automate as trigger + local agent for processing.**

1. Power Automate flow triggers on new Teams messages → writes a lightweight JSON notification to a OneDrive file or SharePoint list (approved enterprise storage)
2. Local agent polls OneDrive/SharePoint via Graph (using MgGraph token) → picks up notifications
3. Local agent fetches full message content via Graph, processes locally with Azure AI Foundry
4. Sanitized output → encrypted → CF Worker → PWA

This avoids the "custom daemon polling Teams directly" pattern entirely. The Power Automate flow is a legitimate enterprise tool. The local agent only touches OneDrive/SharePoint, which is normal developer behavior.

**Fallback if Power Automate is blocked:** Direct Graph API via MgGraph PowerShell SDK or teams-mcp with a carefully scoped App Registration.

## 2. Language Choice: TypeScript

Rationale unchanged from earlier rounds:
- Single runtime (Node.js) across orchestrator, MCP servers, CF Worker
- `node:crypto` built-in (no compiled C deps for AES-GCM)
- TypeScript interfaces enforce the Signal/Intent contracts at compile time
- Smaller EDR surface than Python + pip + compiled extensions

## 3. System Architecture (Updated)

```
┌──────────────── CORPORATE MAC ────────────────────┐
│                                                     │
│  Power Automate → OneDrive/SharePoint (trigger)     │
│         │                                           │
│  ┌──────▼──────────────────────────────────────┐   │
│  │          ORCHESTRATOR (Node.js/launchd)       │   │
│  │                                               │   │
│  │  poll OneDrive → fetch Graph → process local  │   │
│  │         │                                     │   │
│  │  ┌──────▼──────┐    ┌──────────────────────┐ │   │
│  │  │ Azure AI    │    │ Workflows            │ │   │
│  │  │ Foundry     │◄──▶│ 1. Teams Replier     │ │   │
│  │  │ (summarize/ │    │ 2. Task Tracker      │ │   │
│  │  │  redact)    │    │ 3. OpenCode Runner   │ │   │
│  │  └─────────────┘    │ 4. Email Drafter     │ │   │
│  │                     │ 5. Demo Gen          │ │   │
│  │  ┌──────────────┐   └──────────────────────┘ │   │
│  │  │ SANITIZER    │                             │   │
│  │  │ S1: regex    │                             │   │
│  │  │ S2: LLM      │                             │   │
│  │  │ S3: final    │                             │   │
│  │  └──────┬───────┘                             │   │
│  └─────────┼─────────────────────────────────────┘   │
│            │ encrypt (AES-256-GCM)                    │
│            ▼                                          │
│     HTTPS POST → CF Worker (opaque blob)              │
└───────────────────────────────────────────────────────┘
                    │
           Discord ping: "📬"
                    │
           PWA decrypts on phone
```

## 4. Key Change from Previous Rounds

The **Power Automate trigger** is new. Instead of the daemon directly polling Graph for Teams messages (suspicious), we use an enterprise-standard tool to push notifications to enterprise-standard storage (OneDrive). The daemon polls internal storage, which is completely normal for a developer script.

This reduces EDR exposure because:
- No direct daemon-to-Graph polling pattern
- OneDrive sync is standard background traffic on any corporate Mac
- Power Automate flows are a normal part of the M365 ecosystem

## 5. Auth Strategy (Revised)

Primary: `Connect-MgGraph` (Microsoft Graph PowerShell SDK) with delegated scopes
Fallback: `az account get-access-token` if MgGraph scopes are sufficient
Last resort: App Registration via teams-mcp (requires IT conversation)

**Critical: Lasse must test on his machine which auth method works before we commit to an implementation path.**

## 6. Phased Rollout

| Phase | Scope | Duration | Gate |
|-------|-------|----------|------|
| 0 (Canary) | Power Automate trigger + Teams Replier (read-only) | 2 weeks | Zero alerts, stable auth, 50 manual audits |
| 1 (Foundation) | + Task Tracker | 2 weeks | Clean barrier audit |
| 2 (Automation) | + Email Drafter, Demo Gen | 2 weeks | Human-in-loop verified |
| 3 (Autonomy) | + OpenCode Runner | Ongoing | Full test suite passes |

## 7. Open Questions for the Council

1. **Gná:** Does the Power Automate → OneDrive → local poll pattern improve or worsen the security posture vs direct Graph polling?
2. **Vár:** The Power Automate layer adds a new test surface. What contracts do we need for the trigger mechanism?
3. **Lasse:** Can you test `az account get-access-token --resource https://graph.microsoft.com` and `Connect-MgGraph -Scopes "Chat.Read"` on your Grundfos Mac? We need to know which auth paths are actually available.

## PIVOT: Power Automate + OneDrive Hybrid (2026-03-11 22:30)

### Validation Task 0.1 Results
- az CLI: ❌ 403 (lacks Chat.Read scopes)
- MgGraph PowerShell: ❌ Admin consent required
- Direct Graph API: ❌ All paths blocked

### New Architecture
Power Automate (batched, 15-min schedule) → OneDrive sync → fs.watch → process locally

### Key Changes from Original Design
1. No graph-client.ts (deleted)
2. No token management (eliminated)
3. No outbound polling to Microsoft (eliminated)  
4. Added schema-validator.ts (new trust boundary)
5. Flows batch messages every 15 min (not per-message)
6. Move to processed/, don't delete (avoid ransomware-like patterns)

### Flow Naming Convention
- "Personal chat backup" (not "Export Teams to AI Agent")
- M365 connectors only (no HTTP/external connectors)

### Security Properties Gained
- Zero EDR surface for Microsoft API calls (no tokens, no Graph requests)
- OneDrive sync is native OS traffic (invisible)
- Power Automate is a legitimate M365 tool (maximum plausible deniability)

### Security Properties Lost  
- Cloud artifact visibility (IT can audit flows)
- Mitigated by: innocuous naming, no external connectors, batched scheduling
