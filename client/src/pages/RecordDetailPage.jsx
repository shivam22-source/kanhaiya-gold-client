import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatMoney, formatWeight } from '../utils/calculations';
import { generateCertificatePdf } from '../utils/pdfGenerator';
import { API_BASE } from '../utils/config';

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value || '-'}</span>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        <Link to="/" className="rounded-2xl py-2 text-center text-xs font-bold text-slate-500">New</Link>
        <Link to="/records" className="rounded-2xl bg-indigo-50 py-2 text-center text-xs font-bold text-indigo-700">Records</Link>
        <Link to="/market-rates" className="rounded-2xl py-2 text-center text-xs font-bold text-slate-500">Market</Link>
      </div>
    </nav>
  );
}

function RecordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfStatus, setPdfStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`${API_BASE}/certificates/${id}`);
        if (response.status === 404) throw new Error('Record not found');
        if (!response.ok) throw new Error('Could not load record');
        const result = await response.json();
        if (!cancelled) setRecord(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Failed to load record');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleRegenerate() {
    if (!record?.payload) return;
    try {
      setPdfStatus('Generating PDF...');
      const { shop, form, rows, customColumns, totals, summaries } = record.payload;
      await generateCertificatePdf({ shop, form, rows, customColumns: customColumns || [], totals, summaries });
      setPdfStatus('PDF downloaded.');
    } catch (pdfError) {
      setPdfStatus(`Failed to generate PDF: ${pdfError.message}`);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 pb-20">
        <p className="text-sm text-slate-500">Loading record...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 pb-20">
        <p className="text-sm text-red-600">{error}</p>
        <Link className="text-sm font-semibold text-indigo-600" to="/records">
          Back to Records
        </Link>
        <MobileBottomNav />
      </main>
    );
  }

  const payload = record?.payload || {};
  const { shop = {}, form = {}, rows = [], customColumns = [], totals = {}, summaries = [], amountWords = '' } = payload;

  return (
    <main className="min-h-screen bg-slate-50 pb-24 text-slate-800">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1300px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button className="text-xs font-semibold uppercase tracking-wide text-indigo-600" onClick={() => navigate('/records')}>
              &larr; Back to Records
            </button>
            <h1 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">{record.borrowerName}</h1>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex">
            <button
              className="h-11 rounded bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              onClick={handleRegenerate}
            >
              Regenerate PDF
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1300px] space-y-5 p-3 sm:p-5">
        {pdfStatus && (
          <div className="rounded border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">{pdfStatus}</div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Shop Details">
            <InfoRow label="Shop Name" value={shop.nameHindi} />
            <InfoRow label="Shop Address" value={shop.addressHindi} />
            <InfoRow label="Registration No." value={shop.registrationNo} />
            <InfoRow label="Appraiser A/c No." value={shop.appraiserAccount} />
            {shop.itemImageUrl && (
              <div className="mt-3 flex items-center gap-3">
                <img className="h-16 w-16 rounded border border-slate-200 object-cover" src={shop.itemImageUrl} alt="Gold item" />
                <a className="text-xs font-semibold text-indigo-600" href={shop.itemImageUrl} target="_blank" rel="noreferrer">
                  Open Photo
                </a>
              </div>
            )}
          </Card>

          <Card title="Reference, Bank & Borrower Details">
            <InfoRow label="Ref No." value={form.refNo} />
            <InfoRow label="Appraisal Charge (Rs.)" value={formatMoney(form.appraisalCharge)} />
            <InfoRow label="Date" value={form.date} />
            <InfoRow label="Bank A/c No." value={form.bankAccount} />
            <InfoRow label="Branch Name" value={form.branchName} />
            <InfoRow label="Borrower Name" value={form.borrowerName} />
            <InfoRow label="Father/Husband Name" value={form.fatherName} />
            <InfoRow label="Borrower Resident" value={form.borrowerAddress} />
            <InfoRow label="Appraisal Date" value={form.appraisalDate} />
            <InfoRow label="Cash-in-charge" value={form.cashInCharge} />
            <InfoRow label="Testing Method" value={form.testingMethod} />
            <InfoRow label="Place" value={form.place} />
            <InfoRow label="Signature Date" value={form.signatureDate} />
          </Card>
        </div>

        <Card title="Appraisal Table">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
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
                    <th key={column.id} className="border border-slate-200 p-2">{column.label}</th>
                  ))}
                  <th className="border border-slate-200 p-2">Market Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id || index}>
                    <td className="border border-slate-200 p-2 text-center">{index + 1}</td>
                    <td className="border border-slate-200 p-2">{row.description}</td>
                    <td className="border border-slate-200 p-2 text-right">{row.units}</td>
                    <td className="border border-slate-200 p-2 text-right">{formatWeight(row.stoneWeight)}</td>
                    <td className="border border-slate-200 p-2 text-right">{formatWeight(row.grossWeight)}</td>
                    <td className="border border-slate-200 p-2 text-right">{formatWeight(row.netWeight)}</td>
                    <td className="border border-slate-200 p-2 text-center">{row.purity}</td>
                    {customColumns.map((column) => (
                      <td key={column.id} className="border border-slate-200 p-2">{row.customValues?.[column.id] || ''}</td>
                    ))}
                    <td className="border border-slate-200 p-2 text-right">{formatMoney(row.marketValue)}</td>
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
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Amount in Words">
            <p className="text-sm font-semibold text-slate-900">{amountWords}</p>
            <p className="mt-2 text-xs text-slate-500">Round Up: Rs. {formatMoney(totals.marketValue)}</p>
          </Card>

          <Card title="Purity Summaries">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 p-2 text-left">Purity</th>
                  <th className="border border-slate-200 bg-slate-100 p-2 text-right">Gross Wt (gm)</th>
                  <th className="border border-slate-200 bg-slate-100 p-2 text-right">Net Wt (gm)</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => (
                  <tr key={summary.purity}>
                    <td className="border border-slate-200 p-2">{summary.purity}</td>
                    <td className="border border-slate-200 p-2 text-right">{formatWeight(summary.grossWeight)}</td>
                    <td className="border border-slate-200 p-2 text-right">{formatWeight(summary.netWeight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}

export default RecordDetailPage;
