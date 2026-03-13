const fs = require('fs');
let tasks = fs.readFileSync('/Users/aria/repos/greenkeeper/openspec/changes/greenkeeper-core/4-tasks.md', 'utf8');

if (!tasks.includes('Task 5.1 (Part 1)')) {
  tasks = tasks.replace(
    '### Step 3: Intents & Execution (Future)\n- [ ] **Task 5.1:** Implement aliases.json for deterministic inbound intents.\n- [ ] **Task 5.2:** Implement OpenCode Runner.\n- [x] **Task 5.3:** PWA intent submission UI (integer buttons).',
    `### Step 3: Intents & Execution (In Progress)
- [ ] **Task 5.1 (Part 1):** CF Worker \`POST /intent\` & \`GET /intents\` (KV consume-on-read).
- [ ] **Task 5.1 (Part 2):** PWA Intent Emission (Encrypt JSON + POST to CF Worker).
- [ ] **Task 5.1 (Part 3):** Daemon Poller (Jitter, try/catch decryption, nonce cache, timestamp checks).
- [ ] **Task 5.2:** Implement \`aliases.json\` routing for deterministic execution.
- [ ] **Task 5.3:** Implement OpenCode Runner (\`shell: false\`, regex strict args).`
  );
  fs.writeFileSync('/Users/aria/repos/greenkeeper/openspec/changes/greenkeeper-core/4-tasks.md', tasks);
  console.log('Tasks updated');
} else {
  console.log('Already updated');
}
