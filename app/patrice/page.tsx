import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { loadAttachments } from '@/lib/files';
import { fmtDate, fmtDateTime } from '@/lib/time';
import { DECISION_STATUS_CLASS, PRIORITY_CLASS } from '@/lib/constants';
import AttachmentList, { LinkChips } from '@/components/AttachmentList';
import { RequestButtons, SeenButton, TodosSeenButton } from './InboxButtons';
import type { AjTodo } from '@/app/aj/AjTodos';
import type { Decision, DecisionReply, TaskRequest } from '@/lib/types';

export default async function Inbox() {
  const supabase = createClient();
  const [reqRes, unseenRes, todoRes] = await Promise.all([
    supabase.from('task_requests').select('*').order('created_at', { ascending: false }).limit(40),
    supabase.from('decisions').select('*').eq('seen_by_patrice', false).order('decided_at', { ascending: false }),
    supabase.from('aj_todos').select('*').eq('seen_by_patrice', false).order('done_at', { ascending: false }),
  ]);
  const todoUpdates = (todoRes.data ?? []) as AjTodo[];
  const requests = (reqRes.data ?? []) as TaskRequest[];
  const unseen = (unseenRes.data ?? []) as Decision[];
  const fresh = requests.filter((r) => r.status === 'new');
  const handled = requests.filter((r) => r.status !== 'new').slice(0, 10);

  const unseenIds = unseen.map((d) => d.id);
  const { data: replyRows } = unseenIds.length
    ? await supabase.from('decision_replies').select('*').in('decision_id', unseenIds).eq('author_role', 'aj').order('created_at')
    : { data: [] };
  const replies = (replyRows ?? []) as DecisionReply[];
  const [reqAtts, replyAtts] = await Promise.all([
    loadAttachments('request', requests.map((r) => r.id)),
    loadAttachments('reply', replies.map((r) => r.id)),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Inbox from AJ</h1>
        {fresh.length === 0 && <p className="card p-6 text-slate-500">No new tasks from AJ.</p>}
        {fresh.map((r) => (
          <article key={r.id} className="card border-l-8 border-oasis p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill bg-red-600 text-white">NEW</span>
              {r.priority && <span className={`pill ${PRIORITY_CLASS[r.priority]}`}>{r.priority}</span>}
              {r.due_date && <span className="pill bg-slate-100 text-slate-700">Due {fmtDate(r.due_date)}</span>}
              <span className="ml-auto text-xs text-slate-500">{fmtDateTime(r.created_at)}</span>
            </div>
            <h2 className="mt-2 text-xl font-bold">{r.title}</h2>
            {r.details && <p className="mt-1 whitespace-pre-wrap text-slate-700">{r.details}</p>}
            <LinkChips links={r.links} />
            <AttachmentList items={reqAtts[r.id]} />
            <RequestButtons id={r.id} />
          </article>
        ))}

        {handled.length > 0 && (
          <div>
            <h2 className="mb-2 mt-6 text-sm font-black uppercase text-slate-500">Recently handled</h2>
            <ul className="card divide-y">
              {handled.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className={`pill ${r.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {r.status === 'accepted' ? 'Accepted' : 'Dismissed'}
                  </span>
                  <span className="flex-1 truncate">{r.title}</span>
                  {r.task_id && <Link href={`/patrice/list?open=${r.task_id}`} className="font-semibold text-oasis">Open item</Link>}
                  <span className="text-xs text-slate-400">{fmtDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">AJ responded</h2>
          {unseen.length > 1 && <SeenButton id="all" label="Mark all seen" />}
        </div>
        {unseen.length === 0 && todoUpdates.length === 0 && <p className="card p-4 text-sm text-slate-500">No new responses from AJ.</p>}
        {todoUpdates.length > 0 && (
          <div className="card border-l-8 border-indigo-600 p-4">
            <p className="text-xs font-black uppercase text-indigo-700">AJ's tasks</p>
            <ul className="mt-1 space-y-1.5 text-sm">
              {todoUpdates.map((t) => (
                <li key={t.id}>
                  <span className={`pill mr-1 ${t.status === 'done' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                    {t.status === 'done' ? 'Done' : 'Comment'}
                  </span>
                  <b>{t.title}</b>
                  {t.aj_comment && <span className="block text-slate-700">AJ: {t.aj_comment}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-2"><TodosSeenButton /></div>
          </div>
        )}
        {unseen.map((d) => (
          <div key={d.id} className="card border-l-8 border-red-500 p-4">
            <div className="flex items-center gap-2">
              <span className={`pill ${DECISION_STATUS_CLASS[d.status]}`}>{d.status.toUpperCase()}</span>
              <span className="ml-auto text-xs text-slate-400">{fmtDateTime(d.decided_at ?? d.created_at)}</span>
            </div>
            <p className="mt-1 font-bold">{d.title}</p>
            {replies
              .filter((r) => r.decision_id === d.id)
              .map((r) => (
                <div key={r.id} className="mt-1 text-sm">
                  {r.body && <p className="text-slate-700">AJ: {r.body}</p>}
                  <AttachmentList items={replyAtts[r.id]} />
                </div>
              ))}
            <div className="mt-2 flex gap-2">
              <SeenButton id={d.id} label="Got it" />
              <Link href="/patrice/decisions" className="btn-ghost">Open</Link>
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
