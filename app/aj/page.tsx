import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadAttachments, signPath } from '@/lib/files';
import { ctToday, fmtDate, fmtLongToday } from '@/lib/time';
import { sortTasks } from '@/lib/sort';
import Section, { Empty } from '@/components/Section';
import RealtimeRefresh from '@/components/RealtimeRefresh';
import TaskRequestFab from '@/components/TaskRequestFab';
import { EodSection, PlanSection, SalesSection, ScheduleSection, TopThree, UpdatesSection } from '@/components/ReportSections';
import DecisionCard from './DecisionCard';
import MeetingsList from './MeetingsList';
import RunningListReadOnly from './RunningListReadOnly';
import type { Decision, DecisionReply, Meeting, Report, Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AjView() {
  const me = await requireMe();
  const supabase = createClient();
  const today = ctToday();

  const [decRes, morningRes, eodRes, meetRes, taskRes] = await Promise.all([
    supabase.from('decisions').select('*').eq('status', 'waiting').order('created_at'),
    supabase.from('reports').select('*').eq('kind', 'morning').eq('status', 'published').order('report_date', { ascending: false }).limit(1),
    supabase.from('reports').select('*').eq('kind', 'eod').eq('status', 'published').order('report_date', { ascending: false }).limit(1),
    supabase.from('meetings').select('*').gte('starts_at', new Date(Date.now() - 2 * 3600e3).toISOString()).order('starts_at').limit(12),
    supabase.from('tasks').select('*'),
  ]);

  const decisions = (decRes.data ?? []) as Decision[];
  const morning = ((morningRes.data ?? [])[0] ?? null) as Report | null;
  const eod = ((eodRes.data ?? [])[0] ?? null) as Report | null;
  const meetings = (meetRes.data ?? []) as Meeting[];
  const tasks = sortTasks((taskRes.data ?? []) as Task[]);

  const ids = decisions.map((d) => d.id);
  const { data: replyRows } = ids.length
    ? await supabase.from('decision_replies').select('*').in('decision_id', ids).order('created_at')
    : { data: [] };
  const replies = (replyRows ?? []) as DecisionReply[];
  const [decAtts, replyAtts, salesImg] = await Promise.all([
    loadAttachments('decision', ids),
    loadAttachments('reply', replies.map((r) => r.id)),
    signPath(morning?.data.sales?.image_path),
  ]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-3 pb-32" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <RealtimeRefresh tables={['decisions', 'reports', 'meetings', 'tasks', 'decision_replies']} />
      <header className="flex items-center justify-between px-1">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-oasis">Oasis Command Center</p>
          <p className="text-lg font-extrabold">{fmtLongToday()}</p>
        </div>
        <div className="flex items-center gap-2">
          {me.role === 'patrice' && (
            <Link href="/patrice" className="btn-ghost">My view</Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="text-xs font-semibold text-slate-500">Sign out</button>
          </form>
        </div>
      </header>

      <Section title="Needs Your Decision" color="bg-red-600" count={decisions.length} id="decisions">
        {decisions.length === 0 ? (
          <Empty>All clear. Nothing is waiting on you.</Empty>
        ) : (
          <ul className="space-y-4">
            {decisions.map((d) => (
              <DecisionCard
                key={d.id}
                d={d}
                attachments={decAtts[d.id]}
                replies={replies.filter((r) => r.decision_id === d.id)}
                replyAtts={replyAtts}
              />
            ))}
          </ul>
        )}
      </Section>

      <TopThree report={morning} today={today} />
      <UpdatesSection report={morning} today={today} />
      <PlanSection plan={morning?.data.plan} note={morning && morning.report_date !== today ? 'From ' + fmtDate(morning.report_date) : undefined} />
      <ScheduleSection report={morning} today={today} />

      <Section title="Meetings" color="bg-teal-700">
        <MeetingsList meetings={meetings} />
      </Section>

      <SalesSection report={morning} imageUrl={salesImg} />
      <EodSection report={eod} />
      <RunningListReadOnly tasks={tasks} />

      <TaskRequestFab />
    </main>
  );
}
