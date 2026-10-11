'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { Token, Mess, MealType } from '@/types/database';
import { TOKEN_CONFIG } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import {
  PlusCircle,
  Wallet,
  Clock,
  Calendar,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ListOrdered,
  Loader2,
  TrendingUp,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { showToast } = useToast();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [messes, setMesses] = useState<Mess[]>([]);
  const [myTokens, setMyTokens] = useState<Token[]>([]);
  const [monthlyCount, setMonthlyCount] = useState<number>(0);
  const [walletStats, setWalletStats] = useState({ available: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Listing Form State
  const [selectedMess, setSelectedMess] = useState<string>('');
  const [mealType, setMealType] = useState<MealType>('dinner');
  const [mealDate, setMealDate] = useState<string>('');
  const [mealTime, setMealTime] = useState<string>('20:30');
  const [listPrice, setListPrice] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setMealDate(today);

    async function loadStudentData() {
      setIsLoading(true);

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      setUser({
        id: authUser.id,
        email: authUser.email,
        role: profile?.role || 'student',
        fullName: profile?.full_name,
        messId: profile?.mess_id,
      });

      // Fetch messes
      const { data: messList } = await supabase.from('messes').select('*');
      if (messList && messList.length > 0) {
        setMesses(messList);
        setSelectedMess(profile?.mess_id || messList[0].id);
      }

      await refreshStudentStats(authUser.id);
      setIsLoading(false);
    }

    loadStudentData();

    // Supabase Realtime: updates when token status changes (e.g. bought by buyer)
    const channel = supabase
      .channel('student-tokens-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        (payload) => {
          // If a token owned by this student was updated (e.g. sold or used)
          if (user?.id) {
            refreshStudentStats(user.id);
            if (payload.eventType === 'UPDATE' && (payload.new as any).status === 'sold') {
              showToast('🎉 Great news! One of your listed meals was just bought!', 'success');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshStudentStats = async (userId: string) => {
    try {
      // 1. Fetch user's listings
      const { data: tokensData } = await supabase
        .from('tokens')
        .select('*, messes(*)')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false });

      if (tokensData && tokensData.length > 0) {
        setMyTokens(tokensData as Token[]);
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        setMyTokens([
          {
            id: 'sample-student-1',
            seller_id: userId,
            mess_id: 'demo-mess-1',
            meal_type: 'dinner',
            meal_date: todayStr,
            meal_time: '20:30:00',
            cutoff_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
            valid_until: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
            face_price: 40,
            list_price: 30,
            seller_payout: 22,
            mess_share: 4,
            platform_fee: 4,
            status: 'listed',
            short_code: '8192-MKL',
            created_at: new Date().toISOString(),
            messes: {
              id: 'demo-mess-1',
              name: 'Boys Hostel A Mess',
              access_code: 'MESS-DEMO',
              created_at: new Date().toISOString(),
            },
          },
          {
            id: 'sample-student-2',
            seller_id: userId,
            mess_id: 'demo-mess-1',
            meal_type: 'lunch',
            meal_date: todayStr,
            meal_time: '13:00:00',
            cutoff_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
            valid_until: new Date(Date.now() + 1 * 3600 * 1000).toISOString(),
            face_price: 40,
            list_price: 30,
            seller_payout: 22,
            mess_share: 4,
            platform_fee: 4,
            status: 'sold',
            short_code: '5521-VAL',
            created_at: new Date().toISOString(),
            messes: {
              id: 'demo-mess-1',
              name: 'Boys Hostel A Mess',
              access_code: 'MESS-DEMO',
              created_at: new Date().toISOString(),
            },
          },
        ]);
        setMonthlyCount(2);
        setWalletStats({ available: 22, pending: 22 });
        return;
      }

      // 2. Monthly limit count
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .neq('status', 'cancelled')
        .gte('created_at', startOfMonth.toISOString());

      setMonthlyCount(count || 0);

      // 3. Wallet stats
      const { data: walletData } = await supabase
        .from('wallet_entries')
        .select('*')
        .eq('user_id', userId);

      if (walletData && walletData.length > 0) {
        let avail = 0;
        let pend = 0;
        walletData.forEach((w) => {
          if (w.status === 'available' || w.status === 'paid') avail += Number(w.amount);
          if (w.status === 'pending') pend += Number(w.amount);
        });
        setWalletStats({ available: avail, pending: pend });
      } else {
        setWalletStats({ available: 22, pending: 22 });
      }
    } catch (e) {
      console.warn('Student stats refresh note:', e);
    }
  };

  const handleListMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (monthlyCount >= TOKEN_CONFIG.MONTHLY_SELLER_LIMIT) {
      setFormError('Monthly limit reached! You have already listed 10 meals this calendar month.');
      return;
    }

    if (!selectedMess || !mealDate || !mealTime) {
      setFormError('Please select mess, meal date, and meal time.');
      return;
    }

    // Client-side pre-validation of cutoff
    const mealDateTime = new Date(`${mealDate}T${mealTime}`);
    const cutoffDateTime = new Date(mealDateTime.getTime() - 2 * 60 * 60 * 1000);

    if (new Date() >= cutoffDateTime) {
      setFormError(
        'Cutoff time has already passed for this meal! Meals must be listed at least 2 hours before serving time.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/tokens/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messId: selectedMess,
          mealType,
          mealDate,
          mealTime: `${mealTime}:00`,
          listPrice: 30,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to list meal.');
      }

      showToast('Meal successfully listed on the marketplace! ₹22 will be credited upon redemption.', 'success');
      if (user?.id) {
        await refreshStudentStats(user.id);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error creating listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingQuota = Math.max(0, TOKEN_CONFIG.MONTHLY_SELLER_LIMIT - monthlyCount);

  return (
    <AppLayout user={user}>
      <div className="space-y-8">
        {/* Top Header & Quota Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Live Monthly Counter Widget */}
          <div className="md:col-span-2 bg-gradient-to-br from-brand-dark to-brand-primary rounded-3xl p-6 text-white shadow-card relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-yellow">
                  Monthly Skipping Limit
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-emerald-200">
                  Fair-Use Policy
                </span>
              </div>
              <h2 className="text-2xl font-black">
                {monthlyCount}/{TOKEN_CONFIG.MONTHLY_SELLER_LIMIT} Listed This Month
              </h2>
              <p className="text-xs text-emerald-100/90 mt-1 max-w-md">
                Hostel policy allows a maximum of 10 listed meal passes per student each calendar month to prevent commercial abuse.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mt-5">
              <div className="w-full h-3 rounded-full bg-white/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    monthlyCount >= 10
                      ? 'bg-rose-400'
                      : monthlyCount >= 7
                      ? 'bg-amber-400'
                      : 'bg-brand-yellow'
                  }`}
                  style={{ width: `${(monthlyCount / TOKEN_CONFIG.MONTHLY_SELLER_LIMIT) * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-semibold text-emerald-200 mt-1.5">
                <span>{remainingQuota} slots remaining this month</span>
                <span>Resets 1st of next month</span>
              </div>
            </div>
          </div>

          {/* Student Wallet Quick Summary */}
          <div className="bg-white rounded-3xl p-6 shadow-card border border-emerald-950/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
                <span>Earnings Wallet</span>
                <Wallet className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-brand-dark">₹{walletStats.available}</span>
                <span className="text-xs text-brand-muted font-bold ml-1.5">Redeemed</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5" />
                <span>₹{walletStats.pending} pending scan</span>
              </div>
            </div>

            <Link
              href="/student/wallet"
              className="mt-4 w-full py-2.5 rounded-xl border border-brand-primary/20 text-brand-primary font-bold text-xs text-center hover:bg-brand-mint transition-colors"
            >
              View Payout Ledger &rarr;
            </Link>
          </div>
        </div>

        {/* List a Meal Form Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-card border border-emerald-950/5">
          <div className="flex items-center justify-between pb-4 border-b border-brand-mint">
            <div>
              <h2 className="text-xl font-extrabold text-brand-dark flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-brand-primary" />
                List a Meal You Will Skip
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                List before cutoff (2 hours before meal time). Buyers can purchase for ₹30.
              </p>
            </div>
            <span className="hidden sm:inline-flex text-xs font-bold text-brand-primary px-3 py-1 rounded-full bg-brand-mint">
              You Earn ₹22
            </span>
          </div>

          {formError && (
            <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleListMeal} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Mess Picker */}
              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1.5">
                  Select Mess
                </label>
                <select
                  value={selectedMess}
                  onChange={(e) => setSelectedMess(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-gray-200 bg-brand-light text-sm font-semibold focus:border-brand-primary focus:outline-none"
                >
                  {messes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Meal Type */}
              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1.5">
                  Meal Type
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-brand-light p-1 rounded-2xl border border-gray-200">
                  {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setMealType(type);
                        if (type === 'breakfast') setMealTime('08:30');
                        if (type === 'lunch') setMealTime('13:00');
                        if (type === 'dinner') setMealTime('20:30');
                      }}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                        mealType === type
                          ? 'bg-brand-primary text-white shadow-soft'
                          : 'text-brand-muted hover:text-brand-ink'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meal Date */}
              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1.5">
                  Meal Date
                </label>
                <input
                  type="date"
                  required
                  value={mealDate}
                  onChange={(e) => setMealDate(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-gray-200 bg-brand-light text-sm font-semibold focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Serving Time */}
              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1.5">
                  Serving Time
                </label>
                <input
                  type="time"
                  required
                  value={mealTime}
                  onChange={(e) => setMealTime(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-gray-200 bg-brand-light text-sm font-semibold focus:border-brand-primary focus:outline-none"
                />
              </div>

              {/* Fixed Platform Pricing Split Preview */}
              <div className="p-4 rounded-2xl bg-brand-mint/60 border border-brand-primary/20">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-brand-dark">Fair Value Split (₹30 Token)</span>
                  <span className="text-brand-primary">40 Face Value</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-xl shadow-xs border border-emerald-950/5">
                    <span className="text-[10px] text-brand-muted uppercase block">You Get</span>
                    <span className="font-extrabold text-brand-primary text-sm">₹22</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl shadow-xs border border-emerald-950/5">
                    <span className="text-[10px] text-brand-muted uppercase block">Mess Share</span>
                    <span className="font-bold text-brand-dark text-sm">₹4</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl shadow-xs border border-emerald-950/5">
                    <span className="text-[10px] text-brand-muted uppercase block">Platform</span>
                    <span className="font-bold text-brand-dark text-sm">₹4</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || monthlyCount >= 10}
              className="w-full py-4 rounded-2xl bg-brand-primary text-white font-extrabold text-sm shadow-card hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Token to Marketplace...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-brand-yellow fill-brand-yellow" />
                  <span>List Token on Marketplace (List Price ₹30)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* My Recent Listings with Realtime Status Badges */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-card border border-emerald-950/5">
          <div className="flex items-center justify-between pb-4 border-b border-brand-mint">
            <div>
              <h2 className="text-lg font-extrabold text-brand-dark flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-brand-primary" />
                My Listed Tokens
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Real-time status updates when someone buys or redeems your meal pass
              </p>
            </div>
            <Link
              href="/student/listings"
              className="text-xs font-bold text-brand-primary hover:underline"
            >
              View Full History &rarr;
            </Link>
          </div>

          <div className="mt-4">
            {myTokens.length > 0 ? (
              <div className="divide-y divide-brand-mint/60">
                {myTokens.slice(0, 5).map((token) => (
                  <div
                    key={token.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-sm text-brand-dark capitalize">
                          {token.meal_type}
                        </span>
                        <StatusBadge status={token.status} size="sm" />
                      </div>
                      <p className="text-xs text-brand-muted mt-0.5">
                        {token.messes?.name || 'Mess'} &bull; Date: {token.meal_date} &bull; Time:{' '}
                        {token.meal_time.slice(0, 5)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-brand-muted">
                          {token.short_code}
                        </span>
                        <p className="text-xs font-bold text-emerald-700">₹{token.seller_payout} payout</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-brand-muted">You haven't listed any meal tokens yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
