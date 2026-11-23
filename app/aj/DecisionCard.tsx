'use client';

import { useState, useTransition } from 'react';
import { actOnDecision, type NewAttachment } from '@/app/actions';
import AttachmentList from '@/components/AttachmentList';
import Uploader from '@/components/Uploader';
import { fmtDate } from '@/lib/time';
import type { Attachment, Decision, DecisionReply } from '@/lib/types';

export default function DecisionCard({
  d,
  attachments,
  replies,
  replyAtts,
}: {
  d: Decision;
  attachments?: Attachment[];
  replies: DecisionReply[];
  replyAtts: Record<string, Attachment[]>;
}) {
  const [comment, setComment] = useState('');
  const [atts, setAtts] = useState<NewAttachment[]>([]);
  const [showReply, setShowReply] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [pending, start] = useTransition();

  function act(action: 'approved' | 'declined' | 'discuss' | 'comment') {
    setError('');
    start(async () => {
      const res = await actOnDecision({ id: d.id, action, body: comment, attachments: atts });
      if (!res.ok) setError(res.error);
      else {
        setComment('');
        setAtts([]);
        setResetKey((k) => k + 1);
        setShowReply(false);
      }
    });
  }

  const big = 'flex-1 rounded-xl py-3 text-base font-extrabold text-white active:scale-95 disabled:opacity-50';
  return (
    <li className="rounded-xl border-2 border-red-200 bg-red-50/40 p-4">
      <p className="text-lg font-extrabold leading-snug">{d.title}</p>
      {d.context && (
        <p
          className={`mt-1 whitespace-pre-wrap text-[15px] text-slate-700 ${expanded ? '' : 'line-clamp-3'}`}
          onClick={() => setExpanded(!expanded)}
        >
          {d.context}
        </p>
      )}
      <p className="mt-2 text-xs font-semibold text-slate-500">
        {d.waiting_on ? <>Waiting: <span className="text-red-700">{d.waiting_on}</span> · </> : null}
        Added {fmtDate(d.created_at)}
      </p>
      <AttachmentList items={attachments} />

      {replies.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-red-100 pt-2 text-sm">
          {replies.map((r) => (
            <li key={r.id}>
              <span className="font-bold">{r.author_role === 'aj' ? 'You' : 'Patrice'}:</span> {r.body}
              <AttachmentList items={replyAtts[r.id]} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <button disabled={pending} onClick={() => act('approved')} className={`${big} bg-emerald-600`}>Approve</button>
        <button disabled={pending} onClick={() => act('declined')} className={`${big} bg-slate-700`}>Decline</button>
        <button disabled={pending} onClick={() => act('discuss')} className={`${big} bg-amber-500`}>Discuss</button>
      </div>

      {!showReply ? (
        <button onClick={() => setShowReply(true)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700">
          Comment or voice note
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            className="w-full rounded-xl border border-slate-300 p-3 text-base"
            rows={2}
            placeholder="Add a comment (sent with your choice above, or on its own)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Uploader folder="replies" onChange={setAtts} compact allowFiles={false} resetKey={resetKey} />
          <button disabled={pending} onClick={() => act('comment')} className="w-full rounded-xl bg-oasis py-3 font-bold text-white disabled:opacity-50">
            Send comment only
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
    </li>
  );
}
