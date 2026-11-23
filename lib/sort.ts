import type { Task } from '@/lib/types';

const P: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const CLOSED = ['Done', 'Cancelled'];

/** Open items first, then by priority, then most recently updated. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ca = CLOSED.includes(a.status) ? 1 : 0;
    const cb = CLOSED.includes(b.status) ? 1 : 0;
    if (ca !== cb) return ca - cb;
    const p = (P[a.priority] ?? 9) - (P[b.priority] ?? 9);
    if (p !== 0) return p;
    return b.last_update.localeCompare(a.last_update);
  });
}
