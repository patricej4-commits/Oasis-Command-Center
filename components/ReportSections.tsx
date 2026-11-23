import Section, { Empty } from '@/components/Section';
import { DAILY_EMAIL_LINE, UPDATE_PEOPLE, UPDATE_STATUSES } from '@/lib/constants';
import { fmtDate, fmtDateTime } from '@/lib/time';
import type { PlanItem, Report, SalesBlock } from '@/lib/types';

function staleNote(report: Report | null, today: string) {
  if (!report) return undefined;
  return report.report_date === today ? 'Today' : 'From ' + fmtDate(report.report_date);
}

export function withDailyLine(plan: PlanItem[] = []): PlanItem[] {
  const has = plan.some((p) => p.text.toLowerCase().includes('email and whatsapp'));
  return has ? plan : [...plan, { text: DAILY_EMAIL_LINE, top3: false }];
}

export function TopThree({ report, today }: { report: Report | null; today: string }) {
  const top = (report?.data.plan ?? []).filter((p) => p.top3).slice(0, 3);
  return (
    <Section title="My Top 3 Today" color="bg-purple-700" right={staleNote(report, today)}>
      {top.length === 0 ? (
        <Empty>No Top 3 published yet.</Empty>
      ) : (
        <ol className="space-y-2">
          {top.map((p, i) => (
            <li key={i} className="relative rounded-xl bg-purple-700 p-4 pt-6 text-white shadow">
              <span className="absolute -top-0 left-3 rounded-b-md bg-yellow-300 px-2 py-0.5 text-[10px] font-black tracking-wider text-purple-900">
                TOP 3 TODAY
              </span>
              <span className="mr-2 text-2xl font-black text-yellow-300">{i + 1}</span>
              <span className="text-lg font-bold">{p.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function UpdatesSection({ report, today }: { report: Report | null; today: string }) {
  const updates = report?.data.updates ?? [];
  const order = [...UPDATE_PEOPLE] as string[];
  const groups = new Map<string, typeof updates>();
  updates.forEach((u) => {
    const key = order.includes(u.person) ? u.person : u.person || 'Other';
    groups.set(key, [...(groups.get(key) ?? []), u]);
  });
  const keys = Array.from(groups.keys()).sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return (
    <Section title="Updates" color="bg-blue-600" right={staleNote(report, today)}>
      {updates.length === 0 ? (
        <Empty>No updates published yet.</Empty>
      ) : (
        <div className="space-y-4">
          {keys.map((k) => (
            <div key={k}>
              <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-blue-700">{k}</h3>
              <ul className="space-y-1.5">
                {groups.get(k)!.map((u, i) => {
                  const st = UPDATE_STATUSES.find((s) => s.value === u.status);
                  return (
                    <li key={i} className="flex items-start gap-2 border-l-4 border-blue-200 pl-3">
                      <span className="flex-1 text-[15px] leading-snug">{u.text}</span>
                      {st && <span className={`pill shrink-0 ${st.cls}`}>{st.label}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function PlanSection({ plan, title = 'Plan for Today', note }: { plan?: PlanItem[]; title?: string; note?: string }) {
  const items = withDailyLine(plan ?? []);
  const sorted = [...items.filter((p) => p.top3), ...items.filter((p) => !p.top3)];
  return (
    <Section title={title} color="bg-green-600" right={note}>
      <ol className="space-y-1.5">
        {sorted.map((p, i) => (
          <li key={i} className={`flex gap-3 rounded-lg px-2 py-1.5 ${p.top3 ? 'bg-purple-50 ring-1 ring-purple-200' : ''}`}>
            <span className="w-6 shrink-0 text-right font-black text-green-700">{i + 1}.</span>
            <span className="flex-1 text-[15px]">{p.text}</span>
            {p.top3 && <span className="pill shrink-0 bg-yellow-300 text-purple-900">TOP 3</span>}
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function ScheduleSection({ report, today }: { report: Report | null; today: string }) {
  const items = report?.data.schedule ?? [];
  return (
    <Section title="Your Schedule Today" color="bg-orange-500" right={staleNote(report, today)}>
      {items.length === 0 ? (
        <Empty>Nothing on the schedule.</Empty>
      ) : (
        <ul className="divide-y">
          {items.map((s, i) => (
            <li key={i} className="flex gap-3 py-2">
              <span className="w-20 shrink-0 font-black text-orange-600">{s.time}</span>
              <span className="flex-1">
                <span className="block font-semibold">{s.title}</span>
                {s.location && <span className="text-sm text-slate-500">{s.location}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function SalesCard({ name, sub, s }: { name: string; sub: string; s?: SalesBlock }) {
  const rows: [string, string | undefined][] = [
    ['Yesterday', s?.yesterday],
    ['Week to date', s?.wtd],
    ['Best seller', s?.best],
    ['Busiest hour', s?.busiest],
  ];
  return (
    <div className="rounded-xl border-2 border-oasis/20 p-3">
      <p className="font-black text-oasis">{name}</p>
      <p className="mb-2 text-xs text-slate-500">{sub}</p>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-bold">{v || '-'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SalesSection({ report, imageUrl }: { report: Report | null; imageUrl?: string | null }) {
  const sales = report?.data.sales;
  return (
    <Section title="Sales at a Glance" color="bg-oasis" right={sales?.period}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SalesCard name="Sugar Llamas" sub="Square" s={sales?.sugar} />
        <SalesCard name="Western Supply" sub="Amazon Just Walk Out" s={sales?.jwo} />
      </div>
      {imageUrl && (
        <a href={imageUrl} target="_blank" rel="noreferrer" className="mt-3 block">
          <img src={imageUrl} alt="Full sales report" className="max-h-64 w-full rounded-lg border object-contain" />
          <span className="text-xs font-semibold text-oasis">Tap to open the full report</span>
        </a>
      )}
    </Section>
  );
}

export function EodSection({ report }: { report: Report | null }) {
  return (
    <Section title="End of Day Report" color="bg-indigo-700" right={report ? fmtDateTime(report.published_at) : undefined}>
      {!report ? (
        <Empty>No end of day report yet.</Empty>
      ) : (
        <div className="space-y-4">
          {report.data.note && <p className="whitespace-pre-wrap text-[15px]">{report.data.note}</p>}
          <div>
            <h3 className="mb-1 text-sm font-black uppercase text-indigo-700">Updates</h3>
            {(report.data.updates ?? []).length === 0 ? (
              <Empty>No updates.</Empty>
            ) : (
              <ul className="space-y-1">
                {report.data.updates!.map((u, i) => {
                  const st = UPDATE_STATUSES.find((s) => s.value === u.status);
                  return (
                    <li key={i} className="flex gap-2 text-[15px]">
                      <span className="font-bold text-slate-600">{u.person}:</span>
                      <span className="flex-1">{u.text}</span>
                      {st && <span className={`pill shrink-0 ${st.cls}`}>{st.label}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-sm font-black uppercase text-indigo-700">My plan for tomorrow</h3>
            <ol className="list-decimal space-y-1 pl-6 text-[15px]">
              {withDailyLine(report.data.tomorrow).map((p, i) => (
                <li key={i} className={p.top3 ? 'font-bold text-purple-800' : ''}>
                  {p.text} {p.top3 && <span className="pill bg-yellow-300 text-purple-900">TOP 3</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Section>
  );
}
