import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatMoney } from '../utils/calculations';
import { API_BASE } from '../utils/config';

function PaymentEditor({ value, onPay, paying }) {
  const [amount, setAmount] = useState('');

  function submit() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onPay(parsed, () => setAmount(''));
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
        placeholder="Paid"
        aria-label="Paid amount"
        className="h-10 w-28 rounded-xl border border-slate-300 px-3 text-right text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <button
        type="button"
        onClick={submit}
        disabled={paying || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > Number(value)}
        className="h-10 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {paying ? 'Saving…' : 'Pay'}
      </button>
    </div>
  );
}

function DueSettlementPage() {
  const navigate = useNavigate();
  const [branch, setBranch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState('');

  async function loadDues(branchName = '') {
    try {
      setLoading(true);
      setError('');
      const query = branchName.trim() ? `?branch=${encodeURIComponent(branchName.trim())}` : '';
      const response = await fetch(`${API_BASE}/dues${query}`);
      const result = await response.json().catch(() => []);
      if (!response.ok) throw new Error(result.message || 'Could not load due settlements');
      setDues(result);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load due settlements');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDues(); }, []);

  async function recordPayment(due, amount, clearInput) {
    try {
      setPayingId(due.certificateId);
      setError('');
      const response = await fetch(`${API_BASE}/dues/${due.certificateId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Could not record payment');

      clearInput?.();
      if (Number(result.due?.dueAmount) === 0) {
        setDues((current) => current.filter((item) => item.certificateId !== due.certificateId));
      } else {
        setDues((current) => current.map((item) => item.certificateId === due.certificateId ? { ...item, dueAmount: Number(result.due.dueAmount), status: result.due.status } : item));
      }
    } catch (paymentError) {
      setError(paymentError.message || 'Could not record payment');
    } finally {
      setPayingId('');
    }
  }

  async function removeClosedDue(due) {
    if (Number(due.dueAmount) !== 0) return;
    const confirmed = window.confirm(`Remove ${due.refNo || due.borrowerName} from Due Settlement?\n\nPayment history will remain attached to the certificate.`);
    if (!confirmed) return;

    try {
      setError('');
      const response = await fetch(`${API_BASE}/dues/${due.certificateId}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Could not remove due');
      setDues((current) => current.filter((item) => item.certificateId !== due.certificateId));
    } catch (deleteError) {
      setError(deleteError.message || 'Could not remove due');
    }
  }

  async function filterDues() {
    setFilterBranch(branch.trim());
    await loadDues(branch.trim());
  }

  async function clearFilter() {
    setBranch('');
    setFilterBranch('');
    await loadDues();
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24 text-slate-800">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1300px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/records" className="text-xs font-semibold uppercase tracking-wide text-indigo-600">&larr; Records</Link>
              <span className="text-xs text-slate-300">/</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Due Settlement</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Due Settlement</h1>
          </div>
          <Link className="flex h-11 items-center justify-center rounded border border-slate-300 px-4 text-sm font-semibold text-slate-700" to="/records">All Records</Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1300px] p-3 sm:p-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Filter by Branch</span>
              <input
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') filterDues(); }}
                placeholder="e.g. Madhubani"
                className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <button className="h-10 rounded bg-slate-900 px-4 text-sm font-semibold text-white" onClick={filterDues}>Search</button>
            <button className="h-10 rounded border border-slate-300 px-4 text-sm font-semibold text-slate-700" onClick={clearFilter} disabled={!filterBranch}>All Branches</button>
          </div>
          {filterBranch && <p className="mt-2 text-xs text-slate-500">Showing dues for <span className="font-bold text-slate-700">{filterBranch}</span></p>}
        </section>

        {error && <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
            <div>
              <p className="text-sm font-semibold text-slate-700">{loading ? 'Loading...' : `${dues.length} active due record(s)`}</p>
              <p className="text-xs text-slate-400">Due starts automatically from the certificate's Appraisal Charge.</p>
            </div>
          </div>

          {!loading && dues.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-3xl">₹</p>
              <p className="mt-3 text-base font-bold text-slate-900">No active due records</p>
              <p className="mt-1 text-sm text-slate-500">New certificates with an Appraisal Charge will appear here automatically.</p>
            </div>
          )}

          {!loading && dues.length > 0 && (
            <div className="divide-y divide-slate-100">
              {dues.map((due) => (
                <div key={due.certificateId} className="px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <button type="button" onClick={() => navigate(`/records/${due.certificateId}`)} className="min-w-0 text-left">
                      <p className="truncate text-sm font-bold text-indigo-700 hover:underline">{due.refNo || 'No Ref No.'}</p>
                      <p className="mt-0.5 truncate text-base font-semibold text-slate-900">{due.borrowerName}</p>
                      <p className="mt-1 text-xs text-slate-500">{due.branchName || 'No branch'} · {due.date || 'No date'}</p>
                    </button>

                    <div className="grid gap-3 sm:grid-cols-3 sm:items-center lg:min-w-[520px]">
                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Initial Due</p>
                        <p className="mt-1 text-sm font-extrabold text-slate-800">₹{formatMoney(due.initialDue)}</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Remaining Due</p>
                        <p className="mt-1 text-base font-black text-amber-900">₹{formatMoney(due.dueAmount)}</p>
                      </div>
                      <PaymentEditor value={due.dueAmount} onPay={(amount, clear) => recordPayment(due, amount, clear)} paying={payingId === due.certificateId} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">Payments are stored in transaction history and remain attached to the certificate.</p>
                    <button
                      type="button"
                      onClick={() => removeClosedDue(due)}
                      disabled={Number(due.dueAmount) !== 0}
                      title={Number(due.dueAmount) === 0 ? 'Remove from active due list' : 'Clear due first'}
                      className={`flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-bold ${Number(due.dueAmount) === 0 ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'}`}
                    >
                      Remove from Due List
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default DueSettlementPage;
