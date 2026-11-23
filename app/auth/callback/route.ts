import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const supabase = createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash) {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
  }
  return NextResponse.redirect(`${origin}/`);
}
