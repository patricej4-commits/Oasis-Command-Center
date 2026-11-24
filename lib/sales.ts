import { CT, ctToday } from '@/lib/time';
import type { SalesBlock } from '@/lib/types';

export type SalesDay = {
  store: 'sugar' | 'jwo';
  sale_date: string;
  total_cents: number;
  orders: number;
  items: Record<string, number>;
  hours: Record<string, number>;
  units?: number;
  item_revenue?: Record<string, number>;
  hour_revenue?: Record<string, number>;
  source?: string | null;
  synced_at?: string;
};

// ---------------------------------------------------------------- Weekly dashboard

export type ItemStat = { name: string; units: number; cents: number };
export type DayStat = {
  date: string;
  label: string;          // "Fri, Nov 20"
  cents: number;
  orders: number;
  units: number;
  avgOrderCents: number;
  busiestHour: { hour: number; cents: number } | null;
  bestSeller: ItemStat | null;
  top3: ItemStat[];
  wtdCents: number;
  wtdOrders: number;
  vsPrevPct: number | null; // change vs the day before, in percent
};
export type WeekStat = {
  start: string;
  end: string;
  label: string;           // "Nov 16 to 22, 2026"
  complete: boolean;
  cents: number;
  orders: number;
  units: number;
  daysWithSales: number;
  dailyAvgCents: number;
  avgOrderCents: number;
  bestDay: DayStat | null;
  slowestDay: DayStat | null;
  busiestHour: { hour: number; cents: number } | null;
  topByUnits: ItemStat[];
  topByRevenue: ItemStat | null;
  days: DayStat[];          // Monday to Sunday (only days up to today)
  vsLastWeekPct: number | null; // same days last week
};

export function hourName(h: number) {
  const f = (x: number) => (x % 12 === 0 ? 12 : x % 12) + (x % 24 < 12 ? ' AM' : ' PM');
  return f(h);
}

function sumRec(target: Record<string, number>, src?: Record<string, number>) {
  for (const [k, v] of Object.entries(src || {})) target[k] = (target[k] || 0) + Number(v || 0);
}

function items(units: Record<string, number>, rev: Record<string, number>): ItemStat[] {
  const names = new Set([...Object.keys(units), ...Object.keys(rev)]);
  return Array.from(names).map((name) => ({ name, units: units[name] || 0, cents: rev[name] || 0 }));
}

function bestHour(rev: Record<string, number>, counts: Record<string, number>) {
  const src = Object.keys(rev).length ? rev : counts;
  let best: { hour: number; cents: number } | null = null;
  for (const [h, v] of Object.entries(src)) if (!best || v > best.cents) best = { hour: Number(h), cents: Number(rev[h] || 0) };
  return best;
}

const byUnits = (a: ItemStat, b: ItemStat) => b.units - a.units || b.cents - a.cents;

function dayLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}

/** Full summary of one store's week (Monday to Sunday) that contains `anyDate`. */
export function weekStat(all: SalesDay[], store: 'sugar' | 'jwo', anyDate: string, today = ctToday()): WeekStat {
  const start = weekStart(anyDate);
  const end = addDays(start, 6);
  const mine = all.filter((d) => d.store === store);
  const byDate = new Map(mine.map((d) => [d.sale_date, d]));
  const weekUnits: Record<string, number> = {};
  const weekRev: Record<string, number> = {};
  const weekHourRev: Record<string, number> = {};
  const weekHourCount: Record<string, number> = {};
  const days: DayStat[] = [];
  let wtdCents = 0, wtdOrders = 0, prevCents: number | null = null;

  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    if (date > today) break;
    const d = byDate.get(date);
    const cents = d ? Number(d.total_cents) : 0;
    const orders = d?.orders ?? 0;
    const units = d ? (d.units ?? Object.values(d.items || {}).reduce((a, b) => a + Number(b), 0)) : 0;
    wtdCents += cents;
    wtdOrders += orders;
    const list = d ? items(d.items || {}, d.item_revenue || {}).sort(byUnits) : [];
    days.push({
      date, label: dayLabel(date), cents, orders, units,
      avgOrderCents: orders ? Math.round(cents / orders) : 0,
      busiestHour: d ? bestHour(d.hour_revenue || {}, d.hours || {}) : null,
      bestSeller: list[0] ?? null,
      top3: list.slice(0, 3),
      wtdCents, wtdOrders,
      vsPrevPct: prevCents && d ? Math.round(((cents - prevCents) / prevCents) * 100) : null,
    });
    if (d) {
      sumRec(weekUnits, d.items); sumRec(weekRev, d.item_revenue);
      sumRec(weekHourRev, d.hour_revenue); sumRec(weekHourCount, d.hours);
      prevCents = cents;
    } else prevCents = null;
  }

  const withSales = days.filter((d) => d.orders > 0);
  const all7 = items(weekUnits, weekRev);
  const units = days.reduce((a, d) => a + d.units, 0);
  // Same days of the previous week, for a fair comparison
  let lastWeekSame = 0;
  for (const d of days) lastWeekSame += Number(byDate.get(addDays(d.date, -7))?.total_cents ?? 0);
  const fmt = (s: string, withYear = false) => {
    const [y, m, dd] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, dd, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
  };
  return {
    start, end,
    label: `${fmt(start)} to ${fmt(end, true)}`,
    complete: today > end,
    cents: wtdCents, orders: wtdOrders, units,
    daysWithSales: withSales.length,
    dailyAvgCents: withSales.length ? Math.round(wtdCents / withSales.length) : 0,
    avgOrderCents: wtdOrders ? Math.round(wtdCents / wtdOrders) : 0,
    bestDay: withSales.length ? withSales.reduce((a, b) => (b.cents > a.cents ? b : a)) : null,
    slowestDay: withSales.length > 1 ? withSales.reduce((a, b) => (b.cents < a.cents ? b : a)) : null,
    busiestHour: bestHour(weekHourRev, weekHourCount),
    topByUnits: [...all7].sort(byUnits).slice(0, 5),
    topByRevenue: all7.length ? all7.reduce((a, b) => (b.cents > a.cents ? b : a)) : null,
    days,
    vsLastWeekPct: lastWeekSame ? Math.round(((wtdCents - lastWeekSame) / lastWeekSame) * 100) : null,
  };
}

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
