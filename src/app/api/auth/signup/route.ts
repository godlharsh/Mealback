import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      fullName,
      role,
      isMessManager,
      messName,
      messLocation,
      messAccessCode,
      hostelRoom,
    } = body;

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email address is required.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (!role || !['student', 'buyer', 'mess'].includes(role)) {
      return NextResponse.json(
        { error: 'Please select a valid role (Student, Buyer, or Mess Staff).' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const adminSupabase = createAdminClient();

    let linkedMessId: string | null = null;
    let isManager = false;

    // Mess verification: manager creating new mess vs staff joining with code
    if (role === 'mess') {
      if (isMessManager) {
        if (!messName || !messName.trim()) {
          return NextResponse.json(
            { error: 'Please enter the name of your mess.' },
            { status: 400 }
          );
        }
        isManager = true;
      } else {
        if (!messAccessCode || !messAccessCode.trim()) {
          return NextResponse.json(
            { error: 'Mess staff registration requires a valid Mess Access Code from your mess manager.' },
            { status: 400 }
          );
        }

        try {
          const { data: messData } = await adminSupabase
            .from('messes')
            .select('id, access_code')
            .eq('access_code', messAccessCode.trim().toUpperCase())
            .single();

          if (!messData) {
            return NextResponse.json(
              { error: 'Invalid Mess Access Code. Please verify the code with your mess manager.' },
              { status: 400 }
            );
          }
          linkedMessId = messData.id;
        } catch {
          // If messes table does not exist yet, continue
        }
      }
    }

    // Default mess for students if one exists
    if (role === 'student' && !linkedMessId) {
      try {
        const { data: defaultMess } = await adminSupabase
          .from('messes')
          .select('id')
          .limit(1)
          .single();
        linkedMessId = defaultMess?.id || null;
      } catch {
        // Continue if table not yet created
      }
    }

    // Create user in Supabase Auth via admin client
    // Setting email_confirm: true ensures user is verified and never blocked by free SMTP rate limits
    const { data: createData, error: createError } = await adminSupabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: (fullName || '').trim(),
        role,
      },
    });

    if (createError) {
      if (
        createError.message.includes('already been registered') ||
        createError.message.includes('already registered')
      ) {
        return NextResponse.json(
          {
            error: 'An account with this email address already exists. Please sign in or use Forgot Password to reset it.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const newUser = createData.user;
    const userId = newUser.id;

    // Handle mess creation if manager
    if (role === 'mess' && isManager && userId) {
      const generatedCode = 'MESS-' + Math.floor(1000 + Math.random() * 9000);
      try {
        const { data: newMess } = await adminSupabase
          .from('messes')
          .insert({
            name: messName.trim(),
            location: (messLocation || '').trim(),
            access_code: generatedCode,
            created_by: userId,
          })
          .select()
          .single();

        if (newMess) {
          linkedMessId = newMess.id;
        }
      } catch {
        // Continue if table not yet migrated
      }
    }

    // Try upserting into public.profiles
    try {
      await adminSupabase.from('profiles').upsert({
        id: userId,
        email: normalizedEmail,
        full_name: (fullName || '').trim() || null,
        role,
        mess_id: linkedMessId,
        is_mess_manager: isManager,
        hostel_room: hostelRoom || null,
      });
    } catch {
      // Continue if table not yet migrated
    }

    // Sign in using server client to set session cookies
    const serverSupabase = createClient();
    const { data: signInData } = await serverSupabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    return NextResponse.json({
      success: true,
      user: newUser,
      session: signInData?.session || null,
      role,
      isConfirmed: true,
      message: 'Account created successfully!',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
