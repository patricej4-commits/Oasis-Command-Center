import { createClient } from '@/lib/supabase/server';
import { loadAttachments } from '@/lib/files';
import { ctToday } from '@/lib/time';
import DecisionsBoard from './DecisionsBoard';
import type { Decision, DecisionReply } from '@/lib/types';

export default async function DecisionsPage() {
  const supabase = createClient();
  const [{ data: decisions }, { data: replies }, { data: nudges }] = await Promise.all([
    supabase.from('decisions').select('*').order('created_at', { ascending: false }),
    supabase.from('decision_replies').select('*').order('created_at'),
    supabase.from('nudges').select('decision_id, created_at').eq('nudge_date', ctToday()),
  ]);
  const ds = (decisions ?? []) as Decision[];
  const rs = (replies ?? []) as DecisionReply[];
  const nudgeCount: Record<string, number> = {};
  (nudges ?? []).forEach((n: { decision_id: string }) => (nudgeCount[n.decision_id] = (nudgeCount[n.decision_id] ?? 0) + 1));
  const [decAtts, replyAtts] = await Promise.all([
    loadAttachments('decision', ds.map((d) => d.id)),
    loadAttachments('reply', rs.map((r) => r.id)),
  ]);
  return <DecisionsBoard decisions={ds} replies={rs} nudgeCount={nudgeCount} decAtts={decAtts} replyAtts={replyAtts} />;
}
