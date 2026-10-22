import { createClient } from './supabase/server';
import { defaultPaymentProvider } from './payments/demo-upi';
import {
  MarketplaceToken,
  Token,
  WalletEntry,
  ScanResult,
  MealType,
  Mess,
} from '@/types/database';
import { PRICING_CONFIG, TIMING_CONFIG, POLICY_CONFIG } from './constants';

/**
 * Data service handling real database queries and atomic RPC functions.
 */

export async function getMesses(): Promise<Mess[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('messes').select('*').order('name');
  if (error || !data) {
    return [];
  }
  return data;
}

export async function getMarketplaceTokens(filter?: {
  mealType?: string;
  messId?: string;
}): Promise<MarketplaceToken[]> {
  const supabase = createClient();
  let query = supabase
    .from('marketplace_tokens')
    .select('*')
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
    // Fallback directly to tokens if view not populated
    let directQuery = supabase
      .from('tokens')
      .select('*, messes(name, location)')
      .eq('status', 'listed')
      .gt('cutoff_at', new Date().toISOString())
      .order('meal_date', { ascending: true })
      .order('meal_time', { ascending: true });

    if (filter?.mealType && filter.mealType !== 'all') {
      directQuery = directQuery.eq('meal_type', filter.mealType);
    }
    if (filter?.messId && filter.messId !== 'all') {
      directQuery = directQuery.eq('mess_id', filter.messId);
    }

    const directRes = await directQuery;
    if (directRes.error || !directRes.data) {
      return [];
    }

    return directRes.data.map((t: any) => ({
      id: t.id,
      mess_id: t.mess_id,
      mess_name: t.messes?.name || 'Mess',
      mess_location: t.messes?.location || null,
      meal_type: t.meal_type as MealType,
      meal_date: t.meal_date,
      meal_time: t.meal_time,
      cutoff_at: t.cutoff_at,
      valid_until: t.valid_until,
      list_price: Number(t.list_price),
      status: t.status,
      created_at: t.created_at,
    }));
  }

  return data.map((item: any) => ({
    id: item.id,
    mess_id: item.mess_id,
    mess_name: item.mess_name,
    mess_location: item.mess_location || null,
    meal_type: item.meal_type as MealType,
    meal_date: item.meal_date,
    meal_time: item.meal_time,
    cutoff_at: item.cutoff_at,
    valid_until: item.valid_until,
    list_price: Number(item.list_price),
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
  listPrice: number;
}): Promise<{ success: boolean; error?: string; tokenId?: string }> {
  const supabase = createClient();

  if (
    !params.listPrice ||
    params.listPrice < PRICING_CONFIG.MIN_PRICE ||
    params.listPrice > PRICING_CONFIG.MAX_PRICE
  ) {
    return {
      success: false,
      error: `Asking price must be between ₹${PRICING_CONFIG.MIN_PRICE} and ₹${PRICING_CONFIG.MAX_PRICE}.`,
    };
  }

  const { data, error } = await supabase.rpc('list_meal_token', {
    p_seller_id: params.sellerId,
    p_mess_id: params.messId,
    p_meal_type: params.mealType,
    p_meal_date: params.mealDate,
    p_meal_time: params.mealTime,
    p_list_price: params.listPrice,
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
  const supabase = createClient();

  // 1. Fetch token to get actual student-selected price
  const { data: tokenRecord, error: fetchErr } = await supabase
    .from('tokens')
    .select('id, list_price, status, cutoff_at, meal_type')
    .eq('id', params.tokenId)
    .single();

  if (fetchErr || !tokenRecord) {
    return { success: false, error: 'Meal token not found or no longer available.' };
  }

  if (tokenRecord.status !== 'listed') {
    return { success: false, error: `This meal pass is ${tokenRecord.status}.` };
  }

  if (new Date() >= new Date(tokenRecord.cutoff_at)) {
    return { success: false, error: 'The purchase cutoff time for this meal has passed.' };
  }

  const actualPrice = Number(tokenRecord.list_price);

  // 2. Process simulated UPI payment for the exact asking price
  const paymentRes = await defaultPaymentProvider.processPayment({
    tokenId: params.tokenId,
    amount: actualPrice,
    currency: 'INR',
    buyerId: params.buyerId,
    description: `MealBack ${tokenRecord.meal_type} pass purchase`,
  });

  if (!paymentRes.success) {
    return { success: false, error: paymentRes.error || 'Payment failed' };
  }

  // 3. Call atomic Postgres function with row lock
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
      message: error.message || 'Database error verifying token',
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
    return {
      date: targetDate,
      listed_count: 0,
      sold_count: 0,
      used_count: 0,
      pending_count: 0,
      meals: {
        lunch: { listed: 0, sold: 0, used: 0 },
        dinner: { listed: 0, sold: 0, used: 0 },
        breakfast: { listed: 0, sold: 0, used: 0 },
      },
      recent_scans: [],
      average_rating: 0,
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
