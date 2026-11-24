import { ctLocalToIso, ctToday } from '@/lib/time';
import { ctHour } from '@/lib/sales';

/** Minimal CSV parser that handles quoted fields, commas and new lines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  const s = text.replace(/^ï»¿/, '');
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

export type DayRollup = {
  sale_date: string;
  total_cents: number;
  orders: number;
  units: number;
  items: Record<string, number>;        // units sold per item
  item_revenue: Record<string, number>; // cents per item
  hours: Record<string, number>;        // orders per hour (Central)
  hour_revenue: Record<string, number>; // cents per hour (Central)
};

export function emptyDay(sale_date: string): DayRollup {
  return { sale_date, total_cents: 0, orders: 0, units: 0, items: {}, item_revenue: {}, hours: {}, hour_revenue: {} };
}

function add(rec: Record<string, number>, key: string, n: number) {
  rec[key] = (rec[key] || 0) + n;
}

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
      const m = merged.get(d.sale_date) ?? emptyDay(d.sale_date);
      m.total_cents += d.total_cents;
      m.orders += d.orders;
      m.units += d.units;
      for (const [k, v] of Object.entries(d.items)) add(m.items, k, v);
      for (const [k, v] of Object.entries(d.item_revenue)) add(m.item_revenue, k, v);
      for (const [k, v] of Object.entries(d.hours)) add(m.hours, k, v);
      for (const [k, v] of Object.entries(d.hour_revenue)) add(m.hour_revenue, k, v);
      merged.set(d.sale_date, m);
    }
  }
  return { days: Array.from(merged.values()), skipped, rows };
}

/** Rolls report lines up into daily totals (Central Time). Refund lines are subtracted. */
export function rollup(rows: string[][], cols: ColumnGuess): { days: DayRollup[]; skipped: number } {
  const days = new Map<string, DayRollup & { orderIds: Set<string> }>();
  let skipped = 0;
  rows.forEach((r, idx) => {
    const when = cols.date >= 0 ? toDate(r[cols.date] ?? '') : null;
    if (!when) { skipped++; return; }
    const date = ctToday(when);
    const d = days.get(date) ?? { ...emptyDay(date), orderIds: new Set<string>() };
    const id = cols.order >= 0 ? (r[cols.order] || `row${idx}`) : `row${idx}`;
    const isRefund = cols.type >= 0 && /refund|return/i.test(r[cols.type] ?? '');
    const cents = cols.amount >= 0 ? Math.abs(toCents(r[cols.amount] ?? '')) : 0;
    const name = cols.item >= 0 ? (r[cols.item] || '').trim() : '';
    const qty = cols.qty >= 0 ? Math.abs(Number(r[cols.qty]) || 1) : 1;
    const hour = String(ctHour(when));

    if (isRefund) {
      d.total_cents -= cents;
      if (name) add(d.item_revenue, name, -cents);
      days.set(date, d);
      return; // refunds reduce sales but are not new orders
    }
    d.total_cents += cents;
    d.units += qty;
    add(d.hour_revenue, hour, cents);
    if (!d.orderIds.has(id)) {
      d.orderIds.add(id);
      add(d.hours, hour, 1);
    }
    if (name) {
      add(d.items, name, qty);
      add(d.item_revenue, name, cents);
    }
    days.set(date, d);
  });
  return {
    days: Array.from(days.values()).map(({ orderIds, ...d }) => ({ ...d, orders: orderIds.size })),
    skipped,
  };
}
