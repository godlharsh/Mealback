import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { defaultPaymentProvider } from './payments/demo-upi';
import {
  MarketplaceToken,
  Token,
  WalletEntry,
  ScanResult,
  MealType,
  Mess,
} from '@/types/database';
import { TOKEN_CONFIG } from './constants';

/**
 * Data service handling database queries and atomic RPC functions.
 */

export async function getMesses(): Promise<Mess[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('messes').select('*').order('name');
  if (error || !data || data.length === 0) {
    // Sensible fallback if not seeded yet
    return [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Boys Hostel A Mess',
        location: 'Campus Block 3, North Wing',
        access_code: 'MESS-DEMO',
        created_at: new Date().toISOString(),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Girls Hostel B Mess',
        location: 'Campus Block 7, South Wing',
        access_code: 'MESS-ALT',
        created_at: new Date().toISOString(),
      },
    ];
  }
  return data;
}

export async function getMarketplaceTokens(filter?: {
  mealType?: string;
  messId?: string;
}): Promise<MarketplaceToken[]> {
  const supabase = createClient();
  let query = supabase
    .from('tokens')
    .select(
      `
      id,
      mess_id,
      meal_type,
      meal_date,
      meal_time,
      cutoff_at,
      valid_until,
      face_price,
      list_price,
      status,
      created_at,
      messes (
        name,
        location
      )
    `
    )
    .eq('status', 'listed')
    .gt('cutoff_at', new Date().toISOString())
    .order('meal_date', { ascending: true })
    .order('meal_time', { ascending: true });

  if (filter?.mealType && filter.mealType !== 'all') {
    query = query.eq('meal_type', filter.mealType);
  }
  if (filter?.messId && filter.messId !== 'all') {
    query = query.eq('mess_id', filter.messId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.warn('Marketplace query note:', error?.message);
    return [];
  }

  return data.map((item: any) => ({
    id: item.id,
    mess_id: item.mess_id,
    mess_name: item.messes?.name || 'Hostel Mess',
    mess_location: item.messes?.location || null,
    meal_type: item.meal_type as MealType,
    meal_date: item.meal_date,
    meal_time: item.meal_time,
    cutoff_at: item.cutoff_at,
    valid_until: item.valid_until,
    face_price: Number(item.face_price || 40),
    list_price: Number(item.list_price || 30),
    status: item.status,
    created_at: item.created_at,
  }));
}

export async function getStudentListings(sellerId: string): Promise<Token[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tokens')
    .select('*, messes(*)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }
  return data;
}

export async function getSellerMonthlyCount(sellerId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_seller_monthly_count', {
    p_seller_id: sellerId,
  });

  if (error || typeof data !== 'number') {
    // Direct count fallback
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('tokens')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .neq('status', 'cancelled')
      .gte('created_at', startOfMonth.toISOString());

    return count || 0;
  }
  return data;
}

export async function getStudentWallet(userId: string): Promise<{
  entries: WalletEntry[];
  totalEarnings: number;
  pendingEarnings: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('wallet_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const entries: WalletEntry[] = data || [];
  let totalEarnings = 0;
  let pendingEarnings = 0;

  for (const entry of entries) {
    if (entry.status === 'available' || entry.status === 'paid') {
      totalEarnings += Number(entry.amount);
    } else if (entry.status === 'pending') {
      pendingEarnings += Number(entry.amount);
    }
  }

  return { entries, totalEarnings, pendingEarnings };
}

export async function getBuyerTokens(buyerId: string): Promise<Token[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tokens')
    .select('*, messes(*)')
    .eq('buyer_id', buyerId)
    .order('sold_at', { ascending: false });

  if (error || !data) {
    return [];
  }
  return data;
}

export async function listMealTokenAction(params: {
  sellerId: string;
  messId: string;
  mealType: MealType;
  mealDate: string;
  mealTime: string;
  listPrice?: number;
}): Promise<{ success: boolean; error?: string; tokenId?: string }> {
  const supabase = createClient();

  // Try calling the atomic Postgres RPC function first
  const { data, error } = await supabase.rpc('list_meal_token', {
    p_seller_id: params.sellerId,
    p_mess_id: params.messId,
    p_meal_type: params.mealType,
    p_meal_date: params.mealDate,
    p_meal_time: params.mealTime,
    p_list_price: params.listPrice || TOKEN_CONFIG.LIST_PRICE,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data && data.success) {
    return { success: true, tokenId: data.token_id };
  }

  return { success: false, error: 'Could not list token.' };
}

export async function buyTokenAction(params: {
  tokenId: string;
  buyerId: string;
}): Promise<{ success: boolean; error?: string; token?: any }> {
  // 1. Process simulated UPI payment
  const paymentRes = await defaultPaymentProvider.processPayment({
    tokenId: params.tokenId,
    amount: TOKEN_CONFIG.LIST_PRICE,
    currency: 'INR',
    buyerId: params.buyerId,
    description: `MealBack Token Purchase #${params.tokenId.slice(0, 8)}`,
  });

  if (!paymentRes.success) {
    return { success: false, error: paymentRes.error || 'Payment failed' };
  }

  // 2. Call atomic Postgres function with row lock
  const supabase = createClient();
  const { data, error } = await supabase.rpc('buy_token', {
    p_token_id: params.tokenId,
    p_buyer_id: params.buyerId,
    p_payment_ref: paymentRes.paymentRef,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data && data.success) {
    return { success: true, token: data };
  }

  return { success: false, error: 'Failed to complete token purchase.' };
}

export async function scanTokenAction(params: {
  identifier: string;
  messId: string;
  staffId: string;
}): Promise<ScanResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('verify_and_use_token', {
    p_identifier: params.identifier,
    p_mess_id: params.messId,
    p_staff_id: params.staffId,
  });

  if (error) {
    return {
      result: 'INVALID',
      message: error.message,
    };
  }

  return data as ScanResult;
}

export async function getMessStats(messId: string, dateStr?: string) {
  const supabase = createClient();
  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase.rpc('get_mess_stats', {
    p_mess_id: messId,
    p_date: targetDate,
  });

  if (error || !data) {
    // Direct count fallback
    const { data: tokens } = await supabase
      .from('tokens')
      .select('*')
      .eq('mess_id', messId)
      .eq('meal_date', targetDate);

    const list = tokens || [];
    const listed = list.filter((t) => t.status === 'listed').length;
    const sold = list.filter((t) => t.status === 'sold').length;
    const used = list.filter((t) => t.status === 'used').length;

    return {
      date: targetDate,
      listed_count: listed,
      sold_count: sold,
      used_count: used,
      pending_count: listed + sold,
      meals: {
        lunch: { listed: 0, sold: 0, used: 0 },
        dinner: { listed: 0, sold: 0, used: 0 },
        breakfast: { listed: 0, sold: 0, used: 0 },
      },
      recent_scans: [],
      average_rating: 4.5,
    };
  }

  return data;
}

export async function rateTokenAction(params: {
  tokenId: string;
  buyerId: string;
  messId: string;
  mealType: MealType;
  rating: number;
  review?: string;
}) {
  const supabase = createClient();
  const { error } = await supabase.from('ratings').insert({
    token_id: params.tokenId,
    buyer_id: params.buyerId,
    mess_id: params.messId,
    meal_type: params.mealType,
    rating: params.rating,
    review: params.review || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
