import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateTokenAction } from '@/lib/data-service';

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
    const { tokenId, messId, mealType, rating, review } = body;

    if (!tokenId || !messId || !mealType || !rating) {
      return NextResponse.json(
        { error: 'Token ID, mess ID, meal type, and rating (1-5) are required.' },
        { status: 400 }
      );
    }

    const result = await rateTokenAction({
      tokenId,
      buyerId: user.id,
      messId,
      mealType,
      rating: Number(rating),
      review,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Rating submission error' },
      { status: 500 }
    );
  }
}
