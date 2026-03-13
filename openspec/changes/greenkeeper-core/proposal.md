## Why

A stealthy, multi-agent automation setup is needed to process M365 data (Teams, Planner, etc.) on a corporate Mac without triggering EDR/DLP or violating Conditional Access policies. The system must provide two-way interaction without inbound ports or Arbitrary Code Execution (ACE) risks.

## What Changes

- Implement `orchestrator.ts` daemon for local file ingestion via OneDrive sync.
- Create a 3-stage sanitization pipeline (Regex -> AI -> Regex) to strip corporate IP.
- Implement AES-256-GCM encryption for all outbound payloads.
- Develop a Cloudflare Worker relay with "consume-on-read" semantics.
- Build a PWA dashboard for secure decryption and rendering.
- Implement an integer-only intent channel for local script execution via `aliases.json`.
- Add a volume threshold monitor (`panic.lock`) as a safety switch.

## Capabilities

### New Capabilities
- `local-ingestion`: Monitoring and ingesting M365 data files from local OneDrive sync.
- `data-sanitization`: Multi-stage stripping of sensitive corporate information and credentials.
- `secure-relay`: Cloudflare Worker based "consume-on-read" encrypted data exchange.
- `dashboard-client`: PWA for secure, zero-trust rendering and interaction with sanitized data.
- `intent-execution`: Mapping and executing pre-defined local scripts based on encrypted integer codes.
- `system-guardrails`: Panic switch and volume monitoring to prevent data exfiltration.

### Modified Capabilities
<!-- No existing capabilities found in the project -->

## Impact

- **Affected Code**: Entirely new project structure including `src/orchestrator.ts`, `src/sanitizer/`, `relay-worker/`, and `dashboard/`.
- **Dependencies**: Node.js, Cloudflare Workers, Web Crypto API, Vitest.
- **Security**: Strict adherence to AES-256-GCM and XSS prevention (no innerHTML).
