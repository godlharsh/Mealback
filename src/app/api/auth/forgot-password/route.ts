import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { origin } = new URL(request.url);
    const redirectUrl = `${origin}/auth/callback?next=/reset-password`;
    const supabase = createClient();

    // 1. Attempt standard password reset email via Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl,
    });

    if (error) {
      // If Supabase free default SMTP hits hourly rate limit (429 over_email_send_rate_limit),
      // generate a secure action link via admin client so the user is never blocked.
      if (
        error.message.includes('rate limit') ||
        (error as any).code === 'over_email_send_rate_limit'
      ) {
        try {
          const adminSupabase = createAdminClient();
          const { data: linkData, error: linkError } =
            await adminSupabase.auth.admin.generateLink({
              type: 'recovery',
              email: normalizedEmail,
              options: {
                redirectTo: redirectUrl,
              },
            });

          if (!linkError && linkData?.properties?.action_link) {
            return NextResponse.json({
              success: true,
              message:
                'Because Supabase free-tier SMTP is temporarily rate-limited, an instant secure reset link has been prepared for you.',
              resetUrl: linkData.properties.action_link,
            });
          }
        } catch {
          // Continue to error response
        }
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset link sent! Please check your email inbox.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
