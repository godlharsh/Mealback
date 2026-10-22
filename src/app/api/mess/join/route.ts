import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to join a mess.' },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminClient();

    // Verify authenticated user profile
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile?.is_mess_manager && profile?.mess_id) {
      return NextResponse.json(
        { error: 'You are registered as the manager of a mess. Managers cannot join another mess as staff.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { accessCode } = body;

    if (!accessCode || !accessCode.trim()) {
      return NextResponse.json(
        { error: 'Mess Access Code is required.' },
        { status: 400 }
      );
    }

    const code = accessCode.trim().toUpperCase();

    // Find mess by access code and verify it is active
    const { data: mess, error: findError } = await adminSupabase
      .from('messes')
      .select('*')
      .eq('access_code', code)
      .eq('is_active', true)
      .single();

    if (findError) {
      if (
        findError.code === 'PGRST205' ||
        findError.message.includes('schema cache') ||
        findError.message.includes('public.messes')
      ) {
        return NextResponse.json(
          {
            error:
              "The 'public.messes' table has not been initialized in your Supabase database yet. Please run the migration script (supabase/schema.sql) in your Supabase Dashboard SQL Editor.",
            code: 'SCHEMA_NOT_INITIALIZED',
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error:
            'Invalid access code. No active mess found matching this code. Please verify the code with your mess manager.',
        },
        { status: 404 }
      );
    }

    if (!mess) {
      return NextResponse.json(
        {
          error:
            'Invalid access code. No active mess found matching this code. Please verify the code with your mess manager.',
        },
        { status: 404 }
      );
    }

    // Link staff member to this mess securely
    const { error: updateError } = await adminSupabase
      .from('profiles')
      .update({
        mess_id: mess.id,
        is_mess_manager: false,
        role: 'mess',
      })
      .eq('id', user.id);

    try {
      await adminSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          role: 'mess',
        },
      });
    } catch {
      // Continue
    }

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update profile with mess.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mess,
      message: `Successfully joined ${mess.name}!`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
