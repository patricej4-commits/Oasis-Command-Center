import { ctLocalToIso, ctToday } from '@/lib/time';
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

export type ColumnGuess = { date: number; order: number; item: number; qty: number; amount: number; type: number; tz: number };

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
    amount: find(h, [/(net|gross|total).*(sales|amount|price|charged)/, /^(total|amount|sales|charged|subtotal)$/, /total|amount|sales|charged|price/], [/tax|discount|unit price/]),
    type: find(h, [/type_of_transaction|transaction_type|^type$/]),
    tz: find(h, [/^time_?zone$/]),
  };
}

function toCents(v: string): number {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function toDate(v: string): Date | null {
  const t = v.trim();
  if (!t) return null;
  // A plain date (no time) is treated as that calendar day at noon Central
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(ctLocalToIso(t + 'T12:00'));
  // "YYYY-MM-DD HH:MM[:SS]" with no zone: Amazon JWO reports these in Central Time
  const m = t.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?$/);
  if (m) {
    const d = new Date(ctLocalToIso(`${m[1]}T${m[2]}`));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

export type DayRollup = { sale_date: string; total_cents: number; orders: number; items: Record<string, number>; hours: Record<string, number> };

/** Parses several report files (for example the JWO Sales and Refund files) and combines them by day. */
export function rollupFiles(texts: string[]): { days: DayRollup[]; skipped: number; rows: number } {
  const merged = new Map<string, DayRollup>();
  let skipped = 0;
  let rows = 0;
  for (const text of texts) {
    const parsed = parseCsv(text);
    if (parsed.length < 2) continue;
    const cols = guessColumns(parsed[0]);
    if (cols.date < 0 || cols.amount < 0) { skipped += parsed.length - 1; continue; }
    rows += parsed.length - 1;
    const r = rollup(parsed.slice(1), cols);
    skipped += r.skipped;
    for (const d of r.days) {
      const m = merged.get(d.sale_date) ?? { sale_date: d.sale_date, total_cents: 0, orders: 0, items: {}, hours: {} };
      m.total_cents += d.total_cents;
      m.orders += d.orders;
      for (const [k, v] of Object.entries(d.items)) m.items[k] = (m.items[k] || 0) + v;
      for (const [k, v] of Object.entries(d.hours)) m.hours[k] = (m.hours[k] || 0) + v;
      merged.set(d.sale_date, m);
    }
  }
  return { days: Array.from(merged.values()), skipped, rows };
}

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
    const isRefund = cols.type >= 0 && /refund|return/i.test(r[cols.type] ?? '');
    if (cols.amount >= 0) {
      const cents = Math.abs(toCents(r[cols.amount] ?? ''));
      d.total_cents += isRefund ? -cents : cents;
    }
    if (isRefund) { days.set(date, d); return; } // refunds reduce sales but are not new orders
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
