'use client';

import { useState } from 'react';
import { PRIORITY_CLASS, STATUS_CLASS, TASK_STATUSES } from '@/lib/constants';
import { fmtDate } from '@/lib/time';
import type { Task } from '@/lib/types';

export default function RunningListReadOnly({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('open');
  const shown = tasks.filter((t) =>
    filter === 'all' ? true : filter === 'open' ? !['Done', 'Cancelled'].includes(t.status) : t.status === filter,
  );
  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="section-title w-full bg-slate-700 text-left">
        <span>Running List</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-black text-slate-900">
          {tasks.filter((t) => !['Done', 'Cancelled'].includes(t.status)).length}
        </span>
        <span className="ml-auto text-2xl">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="p-4">
          <select className="field mb-3 py-3 text-base" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">All open items</option>
            <option value="all">Everything</option>
            {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <ul className="divide-y">
            {shown.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex items-start gap-2">
                  <p className="flex-1 font-bold leading-snug">{t.title}</p>
                  <span className={`pill ${PRIORITY_CLASS[t.priority]}`}>{t.priority}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`pill ${STATUS_CLASS[t.status]}`}>{t.status}</span>
                  {t.person_company && <span className="text-slate-500">{t.person_company}</span>}
                  {t.next_follow_up && <span className="text-slate-500">Follow up {fmtDate(t.next_follow_up)}</span>}
                </div>
                {t.current_state && <p className="mt-1 text-sm text-slate-600">{t.current_state}</p>}
                {t.waiting_on && <p className="text-sm text-amber-700">Waiting on: {t.waiting_on}</p>}
              </li>
            ))}
            {shown.length === 0 && <li className="py-3 text-sm italic text-slate-500">Nothing here.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
