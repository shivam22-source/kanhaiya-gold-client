import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../utils/calculations';
import { API_BASE } from '../utils/config';

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [purityFilter, setPurityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const query = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : '';
        const response = await fetch(`${API_BASE}/certificates${query}`);
        if (!response.ok) throw new Error('Could not load records');
        const result = await response.json();
        if (!cancelled) setRecords(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Failed to load records');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const purityOptions = useMemo(() => {
    const set = new Set();
    records.forEach((record) => {
      (record.payload?.summaries || []).forEach((summary) => {
        if (summary.purity) set.add(summary.purity);
      });
    });
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let list = records.filter((record) => {
      if (dateFrom && (!record.date || record.date < dateFrom)) return false;
      if (dateTo && (!record.date || record.date > dateTo)) return false;
      if (minValue && Number(record.totalMarketValue) < Number(minValue)) return false;
      if (maxValue && Number(record.totalMarketValue) > Number(maxValue)) return false;
      if (purityFilter !== 'all') {
        const purities = (record.payload?.summaries || []).map((summary) => summary.purity);
        if (!purities.includes(purityFilter)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'value-high') return Number(b.totalMarketValue) - Number(a.totalMarketValue);
      if (sortBy === 'value-low') return Number(a.totalMarketValue) - Number(b.totalMarketValue);
      return 0;
    });

    return list;
  }, [records, dateFrom, dateTo, minValue, maxValue, purityFilter, sortBy]);

  function resetFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setMinValue('');
    setMaxValue('');
    setPurityFilter('all');
    setSortBy('newest');
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1300px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Records</p>
            <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">All Appraiser Certificates</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="flex h-11 items-center justify-center rounded border border-slate-300 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              to="/dues"
            >
              Due Settlement
            </Link>
            <Link
              className="flex h-11 items-center justify-center rounded bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              to="/"
            >
              + New Certificate
            </Link>
          </div>
        </div>
      </header>
      

      <div className="mx-auto max-w-[1300px] p-3 sm:p-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search (Borrower / Ref)</span>
              <input
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                value={search}
                placeholder="Search by borrower name or ref no."
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date From</span>
              <input
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date To</span>
              <input
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Min Value (Rs.)</span>
              <input
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                type="number"
                value={minValue}
                onChange={(event) => setMinValue(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Max Value (Rs.)</span>
              <input
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                type="number"
                value={maxValue}
                onChange={(event) => setMaxValue(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Purity</span>
              <select
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                value={purityFilter}
                onChange={(event) => setPurityFilter(event.target.value)}
              >
                <option value="all">All Purities</option>
                {purityOptions.map((purity) => (
                  <option key={purity} value={purity}>
                    {purity}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sort By</span>
              <select
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="value-high">Value: High to Low</option>
                <option value="value-low">Value: Low to High</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                className="h-10 w-full rounded border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={resetFilters}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
            <p className="text-sm font-semibold text-slate-700">
              {loading ? 'Loading...' : `${filteredRecords.length} record(s) found`}
            </p>
          </div>

          {error && <div className="m-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {!loading && !error && filteredRecords.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">No records match your search / filters.</p>
          )}

          {!loading && filteredRecords.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="border-b border-slate-200 p-3">Borrower</th>
                    <th className="border-b border-slate-200 p-3">Ref No.</th>
                    <th className="border-b border-slate-200 p-3">Date</th>
                    <th className="border-b border-slate-200 p-3 text-right">Total Value</th>
                    <th className="border-b border-slate-200 p-3">Purities</th>
                    <th className="border-b border-slate-200 p-3">Photo</th>
                    <th className="border-b border-slate-200 p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 p-3 font-semibold text-slate-900">{record.borrowerName}</td>
                      <td className="border-b border-slate-100 p-3 text-slate-600">{record.refNo || '-'}</td>
                      <td className="border-b border-slate-100 p-3 text-slate-600">{record.date || '-'}</td>
                      <td className="border-b border-slate-100 p-3 text-right font-semibold text-slate-900">
                        Rs. {formatMoney(record.totalMarketValue)}
                      </td>
                      <td className="border-b border-slate-100 p-3 text-slate-600">
                        {(record.payload?.summaries || []).map((s) => s.purity).join(', ') || '-'}
                      </td>
                      <td className="border-b border-slate-100 p-3 text-slate-600">
                        {record.itemImageUrl ? (
                          <a className="font-semibold text-indigo-600" href={record.itemImageUrl} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="border-b border-slate-100 p-3 text-right">
                        <Link
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          to={`/records/${record.id}`}
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default RecordsPage;
