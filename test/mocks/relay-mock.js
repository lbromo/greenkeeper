import http from 'http';
import { URL } from 'url';

/**
 * Project Greenkeeper - Local Relay Mock (Simulates CF Worker)
 * 
 * Behavior:
 * - GET / : Returns 'latest_distillation' then DELETES it (Consume-on-Read)
 * - POST /intent : Stores 'pending_intent' for daemon to fetch
 * - POST /distill : Internal helper to simulate a new distillation hitting the worker
 */

let state = {
  latest_distillation: null,
  pending_intents: []
};

const PORT = process.env.PORT || 3333;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Dashboard / Daemon Polling for Distillation
  if (req.method === 'GET' && url.pathname === '/') {
    if (!state.latest_distillation) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No distillation available' }));
    }
    const data = state.latest_distillation;
    state.latest_distillation = null; // Consume-on-Read
    console.log('[Mock Relay] Distillation consumed by client');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  // Dashboard Submitting Intent
  if (req.method === 'POST' && url.pathname === '/intent') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        state.pending_intents.push(payload);
        console.log('[Mock Relay] Intent stored:', payload.taskId || 'unknown');
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'Intent stored' }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // INTERNAL: Helper to "push" data into the mock for testing
  if (req.method === 'POST' && url.pathname === '/mock-push') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      state.latest_distillation = JSON.parse(body);
      console.log('[Mock Relay] New distillation pushed for testing');
      res.writeHead(200);
      res.end('OK');
    });
    return;
  }

  // Daemon Polling for Intents (if implemented as a separate poll)
  if (req.method === 'GET' && url.pathname === '/pending-intents') {
    const intents = state.pending_intents;
    state.pending_intents = []; // Consume-on-Read
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(intents));
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Greenkeeper Mock Relay] Listening on http://localhost:${PORT}`);
  console.log(' - GET  /                : Fetch/Consume Distillation');
  console.log(' - POST /intent          : Submit Intent');
  console.log(' - POST /mock-push       : Simulate new distillation (Internal)');
  console.log(' - GET  /pending-intents : Daemon polling for Dashboard feedback');
});
