'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { addMeeting, createDecision, deleteMeeting, saveReport, type NewAttachment } from '@/app/actions';
import { DAILY_EMAIL_LINE, UPDATE_PEOPLE, UPDATE_STATUSES } from '@/lib/constants';
import { CT, fmtDateTime, fmtLongToday } from '@/lib/time';
import Uploader from '@/components/Uploader';
import type { Decision, Meeting, PlanItem, ReportData, SalesBlock, ScheduleItem, UpdateItem } from '@/lib/types';

type Loaded = { data: ReportData; status: string | null; published_at: string | null };

export default function ReportBuilder({
  morning,
  eod,
  salesImageUrl,
  meetings,
  openDecisions,
}: {
  morning: Loaded;
  eod: Loaded;
  salesImageUrl: string | null;
  meetings: Meeting[];
  openDecisions: Decision[];
}) {
  const [kind, setKind] = useState<'morning' | 'eod'>('morning');
  const [m, setM] = useState<ReportData>(morning.data);
  const [e, setE] = useState<ReportData>(eod.data);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const loaded = kind === 'morning' ? morning : eod;

  function submit(publish: boolean) {
    setMsg('');
    const data = kind === 'morning' ? m : e;
    start(async () => {
      const res = await saveReport(kind, data, publish);
      setMsg(res.ok ? (publish ? 'Published. AJ can see it now.' : 'Draft saved.') : res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-2xl font-extrabold">Daily Report Builder</h1>
        <button onClick={() => setKind('morning')} className={`btn ${kind === 'morning' ? 'bg-oasis text-white' : 'btn-ghost'}`}>Morning Report</button>
        <button onClick={() => setKind('eod')} className={`btn ${kind === 'eod' ? 'bg-indigo-700 text-white' : 'btn-ghost'}`}>End of Day Report</button>
        <span className="text-sm text-slate-500">{fmtLongToday()}</span>
        <span className="ml-auto text-sm text-slate-500">
          {loaded.status === 'published' ? `Published ${fmtDateTime(loaded.published_at)}` : loaded.status === 'draft' ? 'Draft saved, not published' : 'Not started'}
        </span>
      </div>

      {kind === 'morning' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Box title="Updates" color="border-blue-600">
            <UpdatesEditor items={m.updates ?? []} onChange={(updates) => setM({ ...m, updates })} />
          </Box>
          <Box title="Plan for Today (mark your Top 3)" color="border-green-600">
            <PlanEditor items={m.plan ?? []} onChange={(plan) => setM({ ...m, plan })} />
          </Box>
          <Box title="AJ's Schedule Today" color="border-orange-500">
            <ScheduleEditor items={m.schedule ?? []} onChange={(schedule) => setM({ ...m, schedule })} />
          </Box>
          <Box title="What I need from AJ" color="border-red-600">
            <NeedsFromAj open={openDecisions} />
          </Box>
          <Box title="Sales" color="border-oasis">
            <SalesEditor data={m} setData={setM} imageUrl={salesImageUrl} />
          </Box>
          <Box title="Meetings (AJ marks if you are needed)" color="border-teal-700">
            <MeetingsEditor meetings={meetings} />
          </Box>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Box title="Summary note (optional)" color="border-indigo-700">
            <textarea className="field" rows={4} value={e.note ?? ''} onChange={(ev) => setE({ ...e, note: ev.target.value })} />
          </Box>
          <Box title="Updates" color="border-blue-600">
            <UpdatesEditor items={e.updates ?? []} onChange={(updates) => setE({ ...e, updates })} />
          </Box>
          <Box title="My plan for tomorrow (mark Top 3)" color="border-green-600">
            <PlanEditor items={e.tomorrow ?? []} onChange={(tomorrow) => setE({ ...e, tomorrow })} />
          </Box>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-white/95 px-4 py-3 backdrop-blur">
        <button disabled={pending} className="btn-ghost" onClick={() => submit(false)}>Save draft</button>
        <button disabled={pending} className={`btn px-6 py-3 text-base text-white ${kind === 'morning' ? 'bg-oasis' : 'bg-indigo-700'}`} onClick={() => submit(true)}>
          {pending ? 'Working...' : kind === 'morning' ? 'Publish Morning Report' : 'Publish End of Day Report'}
        </button>
        {msg && <span className="text-sm font-semibold text-oasis">{msg}</span>}
        <Link href="/aj" className="ml-auto text-sm font-semibold text-slate-600 underline">Preview AJ view</Link>
      </div>
    </div>
  );
}

function Box({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section className={`card border-t-8 p-4 ${color}`}>
      <h2 className="mb-3 font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const iconBtn = 'rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700';

function UpdatesEditor({ items, onChange }: { items: UpdateItem[]; onChange: (v: UpdateItem[]) => void }) {
  const set = (i: number, patch: Partial<UpdateItem>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {items.map((u, i) => (
        <div key={i} className="flex flex-wrap items-start gap-2 rounded-lg bg-slate-50 p-2">
          <select className="field w-28" value={u.person} onChange={(e) => set(i, { person: e.target.value })}>
            {UPDATE_PEOPLE.map((p) => <option key={p}>{p}</option>)}
          </select>
          <textarea className="field min-w-[200px] flex-1" rows={1} value={u.text} onChange={(e) => set(i, { text: e.target.value })} />
          <select className="field w-32" value={u.status} onChange={(e) => set(i, { status: e.target.value })}>
            {UPDATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="flex flex-col">
            <button type="button" className={iconBtn} onClick={() => onChange(move(items, i, -1))} aria-label="Move up">▲</button>
            <button type="button" className={iconBtn} onClick={() => onChange(move(items, i, 1))} aria-label="Move down">▼</button>
          </div>
          <button type="button" className={iconBtn + ' text-xl'} onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={() => onChange([...items, { person: 'Michelle', text: '', status: 'today' }])}>+ Add update</button>
      {items.some((u) => u.status === 'closed') && (
        <button type="button" className="btn-ghost ml-2" onClick={() => onChange(items.filter((u) => u.status !== 'closed'))}>Clear closed items</button>
      )}
    </div>
  );
}

function PlanEditor({ items, onChange }: { items: PlanItem[]; onChange: (v: PlanItem[]) => void }) {
  const topCount = items.filter((p) => p.top3).length;
  const set = (i: number, patch: Partial<PlanItem>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const hasDaily = items.some((p) => p.text.toLowerCase().includes('email and whatsapp'));
  return (
    <div className="space-y-2">
      {items.map((p, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-lg p-2 ${p.top3 ? 'bg-purple-50 ring-1 ring-purple-300' : 'bg-slate-50'}`}>
          <span className="w-6 text-right font-black text-green-700">{i + 1}.</span>
          <input className="field flex-1" value={p.text} onChange={(e) => set(i, { text: e.target.value })} />
          <label className={`flex shrink-0 items-center gap-1 text-xs font-bold ${p.top3 ? 'text-purple-800' : 'text-slate-500'}`}>
            <input type="checkbox" checked={p.top3} disabled={!p.top3 && topCount >= 3} onChange={(e) => set(i, { top3: e.target.checked })} />
            Top 3
          </label>
          <div className="flex flex-col">
            <button type="button" className={iconBtn} onClick={() => onChange(move(items, i, -1))} aria-label="Move up">▲</button>
            <button type="button" className={iconBtn} onClick={() => onChange(move(items, i, 1))} aria-label="Move down">▼</button>
          </div>
          <button type="button" className={iconBtn + ' text-xl'} onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove">×</button>
        </div>
      ))}
      {!hasDaily && <p className="text-xs text-slate-500">"{DAILY_EMAIL_LINE}" is added automatically.</p>}
      <button type="button" className="btn-ghost" onClick={() => onChange([...items, { text: '', top3: false }])}>+ Add plan item</button>
    </div>
  );
}

function ScheduleEditor({ items, onChange }: { items: ScheduleItem[]; onChange: (v: ScheduleItem[]) => void }) {
  const set = (i: number, patch: Partial<ScheduleItem>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {items.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <input className="field w-28" placeholder="9:00 AM" value={s.time} onChange={(e) => set(i, { time: e.target.value })} />
          <input className="field min-w-[160px] flex-1" placeholder="Title" value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
          <input className="field w-40" placeholder="Location" value={s.location} onChange={(e) => set(i, { location: e.target.value })} />
          <button type="button" className={iconBtn + ' text-xl'} onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={() => onChange([...items, { time: '', title: '', location: '' }])}>+ Add schedule item</button>
      <p className="text-xs text-slate-500">Times are Central Time.</p>
    </div>
  );
}

function NeedsFromAj({ open }: { open: Decision[] }) {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="space-y-1 text-sm">
        {open.map((d) => (
          <li key={d.id} className="flex gap-2">
            <span className={`pill ${d.status === 'waiting' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{d.status}</span>
            <span>{d.title}</span>
          </li>
        ))}
        {open.length === 0 && <li className="italic text-slate-500">Nothing waiting on AJ.</li>}
      </ul>
      <div className="space-y-2 rounded-lg bg-red-50 p-3">
        <input className="field" placeholder="Quick add: what you need from AJ" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="field" rows={2} placeholder="Short context" value={context} onChange={(e) => setContext(e.target.value)} />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !title.trim()}
            className="btn bg-red-600 text-white"
            onClick={() => start(async () => {
              const res = await createDecision({ title, context });
              if (res.ok) { setTitle(''); setContext(''); }
            })}
          >
            Add to AJ queue
          </button>
          <Link href="/patrice/decisions" className="btn-ghost">Add with attachments</Link>
        </div>
      </div>
    </div>
  );
}

function SalesEditor({ data, setData, imageUrl }: { data: ReportData; setData: (d: ReportData) => void; imageUrl: string | null }) {
  const sales = data.sales ?? {};
  const setBlock = (key: 'sugar' | 'jwo', patch: Partial<SalesBlock>) =>
    setData({ ...data, sales: { ...sales, [key]: { yesterday: '', wtd: '', best: '', busiest: '', ...(sales[key] ?? {}), ...patch } } });
  const fields: [keyof SalesBlock, string][] = [
    ['yesterday', 'Yesterday'],
    ['wtd', 'Week to date'],
    ['best', 'Best seller'],
    ['busiest', 'Busiest hour'],
  ];
  return (
    <div className="space-y-3">
      <input className="field" placeholder="Period label, for example Week of Nov 16 to 22" value={sales.period ?? ''}
        onChange={(e) => setData({ ...data, sales: { ...sales, period: e.target.value } })} />
      <div className="grid gap-3 sm:grid-cols-2">
        {(['sugar', 'jwo'] as const).map((k) => (
          <div key={k} className="space-y-1.5 rounded-lg bg-slate-50 p-3">
            <p className="font-bold text-oasis">{k === 'sugar' ? 'Sugar Llamas (Square)' : 'Western Supply (Amazon JWO)'}</p>
            {fields.map(([f, label]) => (
              <label key={f} className="block text-xs font-semibold text-slate-500">
                {label}
                <input className="field" value={sales[k]?.[f] ?? ''} onChange={(e) => setBlock(k, { [f]: e.target.value })} />
              </label>
            ))}
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase text-slate-500">Full report image</p>
        {sales.image_path && imageUrl && <img src={imageUrl} alt="Current sales report" className="mb-2 max-h-40 rounded border" />}
        {sales.image_path && (
          <button type="button" className="btn-ghost mb-2" onClick={() => setData({ ...data, sales: { ...sales, image_path: null } })}>Remove image</button>
        )}
        <Uploader
          folder="sales"
          compact
          allowFiles={false}
          onChange={(atts: NewAttachment[]) => {
            const img = atts.find((a) => a.kind === 'image');
            if (img) setData({ ...data, sales: { ...sales, image_path: img.path } });
          }}
        />
      </div>
    </div>
  );
}

function MeetingsEditor({ meetings }: { meetings: Meeting[] }) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [location, setLocation] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="divide-y text-sm">
        {meetings.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-2">
            <span className="flex-1">
              <b>{m.title}</b>
              <span className="block text-xs text-slate-500">
                {new Date(m.starts_at).toLocaleString('en-US', { timeZone: CT, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} CT
                {m.location ? ` · ${m.location}` : ''}
              </span>
            </span>
            <span className={`pill ${m.patrice_needed === true ? 'bg-teal-700 text-white' : m.patrice_needed === false ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>
              {m.patrice_needed === true ? 'Needed' : m.patrice_needed === false ? 'Can skip' : 'No answer'}
            </span>
            <button type="button" className={iconBtn + ' text-xl'} disabled={pending} onClick={() => start(async () => { await deleteMeeting(m.id); })} aria-label="Remove">×</button>
          </li>
        ))}
        {meetings.length === 0 && <li className="py-2 italic text-slate-500">No upcoming meetings.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input className="field min-w-[160px] flex-1" placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="field w-52" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Start time in Central Time" />
        <input className="field w-36" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <button
          type="button"
          disabled={pending}
          className="btn bg-teal-700 text-white"
          onClick={() => start(async () => {
            const res = await addMeeting({ title, starts_local: when, location });
            if (res.ok) { setTitle(''); setWhen(''); setLocation(''); setErr(''); } else setErr(res.error);
          })}
        >
          Add
        </button>
      </div>
      <p className="text-xs text-slate-500">Enter the start time in Central Time.</p>
      {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
    </div>
  );
}
