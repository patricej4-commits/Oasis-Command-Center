import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signPath } from '@/lib/files';
import { fmtDate } from '@/lib/time';
import { EodSection, PlanSection, SalesSection, ScheduleSection, TopThree, UpdatesSection } from '@/components/ReportSections';
import type { Report } from '@/lib/types';

export default async function ArchivedReport({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('reports').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const r = data as Report;
  const img = await signPath(r.data.sales?.image_path);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/patrice/archive" className="text-sm font-semibold text-oasis">Back to archive</Link>
      <h1 className="text-2xl font-extrabold">
        {r.kind === 'morning' ? 'Morning Report' : 'End of Day Report'}, {fmtDate(r.report_date)}
      </h1>
      {r.kind === 'morning' ? (
        <>
          <TopThree report={r} today={r.report_date} />
          <UpdatesSection report={r} today={r.report_date} />
          <PlanSection plan={r.data.plan} />
          <ScheduleSection report={r} today={r.report_date} />
          <SalesSection report={r} imageUrl={img} />
        </>
      ) : (
        <EodSection report={r} />
      )}
    </div>
  );
}
