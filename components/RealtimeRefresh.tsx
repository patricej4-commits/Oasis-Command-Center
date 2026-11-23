'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Refreshes server data whenever one of the watched tables changes. */
export default function RealtimeRefresh({ tables, onEvent }: { tables: string[]; onEvent?: (table: string, payload: unknown) => void }) {
  const router = useRouter();
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('oasis-' + tables.join('-'));
    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        onEvent?.(table, payload);
        if (pending.current) clearTimeout(pending.current);
        pending.current = setTimeout(() => router.refresh(), 400);
      });
    });
    channel.subscribe();

    // Also refresh when the app comes back to the foreground (phones pause sockets)
    const onVisible = () => document.visibilityState === 'visible' && router.refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(',')]);

  return null;
}
