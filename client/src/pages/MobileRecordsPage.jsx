import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../utils/calculations';
import { API_BASE } from '../utils/config';

function MobileRecordsPage() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
        const response = await fetch(`${API_BASE}/certificates${query}`);
        const result = await response.json().catch(() => []);
        if (!response.ok) throw new Error(result.message || 'Could not load records');
        if (!cancelled) setRecords(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Failed to load records');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const timer = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const visibleRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      if (sortBy === 'value-high') return Number(b.totalMarketValue) - Number(a.totalMarketValue);
      if (sortBy === 'value-low') return Number(a.totalMarketValue) - Number(b.totalMarketValue);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [records, sortBy]);

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-24 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-700">‹</Link>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">Kanhaiya Gold</p>
            <h1 className="truncate text-lg font-extrabold tracking-tight">Saved Records</h1>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4">
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="relative">
            <input
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 text-[15px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              value={search}
              placeholder="Search borrower or ref no."
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ['newest', 'Newest'],
              ['oldest', 'Oldest'],
              ['value-high', 'Value ↓'],
              ['value-low', 'Value ↑'],
            ].map(([value, label]) => (
              <button key={value} onClick={() => setSortBy(value)} className={`rounded-2xl px-3 py-2.5 text-xs font-bold ${sortBy === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-4 flex items-center justify-between px-1">
          <p className="text-sm font-bold text-slate-700">{loading ? 'Loading…' : `${visibleRecords.length} record${visibleRecords.length === 1 ? '' : 's'}`}</p>
          <Link to="/" className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">+ New</Link>
        </div>

        {error && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
        {!loading && !error && visibleRecords.length === 0 && (
          <div className="mt-4 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-3xl">▤</p>
            <p className="mt-3 text-base font-extrabold text-slate-900">No records found</p>
            <p className="mt-1 text-sm text-slate-500">Create a certificate and it will appear here.</p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {visibleRecords.map((record) => (
            <article key={record.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-slate-900">{record.borrowerName}</h2>
                  <p className="mt-1 text-xs text-slate-500">{record.date || 'No date'}{record.refNo ? ` · ${record.refNo}` : ''}</p>
                </div>
                <p className="shrink-0 text-base font-black text-indigo-700">₹{formatMoney(record.totalMarketValue)}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(record.payload?.summaries || []).map((summary) => (
                  <span key={summary.purity} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{summary.purity}</span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link to={`/records/${record.id}`} className="flex h-11 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white">View Details</Link>
                {record.itemImageUrl ? (
                  <a href={record.itemImageUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-700">Photo</a>
                ) : (
                  <span className="flex h-11 items-center justify-center rounded-2xl bg-slate-50 text-xs font-bold text-slate-400">No Photo</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          <Link to="/" className="rounded-2xl py-2 text-center text-xs font-bold text-slate-500">New</Link>
          <span className="rounded-2xl bg-indigo-50 py-2 text-center text-xs font-bold text-indigo-700">Records</span>
          <Link to="/" className="rounded-2xl py-2 text-center text-xs font-bold text-slate-500">Summary</Link>
        </div>
      </nav>
    </main>
  );
}

export default MobileRecordsPage;
