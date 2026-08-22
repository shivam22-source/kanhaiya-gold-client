import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../utils/config';

const SOURCE_URL = 'https://www.ibjarates.com/';
const ORDER = ['24 Ct', '22 Ct', '20 Ct', '18 Ct', '14 Ct'];

function MarketRatesPage() {
  const [rates, setRates] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function syncRates() {
    try {
      setLoading(true);
      setMessage('Syncing with IBJA...');
      const response = await fetch(`${API_BASE}/market-rates`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Market-rate sync failed');
      setRates(result.rates);
      setMeta(result);
      setMessage(`Synced ${new Date(result.fetchedAt).toLocaleString('en-IN')}`);
    } catch (error) {
      setMessage(error.message);
      setRates(null);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">Kanhaiya Gold</p>
            <h1 className="text-xl font-extrabold tracking-tight">Gold Market Rate</h1>
          </div>
          <Link to="/" className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Back</Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-900/10 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">India benchmark</p>
              <h2 className="mt-2 text-2xl font-black">IBJA Gold Rates</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Official benchmark rates used in the appraisal workflow. Rates are shown per gram in the app and remain a certificate snapshot once applied.</p>
            </div>
            <button onClick={syncRates} disabled={loading} className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-slate-900 shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Syncing...' : 'Sync Latest Rate'}
            </button>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">{message}</div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold">Latest synced rates</h2>
              <p className="mt-1 text-xs text-slate-500">Source: IBJA · No GST / making charges included</p>
            </div>
            {meta?.rateType && <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">{meta.rateType}</span>}
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            {ORDER.map((purity) => (
              <div key={purity} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{purity}</p>
                <p className="mt-2 text-2xl font-black">{rates?.[purity] != null ? `₹${Number(rates[purity]).toLocaleString('en-IN')}` : '—'}</p>
                <p className="mt-1 text-xs text-slate-500">per gram</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <p><strong>Official source:</strong> IBJA benchmark rate. Verify the published rate before applying it to a certificate.</p>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="shrink-0 font-extrabold text-amber-800 underline">Open IBJA Rates</a>
          </div>
        </section>
      </div>
    </main>
  );
}

export default MarketRatesPage;
