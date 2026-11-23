export const CT = 'America/Chicago';
export const JAMAICA = 'America/Jamaica';

/** Today's date in Central Time as YYYY-MM-DD. */
export function ctToday(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '';
  // Plain dates (YYYY-MM-DD) are shown as calendar dates, not shifted by time zone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
      timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
    });
  }
  return new Date(value).toLocaleDateString('en-US', { timeZone: CT, month: 'short', day: 'numeric' });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    timeZone: CT, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) + ' CT';
}

export function fmtTime(value: string, tz = CT): string {
  return new Date(value).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
}

export function fmtLongToday(): string {
  return new Date().toLocaleDateString('en-US', { timeZone: CT, weekday: 'long', month: 'long', day: 'numeric' });
}

/** Convert a datetime-local value entered as Central Time into an ISO string. */
export function ctLocalToIso(local: string): string {
  // local = YYYY-MM-DDTHH:mm, interpreted in America/Chicago
  const [datePart, timePart] = local.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(new Date(guess), CT);
  return new Date(guess - offset * 60000).toISOString();
}

function tzOffsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (asUtc - date.getTime()) / 60000;
}
