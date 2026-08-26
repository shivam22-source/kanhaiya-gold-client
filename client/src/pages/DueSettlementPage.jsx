import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatMoney } from '../utils/calculations';
import { API_BASE } from '../utils/config';

function AmountEditor({ value, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(value));

  function startEdit() {
    setAmount(String(value));
    setEditing(true);
  }

  async function save() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const ok = await onSave(parsed);
    if (ok) setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800"
        title="Edit due amount"
      >
        ₹{formatMoney(value)} <span aria-hidden="true">✎</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="h-9 w-28 rounded-xl border border-slate-300 px-2 text-right text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-indigo-600 px-2.5 py-2 text-xs font-bold text-white disabled:opacity-50">Save</button>
      <button type="button" onClick={() => setEditing(false)} disabled={saving} className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600">Cancel</button>
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [candidateBranch, setCandidateBranch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [addingId, setAddingId] = useState('');
  const [savingId, setSavingId] = useState('');

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

  useEffect(() => {
    loadDues();
  }, []);

  function resetAddModal() {
    setShowAddModal(false);
    setCandidateBranch('');
    setCandidates([]);
    setCandidateLoading(false);
    setAddingId('');
  }

  async function searchCandidates() {
    const branchName = candidateBranch.trim();
    if (!branchName) {
      setError('Enter a branch name first.');
      return;
    }

    try {
      setCandidateLoading(true);
      setError('');
      const response = await fetch(`${API_BASE}/dues/candidates?branch=${encodeURIComponent(branchName)}`);
      const result = await response.json().catch(() => []);
      if (!response.ok) throw new Error(result.message || 'Could not find certificates');
      setCandidates(result);
    } catch (searchError) {
      setError(searchError.message || 'Could not find certificates');
    } finally {
      setCandidateLoading(false);
    }
  }

  async function addDue(candidate) {
    const raw = window.prompt(`Enter due amount for ${candidate.refNo || candidate.borrowerName}:`, '0');
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Due amount must be zero or greater.');
      return;
    }

    try {
      setAddingId(candidate.id);
      setError('');
      const response = await fetch(`${API_BASE}/dues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificateId: candidate.id, dueAmount: amount }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Could not add due');
      resetAddModal();
      await loadDues(filterBranch);
    } catch (addError) {
      setError(addError.message || 'Could not add due');
    } finally {
      setAddingId('');
    }
  }

  async function updateDue(certificateId, dueAmount) {
    try {
      setSavingId(certificateId);
      setError('');
      const response = await fetch(`${API_BASE}/dues/${certificateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueAmount }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Could not update due');
      setDues((current) => current.map((due) => due.certificateId === certificateId ? { ...due, ...result } : due));
      return true;
    } catch (updateError) {
      setError(updateError.message || 'Could not update due');
      return false;
    } finally {
      setSavingId('');
    }
  }

  async function deleteDue(due) {
    if (Number(due.dueAmount) !== 0) return;
    const confirmed = window.confirm(`Remove ${due.refNo || due.borrowerName} from Due Settlement?\n\nThe main certificate record will not be deleted.`);
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
          <div className="flex flex-wrap gap-2">
            <Link className="flex h-11 items-center justify-center rounded border border-slate-300 px-4 text-sm font-semibold text-slate-700" to="/records">All Records</Link>
            <button className="h-11 rounded bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700" onClick={() => setShowAddModal(true)}>+ Add Due</button>
          </div>
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
              <p className="text-sm font-semibold text-slate-700">{loading ? 'Loading...' : `${dues.length} due record(s)`}</p>
              <p className="text-xs text-slate-400">Deleting here never deletes the main certificate.</p>
            </div>
          </div>

          {!loading && dues.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-3xl">₹</p>
              <p className="mt-3 text-base font-bold text-slate-900">No due records</p>
              <p className="mt-1 text-sm text-slate-500">Use “+ Add Due” to start tracking a certificate.</p>
            </div>
          )}

          {!loading && dues.length > 0 && (
            <div className="divide-y divide-slate-100">
              {dues.map((due) => {
                const canDelete = Number(due.dueAmount) === 0;
                return (
                  <div key={due.certificateId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="min-w-0">
                      <button type="button" onClick={() => navigate(`/records/${due.certificateId}`)} className="text-left">
                        <p className="truncate text-sm font-bold text-indigo-700 hover:underline">{due.refNo || 'No Ref No.'}</p>
                        <p className="mt-0.5 truncate text-base font-semibold text-slate-900">{due.borrowerName}</p>
                        <p className="mt-1 text-xs text-slate-500">{due.branchName || 'No branch'} · {due.date || 'No date'} · Certificate ₹{formatMoney(due.totalMarketValue)}</p>
                      </button>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <AmountEditor value={due.dueAmount} onSave={(amount) => updateDue(due.certificateId, amount)} saving={savingId === due.certificateId} />
                      <button
                        type="button"
                        onClick={() => deleteDue(due)}
                        disabled={!canDelete}
                        title={canDelete ? 'Remove from due list' : 'Clear due first'}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold ${canDelete ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'}`}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={(event) => { if (event.target === event.currentTarget) resetAddModal(); }}>
          <div className="max-h-[88vh] w-full max-w-[760px] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Add Due</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-950">Find certificate by branch</h2>
              </div>
              <button type="button" onClick={resetAddModal} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-500">Close</button>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                autoFocus
                value={candidateBranch}
                onChange={(event) => setCandidateBranch(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') searchCandidates(); }}
                placeholder="Enter branch name"
                className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button type="button" onClick={searchCandidates} disabled={candidateLoading} className="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">{candidateLoading ? 'Searching...' : 'Search'}</button>
            </div>

            <div className="mt-4 space-y-2">
              {!candidateLoading && candidates.length === 0 && candidateBranch.trim() && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No certificates found for this branch.</p>
              )}
              {candidates.map((candidate) => (
                <div key={candidate.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{candidate.refNo || 'No Ref No.'} · {candidate.borrowerName}</p>
                    <p className="mt-1 text-xs text-slate-500">{candidate.date || 'No date'} · Certificate ₹{formatMoney(candidate.totalMarketValue)}</p>
                  </div>
                  {candidate.alreadyInDue ? (
                    <span className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Already in Due</span>
                  ) : (
                    <button type="button" onClick={() => addDue(candidate)} disabled={addingId === candidate.id} className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{addingId === candidate.id ? 'Adding...' : 'Add Due'}</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default DueSettlementPage;
