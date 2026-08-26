import { jsPDF } from 'jspdf';
import { API_BASE } from './config';

const SERIAL_PATCH_FLAG = '__kanhaiyaSerialPatchApplied';
const PDF_PATCH_FLAG = '__kanhaiyaPdfAccountPatchApplied';

function findCertificateRefInput() {
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((node) => /ref\s*no/i.test(node.textContent || ''));
  return label?.querySelector('input') || null;
}

function setReactInputValue(input, value) {
  const prototype = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function relabelSerialField(input) {
  const label = input?.closest('label');
  const text = label?.querySelector('span');
  if (text) text.textContent = 'Serial No. · KJ (auto-filled)';
}

async function fetchNextSerialValue() {
  const response = await window.fetch(`${API_BASE}/certificates/next-serial?prefix=KJ`);
  if (!response.ok) throw new Error('Could not load next serial');
  const result = await response.json();
  return result.nextRefNo || `KJ-${result.nextNumber}`;
}

async function fillNextSerial({ force = false, retries = 12 } = {}) {
  try {
    const nextRefNo = await fetchNextSerialValue();
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const input = findCertificateRefInput();
      if (input) {
        relabelSerialField(input);
        if (force || !String(input.value || '').trim()) {
          setReactInputValue(input, nextRefNo);
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  } catch {
    // Keep the existing/manual value when the API is unavailable.
  }
}

function installSerialPatch() {
  if (window[SERIAL_PATCH_FLAG] || window.location.pathname !== '/') return;
  window[SERIAL_PATCH_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const request = args[0];
      const options = args[1] || {};
      const url = typeof request === 'string' ? request : request?.url || '';
      const method = String(options.method || request?.method || 'GET').toUpperCase();
      if (method === 'POST' && /\/certificates\/?$/i.test(url) && response.ok) {
        setTimeout(() => fillNextSerial({ force: true }), 0);
      }
    } catch {
      // Do not interfere with normal application requests.
    }
    return response;
  };

  window.addEventListener('load', () => fillNextSerial());
  window.setTimeout(() => fillNextSerial(), 100);
  window.setTimeout(() => fillNextSerial(), 500);
}

function getAppraiserAccount() {
  try {
    const saved = localStorage.getItem('sbi-gold-appraiser-shop-settings');
    const parsed = saved ? JSON.parse(saved) : null;
    return String(parsed?.appraiserAccount || '43647158156').trim();
  } catch {
    return '43647158156';
  }
}

// ================== Branch → Cash-in-Charge Auto-Fill ==================

const BRANCH_MAP_KEY = 'kanhaiya-branch-cashincharge-map-v1';
let branchMapCache = null;
let branchMapLoadPromise = null;
let legacyMigrationPromise = null;

function normalizeBranchKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function fetchBranchMap() {
  if (branchMapCache) return branchMapCache;
  if (!branchMapLoadPromise) {
    branchMapLoadPromise = window.fetch(`${API_BASE}/branch-cash-in-charge`).then(async (response) => {
      if (!response.ok) throw new Error('Could not load branch list');
      const rows = await response.json();
      branchMapCache = Object.fromEntries(rows.map((row) => [row.branchKey, row]));
      return branchMapCache;
    }).finally(() => {
      branchMapLoadPromise = null;
    });
  }
  return branchMapLoadPromise;
}

async function saveBranchMapping(branchName, cashInCharge) {
  const branch = String(branchName || '').trim();
  const cash = String(cashInCharge || '').trim();
  const branchKey = normalizeBranchKey(branch);
  if (!branchKey || !cash) return;

  const response = await window.fetch(`${API_BASE}/branch-cash-in-charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchName: branch, cashInCharge: cash }),
  });
  if (!response.ok) throw new Error('Could not save branch mapping');
  const row = await response.json();
  branchMapCache = { ...(branchMapCache || {}), [row.branchKey]: row };
  return row;
}

async function updateBranchMapping(oldKey, branchName, cashInCharge) {
  const branch = String(branchName || '').trim();
  const cash = String(cashInCharge || '').trim();
  const branchKey = normalizeBranchKey(branch);
  if (!branchKey || !cash) return;

  const response = await window.fetch(`${API_BASE}/branch-cash-in-charge/${encodeURIComponent(oldKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchName: branch, cashInCharge: cash }),
  });
  if (!response.ok) throw new Error('Could not update branch mapping');
  const row = await response.json();
  const map = { ...(branchMapCache || {}) };
  delete map[oldKey];
  map[row.branchKey] = row;
  branchMapCache = map;
}

async function deleteBranchMapping(branchKey) {
  const response = await window.fetch(`${API_BASE}/branch-cash-in-charge/${encodeURIComponent(branchKey)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Could not delete branch mapping');
  const map = { ...(branchMapCache || {}) };
  delete map[branchKey];
  branchMapCache = map;
}

async function migrateLegacyBranchMap() {
  if (legacyMigrationPromise) return legacyMigrationPromise;
  legacyMigrationPromise = (async () => {
    try {
      const raw = localStorage.getItem(BRANCH_MAP_KEY);
      if (!raw) return;
      const legacyMap = JSON.parse(raw);
      if (!legacyMap || typeof legacyMap !== 'object') return;

      await fetchBranchMap();
      for (const entry of Object.values(legacyMap)) {
        if (entry?.branchName && entry?.cashInCharge) {
          await saveBranchMapping(entry.branchName, entry.cashInCharge);
        }
      }
      localStorage.removeItem(BRANCH_MAP_KEY);
    } catch {
      // Keep the legacy cache until the database migration succeeds.
    }
  })().finally(() => {
    legacyMigrationPromise = null;
  });
  return legacyMigrationPromise;
}

async function getCashInChargeForBranch(branchName) {
  const key = normalizeBranchKey(branchName);
  if (!key) return null;
  try {
    await fetchBranchMap();
    return branchMapCache?.[key]?.cashInCharge || null;
  } catch {
    return null;
  }
}

function findInputByLabel(regex) {
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((node) => regex.test(node.textContent || ''));
  return label?.querySelector('input') || null;
}

function installBranchCashInChargePatch() {
  if (window.__kanhaiyaBranchCicPatchApplied) return;
  window.__kanhaiyaBranchCicPatchApplied = true;

  void migrateLegacyBranchMap();

  async function tryWire() {
    const branchInput = findInputByLabel(/branch\s*name/i);
    const cicInput = findInputByLabel(/cash[\s-]*in[\s-]*charge/i);

    if (!branchInput || !cicInput) return false;

    if (branchInput.__cicWired) return true;
    branchInput.__cicWired = true;
    cicInput.__cicWired = true;

    branchInput.addEventListener('blur', async () => {
      if (String(cicInput.value || '').trim()) return;
      const suggestion = await getCashInChargeForBranch(branchInput.value);
      if (suggestion) setReactInputValue(cicInput, suggestion);
    });

    cicInput.addEventListener('blur', async () => {
      try {
        await saveBranchMapping(branchInput.value, cicInput.value);
      } catch {
        // Keep form usable even if the branch list API is temporarily unavailable.
      }
    });

    injectManageButton(branchInput);
    return true;
  }

  tryWire();

  const observer = new MutationObserver(() => {
    void tryWire();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', () => void tryWire());
}

function injectManageButton(branchInput) {
  if (document.getElementById('kanhaiya-cic-manage-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'kanhaiya-cic-manage-btn';
  btn.type = 'button';
  btn.textContent = '📋 Manage Cash-in-Charge List';
  btn.style.cssText =
    'margin-left:8px;padding:4px 10px;font-size:12px;border-radius:6px;border:1px solid #999;background:#fff;cursor:pointer;';
  btn.addEventListener('click', openManagePanel);

  const label = branchInput.closest('label') || branchInput.parentElement;
  label?.parentElement?.appendChild(btn);
}

function closeManagePanel() {
  document.getElementById('kanhaiya-cic-overlay')?.remove();
}

function openManagePanel() {
  closeManagePanel();

  const overlay = document.createElement('div');
  overlay.id = 'kanhaiya-cic-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'background:#fff;border-radius:10px;padding:16px;max-width:560px;width:94%;max-height:85vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.3);box-sizing:border-box;';

  const title = document.createElement('h3');
  title.textContent = 'Branch → Cash-in-Charge List';
  title.style.cssText = 'margin:0 0 12px;font-size:16px;';
  panel.appendChild(title);

  const list = document.createElement('div');
  panel.appendChild(list);

  async function renderList() {
    list.innerHTML = '<p style="color:#777;font-size:13px;">Loading...</p>';
    try {
      const map = await fetchBranchMap();
      const entries = Object.entries(map).sort((a, b) => a[1].branchName.localeCompare(b[1].branchName));
      list.innerHTML = '';

      if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No branches have been saved yet. Add one below';
        empty.style.cssText = 'color:#777;font-size:13px;';
        list.appendChild(empty);
      }

      entries.forEach(([key, entry]) => {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;';

        const branchField = document.createElement('input');
        branchField.value = entry.branchName;
        branchField.placeholder = 'Branch name';
        branchField.style.cssText =
          'flex:1 1 120px;min-width:0;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;box-sizing:border-box;';

        const cicField = document.createElement('input');
        cicField.value = entry.cashInCharge;
        cicField.placeholder = 'Cash-in-charge name';
        cicField.style.cssText =
          'flex:1 1 120px;min-width:0;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;box-sizing:border-box;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾';
        saveBtn.title = 'Save';
        saveBtn.style.cssText = 'flex:0 0 auto;padding:6px 10px;border:none;border-radius:5px;background:#2e7d32;color:#fff;cursor:pointer;font-size:14px;';
        saveBtn.addEventListener('click', async () => {
          try {
            await updateBranchMapping(key, branchField.value, cicField.value);
            await renderList();
          } catch {
            alert('Could not update this branch.');
          }
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️';
        delBtn.title = 'Delete';
        delBtn.style.cssText =
          'flex:0 0 auto;padding:6px 10px;border:none;border-radius:5px;background:#c62828;color:#fff;cursor:pointer;font-size:14px;';
        delBtn.addEventListener('click', async () => {
          try {
            await deleteBranchMapping(key);
            await renderList();
          } catch {
            alert('Could not delete this branch.');
          }
        });

        row.appendChild(branchField);
        row.appendChild(cicField);
        row.appendChild(saveBtn);
        row.appendChild(delBtn);
        list.appendChild(row);
      });
    } catch {
      list.innerHTML = '<p style="color:#b00020;font-size:13px;">Could not load the saved branch list.</p>';
    }
  }

  void renderList();

  const addRow = document.createElement('div');
  addRow.style.cssText =
    'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;border-top:1px solid #eee;padding-top:10px;';

  const newBranch = document.createElement('input');
  newBranch.placeholder = 'New branch name';
  newBranch.style.cssText =
    'flex:1 1 120px;min-width:0;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;box-sizing:border-box;';

  const newCic = document.createElement('input');
  newCic.placeholder = 'Cash-in-charge name';
  newCic.style.cssText =
    'flex:1 1 120px;min-width:0;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;box-sizing:border-box;';

  const addBtn = document.createElement('button');
  addBtn.textContent = '➕ Add';
  addBtn.style.cssText =
    'flex:1 1 100%;padding:8px 10px;border:none;border-radius:5px;background:#1565c0;color:#fff;cursor:pointer;font-size:14px;';
  addBtn.addEventListener('click', async () => {
    if (!newBranch.value.trim() || !newCic.value.trim()) return;
    try {
      await saveBranchMapping(newBranch.value, newCic.value);
      newBranch.value = '';
      newCic.value = '';
      await renderList();
    } catch {
      alert('Could not save this branch.');
    }
  });

  addRow.appendChild(newBranch);
  addRow.appendChild(newCic);
  addRow.appendChild(addBtn);
  panel.appendChild(addRow);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText =
    'margin-top:16px;padding:6px 14px;border:1px solid #999;border-radius:6px;background:#fff;cursor:pointer;float:right;';
  closeBtn.addEventListener('click', closeManagePanel);
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeManagePanel();
  });
  document.body.appendChild(overlay);
}

installSerialPatch();
installBranchCashInChargePatch();
