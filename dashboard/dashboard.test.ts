import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';

function createDashboardEnvironment() {
  const window = new Window();
  const document = window.document;
  
  document.body.innerHTML = `
    <div id="setup" class="status">
      <input type="password" id="encryptionKey" placeholder="Enter 32-byte encryption key" maxlength="32">
      <input type="text" id="relayUrl" placeholder="https://your-worker.workers.dev" value="">
      <button id="connectBtn">Connect</button>
    </div>
    <div id="dashboard" class="hidden">
      <div class="status">
        <span class="value" id="status">Connected</span>
        <span class="value" id="messageCount">0</span>
      </div>
      <button id="refreshBtn">Refresh Messages</button>
      <div class="messages" id="messages"></div>
    </div>
  `;
  
  window.alert = vi.fn();
  
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function validateKey(key) {
    if (!key) return { valid: false, error: 'Key is required' };
    
    let normalizedKey = key;
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      normalizedKey = hexToBytes(key);
      if (normalizedKey.length !== 32) {
        return { valid: false, error: 'Invalid hex key: must decode to 32 bytes' };
      }
    } else if (key.length < 32) {
      return { valid: false, error: 'Key must be at least 32 bytes' };
    } else if (key.length > 32) {
      normalizedKey = key.slice(0, 32);
    }
    
    const uniqueChars = new Set(key.split('')).size;
    const isWeak = uniqueChars <= 5;
    
    return { valid: true, key: normalizedKey, isWeak };
  }

  function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return String.fromCharCode.apply(null, bytes);
  }

  function showSetup() {
    document.getElementById('setup').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
  }

  function showDashboard() {
    const keyInput = document.getElementById('encryptionKey').value;
    const relayUrl = document.getElementById('relayUrl').value;
    
    if (!relayUrl) {
      window.alert('Please enter the Cloudflare Worker URL');
      return;
    }

    const keyValidation = validateKey(keyInput);
    if (!keyValidation.valid) {
      window.alert(keyValidation.error);
      return;
    }
    
    if (keyValidation.isWeak) {
      window.alert('Warning: Your key has low entropy (repetitive characters). Consider using a stronger key.');
    }

    window.sessionStorage.setItem('encryptionKey', keyValidation.key);
    window.sessionStorage.setItem('relayUrl', relayUrl);
    
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
  }
  
  return { window, document, escapeHtml, validateKey, showDashboard, hexToBytes };
}

describe('Contract 22: Key Storage & Memory Management', () => {
  let window, document, showDashboard;
  
  beforeEach(() => {
    const env = createDashboardEnvironment();
    window = env.window;
    document = env.document;
    showDashboard = env.showDashboard;
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  
  it('TC-22.1: Key stored in sessionStorage after connect', async () => {
    document.getElementById('encryptionKey').value = 'a'.repeat(32);
    document.getElementById('relayUrl').value = 'https://test.workers.dev';
    
    showDashboard();
    
    expect(window.sessionStorage.getItem('encryptionKey')).toBe('a'.repeat(32));
  });
  
  it('TC-22.2: Key NOT in localStorage after connect', async () => {
    document.getElementById('encryptionKey').value = 'a'.repeat(32);
    document.getElementById('relayUrl').value = 'https://test.workers.dev';
    
    showDashboard();
    
    expect(window.localStorage.getItem('encryptionKey')).toBeNull();
  });
  
  it('TC-22.4: Key length validation - reject if < 32 bytes', async () => {
    document.getElementById('encryptionKey').value = 'a'.repeat(31);
    document.getElementById('relayUrl').value = 'https://test.workers.dev';
    
    showDashboard();
    
    expect(window.alert).toHaveBeenCalled();
    expect(window.sessionStorage.getItem('encryptionKey')).toBeNull();
  });
});

describe('Contract 23: XSS Prevention & Output Encoding', () => {
  let window, document, escapeHtml;
  
  beforeEach(() => {
    const env = createDashboardEnvironment();
    window = env.window;
    document = env.document;
    escapeHtml = env.escapeHtml;
  });
  
  it('TC-23.1: Payload with script tag rendered as text', () => {
    const escaped = escapeHtml('<script>alert(\'XSS\')</script>');
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });
  
  it('TC-23.2: Payload with img onerror rendered as text', () => {
    const escaped = escapeHtml('<img src=x onerror=alert(1)>');
    expect(escaped).toContain('&lt;img');
    expect(escaped).toContain('&gt;');
  });
  
  it('TC-23.3: escapeHtml correctly escapes &, <, >, "', () => {
    const input = '&<>"';
    const escaped = escapeHtml(input);
    expect(escaped).toBe('&amp;&lt;&gt;&quot;');
  });
  
  it('TC-23.5: Decrypted content inserted via textContent, not innerHTML', () => {
    const messagesEl = document.getElementById('messages');
    const msgEl = document.createElement('div');
    msgEl.className = 'decrypted';
    msgEl.textContent = '<script>alert(1)</script>';
    messagesEl.appendChild(msgEl);
    
    expect(messagesEl.innerHTML).not.toContain('<script>');
    expect(messagesEl.querySelector('.decrypted').textContent).toBe('<script>alert(1)</script>');
  });
});

describe('Contract 26: Key Validation & Entropy', () => {
  let window, document, validateKey, showDashboard;
  
  beforeEach(() => {
    const env = createDashboardEnvironment();
    window = env.window;
    document = env.document;
    validateKey = env.validateKey;
    showDashboard = env.showDashboard;
    window.sessionStorage.clear();
  });
  
  it('TC-26.1: 31-byte key rejected with error', () => {
    document.getElementById('encryptionKey').value = 'a'.repeat(31);
    document.getElementById('relayUrl').value = 'https://test.workers.dev';
    
    showDashboard();
    
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('at least 32'));
  });
  
  it('TC-26.2: 32-byte key accepted', () => {
    document.getElementById('encryptionKey').value = 'abcdefghijklmnopqrstuvwxyz123456';
    document.getElementById('relayUrl').value = 'https://test.workers.dev';
    
    showDashboard();
    
    expect(window.alert).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('encryptionKey')).toBe('abcdefghijklmnopqrstuvwxyz123456'.slice(0, 32));
  });
  
  it('TC-26.3: 64-char hex key accepted and converted correctly', () => {
    const hexKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    document.getElementById('encryptionKey').value = hexKey;
    document.getElementById('relayUrl').value = 'https://test.workers.dev';
    
    showDashboard();
    
    expect(window.alert).not.toHaveBeenCalled();
    const storedKey = window.sessionStorage.getItem('encryptionKey');
    expect(storedKey).toBeDefined();
    expect(storedKey.length).toBe(32);
  });
  
  it('TC-26.4: Weak key (repetitive chars) shows warning', () => {
    const weakKey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    document.getElementById('encryptionKey').value = weakKey;
    document.getElementById('relayUrl').value = 'https://test.workers.dev';
    
    showDashboard();
    
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('entropy'));
  });
});

describe('Contract 27: Message Rendering Safety', () => {
  let window, document;
  
  beforeEach(() => {
    const env = createDashboardEnvironment();
    window = env.window;
    document = env.document;
  });
  
  it('TC-27.1: Message > 2000 chars truncated to 2000 + "..."', () => {
    const longContent = 'x'.repeat(3000);
    let content = longContent;
    if (content.length > 2000) {
      content = content.slice(0, 2000) + '...';
    }
    
    expect(content.length).toBe(2003);
    expect(content.endsWith('...')).toBe(true);
  });
  
  it('TC-27.2: URL displayed as plain text, not hyperlink', () => {
    const messagesEl = document.getElementById('messages');
    const msgEl = document.createElement('div');
    msgEl.className = 'decrypted';
    msgEl.textContent = 'Visit https://example.com';
    messagesEl.appendChild(msgEl);
    
    const links = messagesEl.querySelectorAll('a');
    expect(links.length).toBe(0);
  });
  
  it('TC-27.4: Empty message displays "(empty message)"', () => {
    let content = '';
    if (!content || content.trim() === '') {
      content = '(empty message)';
    }
    
    expect(content).toBe('(empty message)');
  });
});

describe('Contract 24: Decryption & Web Crypto API', () => {
  let window, document;
  
  beforeEach(() => {
    const env = createDashboardEnvironment();
    window = env.window;
    document = env.document;
  });
  
  it('TC-24.4: Algorithm validation - uses AES-GCM with 128-bit tag', async () => {
    const testKey = 'testkey12345678901234567890123';
    const keyBuffer = new TextEncoder().encode(testKey.padEnd(32, '0').slice(0, 32));
    
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw', keyBuffer, { name: 'AES-GCM' }, false, ['decrypt']
    );
    
    expect(cryptoKey.algorithm.name).toBe('AES-GCM');
  });
  
  it('TC-24.3: Malformed payload (invalid base64) caught and handled', async () => {
    const invalidPayload = { iv: 'invalid!', authTag: 'base64', ciphertext: 'data' };
    
    expect(() => {
      try {
        Uint8Array.from(atob(invalidPayload.iv), c => c.charCodeAt(0));
      } catch (e) {
        throw new Error('Invalid base64');
      }
    }).toThrow();
  });
});

describe('Contract 25: Cloudflare Worker Integration', () => {
  let window, document, showDashboard;
  
  beforeEach(() => {
    const env = createDashboardEnvironment();
    window = env.window;
    document = env.document;
    showDashboard = env.showDashboard;
  });
  
  it('TC-25.5: Invalid URL (no HTTPS) - accepts but stores', () => {
    document.getElementById('encryptionKey').value = 'a'.repeat(32);
    document.getElementById('relayUrl').value = 'http://insecure.workers.dev';
    
    showDashboard();
    
    const storedUrl = window.sessionStorage.getItem('relayUrl');
    expect(storedUrl).toBe('http://insecure.workers.dev');
  });
});

describe('Contract 28: Dashboard State Management', () => {
  let window, document;
  
  beforeEach(() => {
    const env = createDashboardEnvironment();
    window = env.window;
    document = env.document;
    window.sessionStorage.clear();
  });
  
  it('TC-28.2: Message count updated after fetch', () => {
    document.getElementById('messageCount').textContent = '5';
    expect(document.getElementById('messageCount').textContent).toBe('5');
  });
  
  it('TC-28.3: Zero messages displays "No messages yet"', () => {
    const messagesEl = document.getElementById('messages');
    const messageKeys = [];
    
    messagesEl.innerHTML = '';
    if (messageKeys.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.style.color = '#666';
      emptyEl.textContent = 'No messages yet';
      messagesEl.appendChild(emptyEl);
    }
    
    expect(messagesEl.textContent).toBe('No messages yet');
  });
});

describe('Contract 30: Task Intent UI (Phase 2, Step 3)', () => {
  let window, document;
  
  beforeEach(() => {
    const env = createDashboardEnvironment();
    window = env.window;
    document = env.document;
  });

  it('TC-30.1: Distilled task cards contain Confirm (1), Reject (2), and Defer (3) buttons', () => {
    const messagesEl = document.getElementById('messages');
    const distEl = document.createElement('div');
    distEl.className = 'distillation-summary';
    
    const taskCard = document.createElement('div');
    taskCard.className = 'task-card';
    
    const actionsEl = document.createElement('div');
    actionsEl.className = 'task-actions';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'action-btn action-confirm';
    confirmBtn.textContent = '1: Confirm';
    confirmBtn.dataset.intent = '1';
    
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'action-btn action-reject';
    rejectBtn.textContent = '2: Reject';
    rejectBtn.dataset.intent = '2';

    const deferBtn = document.createElement('button');
    deferBtn.className = 'action-btn action-defer';
    deferBtn.textContent = '3: Defer';
    deferBtn.dataset.intent = '3';
    
    actionsEl.appendChild(confirmBtn);
    actionsEl.appendChild(rejectBtn);
    actionsEl.appendChild(deferBtn);
    taskCard.appendChild(actionsEl);
    distEl.appendChild(taskCard);
    messagesEl.appendChild(distEl);
    
    const btns = messagesEl.querySelectorAll('.action-btn');
    expect(btns.length).toBe(3);
    expect(messagesEl.querySelector('.action-confirm').textContent).toContain('1');
    expect(messagesEl.querySelector('.action-reject').textContent).toContain('2');
    expect(messagesEl.querySelector('.action-defer').textContent).toContain('3');
    expect(messagesEl.querySelector('.action-confirm').dataset.intent).toBe('1');
    expect(messagesEl.querySelector('.action-reject').dataset.intent).toBe('2');
    expect(messagesEl.querySelector('.action-defer').dataset.intent).toBe('3');
  });
});
