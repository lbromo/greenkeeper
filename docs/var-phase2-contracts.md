# Vár — Phase 2 Step 1 Test Contracts
_Project Greenkeeper ⛳ — PWA Dashboard (The Glass)_  
**Date:** 2026-03-12  
**Status:** Draft for Review

---

## Contract Overview

**Component:** PWA Dashboard (`dashboard/index.html`)  
**Purpose:** Client-side decryption and rendering of encrypted payloads from Cloudflare Worker  
**Risk Level:** 🟢 Low (per Gná's assessment)  
**Total Test Cases:** 31 (28 automated, 3 manual)

---

## Part 1: Core Functionality Contracts (Contracts 22-25)

### Contract 22: Key Storage & Memory Management
```gherkin
GIVEN: User enters a 32-byte encryption key
WHEN: Dashboard is connected
THEN: MUST store key in sessionStorage only (not localStorage)
  AND: MUST clear key when browser tab closes
  AND: MUST NOT persist key to disk
  AND: MUST re-prompt for key on fresh page load
```

**Test Cases:**
- **TC-22.1 (Automated):** Key stored in `sessionStorage.getItem('encryptionKey')` after connect
- **TC-22.2 (Automated):** Key NOT in `localStorage` after connect
- **TC-22.3 (Manual):** Close tab, reopen → key is gone, user re-prompted
- **TC-22.4 (Automated):** Key length validation: reject if < 32 bytes

**Acceptance Criteria:**
- ✅ No key persistence across browser sessions
- ✅ Key exists only in volatile memory

---

### Contract 23: XSS Prevention & Output Encoding
```gherkin
GIVEN: Decrypted payload contains HTML/JavaScript injection
WHEN: Dashboard renders message
THEN: MUST escape all HTML entities before rendering
  AND: MUST NOT use innerHTML for user content
  AND: MUST enforce Content Security Policy (CSP)
  AND: MUST render malicious payloads as plain text
```

**Test Cases:**
- **TC-23.1 (Automated):** Payload contains `<script>alert('XSS')</script>` → rendered as escaped text, not executed
- **TC-23.2 (Automated):** Payload contains `<img src=x onerror=alert(1)>` → rendered as text, no error triggered
- **TC-23.3 (Automated):** `escapeHtml()` function correctly escapes `&`, `<`, `>`, `"`
- **TC-23.4 (Manual):** CSP header present: `Content-Security-Policy: default-src 'self'; script-src 'self'`
- **TC-23.5 (Automated):** Decrypted content inserted via `textContent` (not `innerHTML`)

**Required CSP:**
```
Content-Security-Policy: default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https://*.workers.dev
```
(Note: `unsafe-inline` required for inline scripts in current implementation; should be eliminated in production by moving JS to external file)

---

### Contract 24: Decryption & Web Crypto API
```gherkin
GIVEN: Valid encrypted payload from Cloudflare Worker
WHEN: Dashboard decrypts with correct key
THEN: MUST use Web Crypto API (AES-256-GCM)
  AND: MUST validate authentication tag
  AND: MUST handle decryption failures gracefully (no crash)
  AND: MUST display error message if key is incorrect
```

**Test Cases:**
- **TC-24.1 (Automated):** Valid payload + correct key → successful decryption
- **TC-24.2 (Automated):** Valid payload + wrong key → decryption fails, error displayed
- **TC-24.3 (Automated):** Malformed payload (invalid base64) → caught, error displayed
- **TC-24.4 (Automated):** Algorithm validation: uses `AES-GCM` with 128-bit tag
- **TC-24.5 (Automated):** IV uniqueness: different messages have different IVs

---

### Contract 25: Cloudflare Worker Integration
```gherkin
GIVEN: User enters valid Cloudflare Worker URL
WHEN: Dashboard fetches messages
THEN: MUST send GET request with ?key= parameter
  AND: MUST handle network errors (timeout, 404, 500)
  AND: MUST enforce 10-second timeout
  AND: MUST display user-friendly error messages
```

**Test Cases:**
- **TC-25.1 (Automated):** Valid URL, valid key → message fetched successfully
- **TC-25.2 (Automated):** Network timeout (>10s) → error displayed: "Request timed out"
- **TC-25.3 (Automated):** 404 response → error displayed: "Message not found or expired"
- **TC-25.4 (Automated):** 500 response → error displayed: "Server error"
- **TC-25.5 (Automated):** Invalid URL (no HTTPS) → validation error before fetch

---

## Part 2: Security Boundary Contracts (Contracts 26-27)

### Contract 26: Key Validation & Entropy
```gherkin
GIVEN: User submits encryption key
WHEN: Dashboard validates key
THEN: MUST enforce minimum 32 bytes
  AND: MUST reject keys with insufficient entropy
  AND: MUST warn if key appears weak (e.g., all same character)
  AND: MUST support hex or base64 encoded keys
```

**Test Cases:**
- **TC-26.1 (Automated):** 31-byte key → rejected with error
- **TC-26.2 (Automated):** 32-byte key → accepted
- **TC-26.3 (Automated):** 64-char hex key → accepted and converted correctly
- **TC-26.4 (Automated):** Key = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" → warning displayed (weak entropy)

---

### Contract 27: Message Rendering Safety
```gherkin
GIVEN: Decrypted payload is rendered
WHEN: Dashboard displays message content
THEN: MUST truncate long messages (>2000 chars) with "..."
  AND: MUST sanitize URLs before display
  AND: MUST not auto-link URLs (no clickable links unless user opts in)
  AND: MUST display message timestamp from encrypted payload
```

**Test Cases:**
- **TC-27.1 (Automated):** Message with 3000 chars → truncated to 2000 + "..."
- **TC-27.2 (Automated):** Message contains URL → displayed as plain text, not hyperlink
- **TC-27.3 (Automated):** Timestamp from payload → displayed in local timezone
- **TC-27.4 (Automated):** Empty message content → displays "(empty message)"

---

## Part 3: User Experience Contracts (Contract 28)

### Contract 28: Dashboard State Management
```gherkin
GIVEN: User interacts with dashboard
WHEN: State changes occur
THEN: MUST show loading indicator during fetch
  AND: MUST display message count after fetch
  AND: MUST handle empty message list gracefully
  AND: MUST preserve scroll position after refresh
```

**Test Cases:**
- **TC-28.1 (Automated):** Click "Refresh" → loading indicator appears
- **TC-28.2 (Automated):** Fetch completes → message count updated
- **TC-28.3 (Automated):** Zero messages → displays "No messages yet"
- **TC-28.4 (Manual):** Scroll to message #10, click refresh → returns to same position

---

## Summary Table

| Contract | Focus Area | Test Cases | Automated | Manual |
|:---|:---|:---:|:---:|:---:|
| 22 | Key Storage | 4 | 3 | 1 |
| 23 | XSS Prevention | 5 | 4 | 1 |
| 24 | Decryption | 5 | 5 | 0 |
| 25 | CF Worker Integration | 5 | 5 | 0 |
| 26 | Key Validation | 4 | 4 | 0 |
| 27 | Message Rendering | 4 | 4 | 0 |
| 28 | UX State | 4 | 3 | 1 |
| **TOTALS** | | **31** | **28** | **3** |

---

## Implementation Requirements

### 1. Test Framework
Use **Vitest** + **Happy DOM** for automated browser testing:
```bash
npm install --save-dev vitest happy-dom
```

### 2. CSP Header (for production hosting)
```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self'; 
  style-src 'self'; 
  connect-src https://*.workers.dev;
  img-src 'self' data:;
```

### 3. Key Storage Migration
Current implementation uses `sessionStorage`. Consider migrating to:
- **In-memory only** (variable scoped to module)
- **SubtleCrypto.generateKey()** with non-extractable flag for session keys

### 4. Existing Gaps in `dashboard/index.html`

**Critical:**
- ❌ **TC-23.5 FAILING:** Current code uses `innerHTML` for message content (line ~150)
  ```javascript
  // CURRENT (UNSAFE):
  html += '<div class="decrypted">' + escapeHtml(decrypted.content || JSON.stringify(decrypted)) + '</div>';
  
  // REQUIRED (SAFE):
  const el = document.createElement('div');
  el.className = 'decrypted';
  el.textContent = decrypted.content || JSON.stringify(decrypted);
  ```

**Medium:**
- ⚠️ **TC-26.4:** No weak key detection (e.g., repeated characters)
- ⚠️ **TC-27.1:** No message truncation (could overflow UI)

**Low:**
- 💡 **TC-24.5:** No IV uniqueness validation (relies on crypto.ts correctness)

---

## Acceptance Gate

**Definition of Done for Step 1:**
- [ ] All 28 automated tests pass at 100%
- [ ] All 3 manual tests documented and verified
- [ ] CSP configured (if hosted on GitHub Pages)
- [ ] No `innerHTML` usage for user content
- [ ] Key stored in `sessionStorage` only (verified via browser DevTools)

**Once accepted:**
- Proceed to **Step 2: Wire the Sanitizer** (Gróa's sequence)
- Update contracts for sanitizer integration

---

**Vár: Phase 2 Step 1 contracts complete. Awaiting review.**
