import { NextResponse } from 'next/server';
import { getMe } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ctHour } from '@/lib/sales';
import { ctToday } from '@/lib/time';
import { emptyDay, type DayRollup } from '@/lib/csv';
import { upsertSalesDays } from '@/lib/salesStore';

const SQUARE = 'https://connect.squareup.com/v2';
const VERSION = '2024-10-17';

type Money = { amount?: number };
type LineItem = { name?: string; variation_name?: string; quantity?: string; total_money?: Money };
type Order = { id: string; closed_at?: string; created_at?: string; total_money?: Money; line_items?: LineItem[] };

async function sq(path: string, token: string, body?: unknown) {
  const res = await fetch(SQUARE + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Square-Version': VERSION, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail || json?.errors?.[0]?.code || res.statusText;
    throw new Error(`Square said: ${detail} (${res.status})`);
  }
  return json;
}

/**
 * Pulls completed Square orders for the last 9 days and stores daily totals.
 * Only Patrice can run it (it writes with her session, so database rules apply).
 */
export async function POST() {
  const me = await getMe();
  if (!me || me.role !== 'patrice') return NextResponse.json({ ok: false, error: 'Only Patrice can sync sales.' }, { status: 403 });

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Square is not connected yet. Add SQUARE_ACCESS_TOKEN in Vercel.' }, { status: 400 });
  }

  try {
    // Which Square location(s) to read. SQUARE_LOCATION_ID can pin it to Sugar Llamas.
    const locs = await sq('/locations', token);
    const all: { id: string; name: string; status: string }[] = locs.locations ?? [];
    const pinned = process.env.SQUARE_LOCATION_ID;
    const use = pinned ? all.filter((l) => l.id === pinned) : all.filter((l) => l.status === 'ACTIVE');
    if (use.length === 0) throw new Error('No matching Square location found.');

    const end = new Date();
    const start = new Date(end.getTime() - 9 * 24 * 3600 * 1000);
    const orders: Order[] = [];
    let cursor: string | undefined;
    do {
      const page = await sq('/orders/search', token, {
        location_ids: use.map((l) => l.id),
        cursor,
        limit: 500,
        query: {
          filter: {
            date_time_filter: { closed_at: { start_at: start.toISOString(), end_at: end.toISOString() } },
            state_filter: { states: ['COMPLETED'] },
          },
          sort: { sort_field: 'CLOSED_AT', sort_order: 'ASC' },
        },
      });
      orders.push(...(page.orders ?? []));
      cursor = page.cursor;
    } while (cursor);

    // Roll up by Central Time day
    const days = new Map<string, DayRollup>();
    for (const o of orders) {
      const when = new Date(o.closed_at || o.created_at || Date.now());
      const date = ctToday(when);
      const d = days.get(date) ?? emptyDay(date);
      const orderCents = o.total_money?.amount ?? 0;
      d.total_cents += orderCents;
      d.orders += 1;
      const h = String(ctHour(when));
      d.hours[h] = (d.hours[h] || 0) + 1;
      d.hour_revenue[h] = (d.hour_revenue[h] || 0) + orderCents;
      for (const li of o.line_items ?? []) {
        const name = [li.name, li.variation_name && li.variation_name !== 'Regular' ? li.variation_name : '']
          .filter(Boolean).join(' ') || 'Item';
        const q = Number(li.quantity || 1);
        d.units += q;
        d.items[name] = (d.items[name] || 0) + q;
        d.item_revenue[name] = (d.item_revenue[name] || 0) + (li.total_money?.amount ?? 0);
      }
      days.set(date, d);
    }

    const rows = Array.from(days.values());
    if (rows.length) await upsertSalesDays(createClient(), 'sugar', rows, 'square');
    return NextResponse.json({
      ok: true,
      orders: orders.length,
      days: rows.length,
      locations: use.map((l) => l.name),
      allLocations: all.map((l) => ({ id: l.id, name: l.name })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Sync failed.' }, { status: 500 });
  }
}
