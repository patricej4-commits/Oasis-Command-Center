'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSalesDays } from '@/app/actions';
import { rollupFiles, type DayRollup } from '@/lib/csv';
import { fmtDateTime } from '@/lib/time';

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

/** Upload one or more Amazon JWO daily files (Sales and Refund). Refunds are subtracted. */
export function JwoUpload({ lastSynced }: { lastSynced: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ days: DayRollup[]; skipped: number; rows: number } | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setMsg('');
    const files = Array.from(list);
    const texts = await Promise.all(files.map((f) => f.text()));
    const result = rollupFiles(texts);
    setNames(files.map((f) => f.name));
    if (result.days.length === 0) {
      setPreview(null);
      setMsg('No sales rows with a readable date and amount were found in those files.');
      return;
    }
    setPreview(result);
  }

  function save() {
    if (!preview) return;
    start(async () => {
      const res = await saveSalesDays('jwo', preview.days, 'jwo-upload');
      if (res.ok) {
        setMsg(`Saved ${preview.days.length} day(s) from ${names.length} file(s).`);
        setPreview(null);
        router.refresh();
      } else setMsg(res.error);
    });
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => input.current?.click()}>Upload JWO reports (Sales and Refund CSV)</button>
        <span className="text-slate-500">{lastSynced ? `Last upload ${fmtDateTime(lastSynced)}` : 'No report uploaded yet'}</span>
        <input ref={input} type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>
      <p className="text-slate-500">Tip: select the Sales file and the Refund file for the same day together.</p>
      {preview && (
        <div className="space-y-2 rounded-lg border bg-white p-3">
          <p className="font-bold">{names.join(', ')}: {preview.rows} lines read.</p>
          <ul className="space-y-0.5">
            {[...preview.days].sort((a, b) => a.sale_date.localeCompare(b.sale_date)).map((d) => (
              <li key={d.sale_date}>
                {d.sale_date}: ${(d.total_cents / 100).toFixed(2)} from {d.orders} orders (before tax, after refunds)
              </li>
            ))}
          </ul>
          {preview.skipped > 0 && <p className="text-amber-700">{preview.skipped} lines could not be read and were skipped.</p>}
          <button type="button" disabled={pending} onClick={save} className="btn bg-oasis text-white">
            {pending ? 'Saving...' : 'Save these totals'}
          </button>
        </div>
      )}
      {msg && <p className="font-semibold text-oasis">{msg}</p>}
    </div>
  );
}
