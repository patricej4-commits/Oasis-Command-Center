'use client';

import { useState, useTransition } from 'react';
import { addMember, createDecision, saveCheckinNote, saveMemberTime } from '@/app/actions';
import { ctToday, fmtDate } from '@/lib/time';
import type { Member, Note } from './page';

export default function Checkins({ members, notes }: { members: Member[]; notes: Note[] }) {
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-2xl font-extrabold">Team Check-ins</h1>
        <span className="text-sm text-slate-500">Daily 20-minute check-ins</span>
        <div className="ml-auto flex gap-2">
          <input className="field w-44" placeholder="Add team member" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-ghost" disabled={pending || !name.trim()} onClick={() => start(async () => { await addMember(name); setName(''); })}>Add</button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {members.map((m) => (
          <MemberCard key={m.id} m={m} notes={notes.filter((n) => n.member_id === m.id)} />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ m, notes }: { m: Member; notes: Note[] }) {
  const today = ctToday();
  const todays = notes.find((n) => n.note_date === today);
  const past = notes.filter((n) => n.note_date !== today).slice(0, 5);
  const [text, setText] = useState(todays?.notes ?? '');
  const [time, setTime] = useState(m.checkin_time ?? '');
  const [ask, setAsk] = useState('');
  const [askCtx, setAskCtx] = useState('');
  const [status, setStatus] = useState('');
  const [pending, start] = useTransition();

  return (
    <section className="card border-t-8 border-blue-600 p-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-extrabold">{m.name}</h2>
        <input
          className="field ml-auto w-36"
          placeholder="Meeting time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => time !== (m.checkin_time ?? '') && start(async () => { await saveMemberTime(m.id, time); })}
        />
      </div>
      <label className="mt-3 block text-xs font-bold uppercase text-slate-500">Today&apos;s notes</label>
      <textarea className="field" rows={4} value={text} onChange={(e) => { setText(e.target.value); setStatus(''); }} />
      <div className="mt-2 flex items-center gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => start(async () => {
            const res = await saveCheckinNote(m.id, text);
            setStatus(res.ok ? 'Saved' : res.error);
          })}
        >
          Save notes
        </button>
        {status && <span className="text-sm font-semibold text-oasis">{status}</span>}
      </div>

      <div className="mt-4 rounded-lg bg-red-50 p-3">
        <p className="text-xs font-black uppercase text-red-700">Needs from AJ</p>
        <input className="field mt-2" placeholder={`What ${m.name} needs from AJ`} value={ask} onChange={(e) => setAsk(e.target.value)} />
        <textarea className="field mt-2" rows={2} placeholder="Short context" value={askCtx} onChange={(e) => setAskCtx(e.target.value)} />
        <button
          className="btn mt-2 bg-red-600 text-white"
          disabled={pending || !ask.trim()}
          onClick={() => start(async () => {
            const res = await createDecision({ title: ask, context: askCtx, waiting_on: m.name });
            if (res.ok) { setAsk(''); setAskCtx(''); setStatus('Sent to AJ queue'); }
          })}
        >
          Push to AJ Decisions Queue
        </button>
      </div>

      {past.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">Past notes</summary>
          <ul className="mt-2 space-y-2">
            {past.map((n) => (
              <li key={n.id} className="rounded bg-slate-50 p-2 text-sm">
                <p className="text-xs font-bold text-slate-500">{fmtDate(n.note_date)}</p>
                <p className="whitespace-pre-wrap">{n.notes}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
