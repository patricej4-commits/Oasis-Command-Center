'use client';

import { useState } from 'react';
import { hourName, type DayStat, type ItemStat, type WeekStat } from '@/lib/sales';

export type StoreWeeks = { key: string; name: string; source: string; thisWeek: WeekStat; lastWeek: WeekStat };

const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hourRange = (h: number) => `${hourName(h)} to ${hourName(h + 1)}`;
const itemLine = (i: ItemStat) => `${i.name}: ${i.units} sold, ${money(i.cents)}`;

function Pct({ v, suffix }: { v: number | null; suffix: string }) {
  if (v === null) return null;
  const up = v >= 0;
  return (
    <span className={`pill ${up ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
      {up ? '▲' : '▼'} {Math.abs(v)}% {suffix}
    </span>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-black leading-tight text-oasis sm:text-2xl">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Bars({ week }: { week: WeekStat }) {
  const max = Math.max(1, ...week.days.map((d) => d.cents));
  return (
    <div className="space-y-1.5">
      {week.days.map((d) => {
        const best = week.bestDay?.date === d.date;
        return (
          <div key={d.date} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 font-semibold text-slate-600">{d.label.split(',')[0]} {d.label.split(' ').pop()}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
              <div
                className={`h-full rounded ${best ? 'bg-oasis' : 'bg-oasis/50'}`}
                style={{ width: `${Math.max(2, (d.cents / max) * 100)}%` }}
              />
            </div>
            <span className={`w-20 shrink-0 text-right ${best ? 'font-black text-oasis' : 'font-semibold'}`}>
              {d.orders ? money(d.cents) : 'No data'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DayCard({ d, best }: { d: DayStat; best: boolean }) {
  return (
    <div className={`rounded-xl border-l-4 bg-white p-3 shadow-sm ${best ? 'border-oasis' : 'border-orange-400'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold">{d.label}{best ? ' (best day)' : ''}</p>
        <Pct v={d.vsPrevPct} suffix="vs day before" />
      </div>
      <p className="text-2xl font-black text-oasis">{money(d.cents)}</p>
      <p className="text-xs text-slate-600">
        {d.orders} orders, {d.units} items, avg {money(d.avgOrderCents)}
      </p>
      {d.busiestHour && <p className="text-xs text-slate-600">Busiest hour: {hourName(d.busiestHour.hour)} ({money(d.busiestHour.cents)})</p>}
      {d.bestSeller && <p className="text-xs text-slate-600">Best seller: <b>{d.bestSeller.name} ({d.bestSeller.units} sold)</b></p>}
      <p className="text-xs text-slate-600">Week to date: <b>{money(d.wtdCents)}, {d.wtdOrders} orders</b></p>
      {d.top3.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs">
          {d.top3.map((i) => <li key={i.name} className="flex gap-1.5"><span className="text-orange-500">●</span>{itemLine(i)}</li>)}
        </ul>
      )}
    </div>
  );
}

function StoreWeek({ s, week }: { s: StoreWeeks; week: WeekStat }) {
  const [allDays, setAllDays] = useState(false);
  const withSales = week.days.filter((d) => d.orders > 0).reverse();
  const shown = allDays ? withSales : withSales.slice(0, 3);
  if (week.orders === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm italic text-slate-500">No sales data for {s.name} in this week yet.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label={week.complete ? 'Week total' : 'Week so far'} value={money(week.cents)} sub={`${week.daysWithSales} day(s)`} />
        <Tile label="Orders" value={String(week.orders)} sub={`${week.units} items`} />
        <Tile label="Best day" value={week.bestDay ? week.bestDay.label.split(',')[0] : '-'} sub={week.bestDay ? money(week.bestDay.cents) : ''} />
        <Tile label="Busiest hour" value={week.busiestHour ? hourName(week.busiestHour.hour) : '-'} sub={week.busiestHour ? money(week.busiestHour.cents) + ' in sales' : ''} />
      </div>

      <div className="rounded-xl border-l-4 border-oasis bg-white p-3 text-sm shadow-sm">
        <ul className="space-y-1">
          <li>Sales: <b>{money(week.cents)}</b> from {week.orders} orders, {week.units} items. <Pct v={week.vsLastWeekPct} suffix="vs same days last week" /></li>
          <li>Daily average: {money(week.dailyAvgCents)}; average order {money(week.avgOrderCents)}</li>
          {week.topByUnits.length > 0 && (
            <li>Top sellers: {week.topByUnits.map((i) => `${i.name} (${i.units} sold, ${money(i.cents)})`).join('; ')}</li>
          )}
          {week.topByRevenue && <li>Highest revenue item: <b>{week.topByRevenue.name}</b> ({money(week.topByRevenue.cents)})</li>}
          {week.busiestHour && <li>Busiest hour: {hourRange(week.busiestHour.hour)} ({money(week.busiestHour.cents)} across the week)</li>}
          {week.bestDay && week.slowestDay && (
            <li>Strongest day {week.bestDay.label.split(',')[0]} ({money(week.bestDay.cents)}); slowest {week.slowestDay.label.split(',')[0]} ({money(week.slowestDay.cents)})</li>
          )}
        </ul>
      </div>

      <div className="rounded-xl bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Day by day</p>
        <Bars week={week} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {shown.map((d) => <DayCard key={d.date} d={d} best={week.bestDay?.date === d.date} />)}
      </div>
      {withSales.length > 3 && (
        <button className="text-sm font-bold text-oasis" onClick={() => setAllDays(!allDays)}>
          {allDays ? 'Show fewer days' : `Show all ${withSales.length} days`}
        </button>
      )}
    </div>
  );
}

export default function SalesDashboard({ stores }: { stores: StoreWeeks[] }) {
  const [store, setStore] = useState(stores.find((s) => s.thisWeek.orders || s.lastWeek.orders)?.key ?? stores[0]?.key);
  const s = stores.find((x) => x.key === store) ?? stores[0];
  // Early in the week, default to last week's full picture
  const [which, setWhich] = useState<'this' | 'last'>(s && s.thisWeek.daysWithSales < 2 && s.lastWeek.orders ? 'last' : 'this');
  if (!s) return null;
  const week = which === 'this' ? s.thisWeek : s.lastWeek;

  return (
    <section className="card overflow-hidden">
      <h2 className="section-title bg-oasis">
        <span>Sales at a Glance</span>
      </h2>
      <div className="space-y-3 bg-oasis-light/60 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {stores.map((x) => (
            <button
              key={x.key}
              onClick={() => setStore(x.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${x.key === s.key ? 'bg-oasis text-white' : 'bg-white text-oasis'}`}
            >
              {x.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-oasis">{s.source}</p>
            <p className="text-lg font-extrabold leading-tight">{s.name}: {week.complete ? 'Weekly Sales' : 'Week So Far'}</p>
            <p className="text-xs text-slate-500">Monday to Sunday, {week.label}</p>
          </div>
          <div className="flex rounded-lg bg-white p-0.5 text-xs font-bold">
            <button onClick={() => setWhich('this')} className={`rounded-md px-3 py-1.5 ${which === 'this' ? 'bg-oasis text-white' : 'text-oasis'}`}>This week</button>
            <button onClick={() => setWhich('last')} className={`rounded-md px-3 py-1.5 ${which === 'last' ? 'bg-oasis text-white' : 'text-oasis'}`}>Last week</button>
          </div>
        </div>
        <StoreWeek key={s.key + which} s={s} week={week} />
        <p className="text-[11px] text-slate-500">Item totals are before tax; refunds are subtracted.</p>
      </div>
    </section>
  );
}
