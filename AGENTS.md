# AGENTS.md - OpenCode Instructions for Project Greenkeeper

Welcome, Agent. You are assigned to implement **Project Greenkeeper**, a highly sensitive, stealthy background daemon designed to run on a corporate macOS machine under heavy EDR (CrowdStrike/Defender) and DLP surveillance.

Your implementation must be paranoid, flawless, and strictly adhere to the council's documentation in `docs/`.

## 1. The Prime Directives (The Council's Rules)
- **Gróa (Architecture):** Maintain the **11-file limit**. Do not bloat the project with unnecessary files, abstractions, or heavy `node_modules`. Keep the footprint microscopic.
- **Gná (Security):** **Never log user data to the console.** No `console.log(message.body)`. The blood-brain barrier is absolute. No external HTTP calls except to the explicit Azure AI Foundry endpoint and the Cloudflare Worker relay.
- **Vár (Testing):** **Contract-Driven Development.** You must read `docs/CONTRACTS.md` and `docs/var-testing.md`. For every component, write the `vitest` spec *first*, asserting the boundary conditions. Only when the test is written do you implement the logic.

## 2. Environment & Mocking
You are building this on a Mac Mini, NOT the final corporate hardware.
- Use `process.env.WATCH_DIR` to determine where to listen.
- For local testing, use `./mock-onedrive/inbox/`.
- **Do not** write tests that connect to real Microsoft APIs. All tests must be offline and boundary-driven using the `mock-onedrive` directories.

## 3. Tech Stack
- **Language:** TypeScript (`tsx` for execution).
- **Validation:** `zod` (Strict schema enforcement is Contract 19).
- **File Watching:** `chokidar` (Avoid raw `fs.watch` edge cases).
- **Testing:** `vitest`.

## 4. Workflow State
We are using `openspec` to track progress. Read the specs in `openspec/changes/greenkeeper-core/` before starting any major task, specifically `4-tasks.md`. Update tasks as you complete them.
