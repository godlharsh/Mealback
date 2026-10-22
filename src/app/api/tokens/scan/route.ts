import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanTokenAction } from '@/lib/data-service';
import { ScanResult } from '@/types/database';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { result: 'INVALID', message: 'Unauthorized. Please sign in as mess staff.' } as ScanResult,
        { status: 401 }
      );
    }

    // Get staff profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, mess_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'mess' || !profile.mess_id) {
      return NextResponse.json(
        {
          result: 'INVALID',
          message: 'Only authorized mess staff linked to a mess can verify tokens.',
        } as ScanResult,
        { status: 403 }
      );
    }

    const body = await request.json();
    const { identifier } = body;

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return NextResponse.json(
        {
          result: 'INVALID',
          message: 'Please provide a valid QR code or enter a short code.',
        } as ScanResult,
        { status: 400 }
      );
    }

    const result = await scanTokenAction({
      identifier: identifier.trim(),
      messId: profile.mess_id,
      staffId: user.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        result: 'INVALID',
        message: err.message || 'Scan verification error occurred',
      } as ScanResult,
      { status: 500 }
    );
  }
}
