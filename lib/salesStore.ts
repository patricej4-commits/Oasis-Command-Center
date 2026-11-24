import type { SupabaseClient } from '@supabase/supabase-js';
import type { DayRollup } from '@/lib/csv';

/**
 * Saves daily totals. A day that has sales in this upload replaces what was stored.
 * A day that only has refunds (no orders) is added to what is already stored,
 * so uploading a Refund file on its own never wipes out that day's sales.
 */
export async function upsertSalesDays(db: SupabaseClient, store: 'sugar' | 'jwo', days: DayRollup[], source: string) {
  if (!days.length) throw new Error('No sales rows were found.');
  const refundOnly = days.filter((d) => d.orders === 0);
  const existing = new Map<string, { total_cents: number; orders: number; items: Record<string, number>; hours: Record<string, number> }>();
  if (refundOnly.length) {
    const { data, error } = await db
      .from('sales_days')
      .select('sale_date,total_cents,orders,items,hours')
      .eq('store', store)
      .in('sale_date', refundOnly.map((d) => d.sale_date));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) existing.set(r.sale_date, r);
  }
  const rows = days.map((d) => {
    const prev = d.orders === 0 ? existing.get(d.sale_date) : undefined;
    const base = prev
      ? { ...d, total_cents: Number(prev.total_cents) + d.total_cents, orders: prev.orders, items: prev.items, hours: prev.hours }
      : d;
    return { ...base, store, source, synced_at: new Date().toISOString() };
  });
  const { error } = await db.from('sales_days').upsert(rows, { onConflict: 'store,sale_date' });
  if (error) throw new Error(error.message);
  return rows.map((r) => ({ date: r.sale_date, total: (r.total_cents / 100).toFixed(2), orders: r.orders }));
}
