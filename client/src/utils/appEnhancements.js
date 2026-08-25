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
  if (window[SERIAL_PATCH_FLAG]) return;
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

function loadBranchMap() {
  try {
    const raw = localStorage.getItem(BRANCH_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBranchMap(map) {
  try {
    localStorage.setItem(BRANCH_MAP_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage failures.
  }
}

function normalizeBranchKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function upsertBranchMapping(branchName, cashInCharge) {
  const key = normalizeBranchKey(branchName);
  if (!key || !String(cashInCharge || '').trim()) return;

  const map = loadBranchMap();
  map[key] = {
    branchName: String(branchName).trim(),
    cashInCharge: String(cashInCharge).trim(),
    updatedAt: new Date().toISOString(),
  };
  saveBranchMap(map);
}

function getCashInChargeForBranch(branchName) {
  const key = normalizeBranchKey(branchName);
  if (!key) return null;
  const map = loadBranchMap();
  return map[key]?.cashInCharge || null;
}

function findInputByLabel(regex) {
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((node) => regex.test(node.textContent || ''));
  return label?.querySelector('input') || null;
}

function installBranchCashInChargePatch({ retries = 30 } = {}) {
  if (window.__kanhaiyaBranchCicPatchApplied) return;
  window.__kanhaiyaBranchCicPatchApplied = true;

  let branchInput = null;
  let cicInput = null;
  let wired = false;

  function tryWire() {
    branchInput = branchInput || findInputByLabel(/branch\s*name/i);
    cicInput = cicInput || findInputByLabel(/cash[\s-]*in[\s-]*charge/i);
    if (!branchInput || !cicInput || wired) return wired;
    wired = true;

    branchInput.addEventListener('blur', () => {
      if (String(cicInput.value || '').trim()) return;
      const suggestion = getCashInChargeForBranch(branchInput.value);
      if (suggestion) setReactInputValue(cicInput, suggestion);
    });

    cicInput.addEventListener('blur', () => {
      upsertBranchMapping(branchInput.value, cicInput.value);
    });

    injectManageButton(branchInput);
    return true;
  }

  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    if (tryWire() || attempts >= retries) clearInterval(interval);
  }, 250);

  window.addEventListener('load', tryWire);
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
    'background:#fff;border-radius:10px;padding:20px;max-width:560px;width:92%;max-height:80vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,0.3);';

  const title = document.createElement('h3');
  title.textContent = 'Branch → Cash-in-Charge List';
  title.style.cssText = 'margin:0 0 12px;font-size:16px;';
  panel.appendChild(title);

  const list = document.createElement('div');
  panel.appendChild(list);

  function renderList() {
    const map = loadBranchMap();
    const entries = Object.entries(map).sort((a, b) =>
      a[1].branchName.localeCompare(b[1].branchName),
    );
    list.innerHTML = '';

    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Abhi tak koi branch save nahi hui. Neeche se add karein.';
      empty.style.cssText = 'color:#777;font-size:13px;';
      list.appendChild(empty);
    }

    entries.forEach(([key, entry]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:8px;';

      const branchField = document.createElement('input');
      branchField.value = entry.branchName;
      branchField.placeholder = 'Branch name';
      branchField.style.cssText =
        'flex:1;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:13px;';

      const cicField = document.createElement('input');
      cicField.value = entry.cashInCharge;
      cicField.placeholder = 'Cash-in-charge name';
      cicField.style.cssText =
        'flex:1;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:13px;';

      const saveBtn = document.createElement('button');
      saveBtn.textContent = '💾';
      saveBtn.title = 'Save';
      saveBtn.style.cssText =
        'padding:5px 8px;border:none;border-radius:5px;background:#2e7d32;color:#fff;cursor:pointer;';
      saveBtn.addEventListener('click', () => {
        const map2 = loadBranchMap();
        delete map2[key];
        const newKey = normalizeBranchKey(branchField.value);
        if (newKey && cicField.value.trim()) {
          map2[newKey] = {
            branchName: branchField.value.trim(),
            cashInCharge: cicField.value.trim(),
            updatedAt: new Date().toISOString(),
          };
        }
        saveBranchMap(map2);
        renderList();
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.title = 'Delete';
      delBtn.style.cssText =
        'padding:5px 8px;border:none;border-radius:5px;background:#c62828;color:#fff;cursor:pointer;';
      delBtn.addEventListener('click', () => {
        const map2 = loadBranchMap();
        delete map2[key];
        saveBranchMap(map2);
        renderList();
      });

      row.appendChild(branchField);
      row.appendChild(cicField);
      row.appendChild(saveBtn);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  renderList();

  const addRow = document.createElement('div');
  addRow.style.cssText =
    'display:flex;gap:6px;margin-top:10px;border-top:1px solid #eee;padding-top:10px;';

  const newBranch = document.createElement('input');
  newBranch.placeholder = 'New branch name';
  newBranch.style.cssText =
    'flex:1;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:13px;';

  const newCic = document.createElement('input');
  newCic.placeholder = 'Cash-in-charge name';
  newCic.style.cssText =
    'flex:1;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:13px;';

  const addBtn = document.createElement('button');
  addBtn.textContent = '➕ Add';
  addBtn.style.cssText =
    'padding:5px 10px;border:none;border-radius:5px;background:#1565c0;color:#fff;cursor:pointer;';
  addBtn.addEventListener('click', () => {
    if (newBranch.value.trim() && newCic.value.trim()) {
      upsertBranchMapping(newBranch.value, newCic.value);
      newBranch.value = '';
      newCic.value = '';
      renderList();
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
