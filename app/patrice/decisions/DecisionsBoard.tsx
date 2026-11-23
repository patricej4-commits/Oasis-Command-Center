'use client';

import { useState, useTransition } from 'react';
import { actOnDecision, addNudge, createDecision, deleteDecision, updateDecision, type NewAttachment } from '@/app/actions';
import { DECISION_STATUS_CLASS } from '@/lib/constants';
import { fmtDate, fmtDateTime } from '@/lib/time';
import AttachmentList from '@/components/AttachmentList';
import Uploader from '@/components/Uploader';
import type { Attachment, Decision, DecisionReply } from '@/lib/types';

const TABS = [
  { key: 'open', label: 'Waiting and Discuss' },
  { key: 'approved', label: 'Approved' },
  { key: 'declined', label: 'Declined' },
  { key: 'all', label: 'All' },
];

export default function DecisionsBoard({
  decisions,
  replies,
  nudgeCount,
  decAtts,
  replyAtts,
}: {
  decisions: Decision[];
  replies: DecisionReply[];
  nudgeCount: Record<string, number>;
  decAtts: Record<string, Attachment[]>;
  replyAtts: Record<string, Attachment[]>;
}) {
  const [tab, setTab] = useState('open');
  const shown = decisions.filter((d) =>
    tab === 'all' ? true : tab === 'open' ? d.status === 'waiting' || d.status === 'discuss' : d.status === tab,
  );
  const callFlags = decisions.filter((d) => d.status === 'waiting' && (nudgeCount[d.id] ?? 0) >= 3);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-4 text-2xl font-extrabold">Decisions Queue</h1>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`btn ${tab === t.key ? 'bg-red-600 text-white' : 'btn-ghost'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {callFlags.length > 0 && (
          <div className="rounded-2xl bg-red-600 p-4 text-white">
            <p className="text-lg font-black">Call AJ</p>
            <p className="text-sm">3 nudges sent today with no answer on: {callFlags.map((d) => d.title).join('; ')}</p>
          </div>
        )}
        {shown.map((d) => (
          <DecisionItem
            key={d.id}
            d={d}
            replies={replies.filter((r) => r.decision_id === d.id)}
            nudges={nudgeCount[d.id] ?? 0}
            atts={decAtts[d.id]}
            replyAtts={replyAtts}
          />
        ))}
        {shown.length === 0 && <p className="card p-6 text-slate-500">Nothing here.</p>}
      </div>
      <aside>
        <NewDecision />
      </aside>
    </div>
  );
}

function nudgeText(title: string) {
  return `Hi AJ, following up on ${title}. Can you let me know your feedback on this?`;
}

function DecisionItem({
  d,
  replies,
  nudges,
  atts,
  replyAtts,
}: {
  d: Decision;
  replies: DecisionReply[];
  nudges: number;
  atts?: Attachment[];
  replyAtts: Record<string, Attachment[]>;
}) {
  const [pending, start] = useTransition();
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(d.title);
  const [context, setContext] = useState(d.context ?? '');
  const [waitingOn, setWaitingOn] = useState(d.waiting_on ?? '');
  const open = d.status === 'waiting' || d.status === 'discuss';

  async function copyNudge() {
    try {
      await navigator.clipboard.writeText(nudgeText(d.title));
    } catch {
      prompt('Copy this nudge:', nudgeText(d.title));
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    start(async () => { await addNudge(d.id); });
  }

  return (
    <article className={`card p-5 ${nudges >= 3 && d.status === 'waiting' ? 'ring-4 ring-red-500' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`pill ${DECISION_STATUS_CLASS[d.status]}`}>{d.status.toUpperCase()}</span>
        {d.waiting_on && <span className="text-xs font-semibold text-slate-500">Waiting: {d.waiting_on}</span>}
        <span className="ml-auto text-xs text-slate-400">Added {fmtDate(d.created_at)}</span>
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <input className="field font-bold" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="field" rows={4} value={context} onChange={(e) => setContext(e.target.value)} />
          <input className="field" placeholder="Who is waiting" value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={pending} onClick={() => start(async () => {
              await updateDecision(d.id, { title, context, waiting_on: waitingOn });
              setEditing(false);
            })}>Save</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="mt-2 text-lg font-bold">{d.title}</h2>
          {d.context && <p className="mt-1 whitespace-pre-wrap text-slate-700">{d.context}</p>}
        </>
      )}
      <AttachmentList items={atts} />

      {replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-t pt-3">
          {replies.map((r) => (
            <li key={r.id} className={`rounded-lg p-2 text-sm ${r.author_role === 'aj' ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <span className="font-bold">{r.author_role === 'aj' ? 'AJ' : 'You'}</span>
              {r.action && r.action !== 'comment' && <span className="ml-2 pill bg-white">{r.action}</span>}
              <span className="ml-2 text-xs text-slate-400">{fmtDateTime(r.created_at)}</span>
              {r.body && <p className="mt-0.5 whitespace-pre-wrap">{r.body}</p>}
              <AttachmentList items={replyAtts[r.id]} />
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-4 rounded-xl bg-red-50 p-3">
          <p className="text-xs font-black uppercase text-red-700">Follow-up tracker</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-4 w-4 rounded-full ${nudges >= n ? 'bg-red-600' : 'bg-red-200'}`} />
            ))}
            <span className="text-sm font-semibold">{nudges} of 3 nudges today</span>
            {nudges >= 3 ? (
              <span className="ml-auto rounded-lg bg-red-600 px-3 py-1.5 text-sm font-black text-white">Call AJ</span>
            ) : (
              <button disabled={pending} onClick={copyNudge} className="btn-primary ml-auto">
                {copied ? 'Copied' : 'Copy nudge'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input className="field" placeholder="Reply or add a note for AJ" value={reply} onChange={(e) => setReply(e.target.value)} />
        <button
          disabled={pending || !reply.trim()}
          className="btn-primary"
          onClick={() => start(async () => {
            const res = await actOnDecision({ id: d.id, action: 'comment', body: reply });
            if (res.ok) setReply('');
          })}
        >
          Send
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
        {d.status !== 'waiting' && (
          <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await updateDecision(d.id, { status: 'waiting' }); })}>
            Send back to AJ
          </button>
        )}
        <button
          className="btn-ghost ml-auto text-red-600"
          disabled={pending}
          onClick={() => {
            if (confirm('Delete this decision permanently? This cannot be undone.')) start(async () => { await deleteDecision(d.id); });
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function NewDecision() {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [waitingOn, setWaitingOn] = useState('');
  const [atts, setAtts] = useState<NewAttachment[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className="card sticky top-24 space-y-3 border-t-8 border-red-600 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        start(async () => {
          const res = await createDecision({ title, context, waiting_on: waitingOn, attachments: atts });
          if (!res.ok) return setError(res.error);
          setTitle(''); setContext(''); setWaitingOn(''); setAtts([]); setResetKey((k) => k + 1);
        });
      }}
    >
      <h2 className="text-lg font-extrabold text-red-700">Send AJ a decision</h2>
      <input className="field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea className="field" rows={4} placeholder="Short context (2 to 3 lines)" value={context} onChange={(e) => setContext(e.target.value)} />
      <input className="field" placeholder="Who is waiting on this" value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} />
      <Uploader folder="decisions" onChange={setAtts} resetKey={resetKey} />
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button disabled={pending} className="btn w-full bg-red-600 py-3 text-white">{pending ? 'Sending...' : 'Add to AJ queue'}</button>
    </form>
  );
}
