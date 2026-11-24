'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptRequest, dismissRequest, markAjTodosSeen, markDecisionSeen } from '@/app/actions';

export function TodosSeenButton() {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} className="btn-primary" onClick={() => start(async () => { await markAjTodosSeen(); })}>
      Got it
    </button>
  );
}

export function RequestButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="mt-4 flex gap-2">
      <button
        disabled={pending}
        className="btn-primary px-5 py-2.5"
        onClick={() =>
          start(async () => {
            const res = await acceptRequest(id);
            if (res.ok && res.id) router.push(`/patrice/list?open=${res.id}`);
            else if (!res.ok) alert(res.error);
          })
        }
      >
        Accept into Running List
      </button>
      <button
        disabled={pending}
        className="btn-ghost"
        onClick={() => {
          if (confirm('Dismiss this request?')) start(async () => { await dismissRequest(id); });
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

export function SeenButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} className="btn-primary" onClick={() => start(async () => { await markDecisionSeen(id); })}>
      {label}
    </button>
  );
}
