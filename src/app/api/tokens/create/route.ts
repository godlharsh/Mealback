import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listMealTokenAction } from '@/lib/data-service';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { messId, mealType, mealDate, mealTime, listPrice } = body;

    if (!messId || !mealType || !mealDate || !mealTime) {
      return NextResponse.json(
        { error: 'All meal details (mess, meal type, date, time) are required.' },
        { status: 400 }
      );
    }

    const result = await listMealTokenAction({
      sellerId: user.id,
      messId,
      mealType,
      mealDate,
      mealTime,
      listPrice: Number(listPrice) || 30,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, tokenId: result.tokenId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
