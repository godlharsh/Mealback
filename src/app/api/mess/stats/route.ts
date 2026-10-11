import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessStats } from '@/lib/data-service';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, mess_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'mess' || !profile.mess_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || undefined;

    const stats = await getMessStats(profile.mess_id, dateStr);
    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch mess stats' },
      { status: 500 }
    );
  }
}
