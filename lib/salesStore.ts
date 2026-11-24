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
  const existing = new Map<string, DayRollup>();
  if (refundOnly.length) {
    const { data, error } = await db
      .from('sales_days')
      .select('sale_date,total_cents,orders,units,items,item_revenue,hours,hour_revenue')
      .eq('store', store)
      .in('sale_date', refundOnly.map((d) => d.sale_date));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) existing.set(r.sale_date, r as DayRollup);
  }
  const rows = days.map((d) => {
    const prev = d.orders === 0 ? existing.get(d.sale_date) : undefined;
    let base: DayRollup = d;
    if (prev) {
      const item_revenue = { ...(prev.item_revenue || {}) };
      for (const [k, v] of Object.entries(d.item_revenue)) item_revenue[k] = (item_revenue[k] || 0) + v;
      base = { ...prev, sale_date: d.sale_date, total_cents: Number(prev.total_cents) + d.total_cents, item_revenue };
    }
    return { ...base, store, source, synced_at: new Date().toISOString() };
  });
  const { error } = await db.from('sales_days').upsert(rows, { onConflict: 'store,sale_date' });
  if (error) throw new Error(error.message);
  return rows.map((r) => ({ date: r.sale_date, total: (r.total_cents / 100).toFixed(2), orders: r.orders }));
}
