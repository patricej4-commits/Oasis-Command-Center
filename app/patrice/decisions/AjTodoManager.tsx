'use client';

import { useState, useTransition } from 'react';
import { createAjTodo, deleteAjTodo, updateAjTodo } from '@/app/actions';
import { fmtDate, fmtDateTime } from '@/lib/time';
import type { AjTodo } from '@/app/aj/AjTodos';

export default function AjTodoManager({ todos }: { todos: AjTodo[] }) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [due, setDue] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  return (
    <section className="card border-t-8 border-indigo-700 p-5">
      <h2 className="text-lg font-extrabold text-indigo-800">Tasks for AJ</h2>
      <p className="mb-3 text-sm text-slate-500">Things AJ needs to do. He checks them off and can leave a comment for you.</p>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_160px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setErr('');
          start(async () => {
            const r = await createAjTodo({ title, details, due_date: due });
            if (r.ok) { setTitle(''); setDetails(''); setDue(''); } else setErr(r.error);
          });
        }}
      >
        <input className="field" placeholder="Task for AJ" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="field" placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <input className="field" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <button disabled={pending} className="btn bg-indigo-700 text-white">Add</button>
      </form>
      {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}

      <ul className="mt-4 divide-y">
        {todos.map((t) => (
          <li key={t.id} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
            <span className={`pill ${t.status === 'done' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
              {t.status === 'done' ? 'Done' : 'Open'}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-bold ${t.status === 'done' ? 'text-slate-500 line-through' : ''}`}>{t.title}</p>
              {t.details && <p className="text-slate-600">{t.details}</p>}
              <p className="text-xs text-slate-500">
                {t.due_date ? `Due ${fmtDate(t.due_date)}` : 'No due date'}
                {t.done_at ? ` · Done ${fmtDateTime(t.done_at)}` : ''}
              </p>
              {t.aj_comment && <p className="mt-1 rounded bg-amber-50 p-2">AJ: {t.aj_comment}</p>}
            </div>
            {t.status === 'done' && (
              <button className="btn-ghost text-xs" disabled={pending} onClick={() => start(async () => { await updateAjTodo(t.id, { done: false }); })}>
                Reopen
              </button>
            )}
            <button
              className="btn-ghost text-xs text-red-600"
              disabled={pending}
              onClick={() => { if (confirm('Delete this task for AJ?')) start(async () => { await deleteAjTodo(t.id); }); }}
            >
              Delete
            </button>
          </li>
        ))}
        {todos.length === 0 && <li className="py-3 text-sm italic text-slate-500">No tasks for AJ yet.</li>}
      </ul>
    </section>
  );
}
