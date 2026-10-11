import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buyTokenAction } from '@/lib/data-service';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to purchase meal tokens.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tokenId } = body;

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required.' }, { status: 400 });
    }

    const result = await buyTokenAction({
      tokenId,
      buyerId: user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, token: result.token });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Payment or purchase failed' },
      { status: 500 }
    );
  }
}
