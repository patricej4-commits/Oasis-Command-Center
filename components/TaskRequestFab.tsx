'use client';

import { useState, useTransition } from 'react';
import { createTaskRequest, type NewAttachment } from '@/app/actions';
import { PRIORITIES } from '@/lib/constants';
import Uploader from '@/components/Uploader';

export default function TaskRequestFab() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <button
        onClick={() => { setOpen(true); setSent(false); }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-oasis px-5 py-4 text-base font-bold text-white shadow-xl active:scale-95"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <span className="text-2xl leading-none">+</span> Give Patrice a Task
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            {sent ? (
              <div className="py-8 text-center">
                <p className="text-xl font-bold text-oasis">Sent to Patrice</p>
                <p className="mt-1 text-slate-600">It is in her inbox now.</p>
                <div className="mt-6 flex justify-center gap-3">
                  <button className="rounded-xl bg-oasis px-5 py-3 font-bold text-white" onClick={() => setSent(false)}>Send another</button>
                  <button className="rounded-xl border px-5 py-3 font-bold" onClick={() => setOpen(false)}>Close</button>
                </div>
              </div>
            ) : (
              <TaskRequestForm onSent={() => setSent(true)} onCancel={() => setOpen(false)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TaskRequestForm({ onSent, onCancel }: { onSent: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [links, setLinks] = useState('');
  const [priority, setPriority] = useState('');
  const [due, setDue] = useState('');
  const [atts, setAtts] = useState<NewAttachment[]>([]);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const linkList = links.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean).map((l) => (/^https?:\/\//i.test(l) ? l : 'https://' + l));
    start(async () => {
      const res = await createTaskRequest({ title, details, links: linkList, priority: priority || null, due_date: due || null, attachments: atts });
      if (res.ok) onSent();
      else setError(res.error);
    });
  }

  const input = 'w-full rounded-xl border border-slate-300 px-3 py-3 text-base';
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-oasis">New task for Patrice</h2>
        <button type="button" onClick={onCancel} className="text-2xl text-slate-400" aria-label="Close">×</button>
      </div>
      <input className={input} placeholder="What do you need?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      <textarea className={input} rows={3} placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      <Uploader folder="requests" onChange={setAtts} />
      <textarea className={input} rows={2} placeholder="Links (paste one or more)" value={links} onChange={(e) => setLinks(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <select className={input} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Priority</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <input className={input} type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
      </div>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-oasis py-4 text-lg font-bold text-white disabled:opacity-60">
        {pending ? 'Sending...' : 'Send to Patrice'}
      </button>
    </form>
  );
}
