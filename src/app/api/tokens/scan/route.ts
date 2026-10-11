import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanTokenAction } from '@/lib/data-service';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get staff profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, mess_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'mess' || !profile.mess_id) {
      return NextResponse.json(
        { error: 'Only authorized mess staff can scan tokens.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { identifier } = body;

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: 'Token identifier (QR code or short code) is required.' },
        { status: 400 }
      );
    }

    const result = await scanTokenAction({
      identifier,
      messId: profile.mess_id,
      staffId: user.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Scan verification error' },
      { status: 500 }
    );
  }
}
