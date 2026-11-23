import { createClient } from '@/lib/supabase/server';
import { signPath } from '@/lib/files';
import { ctToday } from '@/lib/time';
import ReportBuilder from './ReportBuilder';
import type { Decision, Meeting, Report, ReportData } from '@/lib/types';

export default async function ReportPage() {
  const supabase = createClient();
  const today = ctToday();
  const [{ data: todays }, { data: lastMorning }, { data: meetings }, { data: openDecisions }] = await Promise.all([
    supabase.from('reports').select('*').eq('report_date', today),
    supabase.from('reports').select('*').eq('kind', 'morning').lt('report_date', today).order('report_date', { ascending: false }).limit(1),
    supabase.from('meetings').select('*').gte('starts_at', new Date(Date.now() - 12 * 3600e3).toISOString()).order('starts_at'),
    supabase.from('decisions').select('*').in('status', ['waiting', 'discuss']).order('created_at'),
  ]);
  const rs = (todays ?? []) as Report[];
  const morning = rs.find((r) => r.kind === 'morning') ?? null;
  const eod = rs.find((r) => r.kind === 'eod') ?? null;
  const prev = ((lastMorning ?? [])[0] ?? null) as Report | null;

  const morningStart: ReportData = morning?.data ?? {
    updates: prev?.data.updates ?? [],
    plan: prev?.data.plan ?? [],
    schedule: [],
    sales: prev?.data.sales ?? {},
  };
  const eodStart: ReportData = eod?.data ?? {
    updates: morning?.data.updates ?? [],
    tomorrow: [],
    note: '',
  };

  return (
    <ReportBuilder
      morning={{ data: morningStart, status: morning?.status ?? null, published_at: morning?.published_at ?? null }}
      eod={{ data: eodStart, status: eod?.status ?? null, published_at: eod?.published_at ?? null }}
      salesImageUrl={await signPath(morningStart.sales?.image_path)}
      meetings={(meetings ?? []) as Meeting[]}
      openDecisions={(openDecisions ?? []) as Decision[]}
    />
  );
}
