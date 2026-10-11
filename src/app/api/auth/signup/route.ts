import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { DEMO_CONFIG } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, role, messAccessCode, hostelRoom } = body;

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Email, password, and role are required.' },
        { status: 400 }
      );
    }

    if (!['student', 'buyer', 'mess'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role selected.' }, { status: 400 });
    }

    let linkedMessId: string | null = null;

    // Mess verification: requires access code
    if (role === 'mess') {
      if (!messAccessCode) {
        return NextResponse.json(
          { error: 'Mess Staff registration requires a valid Mess Access Code.' },
          { status: 400 }
        );
      }

      // Check mess code
      const adminSupabase = createAdminClient();
      const { data: messData } = await adminSupabase
        .from('messes')
        .select('id, access_code')
        .eq('access_code', messAccessCode.trim())
        .single();

      if (!messData && messAccessCode.trim() !== DEMO_CONFIG.DEMO_MESS_ACCESS_CODE) {
        return NextResponse.json(
          { error: 'Invalid Mess Access Code. For demo, use MESS-DEMO.' },
          { status: 400 }
        );
      }

      linkedMessId = messData?.id || null;
    }

    // Default mess for students
    if (role === 'student' && !linkedMessId) {
      const adminSupabase = createAdminClient();
      const { data: defaultMess } = await adminSupabase
        .from('messes')
        .select('id')
        .limit(1)
        .single();
      linkedMessId = defaultMess?.id || null;
    }

    // Sign up via Supabase Auth
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user?.id;
    if (userId) {
      // Upsert profile record
      const adminSupabase = createAdminClient();
      await adminSupabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: fullName || null,
        role,
        mess_id: linkedMessId,
        hostel_room: hostelRoom || null,
      });
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
      session: authData.session,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
