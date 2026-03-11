# Development & Test Approach (Greenkeeper)

## 1. The Strategy: "Local Dev, Air Drop Deploy"
To minimize EDR visibility and avoid trial-and-error debugging on corporate hardware, **100% of the Greenkeeper daemon will be built, tested, and validated on a personal Mac Mini**. 

Once the system achieves 100% pass rate against the 80 Test Contracts, the raw `.ts` files will be "air dropped" (cloned/copied) to the Grundfos Mac for execution.

## 2. Mocking the Corporate Environment
The personal Mac Mini lacks access to Grundfos OneDrive and Power Automate. We decouple the infrastructure using environment variables and mock files:

### The Ingestion Boundary
- **Corporate Env:** `WATCH_DIR=~/OneDrive/Greenkeeper/inbox/`
- **Local Dev Env:** `WATCH_DIR=./mock-onedrive/inbox/`
- **Simulation:** A local test script will drop JSON files matching the Power Automate schema into `./mock-onedrive/inbox/` to trigger the `fs.watch` event.

### The Sanitizer / LLM Boundary
- **Corporate Env:** Grundfos Azure AI Foundry API.
- **Local Dev Env:** Direct OpenAI or Anthropic API (or a personal Azure AI instance) using the exact same system prompts. The API key is injected via `.env`.

## 3. Test-Driven Implementation (Vár's Contracts)
Development will proceed strictly according to the 80 test cases defined by Vár.
We will use a standard test runner (e.g., `vitest`) on the Mac Mini.

1. **Phase 1: The Trust Boundary (Contract 19)**
   - Build `schema-validator.ts`.
   - Write tests that drop oversized, malformed, and poisoned JSON files into the mock directory.
   - Assert they are properly routed to `rejected/` without crashing the daemon.

2. **Phase 2: The Sanitizer (Contracts 12, 13, 17)**
   - Build `sanitizer.ts`.
   - Run the 68 Regex and Semantic Redaction tests. Prove that IP addresses, credentials, and project names never survive the 3-stage pipeline.

3. **Phase 3: Crypto & Delivery**
   - Build `crypto.ts` and verify AES-256-GCM encryption/decryption locally.
   - Deploy `relay-worker` to Cloudflare.
   - Assert the 20-minute TTL works.

## 4. The Air Drop (Deployment Protocol)
When all local tests pass:
1. Ensure the project footprint remains strictly under 15 files (no bloated `node_modules` checked into source control; rely on standard TS libraries).
2. Transfer the source files to the Grundfos Mac.
3. Run `npm install` (using standard, benign packages like `zod` and `chokidar`).
4. Build the Power Automate flow in the M365 Cloud.
5. Update `.env` to point to the real OneDrive path.
6. Launch via `npx tsx orchestrator.ts`.
