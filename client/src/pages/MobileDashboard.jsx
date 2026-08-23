import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  DEFAULT_BASE_RATE_24CT,
  PURITIES,
  PURITY_PERCENTAGES,
  calculateRows,
  calculateTotals,
  deriveRatesFromBaseRate,
  formatMoney,
  formatWeight,
  groupPuritySummaries,
} from '../utils/calculations';
import { numberToWordsIndian } from '../utils/numberToWordsIndian';
import { generateCertificatePdf } from '../utils/pdfGenerator';
import { API_BASE } from '../utils/config';

const storageKey = 'sbi-gold-appraiser-shop-settings';

const defaultShop = {
  nameHindi: 'कन्हैया ज्वेलर्स',
  addressHindi: 'देकदार बाजार',
  registrationNo: 'उद्यम रजि० नं०--BR-10-0038338',
  qrText: '',
  qrImage: '',
  itemImageUrl: '',
  appraiserAccount: '43647158156',
  footerCredit: 'Design & Developed by Shivam Thakur',
};

const freshRow = () => ({
  id: crypto.randomUUID(),
  description: '',
  units: 1,
  stoneWeight: '',
  grossWeight: '',
  netWeight: '',
  purity: '22 Ct',
  customValues: {},
  marketManual: false,
});

const indiaToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const defaultForm = {
  refNo: '',
  appraisalCharge: '',
  date: '',
  bankAccount: '',
  branchName: '',
  borrowerName: '',
  fatherName: '',
  borrowerAddress: '',
  appraisalDate: '',
  cashInCharge: '',
  testingMethod: '',
  place: '',
  signatureDate: '',
};

function Field({ label, value, onChange, type = 'text', inputMode, placeholder, readOnly = false, disabled = false, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      <input
        className={`h-12 w-full rounded-2xl border px-4 text-[15px] shadow-sm outline-none transition ${
          readOnly || disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
            : 'border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
        }`}
        type={type}
        inputMode={inputMode}
        autoComplete="off"
        value={value ?? ''}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}

function MobileDashboard() {
  const [shop, setShop] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return defaultShop;
    try {
      return {
        ...defaultShop,
        ...JSON.parse(saved),
        footerCredit: defaultShop.footerCredit,
        itemImageUrl: '',
        qrText: '',
        qrImage: '',
      };
    } catch {
      return defaultShop;
    }
  });
  const [form, setForm] = useState(() => ({ ...defaultForm, date: indiaToday(), appraisalDate: indiaToday(), signatureDate: indiaToday() }));
  const [baseRate24ct, setBaseRate24ct] = useState(DEFAULT_BASE_RATE_24CT);
  const rates = useMemo(() => deriveRatesFromBaseRate(baseRate24ct), [baseRate24ct]);
  const [rows, setRows] = useState([freshRow()]);
  const [customColumns, setCustomColumns] = useState([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(shop));
  }, [shop]);

  useEffect(() => {
    const currentState = window.history.state;
    if (!currentState?.kanhaiyaApp || currentState.screen !== 'certificate-step') {
      window.history.replaceState({ kanhaiyaApp: true, screen: 'certificate-step', step: 0 }, '', window.location.href);
    }
    const handlePopState = (event) => {
      if (event.state?.kanhaiyaApp && event.state.screen === 'certificate-step') {
        setStep(Math.max(0, Math.min(2, Number(event.state.step) || 0)));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function goToStep(nextStep, { push = true } = {}) {
    const normalized = Math.max(0, Math.min(2, Number(nextStep)));
    if (normalized === step) return;
    if (push) {
      window.history.pushState(
        { kanhaiyaApp: true, screen: 'certificate-step', step: normalized },
        '',
        window.location.href,
      );
    }
    setStep(normalized);
  }

  function startNewCertificate() {
    const today = indiaToday();
    setForm({ ...defaultForm, date: today, appraisalDate: today, signatureDate: today });
    setRows([freshRow()]);
    setCustomColumns([]);
    setShop((current) => ({ ...current, itemImageUrl: '', qrText: '', qrImage: '' }));
    setError('');
    setStatus('');
    setPhotoUploading(false);
    setBaseRate24ct(DEFAULT_BASE_RATE_24CT);
    goToStep(0);
  }

  const calculatedRows = useMemo(() => calculateRows(rows, rates), [rows, rates]);
  const totals = useMemo(() => calculateTotals(calculatedRows), [calculatedRows]);
  const summaries = useMemo(() => groupPuritySummaries(calculatedRows), [calculatedRows]);
  const amountWords = useMemo(() => numberToWordsIndian(totals.marketValue), [totals.marketValue]);

  function updateForm(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'appraisalDate' && current.signatureDate === current.appraisalDate) next.signatureDate = value;
      return next;
    });
  }

  function updateRow(id, key, value) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const numericKeys = ['units', 'stoneWeight', 'grossWeight', 'netWeight', 'marketValue'];
      const nextValue = numericKeys.includes(key) ? (value === '' ? '' : Number(value)) : value;
      return {
        ...row,
        [key]: nextValue,
        marketManual: key === 'marketValue' ? true : row.marketManual,
      };
    }));
  }

  function addRow() {
    setRows((current) => [...current, freshRow()]);
    goToStep(1);
  }

  function deleteRow(id) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current);
  }

  function resetMarketValue(id) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, marketManual: false } : row));
  }

  async function uploadImage(file) {
    if (!file || photoUploading) return;
    try {
      setPhotoUploading(true);
      setStatus('Uploading gold photo…');
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch(`${API_BASE}/uploads/gold-item`, { method: 'POST', body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Upload failed');
      const qrImage = await QRCode.toDataURL(result.imageUrl, { margin: 1, width: 300 });
      setShop((current) => ({ ...current, itemImageUrl: result.imageUrl, qrText: result.imageUrl, qrImage, footerCredit: defaultShop.footerCredit }));
      setStatus('Gold photo uploaded successfully');
    } catch (uploadError) {
      setStatus(`Upload failed: ${uploadError.message}`);
    } finally {
      setPhotoUploading(false);
    }
  }

  function validate() {
    const required = [form.date, form.bankAccount, form.branchName, form.borrowerName, form.fatherName, form.borrowerAddress, form.cashInCharge, form.place];
    if (required.some((value) => !String(value || '').trim())) {
      setError('Please complete the borrower, bank, and cash-in-charge details.');
      return false;
    }
    if (calculatedRows.some((row) => !String(row.description || '').trim() || !row.purity)) {
      setError('Please complete every gold item description and purity.');
      goToStep(1, { push: false });
      return false;
    }
    setError('');
    return true;
  }

  function payload() {
    return {
      shop: { ...shop, footerCredit: defaultShop.footerCredit },
      form,
      baseRate24ct,
      rates,
      rows: calculatedRows,
      customColumns,
      totals,
      summaries,
      amountWords,
    };
  }

  async function saveCertificate() {
    if (!validate()) return null;
    try {
      setStatus('Saving certificate...');
      const response = await fetch(`${API_BASE}/certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Save failed');
      setStatus(`Saved for ${result.borrowerName}`);
      return result;
    } catch (saveError) {
      setStatus(`Save failed: ${saveError.message}`);
      return null;
    }
  }

  async function generatePdf() {
    if (!validate()) return;
    const saved = await saveCertificate();
    if (!saved) return;
    await generateCertificatePdf({ shop: { ...shop, footerCredit: defaultShop.footerCredit }, form, rows: calculatedRows, customColumns, totals, summaries });
    setStatus('PDF downloaded');
  }

  async function sharePdf() {
    if (!validate()) return;
    const saved = await saveCertificate();
    if (!saved) return;
    const { blob, filename } = await generateCertificatePdf(
      { shop: { ...shop, footerCredit: defaultShop.footerCredit }, form, rows: calculatedRows, customColumns, totals, summaries },
      { save: false },
    );
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Gold Appraiser Certificate', text: `Certificate for ${form.borrowerName}`, files: [file] });
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('PDF downloaded');
  }

  function addCustomColumn() {
    const label = window.prompt('Column name');
    if (!label?.trim()) return;
    setCustomColumns((current) => [...current, { id: crypto.randomUUID(), label: label.trim() }]);
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-24 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">Kanhaiya Gold</p>
            <h1 className="truncate text-lg font-extrabold tracking-tight">Appraiser Certificate</h1>
          </div>
          <Link to="/records" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm" aria-label="Open saved records">
            <span className="text-lg">▤</span>
          </Link>
        </div>
      </header>

      <div className="px-4 pt-4">
        <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Current valuation</p>
              <p className="mt-2 text-3xl font-black tracking-tight">₹{formatMoney(totals.marketValue)}</p>
              <p className="mt-1 text-xs text-slate-400">{totals.units} units · {formatWeight(totals.netWeight)} gm net</p>
            </div>
            <span className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold">Live</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <QuickMetric label="Gross" value={`${formatWeight(totals.grossWeight)}g`} />
            <QuickMetric label="Net" value={`${formatWeight(totals.netWeight)}g`} />
            <QuickMetric label="Items" value={rows.length} />
          </div>
        </section>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
          {['Details', 'Gold Items', 'Review'].map((label, index) => (
            <button key={label} onClick={() => goToStep(index)} className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${step === index ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
        {status && <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-medium text-indigo-700">{status}</div>}

        {step === 0 && (
          <div className="mt-4 space-y-4">
            <MobileCard title="Borrower">
              <div className="grid gap-4">
                <Field label="Borrower Name" value={form.borrowerName} onChange={(v) => updateForm('borrowerName', v)} />
                <Field label="Father / Husband Name" value={form.fatherName} onChange={(v) => updateForm('fatherName', v)} />
                <Field label="Resident" value={form.borrowerAddress} onChange={(v) => updateForm('borrowerAddress', v)} />
              </div>
            </MobileCard>
            <MobileCard title="Bank & Appraisal">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ref No." value={form.refNo} onChange={(v) => updateForm('refNo', v)} />
                  <Field label="Date" type="date" value={form.date} onChange={(v) => updateForm('date', v)} />
                </div>
                <Field label="Bank A/c No." value={form.bankAccount} onChange={(v) => updateForm('bankAccount', v)} inputMode="numeric" />
                <Field label="Branch Name" value={form.branchName} onChange={(v) => updateForm('branchName', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Appraisal Charge" type="number" value={form.appraisalCharge} onChange={(v) => updateForm('appraisalCharge', v === '' ? '' : Number(v))} />
                  <Field label="Appraisal Date" type="date" value={form.appraisalDate} onChange={(v) => updateForm('appraisalDate', v)} />
                </div>
                <Field label="Cash-in-charge" value={form.cashInCharge} onChange={(v) => updateForm('cashInCharge', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Place" value={form.place} onChange={(v) => updateForm('place', v)} />
                  <Field label="Signature Date" type="date" value={form.signatureDate} onChange={(v) => updateForm('signatureDate', v)} />
                </div>
              </div>
            </MobileCard>

            <MobileCard title="Rate Settings">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <Field
                  label="24 Ct Gold Rate / gm (Manual Market Rate)"
                  type="number"
                  step="0.01"
                  value={baseRate24ct}
                  onChange={(value) => setBaseRate24ct(value === '' ? '' : Number(value))}
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Enter the bank's 24 Ct market rate. All other purity rates are calculated automatically using the standard fineness percentages.
                </p>

                <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
                  <table className="w-full min-w-[430px] border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        <th className="border-b border-slate-200 px-3 py-2 text-left">Purity</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-right">Fineness %</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-right">Rate / gm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PURITIES.map((purity) => (
                        <tr key={purity}>
                          <td className="border-b border-slate-100 px-3 py-2.5 font-bold text-slate-800">{purity}</td>
                          <td className="border-b border-slate-100 px-3 py-2.5 text-right text-slate-500">{(PURITY_PERCENTAGES[purity] * 100).toFixed(2)}%</td>
                          <td className="border-b border-slate-100 px-3 py-2.5 text-right font-black text-slate-900">₹{formatMoney(rates[purity])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </MobileCard>

            <button onClick={() => goToStep(1)} className="flex h-12 w-full items-center justify-center rounded-2xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/20">Continue to Gold Items →</button>
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 space-y-4">
            <MobileCard title="Gold Items" action={<button onClick={addRow} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">+ Add item</button>}>
              <div className="space-y-4">
                {calculatedRows.map((row, index) => (
                  <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Item {index + 1}</span>
                        <h3 className="mt-0.5 text-base font-extrabold text-slate-900">{row.description || 'New gold item'}</h3>
                      </div>
                      <button onClick={() => deleteRow(row.id)} className="h-9 w-9 rounded-xl bg-white text-sm font-bold text-red-500 shadow-sm" aria-label={`Delete item ${index + 1}`}>×</button>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <Field label="Description" value={row.description} onChange={(v) => updateRow(row.id, 'description', v)} placeholder="Ring, chain, locket..." />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Units" type="number" value={row.units} onChange={(v) => updateRow(row.id, 'units', v)} inputMode="numeric" />
                        <label className="block">
                          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Purity</span>
                          <select className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-semibold shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" value={row.purity} onChange={(event) => updateRow(row.id, 'purity', event.target.value)}>
                            {PURITIES.map((purity) => <option key={purity}>{purity}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Stone Wt (gm)" type="number" value={row.stoneWeight} onChange={(v) => updateRow(row.id, 'stoneWeight', v)} />
                        <Field label="Gross Wt (gm)" type="number" value={row.grossWeight} onChange={(v) => updateRow(row.id, 'grossWeight', v)} />
                        <Field label="Net Wt (gm)" type="number" value={row.netWeight} onChange={(v) => updateRow(row.id, 'netWeight', v)} />
                        <Field label="Market Value" type="number" value={row.marketManual || row.netWeight !== '' ? row.marketValue : ''} onChange={(v) => updateRow(row.id, 'marketValue', v)} />
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Auto valuation</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{row.marketManual || row.netWeight !== '' ? `₹${formatMoney(row.marketValue)}` : '—'}</p>
                        </div>
                        {row.marketManual && <button onClick={() => resetMarketValue(row.id)} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">Use Auto</button>}
                      </div>
                      {customColumns.length > 0 && <div className="grid gap-3">{customColumns.map((column) => <Field key={column.id} label={column.label} value={row.customValues?.[column.id] || ''} onChange={(v) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, customValues: { ...item.customValues, [column.id]: v } } : item))} />)}</div>}
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={addCustomColumn} className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700">+ Custom field</button>
                <button onClick={() => goToStep(2)} className="flex-[1.5] rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white">Review valuation →</button>
              </div>
            </MobileCard>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
            <MobileCard title="Valuation Summary">
              <div className="grid grid-cols-2 gap-3">
                <SummaryMetric label="Units" value={totals.units} />
                <SummaryMetric label="Stone Wt" value={`${formatWeight(totals.stoneWeight)} gm`} />
                <SummaryMetric label="Gross Wt" value={`${formatWeight(totals.grossWeight)} gm`} />
                <SummaryMetric label="Net Wt" value={`${formatWeight(totals.netWeight)} gm`} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Total Market Value</p>
                <p className="mt-1 text-2xl font-black">₹{formatMoney(totals.marketValue)}</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">{amountWords}</p>
              </div>
            </MobileCard>
            <MobileCard title="Purity Summary">
              <div className="space-y-2">
                {summaries.map((summary) => (
                  <div key={summary.purity} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <div><p className="font-extrabold text-slate-900">{summary.purity}</p><p className="text-xs text-slate-500">Gross {formatWeight(summary.grossWeight)} gm</p></div>
                    <p className="text-sm font-bold text-slate-700">Net {formatWeight(summary.netWeight)} gm</p>
                  </div>
                ))}
              </div>
            </MobileCard>
            <MobileCard title="Gold Item Photo & Shop">
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex min-h-24 items-center justify-center rounded-2xl border-2 border-dashed px-3 text-center transition ${photoUploading ? 'cursor-not-allowed border-indigo-200 bg-indigo-50' : 'cursor-pointer border-slate-300 bg-slate-50 active:scale-[0.99]'}`}>
                  <input type="file" className="hidden" accept="image/*" capture="environment" disabled={photoUploading} onChange={(event) => uploadImage(event.target.files?.[0])} />
                  <span className="text-sm font-bold text-slate-600">{photoUploading ? '⏳ Uploading…' : '📷 Take Photo'}</span>
                </label>
                <label className={`flex min-h-24 items-center justify-center rounded-2xl border-2 px-3 text-center transition ${photoUploading ? 'cursor-not-allowed border-indigo-200 bg-indigo-50' : 'cursor-pointer border-slate-200 bg-white shadow-sm active:scale-[0.99]'}`}>
                  <input type="file" className="hidden" accept="image/*" disabled={photoUploading} onChange={(event) => uploadImage(event.target.files?.[0])} />
                  <span className="text-sm font-bold text-slate-600">{photoUploading ? '⏳ Uploading…' : '🖼️ Choose from Gallery'}</span>
                </label>
              </div>
              {photoUploading && <div className="mt-3 rounded-2xl bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-700">Photo is uploading. Please wait…</div>}
              {shop.itemImageUrl && !photoUploading && <div className="mt-3 flex items-center gap-3"><img src={shop.itemImageUrl} alt="Gold item" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200" /><div><p className="text-sm font-bold text-slate-900">Photo uploaded</p><p className="text-xs text-slate-500">QR is ready for the certificate.</p></div></div>}
              <div className="mt-4 grid gap-3">
                <Field label="Shop Name" value={shop.nameHindi} readOnly />
                <Field label="Shop Address" value={shop.addressHindi} readOnly />
                <Field label="Registration No." value={shop.registrationNo} readOnly />
                <Field label="Appraiser A/c No." value={shop.appraiserAccount} readOnly />
              </div>
            </MobileCard>
          </div>
        )}
      </div>

      {step === 2 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-3xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur-xl">
            <button onClick={saveCertificate} className="w-full rounded-2xl bg-slate-100 px-2 py-3 text-xs font-extrabold text-slate-800">Save</button>
            <button onClick={generatePdf} className="w-full rounded-2xl bg-indigo-600 px-2 py-3 text-xs font-extrabold text-white shadow-lg shadow-indigo-600/20">Generate PDF</button>
            <button onClick={sharePdf} className="w-full rounded-2xl bg-slate-900 px-2 py-3 text-xs font-extrabold text-white">Share</button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          <button onClick={startNewCertificate} className={`rounded-2xl py-2 text-xs font-bold ${step === 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>New</button>
          <button onClick={() => goToStep(1)} className={`rounded-2xl py-2 text-xs font-bold ${step === 1 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>Items</button>
          <Link to="/records" className="rounded-2xl py-2 text-center text-xs font-bold text-slate-500">Records</Link>
        </div>
      </nav>
    </main>
  );
}

function MobileCard({ title, children, action }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold tracking-tight text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickMetric({ label, value }) {
  return <div className="rounded-2xl bg-white/10 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-extrabold text-white">{value}</p></div>;
}

function SummaryMetric({ label, value }) {
  return <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-base font-extrabold text-slate-900">{value}</p></div>;
}

export default MobileDashboard;
