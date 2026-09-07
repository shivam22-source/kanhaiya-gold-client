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

const sampleRows = [
  { description: 'Locket/Tops/Ring', units: 9, stoneWeight: 1.65, grossWeight: 14.99, netWeight: 13.34, purity: '18 Ct' },
  { description: 'Ring/Bale/Nosering with Lare', units: 7, stoneWeight: 3.44, grossWeight: 29.44, netWeight: 26, purity: '18 Ct' },
  { description: 'Earings/Tika', units: 5, stoneWeight: 2.4, grossWeight: 41.4, netWeight: 39, purity: '20 Ct' },
  { description: 'Chain/Nosering/Tika', units: 3, stoneWeight: 2.8, grossWeight: 47.2, netWeight: 44.4, purity: '20 Ct' },
  { description: 'Asharfi/Ring', units: 3, stoneWeight: 1.5, grossWeight: 17, netWeight: 15.5, purity: '20 Ct' },
].map((row, index) => ({ id: crypto.randomUUID(), customValues: {}, marketManual: false, ...row, sl: index + 1 }));

const defaultShop = {
  nameHindi: 'कन्हैया ज्वेलर्स',
  addressHindi: 'टेकटार बाजार',
  registrationNo: 'उद्यम रजि० नं०--BR-10-0038338',
  qrText: '',
  qrImage: '',
  itemImageUrl: '',
  appraiserAccount: '43647158156',
  footerCredit: 'Design & Developed by Shivam Thakur',
};

const defaultForm = {
  refNo: '',
  appraisalCharge: 4720,
  date: '2026-08-20',
  bankAccount: '34481639897',
  branchName: 'Darbhanga City',
  borrowerName: 'Ashutosh Kumar Jha',
  fatherName: 'Navin Kumar Jha',
  borrowerAddress: 'Darbhanga',
  appraisalDate: '2026-08-20',
  cashInCharge: 'Ruby Choudhary',
  testingMethod: 'Touchstone test',
  place: 'Darbhanga',
  signatureDate: '2026-08-20',
};

function Field({ label, value, onChange, type = 'text', required = false, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function Section({ title, children, action }) {
  return (
    <section className="border-b border-slate-200 px-4 py-5 last:border-b-0 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress image'))),
      'image/jpeg',
      quality,
    );
  });
}

function drawToCanvas(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  return canvas;
}

async function compressImage(file, options = {}) {
  const { maxDimension = 1600, targetBytes = 400 * 1024, minQuality = 0.35, minDimension = 600 } = options;

  const image = await loadImageElement(file);
  let scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  let width = Math.round(image.width * scale);
  let height = Math.round(image.height * scale);
  let canvas = drawToCanvas(image, width, height);

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > targetBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.1);
    blob = await canvasToBlob(canvas, quality);
  }

  while (blob.size > targetBytes && Math.max(width, height) > minDimension) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    canvas = drawToCanvas(image, width, height);
    blob = await canvasToBlob(canvas, quality);
  }

  return {
    file: new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }),
    originalBytes: file.size,
    compressedBytes: blob.size,
  };
}

function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function Dashboard() {
  const [shop, setShop] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return defaultShop;
    const parsed = JSON.parse(saved);
    return {
      ...defaultShop,
      ...parsed,
      qrText: parsed.qrText || '',
      qrImage: parsed.qrImage || '',
      itemImageUrl: parsed.itemImageUrl || '',
    };
  });
  const [form, setForm] = useState(defaultForm);
  const [baseRate24ct, setBaseRate24ct] = useState(DEFAULT_BASE_RATE_24CT);
  const rates = useMemo(() => deriveRatesFromBaseRate(baseRate24ct), [baseRate24ct]);
  const [rows, setRows] = useState(sampleRows);
  const [customColumns, setCustomColumns] = useState([]);
  const [shopOpen, setShopOpen] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const [records, setRecords] = useState([]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(shop));
  }, [shop]);

  const calculatedRows = useMemo(() => calculateRows(rows, rates), [rows, rates]);
  const totals = useMemo(() => calculateTotals(calculatedRows), [calculatedRows]);
  const summaries = useMemo(() => groupPuritySummaries(calculatedRows), [calculatedRows]);
  const amountWords = useMemo(() => numberToWordsIndian(totals.marketValue), [totals.marketValue]);

  function updateShop(key, value) {
    setShop((current) => ({ ...current, [key]: value }));
  }

  async function handleGoldItemUpload(file) {
    if (!file) return;
    try {
      setSaveStatus('Compressing item photo...');
      const { file: compressedFile, originalBytes, compressedBytes } = await compressImage(file);
      setSaveStatus(`Compressed ${formatFileSize(originalBytes)} -> ${formatFileSize(compressedBytes)}, uploading...`);
      const formData = new FormData();
      formData.append('image', compressedFile);
      const response = await fetch(`${API_BASE}/uploads/gold-item`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'Upload failed');
      }
      const result = await response.json();
      const qrImage = await QRCode.toDataURL(result.imageUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 360,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setShop((current) => ({
        ...current,
        itemImageUrl: result.imageUrl,
        qrText: result.imageUrl,
        qrImage,
      }));
      setSaveStatus('Item photo uploaded and QR generated');
    } catch (uploadError) {
      setSaveStatus(`Upload failed: ${uploadError.message}`);
    }
  }

  function updateForm(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'appraisalDate' && current.signatureDate === current.appraisalDate) {
        next.signatureDate = value;
      }
      return next;
    });
  }

  function updateRow(id, key, value) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          [key]: ['units', 'stoneWeight', 'grossWeight', 'netWeight'].includes(key) ? Number(value) : value,
          marketManual: key === 'marketValue' ? true : row.marketManual,
        };
      }),
    );
  }

  function updateCustomValue(rowId, columnId, value) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? { ...row, customValues: { ...row.customValues, [columnId]: value } }
          : row,
      ),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: '',
        units: 1,
        stoneWeight: 0,
        grossWeight: 0,
        netWeight: 0,
        purity: '22 Ct',
        customValues: {},
        marketManual: false,
      },
    ]);
  }

  function deleteRow(id) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  function addCustomColumn() {
    const label = window.prompt('Column name');
    if (!label?.trim()) return;
    setCustomColumns((current) => [...current, { id: crypto.randomUUID(), label: label.trim() }]);
  }

  function deleteCustomColumn(columnId) {
    setCustomColumns((current) => current.filter((column) => column.id !== columnId));
    setRows((current) =>
      current.map((row) => {
        const { [columnId]: removed, ...customValues } = row.customValues || {};
        void removed;
        return { ...row, customValues };
      }),
    );
  }

  function resetMarketValue(id) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, marketManual: false } : row)));
  }

  function validate() {
    const required = [
      ['Date', form.date],
      ['Bank A/c No.', form.bankAccount],
      ['Branch Name', form.branchName],
      ['Borrower Name', form.borrowerName],
      ["Father/Husband's Name", form.fatherName],
      ['Resident', form.borrowerAddress],
      ['Cash in charge', form.cashInCharge],
      ['Testing Method', form.testingMethod],
      ['Place', form.place],
    ];
    const missing = required.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
    const emptyRows = calculatedRows.some((row) => !row.description.trim() || !row.purity);
    if (missing.length || emptyRows) {
      setError(`Please fill: ${[...missing, emptyRows ? 'all appraisal row descriptions and purities' : ''].filter(Boolean).join(', ')}`);
      return false;
    }
    setError('');
    return true;
  }

  async function handleGeneratePdf() {
    if (!validate()) return;
    const saved = await saveCertificate({ silent: true });
    if (!saved) return;
    await generateCertificatePdf({ shop, form, rows: calculatedRows, customColumns, totals, summaries });
  }

  async function handleSharePdf() {
    if (!validate()) return;
    const saved = await saveCertificate({ silent: true });
    if (!saved) return;
    const { blob, filename } = await generateCertificatePdf(
      { shop, form, rows: calculatedRows, customColumns, totals, summaries },
      { save: false },
    );
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Gold Appraiser Certificate',
        text: `Certificate for ${form.borrowerName}`,
        files: [file],
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus('Sharing is not supported here, PDF downloaded instead');
  }

  function certificatePayload() {
    return {
      shop,
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

  async function saveCertificate(options = {}) {
    if (!validate()) return null;
    try {
      setSaveStatus('Saving...');
      const response = await fetch(`${API_BASE}/certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(certificatePayload()),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'Save failed');
      }
      const saved = await response.json();
      setSaveStatus(`Saved: ${saved.borrowerName}`);
      if (!options.silent) await fetchRecords(recordSearch);
      return saved;
    } catch (saveError) {
      setSaveStatus(`Save failed: ${saveError.message}`);
      return null;
    }
  }

  async function fetchRecords(search = '') {
    try {
      setSaveStatus('Loading records...');
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await fetch(`${API_BASE}/certificates${query}`);
      if (!response.ok) throw new Error('Could not load records');
      const result = await response.json();
      setRecords(result);
      setSaveStatus(result.length ? `Loaded ${result.length} record(s)` : 'No saved records found');
    } catch (loadError) {
      setSaveStatus(`Load failed: ${loadError.message}`);
    }
  }

  function loadCertificate(record) {
    const payload = record.payload;
    if (!payload) return;
    setShop((current) => ({ ...current, ...(payload.shop || {}) }));
    setForm((current) => ({ ...current, ...(payload.form || {}) }));
    setBaseRate24ct(payload.baseRate24ct || payload.rates?.['24 Ct'] || DEFAULT_BASE_RATE_24CT);
    setRows((payload.rows || sampleRows).map((row) => ({ ...row, id: row.id || crypto.randomUUID() })));
    setCustomColumns(payload.customColumns || []);
    setSaveStatus(`Loaded: ${record.borrowerName}`);
  }

  async function downloadRecordPdf(record) {
    const payload = record.payload;
    if (!payload) return;
    await generateCertificatePdf({
      shop: payload.shop,
      form: payload.form,
      rows: payload.rows,
      customColumns: payload.customColumns || [],
      totals: payload.totals,
      summaries: payload.summaries,
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Annexure: PL-61(i)</p>
            <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">SBI Gold Loan Appraiser Certificate</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link className="flex h-11 items-center justify-center rounded border border-slate-300 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50" to="/records">
              All Records
            </Link>
            <button className="h-11 rounded bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700" onClick={handleGeneratePdf}>
              Download PDF
            </button>
            <button className="h-11 rounded bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700" onClick={handleSharePdf}>
              Share PDF
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 p-3 sm:p-5 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <Section
            title="Shop Settings"
            action={
              <button className="text-sm font-semibold text-indigo-600" onClick={() => setShopOpen((value) => !value)}>
                {shopOpen ? 'Collapse' : 'Edit'}
              </button>
            }
          >
            {shopOpen && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Shop Name (Fixed)" value={shop.nameHindi} onChange={(value) => updateShop('nameHindi', value)} required />
                <Field label="Shop Address (Fixed)" value={shop.addressHindi} onChange={(value) => updateShop('addressHindi', value)} required />
                <Field label="Registration No. (Fixed)" value={shop.registrationNo} onChange={(value) => updateShop('registrationNo', value)} className="md:col-span-2" required />
                <Field label="Appraiser Bank A/c No." value={shop.appraiserAccount} onChange={(value) => updateShop('appraiserAccount', value)} />
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Upload Gold Items Photo</span>
                  <input className="block h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800" type="file" accept="image/*" onChange={(event) => handleGoldItemUpload(event.target.files?.[0])} />
                  <span className="mt-1 block text-xs text-slate-400">Uploads to Cloudinary and generates a QR code linking to the photo automatically.</span>
                </label>
                <div className="flex items-end gap-3">
                  <div className="flex h-20 w-20 items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                    {shop.qrImage ? <img className="h-full w-full object-contain" src={shop.qrImage} alt="QR preview" /> : 'QR'}
                  </div>
                  {shop.qrImage && (
                    <button className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setShop((current) => ({ ...current, itemImageUrl: '', qrText: '', qrImage: '' }))}>
                      Remove
                    </button>
                  )}
                </div>
                {shop.itemImageUrl && (
                  <a className="truncate text-xs font-semibold text-indigo-600 md:col-span-2 xl:col-span-4" href={shop.itemImageUrl} target="_blank" rel="noreferrer">
                    {shop.itemImageUrl}
                  </a>
                )}
                <Field label="Footer Credit" value={shop.footerCredit} onChange={(value) => updateShop('footerCredit', value)} className="md:col-span-2 xl:col-span-4" />
              </div>
            )}
          </Section>

          <Section title="Reference, Bank & Borrower Details">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Ref No. (optional)" value={form.refNo} onChange={(value) => updateForm('refNo', value)} />
              <Field label="Appraisal Charge (Rs.)" type="number" value={form.appraisalCharge} onChange={(value) => updateForm('appraisalCharge', Number(value))} />
              <Field label="Date" type="date" value={form.date} onChange={(value) => updateForm('date', value)} required />
              <Field label="Bank A/c No." value={form.bankAccount} onChange={(value) => updateForm('bankAccount', value)} required />
              <Field label="Branch Name" value={form.branchName} onChange={(value) => updateForm('branchName', value)} required />
              <Field label="Borrower Name" value={form.borrowerName} onChange={(value) => updateForm('borrowerName', value)} required />
              <Field label="Father/Husband Name" value={form.fatherName} onChange={(value) => updateForm('fatherName', value)} required />
              <Field label="Borrower Resident" value={form.borrowerAddress} onChange={(value) => updateForm('borrowerAddress', value)} required />
              <Field label="Appraisal Date" type="date" value={form.appraisalDate} onChange={(value) => updateForm('appraisalDate', value)} />
              <Field label="Cash-in-charge Name" value={form.cashInCharge} onChange={(value) => updateForm('cashInCharge', value)} required />
              <Field label="Method used for purity testing" value={form.testingMethod} onChange={(value) => updateForm('testingMethod', value)} required />
              <Field label="Place" value={form.place} onChange={(value) => updateForm('place', value)} required />
              <Field label="Signature Date" type="date" value={form.signatureDate} onChange={(value) => updateForm('signatureDate', value)} />
            </div>
          </Section>

          <Section title="Rate Settings">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="24 Ct Gold Rate / gm (Manual - Market Rate, not IBJA)"
                type="number"
                step="0.01"
                value={baseRate24ct}
                onChange={(value) => setBaseRate24ct(Number(value))}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Enter the bank's market rate for 24 Ct here. All other carat rates below are calculated automatically
              from this using standard fineness percentages.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="border border-slate-200 p-2 text-left">Purity</th>
                    <th className="border border-slate-200 p-2 text-right">Fineness %</th>
                    <th className="border border-slate-200 p-2 text-right">Rate / gm (auto)</th>
                  </tr>
                </thead>
                <tbody>
                  {PURITIES.map((purity) => (
                    <tr key={purity}>
                      <td className="border border-slate-200 p-2 font-medium text-slate-800">{purity}</td>
                      <td className="border border-slate-200 p-2 text-right text-slate-600">{(PURITY_PERCENTAGES[purity] * 100).toFixed(2)}%</td>
                      <td className="border border-slate-200 p-2 text-right font-semibold text-slate-900">Rs. {formatMoney(rates[purity])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Appraisal Table"
            action={
              <div className="flex flex-wrap gap-2">
                <button className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={addCustomColumn}>Add Column</button>
                <button className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700" onClick={addRow}>Add Row</button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs font-semibold text-slate-600">
                    <th className="border border-slate-200 p-2">Sl</th>
                    <th className="border border-slate-200 p-2 text-left">Description</th>
                    <th className="border border-slate-200 p-2">Units</th>
                    <th className="border border-slate-200 p-2">Stone Wt</th>
                    <th className="border border-slate-200 p-2">Gross Wt</th>
                    <th className="border border-slate-200 p-2">Net Wt</th>
                    <th className="border border-slate-200 p-2">Purity</th>
                    {customColumns.map((column) => (
                      <th key={column.id} className="border border-slate-200 p-2">
                        <div className="flex items-center justify-center gap-2">
                          {column.label}
                          <button className="text-red-600" onClick={() => deleteCustomColumn(column.id)} title="Delete column">x</button>
                        </div>
                      </th>
                    ))}
                    <th className="border border-slate-200 p-2">Market Value</th>
                    <th className="border border-slate-200 p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedRows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="border border-slate-200 p-2 text-center">{index + 1}</td>
                      <td className="border border-slate-200 p-2">
                        <input className="w-full rounded border border-slate-300 px-2 py-1" value={row.description} onChange={(event) => updateRow(row.id, 'description', event.target.value)} />
                      </td>
                      {['units', 'stoneWeight', 'grossWeight'].map((key) => (
                        <td key={key} className="border border-slate-200 p-2">
                          <input
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
                            type="number"
                            step={key === 'units' ? '1' : '0.01'}
                            value={row[key]}
                            onChange={(event) => updateRow(row.id, key, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className="border border-slate-200 bg-slate-50 p-2 text-right font-medium text-slate-700" title="Auto-calculated: Gross weight - Stone weight">
                        {formatWeight(row.netWeight)}
                      </td>
                      <td className="border border-slate-200 p-2">
                        <select className="w-24 rounded border border-slate-300 px-2 py-1" value={row.purity} onChange={(event) => updateRow(row.id, 'purity', event.target.value)}>
                          {PURITIES.map((purity) => <option key={purity}>{purity}</option>)}
                        </select>
                      </td>
                      {customColumns.map((column) => (
                        <td key={column.id} className="border border-slate-200 p-2">
                          <input className="w-32 rounded border border-slate-300 px-2 py-1" value={row.customValues?.[column.id] || ''} onChange={(event) => updateCustomValue(row.id, column.id, event.target.value)} />
                        </td>
                      ))}
                      <td className="border border-slate-200 p-2">
                        <div className="flex items-center gap-2">
                          <input className="w-32 rounded border border-slate-300 px-2 py-1 text-right" type="number" step="0.01" value={row.marketValue} onChange={(event) => updateRow(row.id, 'marketValue', Number(event.target.value))} />
                          {row.marketManual && <button className="text-xs font-semibold text-indigo-600" onClick={() => resetMarketValue(row.id)}>Auto</button>}
                        </div>
                      </td>
                      <td className="border border-slate-200 p-2 text-center">
                        <button className="rounded px-2 py-1 text-red-600 hover:bg-red-50" onClick={() => deleteRow(row.id)}>x</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold">
                    <td className="border border-slate-200 p-2">Total</td>
                    <td className="border border-slate-200 p-2"></td>
                    <td className="border border-slate-200 p-2 text-right">{totals.units}</td>
                    <td className="border border-slate-200 p-2 text-right">{formatWeight(totals.stoneWeight)}</td>
                    <td className="border border-slate-200 p-2 text-right">{formatWeight(totals.grossWeight)}</td>
                    <td className="border border-slate-200 p-2 text-right">{formatWeight(totals.netWeight)}</td>
                    <td className="border border-slate-200 p-2"></td>
                    {customColumns.map((column) => <td key={column.id} className="border border-slate-200 p-2"></td>)}
                    <td className="border border-slate-200 p-2 text-right">{formatMoney(totals.marketValue)}</td>
                    <td className="border border-slate-200 p-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>
        </div>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-5">
          <h2 className="text-base font-semibold text-slate-950">Live Calculations</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Metric label="Units" value={totals.units} />
            <Metric label="Stone Wt" value={formatWeight(totals.stoneWeight)} />
            <Metric label="Gross Wt" value={formatWeight(totals.grossWeight)} />
            <Metric label="Net Wt" value={formatWeight(totals.netWeight)} />
            <Metric label="Total Value" value={formatMoney(totals.marketValue)} wide />
          </div>
          <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount in Words</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{amountWords}</p>
            <p className="mt-2 text-xs text-slate-500">Round Up: {formatMoney(totals.marketValue)}</p>
          </div>
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-900">Purity Summaries</h3>
            <SummaryTable title="Gross Weight Carat Summary" summaries={summaries} valueKey="grossWeight" />
            <SummaryTable title="Net weight summary" summaries={summaries} valueKey="netWeight" />
          </div>
          {error && <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="mt-5 border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">Saved Records</h3>
            <button className="mt-3 w-full rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => saveCertificate()}>Save Record</button>
            <div className="mt-3 flex gap-2">
              <input className="h-9 min-w-0 flex-1 rounded border border-slate-300 px-2 text-sm" value={recordSearch} placeholder="Borrower or ref" onChange={(event) => setRecordSearch(event.target.value)} />
              <button className="rounded border border-slate-300 px-3 text-sm font-semibold" onClick={() => fetchRecords(recordSearch)}>Search</button>
            </div>
            {saveStatus && <p className="mt-2 text-xs text-slate-500">{saveStatus}</p>}
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {records.map((record) => (
                <div key={record.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <button className="block w-full text-left hover:text-indigo-700" onClick={() => loadCertificate(record)}>
                    <span className="block font-semibold text-slate-900">{record.borrowerName}</span>
                    <span className="block text-slate-500">{record.date || 'No date'} | Rs. {formatMoney(record.totalMarketValue)}</span>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700" onClick={() => loadCertificate(record)}>Load</button>
                    <button className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700" onClick={() => downloadRecordPdf(record)}>PDF</button>
                    {record.itemImageUrl && <a className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700" href={record.itemImageUrl} target="_blank" rel="noreferrer">Photo</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value, wide = false }) {
  return (
    <div className={`rounded border border-slate-200 bg-slate-50 p-3 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function SummaryTable({ title, summaries, valueKey }) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-semibold text-slate-500">{title}</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {summaries.map((summary) => (
              <th key={summary.purity} className="border border-slate-200 bg-slate-100 p-2">{summary.purity}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {summaries.map((summary) => (
              <td key={summary.purity} className="border border-slate-200 p-2 text-center">{formatWeight(summary[valueKey])} gm</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;
