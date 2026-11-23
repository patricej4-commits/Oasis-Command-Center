import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, fmtDateTime } from '@/lib/time';
import type { Report } from '@/lib/types';

export default async function ArchivePage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('reports')
    .select('id, kind, report_date, status, published_at')
    .eq('status', 'published')
    .order('report_date', { ascending: false })
    .order('kind')
    .limit(200);
  const reports = (data ?? []) as Report[];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Report Archive</h1>
      <ul className="card divide-y">
        {reports.map((r) => (
          <li key={r.id}>
            <Link href={`/patrice/archive/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-green-50">
              <span className="w-36 font-bold">{fmtDate(r.report_date)}</span>
              <span className={`pill ${r.kind === 'morning' ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'}`}>
                {r.kind === 'morning' ? 'Morning' : 'End of Day'}
              </span>
              <span className="ml-auto text-xs text-slate-500">Published {fmtDateTime(r.published_at)}</span>
            </Link>
          </li>
        ))}
        {reports.length === 0 && <li className="p-4 text-slate-500">No published reports yet.</li>}
      </ul>
    </div>
  );
}
