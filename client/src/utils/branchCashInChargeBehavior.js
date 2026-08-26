import { API_BASE } from './config';

const PATCH_FLAG = '__kanhaiyaBranchCicBehaviorPatchApplied';

function normalizeBranchKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findInputByLabel(regex) {
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((node) => regex.test(node.textContent || ''));
  return label?.querySelector('input') || null;
}

function setReactInputValue(input, value) {
  const prototype = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function getCashInCharge(branchName) {
  const key = normalizeBranchKey(branchName);
  if (!key) return null;

  try {
    const response = await window.fetch(`${API_BASE}/branch-cash-in-charge`);
    if (!response.ok) return null;
    const rows = await response.json();
    return rows.find((row) => row.branchKey === key)?.cashInCharge || null;
  } catch {
    return null;
  }
}

function wireFields(branchInput, cicInput) {
  if (!branchInput || !cicInput || branchInput.__branchCicBehaviorWired) return;

  branchInput.__branchCicBehaviorWired = true;
  cicInput.__branchCicBehaviorWired = true;

  branchInput.addEventListener('blur', async () => {
    const branch = String(branchInput.value || '').trim();

    if (!branch) {
      if (String(cicInput.value || '').trim()) {
        setReactInputValue(cicInput, '');
      }
      cicInput.__cicAutoFilledValue = '';
      return;
    }

    const suggestion = await getCashInCharge(branch);
    const currentCash = String(cicInput.value || '').trim();

    if (suggestion) {
      setReactInputValue(cicInput, suggestion);
      cicInput.__cicAutoFilledValue = suggestion;
      return;
    }

    if (!suggestion && currentCash === String(cicInput.__cicAutoFilledValue || '').trim()) {
      setReactInputValue(cicInput, '');
    }
    cicInput.__cicAutoFilledValue = '';
  });

  cicInput.addEventListener('input', () => {
    const value = String(cicInput.value || '').trim();
    if (value !== String(cicInput.__cicAutoFilledValue || '').trim()) {
      cicInput.__cicAutoFilledValue = '';
    }
  });
}

function tryWire() {
  wireFields(
    findInputByLabel(/branch\s*name/i),
    findInputByLabel(/cash[\s-]*in[\s-]*charge/i),
  );
}

function install() {
  if (window[PATCH_FLAG]) return;
  window[PATCH_FLAG] = true;

  tryWire();
  new MutationObserver(tryWire).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', tryWire);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
