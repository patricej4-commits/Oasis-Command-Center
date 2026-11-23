import { CT, ctToday } from '@/lib/time';
import type { SalesBlock } from '@/lib/types';

export type SalesDay = {
  store: 'sugar' | 'jwo';
  sale_date: string;
  total_cents: number;
  orders: number;
  items: Record<string, number>;
  hours: Record<string, number>;
  source?: string | null;
  synced_at?: string;
};

/** Hour (0 to 23) of a timestamp in Central Time. */
export function ctHour(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: CT, hour: 'numeric', hourCycle: 'h23' }).format(d));
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}

/** Monday of the week containing the given date (weeks run Monday to Sunday). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0 Sun .. 6 Sat
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

const money = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function hourLabel(h: number) {
  const f = (x: number) => (x % 12 === 0 ? 12 : x % 12) + (x < 12 || x === 24 ? ' AM' : ' PM');
  return `${f(h)} to ${f(h + 1)}`;
}

function merge(target: Record<string, number>, src: Record<string, number>) {
  for (const [k, v] of Object.entries(src || {})) target[k] = (target[k] || 0) + Number(v || 0);
}

function top(rec: Record<string, number>): string | null {
  let best: string | null = null;
  let max = -1;
  for (const [k, v] of Object.entries(rec)) if (v > max) { max = v; best = k; }
  return best;
}

/**
 * Builds the four numbers shown on a sales card from stored daily totals.
 * Yesterday = the day before today (Central). Week to date = Monday through today.
 * Best seller and busiest hour are measured over the week so far.
 */
export function salesBlock(days: SalesDay[], store: 'sugar' | 'jwo', today = ctToday()): SalesBlock | null {
  const mine = days.filter((d) => d.store === store);
  if (mine.length === 0) return null;
  const unit = store === 'sugar' ? 'sales' : 'orders';
  const yesterday = addDays(today, -1);
  const monday = weekStart(today);

  const y = mine.find((d) => d.sale_date === yesterday);
  let wtdCents = 0, wtdOrders = 0;
  const items: Record<string, number> = {};
  const hours: Record<string, number> = {};
  // If the week has only just started, fall back to the last 7 days for best seller and busy hour.
  const statsFrom = monday === today ? addDays(today, -7) : monday;
  for (const d of mine) {
    if (d.sale_date >= monday && d.sale_date <= today) {
      wtdCents += Number(d.total_cents);
      wtdOrders += d.orders;
    }
    if (d.sale_date >= statsFrom && d.sale_date <= today) {
      merge(items, d.items);
      merge(hours, d.hours);
    }
  }
  const bestItem = top(items);
  const busy = top(hours);
  return {
    yesterday: y ? `${money(Number(y.total_cents))} (${y.orders} ${unit})` : 'No data',
    wtd: `${money(wtdCents)} (${wtdOrders} ${unit})`,
    best: bestItem ? `${bestItem} (${items[bestItem]})` : '',
    busiest: busy !== null ? hourLabel(Number(busy)) : '',
  };
}

export function periodLabel(today = ctToday()): string {
  const monday = weekStart(today);
  const fmt = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  };
  return `Week of ${fmt(monday)} to ${fmt(addDays(monday, 6))}`;
}
