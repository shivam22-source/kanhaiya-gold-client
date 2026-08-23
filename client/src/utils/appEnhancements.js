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

function installPdfAccountPatch() {
  if (window[PDF_PATCH_FLAG]) return;
  window[PDF_PATCH_FLAG] = true;

  const originalText = jsPDF.prototype.text;
  jsPDF.prototype.text = function patchedText(text, ...args) {
    const result = originalText.call(this, text, ...args);

    if (String(text || '').trim() === 'Name & Signature of the Appraiser') {
      const x = args[0];
      const y = args[1];
      const options = args[2] || {};
      const account = getAppraiserAccount();
      if (account) {
        const previousFont = this.getFont?.();
        const previousSize = this.getFontSize?.();
        this.setFont('times', 'normal');
        this.setFontSize(9.2);
        this.text(`A/c No.: ${account}`, x, Number(y) + 7, { align: options.align || 'right' });
        if (previousFont?.fontName && previousFont?.fontStyle) {
          this.setFont(previousFont.fontName, previousFont.fontStyle);
        } else {
          this.setFont('times', 'bold');
        }
        if (previousSize) this.setFontSize(previousSize);
      }
    }

    return result;
  };
}

installSerialPatch();
installPdfAccountPatch();
