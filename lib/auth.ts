import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/types';

export async function getMe(): Promise<{ email: string; role: Role; name: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from('allowed_users').select('role, display_name').ilike('email', user.email).maybeSingle();
  if (!data) return null;
  return { email: user.email, role: data.role as Role, name: data.display_name };
}

export async function requireMe(role?: Role) {
  const me = await getMe();
  if (!me) redirect('/login?error=notallowed');
  if (role && me.role !== role) redirect(me.role === 'aj' ? '/aj' : '/patrice');
  return me;
}
