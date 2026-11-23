'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/patrice', label: 'Inbox', badge: 'inbox' },
  { href: '/patrice/list', label: 'Running List' },
  { href: '/patrice/decisions', label: 'Decisions', badge: 'decisions' },
  { href: '/patrice/report', label: 'Report Builder' },
  { href: '/patrice/checkins', label: 'Team Check-ins' },
  { href: '/patrice/archive', label: 'Archive' },
];

export default function NavLinks({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {LINKS.map((l) => {
        const active = l.href === '/patrice' ? path === '/patrice' : path.startsWith(l.href);
        const n = l.badge ? badges[l.badge] : 0;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative rounded-lg px-3 py-1.5 text-sm font-bold ${active ? 'bg-white text-oasis' : 'text-white hover:bg-white/15'}`}
          >
            {l.label}
            {n > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-black text-white">{n}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
