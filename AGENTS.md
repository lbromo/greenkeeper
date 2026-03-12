# AGENTS.md - Greenkeeper

## Project Context
You are working on "Project Greenkeeper," a stealthy homebrew multi-agent proxy.
Read the OpenSpec files in openspec/changes/greenkeeper-core/ for full specs.

## Code Style
- TypeScript, ESM modules (.js extensions in imports)
- Vitest for tests
- No innerHTML anywhere (XSS prevention)
- All crypto uses AES-256-GCM

## Key Files
- src/crypto.ts — AES-256-GCM encrypt/decrypt
- src/schema-validator.ts — Zod schema validation
- src/orchestrator.ts — Main daemon orchestration
- src/sanitizer/stage1-regex.ts — Deterministic blocklist
- src/sanitizer/stage3-final.ts — Final sweep + length limit
- relay-worker/index.ts — Cloudflare Worker
- dashboard/index.html — PWA client

## Important
- The .env key (CRYPTO_KEY) is a 64-char hex string
- Dashboard accepts hex keys directly
- Cloudflare Worker has CORS enabled
- Consume-on-Read: Worker DELETEs from KV after GET
