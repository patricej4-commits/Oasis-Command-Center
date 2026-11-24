import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadAttachments, signPath } from '@/lib/files';
import { ctToday, fmtDate, fmtLongToday } from '@/lib/time';
import { sortTasks } from '@/lib/sort';
import { weekStat, type SalesDay } from '@/lib/sales';
import SalesDashboard, { type StoreWeeks } from '@/components/SalesDashboard';
import AjTodos, { type AjTodo } from './AjTodos';
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

  const [decRes, morningRes, eodRes, meetRes, taskRes, salesRes, todoRes] = await Promise.all([
    supabase.from('decisions').select('*').eq('status', 'waiting').order('created_at'),
    supabase.from('reports').select('*').eq('kind', 'morning').eq('status', 'published').order('report_date', { ascending: false }).limit(1),
    supabase.from('reports').select('*').eq('kind', 'eod').eq('status', 'published').order('report_date', { ascending: false }).limit(1),
    supabase.from('meetings').select('*').gte('starts_at', new Date(Date.now() - 2 * 3600e3).toISOString()).order('starts_at').limit(12),
    supabase.from('tasks').select('*'),
    supabase.from('sales_days').select('*').gte('sale_date', new Date(Date.now() - 22 * 864e5).toISOString().slice(0, 10)),
    supabase.from('aj_todos').select('*').order('status').order('due_date', { nullsFirst: false }).order('created_at').limit(60),
  ]);
  const todos = (todoRes.data ?? []) as AjTodo[];
  const openTodos = todos.filter((t) => t.status === 'open').length;
  const salesDays = (salesRes.data ?? []) as SalesDay[];
  const lastWeekDate = new Date(Date.now() - 7 * 864e5);
  const salesStores: StoreWeeks[] = [
    { key: 'jwo', name: 'Western Supply', source: 'Micro store (Amazon JWO)' },
    { key: 'sugar', name: 'Sugar Llamas', source: 'Square' },
  ].map((s) => ({
    ...s,
    thisWeek: weekStat(salesDays, s.key as 'jwo' | 'sugar', today, today),
    lastWeek: weekStat(salesDays, s.key as 'jwo' | 'sugar', ctToday(lastWeekDate), today),
  }));
  const hasSales = salesDays.length > 0;

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
      <RealtimeRefresh tables={['decisions', 'reports', 'meetings', 'tasks', 'decision_replies', 'aj_todos']} />
      <header className="flex items-center justify-between gap-3 rounded-2xl bg-oasis px-3 py-2 text-white">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Oasis Fresh Market" className="h-10 w-auto" />
          <p className="text-sm font-extrabold leading-tight">{fmtLongToday()}</p>
        </div>
        <div className="flex items-center gap-2">
          {me.role === 'patrice' && (
            <Link href="/patrice" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold">My view</Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="text-xs font-semibold text-green-200">Sign out</button>
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

      <Section title="Your Tasks" color="bg-indigo-700" count={openTodos} id="tasks">
        <AjTodos todos={todos} />
      </Section>

      <TopThree report={morning} today={today} />
      <UpdatesSection report={morning} today={today} />
      <PlanSection plan={morning?.data.plan} note={morning && morning.report_date !== today ? 'From ' + fmtDate(morning.report_date) : undefined} />
      <ScheduleSection report={morning} today={today} />

      <Section title="Meetings" color="bg-teal-700">
        <MeetingsList meetings={meetings} />
      </Section>

      {hasSales ? <SalesDashboard stores={salesStores} /> : <SalesSection report={morning} imageUrl={salesImg} />}
      <EodSection report={eod} />
      <RunningListReadOnly tasks={tasks} />

      <TaskRequestFab />
    </main>
  );
}
