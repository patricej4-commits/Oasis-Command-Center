'use client';

import { useTransition } from 'react';
import { setMeetingNeed } from '@/app/actions';
import { CT } from '@/lib/time';
import type { Meeting } from '@/lib/types';

export default function MeetingsList({ meetings }: { meetings: Meeting[] }) {
  const [pending, start] = useTransition();
  if (meetings.length === 0) return <p className="text-sm italic text-slate-500">No upcoming meetings.</p>;
  return (
    <ul className="space-y-3">
      {meetings.map((m) => (
        <li key={m.id} className="rounded-xl border p-3">
          <p className="font-bold">{m.title}</p>
          <p className="text-sm text-slate-500">
            {new Date(m.starts_at).toLocaleString('en-US', { timeZone: CT, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} CT
            {m.location ? ` · ${m.location}` : ''}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              disabled={pending}
              onClick={() => start(async () => { await setMeetingNeed(m.id, true); })}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${m.patrice_needed === true ? 'bg-teal-700 text-white' : 'border border-teal-700 text-teal-800'}`}
            >
              I need Patrice there
            </button>
            <button
              disabled={pending}
              onClick={() => start(async () => { await setMeetingNeed(m.id, false); })}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${m.patrice_needed === false ? 'bg-slate-700 text-white' : 'border border-slate-400 text-slate-700'}`}
            >
              Patrice can skip
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
