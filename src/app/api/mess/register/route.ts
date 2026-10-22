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
        { error: 'You must be signed in to register a mess.' },
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

    // Prevent user from registering multiple messes if they already manage an active one
    if (profile?.is_mess_manager && profile?.mess_id) {
      return NextResponse.json(
        { error: 'You are already registered as the manager of an active mess.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, location } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Mess name is required.' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedLocation = (location || '').trim();

    // Check for duplicate mess name
    try {
      const { data: duplicateMess } = await adminSupabase
        .from('messes')
        .select('id, name')
        .ilike('name', trimmedName)
        .eq('is_active', true)
        .limit(1);

      if (duplicateMess && duplicateMess.length > 0) {
        return NextResponse.json(
          { error: `A mess named '${trimmedName}' is already registered and active.` },
          { status: 409 }
        );
      }
    } catch {
      // Continue to insert if query fails
    }

    // Generate unique random access code: e.g. MESS-8492
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
    const accessCode = `MESS-${randomNum}${randomSuffix}`;

    // Insert mess record into Supabase PostgreSQL
    const { data: newMess, error: insertError } = await adminSupabase
      .from('messes')
      .insert({
        name: trimmedName,
        location: trimmedLocation || null,
        access_code: accessCode,
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (
        insertError.code === 'PGRST205' ||
        insertError.message.includes('schema cache') ||
        insertError.message.includes('public.messes')
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

      if (insertError.message.includes('unique') || insertError.code === '23505') {
        return NextResponse.json(
          { error: `A mess named '${trimmedName}' is already registered.` },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: insertError.message || 'Failed to register mess in database.' },
        { status: 500 }
      );
    }

    // Securely associate the authorized manager with the new mess
    try {
      await adminSupabase
        .from('profiles')
        .update({
          mess_id: newMess.id,
          is_mess_manager: true,
          role: 'mess',
        })
        .eq('id', user.id);

      await adminSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          role: 'mess',
        },
      });
    } catch {
      // Continue
    }

    return NextResponse.json({
      success: true,
      mess: newMess,
      message: `Mess '${trimmedName}' successfully registered!`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
