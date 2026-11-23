'use client';

import { useMemo, useState, useTransition } from 'react';
import { addTaskUpdate, deleteTask, markTaskDone, saveTask } from '@/app/actions';
import { EDITABLE_STATUSES, PRIORITIES, PRIORITY_CLASS, STATUS_CLASS, TASK_STATUSES } from '@/lib/constants';
import { ctToday, fmtDate, fmtDateTime } from '@/lib/time';
import AttachmentList, { LinkChips } from '@/components/AttachmentList';
import type { Attachment, Task, TaskRequest, TaskUpdate } from '@/lib/types';

type Draft = Partial<Task> & { title: string; status: string; priority: string };
const BLANK: Draft = { title: '', status: 'In Progress', priority: 'Medium' };

export default function RunningList({
  tasks,
  updates,
  requests,
  reqAtts,
  openId,
}: {
  tasks: Task[];
  updates: TaskUpdate[];
  requests: TaskRequest[];
  reqAtts: Record<string, Attachment[]>;
  openId?: string;
}) {
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Draft | null>(() => (openId ? tasks.find((t) => t.id === openId) ?? null : null));

  const categories = useMemo(() => Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))) as string[], [tasks]);
  const today = ctToday();
  const shown = tasks.filter((t) => {
    if (status === 'open' && ['Done', 'Cancelled'].includes(t.status)) return false;
    if (status === 'due' && !(t.next_follow_up && t.next_follow_up <= today && !['Done', 'Cancelled'].includes(t.status))) return false;
    if (!['open', 'all', 'due'].includes(status) && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (category && t.category !== category) return false;
    if (q) {
      const hay = [t.title, t.person_company, t.what_i_need, t.current_state, t.next_action, t.waiting_on].join(' ').toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const current = editing?.id ? tasks.find((t) => t.id === editing.id) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="mr-4 text-2xl font-extrabold">Running List</h1>
        <select className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">All open</option>
          <option value="due">Follow-up due</option>
          <option value="all">Everything</option>
          {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="field w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="field w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Any category</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="field w-56" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary ml-auto" onClick={() => setEditing({ ...BLANK })}>+ New item</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Status</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Next action</th>
              <th className="p-3">Waiting on</th>
              <th className="p-3">Follow up</th>
              <th className="p-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((t) => {
              const overdue = t.next_follow_up && t.next_follow_up <= today && !['Done', 'Cancelled'].includes(t.status);
              return (
                <tr key={t.id} className="cursor-pointer hover:bg-green-50" onClick={() => setEditing(t)}>
                  <td className="max-w-xs p-3">
                    <p className="font-bold">{t.title}</p>
                    <p className="text-xs text-slate-500">{[t.person_company, t.category].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td className="p-3"><span className={`pill ${STATUS_CLASS[t.status]}`}>{t.status}</span></td>
                  <td className="p-3"><span className={`pill ${PRIORITY_CLASS[t.priority]}`}>{t.priority}</span></td>
                  <td className="max-w-xs p-3 text-slate-700">{t.next_action}</td>
                  <td className="p-3 text-slate-700">{t.waiting_on}</td>
                  <td className={`whitespace-nowrap p-3 ${overdue ? 'font-bold text-red-600' : ''}`}>{fmtDate(t.next_follow_up)}</td>
                  <td className="whitespace-nowrap p-3 text-xs text-slate-500">{fmtDate(t.last_update)}</td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">No items match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Editor
          key={editing.id ?? 'new'}
          draft={current ?? editing}
          updates={updates.filter((u) => u.task_id === editing.id)}
          request={requests.find((r) => r.id === current?.source_request_id)}
          reqAtts={current?.source_request_id ? reqAtts[current.source_request_id] : undefined}
          onClose={() => setEditing(null)}
          onSaved={(id) => setEditing((e) => (e ? { ...e, id } : e))}
        />
      )}
    </div>
  );
}

function Editor({
  draft,
  updates,
  request,
  reqAtts,
  onClose,
  onSaved,
}: {
  draft: Draft;
  updates: TaskUpdate[];
  request?: TaskRequest;
  reqAtts?: Attachment[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [f, setF] = useState<Draft>(draft);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof Task) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSaved(false);
    setF({ ...f, [k]: e.target.value });
  };
  const isDone = draft.status === 'Done';

  function save() {
    setError('');
    start(async () => {
      const res = await saveTask({
        id: f.id,
        title: f.title,
        person_company: f.person_company ?? '',
        what_i_need: f.what_i_need ?? '',
        current_state: f.current_state ?? '',
        next_action: f.next_action ?? '',
        waiting_on: f.waiting_on ?? '',
        status: f.status,
        priority: f.priority,
        category: f.category ?? '',
        next_follow_up: f.next_follow_up ?? '',
      });
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        if (res.id) onSaved(res.id);
      }
    });
  }

  const label = 'block text-xs font-bold uppercase text-slate-500';
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{f.id ? 'Edit item' : 'New item'}</h2>
          <button onClick={onClose} className="text-3xl text-slate-400" aria-label="Close">×</button>
        </div>

        {request && (
          <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm">
            <p className="font-bold text-oasis">From AJ on {fmtDateTime(request.created_at)}</p>
            {request.details && <p className="whitespace-pre-wrap">{request.details}</p>}
            <LinkChips links={request.links} />
            <AttachmentList items={reqAtts} />
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={label}>Title</span><input className="field" value={f.title} onChange={set('title')} /></label>
          <label><span className={label}>Person / company</span><input className="field" value={f.person_company ?? ''} onChange={set('person_company')} /></label>
          <label><span className={label}>Category</span><input className="field" value={f.category ?? ''} onChange={set('category')} /></label>
          <label className="sm:col-span-2"><span className={label}>What I need</span><textarea className="field" rows={2} value={f.what_i_need ?? ''} onChange={set('what_i_need')} /></label>
          <label className="sm:col-span-2"><span className={label}>Current state</span><textarea className="field" rows={2} value={f.current_state ?? ''} onChange={set('current_state')} /></label>
          <label className="sm:col-span-2"><span className={label}>Next action</span><input className="field" value={f.next_action ?? ''} onChange={set('next_action')} /></label>
          <label><span className={label}>Waiting on</span><input className="field" value={f.waiting_on ?? ''} onChange={set('waiting_on')} /></label>
          <label><span className={label}>Next follow-up</span><input type="date" className="field" value={f.next_follow_up ?? ''} onChange={set('next_follow_up')} /></label>
          <label>
            <span className={label}>Status</span>
            {isDone ? (
              <p className="field bg-slate-50">Done</p>
            ) : (
              <select className="field" value={f.status} onChange={set('status')}>
                {EDITABLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            )}
          </label>
          <label>
            <span className={label}>Priority</span>
            <select className="field" value={f.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">Finished work goes to Final Review first. Use Mark Done from Final Review to close it.</p>

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {!isDone && <button disabled={pending} onClick={save} className="btn-primary px-5">{pending ? 'Saving...' : saved ? 'Saved' : 'Save'}</button>}
          {draft.id && draft.status === 'Final Review' && (
            <button
              disabled={pending}
              className="btn bg-emerald-600 text-white"
              onClick={() => start(async () => {
                const res = await markTaskDone(draft.id!);
                if (!res.ok) setError(res.error);
              })}
            >
              Mark Done
            </button>
          )}
          {draft.id && (
            <button
              disabled={pending}
              className="btn-ghost ml-auto text-red-600"
              onClick={() => {
                if (confirm('Delete this item permanently? This cannot be undone. Consider Cancelled instead.')) {
                  start(async () => {
                    const res = await deleteTask(draft.id!);
                    if (res.ok) onClose();
                  });
                }
              }}
            >
              Delete
            </button>
          )}
        </div>

        {draft.id && (
          <div className="mt-8">
            <h3 className="text-sm font-black uppercase text-slate-500">Updates log</h3>
            <div className="mt-2 flex gap-2">
              <input className="field" placeholder="Add an update (also sets Current state)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button
                disabled={pending || !note.trim()}
                className="btn-primary"
                onClick={() => start(async () => {
                  const res = await addTaskUpdate(draft.id!, note);
                  if (res.ok) {
                    setNote('');
                    setF((x) => ({ ...x, current_state: note.trim() }));
                  } else setError(res.error);
                })}
              >
                Add
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {updates.map((u) => (
                <li key={u.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-slate-500">{fmtDateTime(u.created_at)}</p>
                  <p className="whitespace-pre-wrap">{u.body}</p>
                </li>
              ))}
              {updates.length === 0 && <li className="text-sm italic text-slate-500">No updates yet.</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
