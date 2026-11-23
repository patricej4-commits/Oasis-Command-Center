'use client';

import { useEffect, useState } from 'react';
import { CT, JAMAICA } from '@/lib/time';

export default function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  const f = (tz: string) => now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  return (
    <div className="text-right leading-tight">
      <span className="block text-base font-extrabold">{f(CT)} CT</span>
      <span className="block text-[11px] text-green-200">Jamaica {f(JAMAICA)}</span>
    </div>
  );
}
