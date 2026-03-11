# Testing & QA Philosophy (Vár)

## The Core Problem
In a standard software project, tests ensure functionality. In Project Greenkeeper, tests ensure the developer isn't fired. The consequence of a test failing in production isn't a broken button—it's a corporate data exfiltration event.

Therefore, our testing approach must be paranoid, adversarial, and boundary-driven.

## 1. Contract-First (Boundary-Driven Development)
We defined 21 strict GIVEN/WHEN/THEN contracts (covering 81 scenarios) before discussing the implementation of `orchestrator.ts`. 
Why? Because if you write the implementation first, you test what the code *does*. If you write the contract first, you test what the code *must not do*.

## 2. The 3-Stage Sanitizer Testing Strategy
The "Loose Policy" (allowing rich text summaries) forces us to rely on an LLM for redaction (Stage 2). This is a known vulnerability: LLMs can be prompt-injected or hallucinate.
Our testing strategy mitigates this via defense-in-depth:
- **Contract 12 (Deterministic):** Proves Stage 1 regex catches 100% of hard credentials before the LLM sees them.
- **Contract 13 (Semantic):** Proves Stage 2 LLM redacts known entities (projects, financials) and resists basic prompt injection ("ignore previous instructions").
- **Contract 17 (Safety Net):** Proves Stage 3 catches any hallucinations missed by Stage 2 and enforces a hard character limit.

## 3. The OneDrive Ingest Trust Boundary (Post-Pivot)
Because we use Power Automate to write to OneDrive, the local file system is now an untrusted boundary.
- **Contract 19 (File Validation):** Requires strict JSON schema validation, file size limits (<1MB), field length limits (10KB max), and age limits (<5 min old). Malformed or oversized files must be routed to `rejected/` without crashing the daemon.
- **Contract 20 (Flow Safety):** Requires Power Automate flows to be innocuously named ("Personal chat backup"), batched every 15 minutes to avoid DLP heuristics, and use `Compose` actions instead of raw string interpolation to prevent JSON poisoning.
- **Contract 21 (Sync Health):** Requires the daemon to detect if the OneDrive sync engine goes offline or pauses, halting processing to prevent stale reads.

## 4. Test Matrix Summary (81 Test Cases)
| Contract | Focus | Test Cases | Type |
| :--- | :--- | :--- | :--- |
| 1-18 | Original design (sanitizer, crypto, workflows) | 68 | 66 automated + 2 manual |
| 19 | OneDrive File Validation | 6 | Automated |
| 20 | Power Automate Flow Safety | 4 | Manual review |
| 21 | OneDrive Sync Monitoring | 3 | Automated |

**Total: 81 test cases (75 automated, 6 manual)**

**Acceptance Gate:**  
- All 75 automated tests must pass at 100%
- All 6 manual reviews (2 adversarial LLM tests + 4 flow audits) must be completed before deployment.
