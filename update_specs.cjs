const fs = require('fs');

// Update 2-specs.md
let specs = fs.readFileSync('/Users/aria/repos/greenkeeper/openspec/changes/greenkeeper-core/2-specs.md', 'utf8');
if (!specs.includes('MUST reject payloads with timestamp > 5 minutes old')) {
  specs = specs.replace(
    '- The orchestrator SHALL decrypt and validate intents before routing to workflows.',
    `- The orchestrator SHALL decrypt and validate intents before routing to workflows.
  - The orchestrator MUST reject payloads with timestamp > 5 minutes old (Replay Protection).
  - The orchestrator MUST maintain an LRU cache of recently processed nonces.
  - The orchestrator MUST wrap decryption in a non-fatal try/catch to silently drop malformed poisons.
  - The polling mechanism MUST use randomized jitter (e.g., 6-14 minute intervals) to evade beaconing detection.
  - The execution runner MUST use \`child_process.spawn\` or \`execFile\` with \`shell: false\`.`
  );
  fs.writeFileSync('/Users/aria/repos/greenkeeper/openspec/changes/greenkeeper-core/2-specs.md', specs);
}

// Update 3-design.md
let design = fs.readFileSync('/Users/aria/repos/greenkeeper/openspec/changes/greenkeeper-core/3-design.md', 'utf8');
if (!design.includes('## 4. Data Flow (Ingress)')) {
  design = design.replace(
    '## 4. Security Constraints',
    `## 4. Data Flow (Ingress)
1. User clicks "Confirm" in PWA.
2. PWA creates JSON: \`{ taskId: "xyz", intent: 1, nonce: UUID, timestamp: ISO8601 }\`.
3. PWA encrypts JSON with local \`sessionStorage\` AES-256-GCM key.
4. PWA POSTs encrypted blob to Cloudflare Worker \`/intent\`.
5. CF Worker stores blob in KV with \`in:*\` prefix and 20-min TTL.
6. Daemon polls CF Worker \`/intents\` with randomized jitter.
7. Daemon GETs and immediately DELETEs the key (Consume-on-Read).
8. Daemon decrypts, validates timestamp (<5min old) and nonce (not seen in cache).
9. Daemon maps integer intent to \`aliases.json\`.
10. Daemon spawns local script with \`shell: false\` and \`taskId\` as a sanitized argument.

## 5. Security Constraints`
  );
  fs.writeFileSync('/Users/aria/repos/greenkeeper/openspec/changes/greenkeeper-core/3-design.md', design);
}
console.log('Specs updated');
