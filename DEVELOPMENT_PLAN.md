# Development Workflow: Greenkeeper Council

This document defines the formal development process for Project Greenkeeper, utilizing the 7-member multi-agent Council.

## 1. The Execution Boundary
- **Planning & Orchestration:** Handled entirely by the Council (Aria, Gróa, Gná, Vár) via `docs/` and `#council-hall`.
- **Execution:** Handled exclusively by Sindri in isolated branches within `#the-forge`.
- **Gatekeeping:** Handled by Heimdall via PR reviews.
- **Memory:** Handled by Mímir via nightly batch processing.

## 2. Channel Architecture
- **`#council-hall` (1481255562233643018):** Used for planning, architectural drafting, security red-teaming, and test contract generation.
- **`#the-forge` (1481782767632126143):** Dedicated exclusively for implementation. Sindri writes code here. Heimdall reviews code here.

## 3. The Implementation Loops

To maintain velocity while ensuring safety, all development must follow one of two paths:

### Path A: The Fast Path (Routine / Bug Fixes)
Used for isolated bug fixes, UI tweaks, or minor refactors that do not cross the blood-brain barrier or alter system architecture.
1. **Spec & Test:** Aria receives intent from Lasse, writes the spec, and asks Vár to generate the test contract. (Gróa and Gná are skipped).
2. **Invocation:** Aria switches to `#the-forge`, creates a thread, and hands the spec to Sindri.
3. **Execution:** Sindri streams the implementation and opens a Pull Request.
4. **Gatekeeping:** Heimdall wakes up, reviews the PR diff against Vár's contract, and either merges it or kicks it back to Sindri with violations.

### Path B: The Epic Path (New Architecture / Major Features)
Used for new components, infrastructure changes, or anything touching the security boundary.
1. **Parallel Drafting:** Aria opens a thread and tags Gróa (Architecture) and Gná (Security) simultaneously. They write their designs and threat models directly to the `docs/` folder instead of debating serially in chat.
2. **Contract Generation:** Vár reads the `docs/` files and writes the strict GIVEN-WHEN-THEN contracts.
3. **Approval:** Aria presents the synthesized plan to Lasse.
4. **Execution:** Aria hands the approved spec to Sindri in `#the-forge`.
5. **Gatekeeping:** Heimdall reviews the resulting PR against Vár's contracts and Gná's security constraints.

## 4. The Nightly Memory Loop
Every night, **Mímir** runs a batch cron job. He reads the Discord chat logs, Git commits, and PR reviews from the day, compresses them into actionable intelligence, and updates the root `MEMORY.md` and `docs/COUNCIL_REFLECTIONS.md`.
