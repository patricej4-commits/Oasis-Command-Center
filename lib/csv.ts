import { ctToday } from '@/lib/time';
import { ctHour } from '@/lib/sales';

/** Minimal CSV parser that handles quoted fields, commas and new lines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export type ColumnGuess = { date: number; order: number; item: number; qty: number; amount: number };

function find(headers: string[], patterns: RegExp[], exclude: RegExp[] = []): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h) && !exclude.some((x) => x.test(h)));
    if (i >= 0) return i;
  }
  return -1;
}

/** Guesses which columns hold the date, order id, item, quantity and amount. */
export function guessColumns(headerRow: string[]): ColumnGuess {
  const h = headerRow.map((x) => x.trim().toLowerCase());
  return {
    date: find(h, [/^(order|transaction|purchase|sale|trip).*(date|time)/, /date.*time|timestamp/, /date/, /time/]),
    order: find(h, [/^(order|transaction|trip|receipt|shopping).*(id|number|#)/, /order/, /transaction/, /trip/], [/date|time|total|amount/]),
    item: find(h, [/item.*(name|description|title)/, /product.*(name|description|title)/, /^(item|product|description|title|name)$/, /item|product/], [/id$|sku|upc|asin|qty|quantity|price|amount/]),
    qty: find(h, [/quantity|qty|units|count/]),
    amount: find(h, [/(net|gross|total).*(sales|amount|price|charged)/, /^(total|amount|sales|charged|subtotal)$/, /total|amount|sales|charged|price/], [/tax|discount|refund|unit price/]),
  };
}

function toCents(v: string): number {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function toDate(v: string): Date | null {
  const t = v.trim();
  if (!t) return null;
  // A plain date (no time) is treated as that calendar day at noon Central-ish
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(t + 'T17:00:00Z');
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

export type DayRollup = { sale_date: string; total_cents: number; orders: number; items: Record<string, number>; hours: Record<string, number> };

/** Rolls report lines up into daily totals (Central Time). */
export function rollup(rows: string[][], cols: ColumnGuess): { days: DayRollup[]; skipped: number } {
  const days = new Map<string, DayRollup & { orderIds: Set<string>; orderHour: Map<string, number> }>();
  let skipped = 0;
  rows.forEach((r, idx) => {
    const when = cols.date >= 0 ? toDate(r[cols.date] ?? '') : null;
    if (!when) { skipped++; return; }
    const date = ctToday(when);
    const d = days.get(date) ?? { sale_date: date, total_cents: 0, orders: 0, items: {}, hours: {}, orderIds: new Set(), orderHour: new Map() };
    const id = cols.order >= 0 ? (r[cols.order] || `row${idx}`) : `row${idx}`;
    if (cols.amount >= 0) d.total_cents += toCents(r[cols.amount] ?? '');
    if (!d.orderIds.has(id)) {
      d.orderIds.add(id);
      const h = String(ctHour(when));
      d.hours[h] = (d.hours[h] || 0) + 1;
    }
    if (cols.item >= 0) {
      const name = (r[cols.item] || '').trim();
      if (name) d.items[name] = (d.items[name] || 0) + (cols.qty >= 0 ? Number(r[cols.qty]) || 1 : 1);
    }
    days.set(date, d);
  });
  return {
    days: Array.from(days.values()).map(({ orderIds, orderHour: _o, ...d }) => ({ ...d, orders: orderIds.size })),
    skipped,
  };
}
