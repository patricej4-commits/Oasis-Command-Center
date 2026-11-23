import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import RealtimeRefresh from '@/components/RealtimeRefresh';
import Clocks from './Clocks';
import NavLinks from './NavLinks';

export const dynamic = 'force-dynamic';

export default async function PatriceLayout({ children }: { children: React.ReactNode }) {
  await requireMe('patrice');
  const supabase = createClient();
  const [{ count: newReqs }, { count: unseen }, { count: waiting }] = await Promise.all([
    supabase.from('task_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('decisions').select('id', { count: 'exact', head: true }).eq('seen_by_patrice', false),
    supabase.from('decisions').select('id', { count: 'exact', head: true }).eq('status', 'waiting'),
  ]);

  return (
    <div className="min-h-screen">
      <RealtimeRefresh tables={['task_requests', 'decisions', 'decision_replies', 'meetings']} />
      <header className="sticky top-0 z-30 bg-oasis text-white shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/patrice" className="leading-tight">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-green-200">Oasis Fresh Market</span>
            <span className="block text-lg font-extrabold">Command Center</span>
          </Link>
          <NavLinks badges={{ inbox: (newReqs ?? 0) + (unseen ?? 0), decisions: waiting ?? 0 }} />
          <div className="ml-auto flex items-center gap-4">
            <Clocks />
            <Link href="/aj" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25">AJ view</Link>
            <form action="/auth/signout" method="post">
              <button className="text-xs text-green-100 hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
