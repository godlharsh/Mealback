import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !email.trim() || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createClient();

    // 1. Attempt authentication with Supabase Auth signInWithPassword
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    // 2. If authentication failed, diagnose the exact cause from Supabase Auth
    if (error) {
      // Check for direct email confirmation error from Supabase
      if (
        error.message.toLowerCase().includes('email not confirmed') ||
        (error as any).code === 'email_not_confirmed'
      ) {
        return NextResponse.json(
          {
            error:
              'Your email address has not been verified yet. Please check your inbox for the confirmation link or click "Resend verification" below.',
          },
          { status: 403 }
        );
      }

      // Check user record in Supabase Auth to distinguish wrong password vs unconfirmed email vs nonexistent user
      try {
        const adminSupabase = createAdminClient();
        const { data: userList } = await adminSupabase.auth.admin.listUsers();
        const existingUser = userList?.users?.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );

        if (!existingUser) {
          return NextResponse.json(
            { error: 'No account found with this email address. Please create an account first.' },
            { status: 404 }
          );
        }

        // Check native Supabase Auth email_confirmed_at timestamp
        if (!existingUser.email_confirmed_at) {
          return NextResponse.json(
            {
              error:
                'Your email address has not been verified yet. Please check your inbox for the verification link or click "Resend verification" below.',
            },
            { status: 403 }
          );
        }

        // Email IS confirmed, but signInWithPassword rejected the password
        return NextResponse.json(
          {
            error:
              'Incorrect password for this account. Please verify your password or use "Forgot Password" to set a new password.',
          },
          { status: 401 }
        );
      } catch {
        // Fallback to the raw Supabase error message
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }

    if (!data?.user) {
      return NextResponse.json({ error: 'Failed to authenticate user.' }, { status: 401 });
    }

    // Determine user role from profile or user_metadata
    let role = data.user.user_metadata?.role || 'student';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role) {
        role = profile.role;
      }
    } catch {
      // Retain metadata role
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      role,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
