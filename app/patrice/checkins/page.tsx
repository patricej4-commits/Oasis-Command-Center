import { createClient } from '@/lib/supabase/server';
import Checkins from './Checkins';

export type Member = { id: string; name: string; checkin_time: string | null; sort: number };
export type Note = { id: string; member_id: string; note_date: string; notes: string };

export default async function CheckinsPage() {
  const supabase = createClient();
  const [{ data: members }, { data: notes }] = await Promise.all([
    supabase.from('team_members').select('*').order('sort').order('name'),
    supabase.from('checkin_notes').select('*').order('note_date', { ascending: false }).limit(200),
  ]);
  return <Checkins members={(members ?? []) as Member[]} notes={(notes ?? []) as Note[]} />;
}
