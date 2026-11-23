import { createClient } from '@/lib/supabase/server';
import { BUCKET } from '@/lib/constants';
import type { Attachment } from '@/lib/types';

/** Load attachments for a set of owners and attach 1 hour signed URLs. */
export async function loadAttachments(ownerType: string, ownerIds: string[]): Promise<Record<string, Attachment[]>> {
  const out: Record<string, Attachment[]> = {};
  if (ownerIds.length === 0) return out;
  const supabase = createClient();
  const { data } = await supabase
    .from('attachments')
    .select('*')
    .eq('owner_type', ownerType)
    .in('owner_id', ownerIds)
    .order('created_at');
  const rows = (data ?? []) as Attachment[];
  if (rows.length === 0) return out;
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600);
  rows.forEach((r, i) => {
    r.url = signed?.[i]?.signedUrl ?? null;
    (out[r.owner_id] ||= []).push(r);
  });
  return out;
}

export async function signPath(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
