'use client';

import { useState, useTransition } from 'react';
import { updateAjTodo } from '@/app/actions';
import { fmtDate } from '@/lib/time';

export type AjTodo = {
  id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  status: 'open' | 'done';
  aj_comment: string | null;
  done_at: string | null;
};

function TodoItem({ t }: { t: AjTodo }) {
  const [comment, setComment] = useState(t.aj_comment ?? '');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const done = t.status === 'done';
  const overdue = !done && t.due_date && t.due_date < new Date().toISOString().slice(0, 10);

  return (
    <li className={`rounded-xl border-2 p-3 ${done ? 'border-slate-200 bg-slate-50' : 'border-indigo-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <button
          disabled={pending}
          onClick={() => start(async () => { await updateAjTodo(t.id, { done: !done, comment }); })}
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-black ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-indigo-400 text-transparent'}`}
          aria-label={done ? 'Mark not done' : 'Mark done'}
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-bold leading-snug ${done ? 'text-slate-500 line-through' : ''}`}>{t.title}</p>
          {t.details && <p className="text-sm text-slate-600">{t.details}</p>}
          {t.due_date && (
            <p className={`text-xs font-semibold ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
              {overdue ? 'Overdue, was due ' : 'Due '}{fmtDate(t.due_date)}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Your comment or feedback for Patrice"
          value={comment}
          onChange={(e) => { setComment(e.target.value); setSaved(false); }}
        />
        <button
          disabled={pending || comment === (t.aj_comment ?? '')}
          onClick={() => start(async () => { const r = await updateAjTodo(t.id, { comment }); if (r.ok) setSaved(true); })}
          className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {saved ? 'Sent' : 'Send'}
        </button>
      </div>
    </li>
  );
}

export default function AjTodos({ todos }: { todos: AjTodo[] }) {
  const [showDone, setShowDone] = useState(false);
  const open = todos.filter((t) => t.status === 'open');
  const done = todos.filter((t) => t.status === 'done');
  return (
    <div className="space-y-3">
      {open.length === 0 && <p className="text-sm italic text-slate-500">Nothing on your list right now.</p>}
      <ul className="space-y-3">{open.map((t) => <TodoItem key={t.id} t={t} />)}</ul>
      {done.length > 0 && (
        <>
          <button className="text-sm font-bold text-indigo-700" onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide completed' : `Show completed (${done.length})`}
          </button>
          {showDone && <ul className="space-y-2">{done.map((t) => <TodoItem key={t.id} t={t} />)}</ul>}
        </>
      )}
    </div>
  );
}
