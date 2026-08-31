import { useMemo, useState } from 'react';
import { exportRecordsCsv, exportRecordsExcel } from '../utils/recordExport';

function RecordExportPanel({ records = [] }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const exportRecords = useMemo(() => records.filter((record) => {
    const date = record.date || record.payload?.form?.date || '';
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;
    return true;
  }), [records, from, to]);

  function clearRange() {
    setFrom('');
    setTo('');
  }

  return (
    <section className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Export Records</p>
          <h2 className="mt-0.5 text-base font-bold text-slate-950">Download CSV or Excel</h2>
          <p className="mt-1 text-xs text-slate-500">Choose a date range. {exportRecords.length} record(s) will be exported.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportRecordsCsv(exportRecords)} disabled={!exportRecords.length} className="h-10 rounded bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">Download CSV</button>
          <button type="button" onClick={() => exportRecordsExcel(exportRecords)} disabled={!exportRecords.length} className="h-10 rounded bg-slate-800 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40">Download Excel</button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">From</span><input className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">To</span><input className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button type="button" onClick={clearRange} disabled={!from && !to} className="h-10 rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">All Dates / Clear</button>
      </div>
    </section>
  );
}

export default RecordExportPanel;
