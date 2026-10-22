import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash') || searchParams.get('token');
  const type = (searchParams.get('type') as EmailOtpType) || 'email';
  const next = searchParams.get('next') ?? '/marketplace';

  const supabase = createClient();

  // 1. PKCE Authorization Code Exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 2. Token Hash / OTP Verification (Email verification, password recovery, invite)
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to login with error parameter
  return NextResponse.redirect(
    `${origin}/login?error=Authentication%20verification%20link%20is%20invalid%20or%20expired`
  );
}
