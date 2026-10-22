import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listMealTokenAction } from '@/lib/data-service';
import { PRICING_CONFIG, TIMING_CONFIG } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to list a meal.' },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminClient();

    // Verify user role
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || user.user_metadata?.role;
    if (role !== 'student') {
      return NextResponse.json(
        { error: 'Only registered hostel students can list meals for exchange.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { messId, mealType, mealDate, mealTime, listPrice } = body;

    if (!messId || !mealType || !mealDate || !mealTime) {
      return NextResponse.json(
        { error: 'All meal details (mess, meal type, date, serving time) are required.' },
        { status: 400 }
      );
    }

    // Verify selected mess exists and is valid
    const { data: messRecord, error: messErr } = await adminSupabase
      .from('messes')
      .select('id, name')
      .eq('id', messId)
      .single();

    if (messErr || !messRecord) {
      if (
        messErr?.code === 'PGRST205' ||
        messErr?.message?.includes('schema cache') ||
        messErr?.message?.includes('public.messes')
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
        { error: 'The selected mess does not exist or has not been registered yet. Please select a valid registered mess.' },
        { status: 400 }
      );
    }

    // Validate meal type
    if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return NextResponse.json(
        { error: 'Invalid meal type. Must be breakfast, lunch, or dinner.' },
        { status: 400 }
      );
    }

    // Validate price
    const parsedPrice = Number(listPrice);
    if (
      isNaN(parsedPrice) ||
      parsedPrice < PRICING_CONFIG.MIN_PRICE ||
      parsedPrice > PRICING_CONFIG.MAX_PRICE
    ) {
      return NextResponse.json(
        {
          error: `Asking price must be a valid number between ₹${PRICING_CONFIG.MIN_PRICE} and ₹${PRICING_CONFIG.MAX_PRICE}.`,
        },
        { status: 400 }
      );
    }

    // Validate cutoff: meal must be at least CUTOFF_HOURS_BEFORE in the future
    const mealDateTime = new Date(`${mealDate}T${mealTime}`);
    const cutoffDateTime = new Date(
      mealDateTime.getTime() - TIMING_CONFIG.CUTOFF_HOURS_BEFORE * 60 * 60 * 1000
    );

    if (new Date() >= cutoffDateTime) {
      return NextResponse.json(
        {
          error: `Cutoff time has already passed! Meals must be listed at least ${TIMING_CONFIG.CUTOFF_HOURS_BEFORE} hours before serving time.`,
        },
        { status: 400 }
      );
    }

    const result = await listMealTokenAction({
      sellerId: user.id,
      messId,
      mealType,
      mealDate,
      mealTime,
      listPrice: parsedPrice,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tokenId: result.tokenId,
      message: `Meal successfully listed for ₹${parsedPrice}!`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
