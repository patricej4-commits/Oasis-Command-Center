'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSalesDays } from '@/app/actions';
import { guessColumns, parseCsv, rollup, type ColumnGuess, type DayRollup } from '@/lib/csv';
import { fmtDateTime } from '@/lib/time';

const FIELDS: { key: keyof ColumnGuess; label: string; required?: boolean }[] = [
  { key: 'date', label: 'Date / time', required: true },
  { key: 'order', label: 'Order ID' },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'item', label: 'Item name' },
  { key: 'qty', label: 'Quantity' },
];

export function SquareSync({ lastSynced }: { lastSynced: string | null }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function sync() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/sales/square', { method: 'POST' });
      const j = await res.json();
      if (!j.ok) setMsg(j.error);
      else {
        setMsg(`Synced ${j.orders} sales over ${j.days} days from ${j.locations.join(', ')}.` +
          (j.allLocations.length > 1 ? ` Your Square account has ${j.allLocations.length} locations; tell Claude which one is Sugar Llamas.` : ''));
        router.refresh();
      }
    } catch {
      setMsg('Could not reach the server. Try again.');
    }
    setBusy(false);
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" disabled={busy} onClick={sync} className="btn-primary">
        {busy ? 'Syncing...' : 'Sync Square now'}
      </button>
      <span className="text-slate-500">{lastSynced ? `Last synced ${fmtDateTime(lastSynced)}` : 'Not synced yet'}</span>
      {msg && <p className="w-full font-semibold text-oasis">{msg}</p>}
    </div>
  );
}

export function JwoUpload({ lastSynced }: { lastSynced: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [cols, setCols] = useState<ColumnGuess | null>(null);
  const [fileName, setFileName] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  async function onFile(f: File | undefined) {
    if (!f) return;
    setMsg('');
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { setMsg('That file has no data rows.'); return; }
    setFileName(f.name);
    setRows(parsed);
    setCols(guessColumns(parsed[0]));
  }

  const headers = rows?.[0] ?? [];
  const preview: { days: DayRollup[]; skipped: number } | null =
    rows && cols && cols.date >= 0 && cols.amount >= 0 ? rollup(rows.slice(1), cols) : null;

  function save() {
    if (!preview) return;
    start(async () => {
      const res = await saveSalesDays('jwo', preview.days, 'jwo-upload');
      if (res.ok) {
        setMsg(`Saved ${preview.days.length} day(s) from ${fileName}.`);
        setRows(null);
        setCols(null);
        router.refresh();
      } else setMsg(res.error);
    });
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => input.current?.click()}>Upload JWO report (CSV)</button>
        <span className="text-slate-500">{lastSynced ? `Last upload ${fmtDateTime(lastSynced)}` : 'No report uploaded yet'}</span>
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {rows && cols && (
        <div className="space-y-2 rounded-lg border bg-white p-3">
          <p className="font-bold">{fileName}: {rows.length - 1} rows. Check the columns below.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="font-semibold text-slate-500">{f.label}{f.required ? ' *' : ''}</span>
                <select className="field" value={cols[f.key]} onChange={(e) => setCols({ ...cols, [f.key]: Number(e.target.value) })}>
                  <option value={-1}>(none)</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          {preview ? (
            <>
              <ul className="space-y-0.5">
                {preview.days.sort((a, b) => a.sale_date.localeCompare(b.sale_date)).map((d) => (
                  <li key={d.sale_date}>
                    {d.sale_date}: ${(d.total_cents / 100).toFixed(2)} from {d.orders} orders
                  </li>
                ))}
              </ul>
              {preview.skipped > 0 && <p className="text-amber-700">{preview.skipped} rows had no readable date and were skipped.</p>}
              <button type="button" disabled={pending} onClick={save} className="btn bg-oasis text-white">
                {pending ? 'Saving...' : 'Save these totals'}
              </button>
            </>
          ) : (
            <p className="text-red-600">Pick the Date and Amount columns to continue.</p>
          )}
        </div>
      )}
      {msg && <p className="font-semibold text-oasis">{msg}</p>}
    </div>
  );
}
