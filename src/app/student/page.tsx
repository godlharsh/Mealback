'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { Token, Mess, MealType } from '@/types/database';
import { PRICING_CONFIG, TIMING_CONFIG, POLICY_CONFIG } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import {
  PlusCircle,
  Wallet,
  Clock,
  Sparkles,
  AlertCircle,
  ListOrdered,
  Loader2,
  Coins,
  ShieldCheck,
  Building2,
  ArrowRight,
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
  const [listPrice, setListPrice] = useState<number>(PRICING_CONFIG.DEFAULT_LIST_PRICE);
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

      // Parallelize profile, messes, and student stats to eliminate waterfall delays
      try {
        const [profileRes, messRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', authUser.id).single(),
          supabase.from('messes').select('*').order('name'),
        ]);

        const profileData = profileRes.data;
        const messList = messRes.data || [];

        setUser({
          id: authUser.id,
          email: authUser.email,
          role: profileData?.role || 'student',
          fullName: profileData?.full_name,
          messId: profileData?.mess_id,
        });

        if (messList.length > 0) {
          setMesses(messList);
          const defaultMessId = profileData?.mess_id && messList.some((m: Mess) => m.id === profileData.mess_id)
            ? profileData.mess_id
            : messList[0].id;
          setSelectedMess(defaultMessId);
        } else {
          setMesses([]);
          setSelectedMess('');
        }

        await refreshStudentStats(authUser.id);
      } catch (err) {
        console.warn('Dashboard data fetch note:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStudentData();

    // Supabase Realtime: updates when token status changes
    const channel = supabase
      .channel('student-tokens-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        (payload) => {
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
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Parallelize tokens, monthly count, and wallet entries
      const [tokensRes, countRes, walletRes] = await Promise.all([
        supabase
          .from('tokens')
          .select('*, messes(*)')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('tokens')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', userId)
          .neq('status', 'cancelled')
          .gte('created_at', startOfMonth.toISOString()),
        supabase
          .from('wallet_entries')
          .select('*')
          .eq('user_id', userId),
      ]);

      setMyTokens(tokensRes.data ? (tokensRes.data as Token[]) : []);
      setMonthlyCount(countRes.count || 0);

      if (walletRes.data && walletRes.data.length > 0) {
        let avail = 0;
        let pend = 0;
        walletRes.data.forEach((w: any) => {
          if (w.status === 'available' || w.status === 'paid') avail += Number(w.amount);
          if (w.status === 'pending') pend += Number(w.amount);
        });
        setWalletStats({ available: avail, pending: pend });
      } else {
        setWalletStats({ available: 0, pending: 0 });
      }
    } catch (e) {
      console.warn('Student stats refresh note:', e);
      setMyTokens([]);
      setMonthlyCount(0);
      setWalletStats({ available: 0, pending: 0 });
    }
  };

  const handleListMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    if (messes.length === 0 || !selectedMess) {
      setFormError('No mess registered yet. Ask your mess administrator to register your mess.');
      return;
    }

    if (monthlyCount >= POLICY_CONFIG.MONTHLY_SELLER_LIMIT) {
      setFormError(
        `Monthly limit reached! You have already listed ${POLICY_CONFIG.MONTHLY_SELLER_LIMIT} meals this calendar month.`
      );
      return;
    }

    if (!mealDate || !mealTime) {
      setFormError('Please select meal date and serving time.');
      return;
    }

    if (listPrice < PRICING_CONFIG.MIN_LIST_PRICE || listPrice > PRICING_CONFIG.MAX_LIST_PRICE) {
      setFormError(
        `Asking price must be between ₹${PRICING_CONFIG.MIN_LIST_PRICE} and ₹${PRICING_CONFIG.MAX_LIST_PRICE}.`
      );
      return;
    }

    // Client-side pre-validation of cutoff
    const mealDateTime = new Date(`${mealDate}T${mealTime}`);
    const cutoffDateTime = new Date(
      mealDateTime.getTime() - TIMING_CONFIG.CUTOFF_HOURS_BEFORE * 60 * 60 * 1000
    );

    if (new Date() >= cutoffDateTime) {
      setFormError(
        `Cutoff time has already passed for this meal! Meals must be listed at least ${TIMING_CONFIG.CUTOFF_HOURS_BEFORE} hours before serving time.`
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
          listPrice,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to list meal.');
      }

      showToast(
        `Meal successfully listed for ₹${listPrice}! Payout will unlock upon mess verification.`,
        'success'
      );
      if (user?.id) {
        await refreshStudentStats(user.id);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error creating listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingQuota = Math.max(0, POLICY_CONFIG.MONTHLY_SELLER_LIMIT - monthlyCount);

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
                {monthlyCount}/{POLICY_CONFIG.MONTHLY_SELLER_LIMIT} Listed This Month
              </h2>
              <p className="text-xs text-emerald-100/90 mt-1 max-w-md">
                Hostel policy allows a maximum of {POLICY_CONFIG.MONTHLY_SELLER_LIMIT} listed meal passes per student each calendar month to prevent commercial abuse.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mt-5">
              <div className="w-full h-3 rounded-full bg-white/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    monthlyCount >= POLICY_CONFIG.MONTHLY_SELLER_LIMIT
                      ? 'bg-rose-400'
                      : monthlyCount >= 7
                      ? 'bg-amber-400'
                      : 'bg-brand-yellow'
                  }`}
                  style={{ width: `${(monthlyCount / POLICY_CONFIG.MONTHLY_SELLER_LIMIT) * 100}%` }}
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
                List before cutoff ({TIMING_CONFIG.CUTOFF_HOURS_BEFORE} hours before serving time). Choose your own price.
              </p>
            </div>
            <span className="hidden sm:inline-flex text-xs font-bold text-brand-primary px-3 py-1 rounded-full bg-brand-mint">
              Set Your Own Price
            </span>
          </div>

          {/* Helpful Missing Mess Notice */}
          {messes.length === 0 && !isLoading && (
            <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Building2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs">No Mess Registered Yet</h4>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    Ask your mess administrator or dining hall in-charge to register your mess to enable meal token listings.
                  </p>
                </div>
              </div>
              {user?.role === 'mess' && (
                <Link
                  href="/mess"
                  className="px-4 py-2 rounded-xl bg-amber-900 text-white font-bold text-xs hover:bg-amber-950 transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <span>Register Mess</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}

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
                  disabled={messes.length === 0}
                  className="w-full p-3 rounded-2xl border border-gray-200 bg-brand-light text-sm font-semibold focus:border-brand-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {messes.length === 0 ? (
                    <option value="">No mess registered yet</option>
                  ) : (
                    messes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.location ? `(${m.location})` : ''}
                      </option>
                    ))
                  )}
                </select>
                {messes.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Registration required before meals can be listed.
                  </p>
                )}
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
                        if (type === 'breakfast') setMealTime(TIMING_CONFIG.DEFAULTS.breakfast.start);
                        if (type === 'lunch') setMealTime(TIMING_CONFIG.DEFAULTS.lunch.start);
                        if (type === 'dinner') setMealTime(TIMING_CONFIG.DEFAULTS.dinner.start);
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
                <p className="text-[11px] text-brand-muted mt-1">
                  Cutoff: {TIMING_CONFIG.CUTOFF_HOURS_BEFORE} hours before this time.
                </p>
              </div>

              {/* Student Asking Price */}
              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1.5">
                  Your Asking Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm font-bold text-brand-muted">₹</span>
                  <input
                    type="number"
                    required
                    min={PRICING_CONFIG.MIN_LIST_PRICE}
                    max={PRICING_CONFIG.MAX_LIST_PRICE}
                    value={listPrice}
                    onChange={(e) => setListPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Enter price"
                    className="w-full pl-8 pr-3 py-3 rounded-2xl border border-gray-200 bg-brand-light text-sm font-bold text-brand-dark focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-brand-muted mt-1">
                  Range: ₹{PRICING_CONFIG.MIN_LIST_PRICE} - ₹{PRICING_CONFIG.MAX_LIST_PRICE}. Credited to your wallet when mess verifies scan.
                </p>
              </div>
            </div>

            {/* Payout Assurance Banner */}
            <div className="p-4 rounded-2xl bg-brand-mint/60 border border-brand-primary/15 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
              <div className="text-xs text-brand-ink">
                <span className="font-bold">Peer-to-Peer Meal Transfer: </span>
                Buyers pay your exact listed price (₹{listPrice}). The full amount is credited to your wallet once redeemed at the mess counter.
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || messes.length === 0 || monthlyCount >= POLICY_CONFIG.MONTHLY_SELLER_LIMIT}
              className="w-full py-4 rounded-2xl bg-brand-primary text-white font-extrabold text-sm shadow-card hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Token to Marketplace...</span>
                </>
              ) : messes.length === 0 ? (
                <>
                  <Building2 className="w-4 h-4" />
                  <span>Waiting for Mess Registration</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-brand-yellow fill-brand-yellow" />
                  <span>List Token on Marketplace (Asking Price: ₹{listPrice})</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* My Recent Listings */}
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
                        <p className="text-xs font-bold text-emerald-700">₹{token.list_price} payout</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-brand-mint text-brand-primary flex items-center justify-center mx-auto mb-3">
                  <Coins className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-brand-dark">No meals listed yet</h4>
                <p className="text-xs text-brand-muted mt-1 max-w-xs mx-auto">
                  When you plan to skip a mess meal, list it above to earn credits into your wallet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
