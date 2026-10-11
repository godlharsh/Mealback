'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { MarketplaceCard } from '@/components/marketplace/MarketplaceCard';
import { DemoUPIModal } from '@/components/payments/DemoUPIModal';
import { useToast } from '@/components/ui/Toast';
import { MarketplaceToken, Mess, MealType } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  Store,
  Filter,
  Sparkles,
  Ticket,
  PlusCircle,
  UtensilsCrossed,
  Clock,
} from 'lucide-react';

export default function MarketplacePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const [tokens, setTokens] = useState<MarketplaceToken[]>([]);
  const [messes, setMesses] = useState<Mess[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<string>('all');
  const [selectedMess, setSelectedMess] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modal payment state
  const [selectedTokenToBuy, setSelectedTokenToBuy] = useState<MarketplaceToken | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      // Check current session
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setCurrentUser({
          email: user.email,
          role: profile?.role || user.user_metadata?.role || 'student',
          fullName: profile?.full_name || user.user_metadata?.full_name,
          id: user.id,
        });
      }

      // Fetch messes
      const { data: messesData } = await supabase.from('messes').select('*');
      if (messesData && messesData.length > 0) {
        setMesses(messesData);
      } else {
        setMesses([
          {
            id: 'demo-mess-1',
            name: 'Boys Hostel A Mess',
            access_code: 'MESS-DEMO',
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // Fetch marketplace tokens
      await fetchTokens();
      setIsLoading(false);
    }

    loadData();

    // Supabase Realtime subscription on tokens table
    const channel = supabase
      .channel('public:tokens:marketplace')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        (payload) => {
          // Refresh list when tokens are added, bought, or updated
          fetchTokens();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTokens = async () => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('tokens')
        .select('*, messes(*)')
        .eq('status', 'listed')
        .gt('cutoff_at', nowIso)
        .order('meal_date', { ascending: true })
        .order('meal_time', { ascending: true });

      if (data && !error) {
        const mapped: MarketplaceToken[] = data.map((t: any) => ({
          id: t.id,
          mess_id: t.mess_id,
          mess_name: t.messes?.name || 'Campus Mess',
          mess_location: t.messes?.location,
          meal_type: t.meal_type as MealType,
          meal_date: t.meal_date,
          meal_time: t.meal_time,
          cutoff_at: t.cutoff_at,
          valid_until: t.valid_until,
          face_price: Number(t.face_price || 40),
          list_price: Number(t.list_price || 30),
          status: t.status,
          created_at: t.created_at,
        }));
        setTokens(mapped);
      }
    } catch (e) {
      console.warn('Marketplace fetch note:', e);
    }
  };

  const handleBuyClick = (token: MarketplaceToken) => {
    if (!currentUser) {
      showToast('Please sign in or create an account to buy a meal token.', 'info');
      router.push('/login?redirect=/marketplace');
      return;
    }
    setSelectedTokenToBuy(token);
    setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = (boughtToken: any) => {
    setIsPaymentOpen(false);
    setSelectedTokenToBuy(null);
    showToast('Token purchased successfully! View your QR pass in My Tokens.', 'success');
    // Remove from local list immediately
    setTokens((prev) => prev.filter((t) => t.id !== boughtToken.token_id));
    // Redirect to buyer's tokens
    router.push('/buyer/tokens');
  };

  // Filter tokens
  const filteredTokens = tokens.filter((t) => {
    if (selectedMealType !== 'all' && t.meal_type !== selectedMealType) return false;
    if (selectedMess !== 'all' && t.mess_id !== selectedMess) return false;
    return true;
  });

  return (
    <AppLayout user={currentUser}>
      <div className="space-y-6">
        {/* Marketplace Banner */}
        <div className="bg-gradient-to-r from-brand-dark to-brand-primary rounded-3xl p-6 md:p-8 text-white shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-yellow/20 text-brand-yellow text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Live Meal Exchange
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              Fresh Mess Meals at ₹30
            </h1>
            <p className="text-emerald-100/90 text-sm mt-1.5 leading-relaxed">
              Hostel students skip meals. You get value-priced meals. Verified with one-time QR passes and instant meal service.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap gap-3">
            {currentUser?.role === 'student' && (
              <Link
                href="/student"
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-yellow text-brand-dark font-extrabold text-sm shadow-md hover:bg-yellow-400 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                List a Meal (Earn ₹22)
              </Link>
            )}
            <Link
              href="/buyer/tokens"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm backdrop-blur-sm transition-colors border border-white/20"
            >
              <Ticket className="w-4 h-4" />
              My QR Tokens
            </Link>
          </div>

          {/* Decorative background element */}
          <div className="absolute right-[-40px] bottom-[-40px] w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-soft border border-emerald-950/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand-primary" />
            <span className="text-xs font-bold text-brand-dark uppercase tracking-wide">
              Filters:
            </span>

            {/* Meal Type Pills */}
            <div className="flex items-center gap-1.5 ml-2">
              {[
                { id: 'all', label: 'All Meals' },
                { id: 'breakfast', label: 'Breakfast' },
                { id: 'lunch', label: 'Lunch' },
                { id: 'dinner', label: 'Dinner' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setSelectedMealType(pill.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedMealType === pill.id
                      ? 'bg-brand-primary text-white shadow-soft'
                      : 'bg-brand-mint/60 text-brand-muted hover:text-brand-ink'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mess Filter Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-brand-muted">Mess:</span>
            <select
              value={selectedMess}
              onChange={(e) => setSelectedMess(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-brand-light text-brand-ink font-semibold focus:outline-none focus:border-brand-primary"
            >
              <option value="all">All Messes</option>
              {messes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tokens Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 animate-pulse space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="w-20 h-5 bg-gray-200 rounded-lg" />
                  <div className="w-16 h-5 bg-gray-200 rounded-full" />
                </div>
                <div className="w-40 h-6 bg-gray-200 rounded-lg" />
                <div className="w-full h-12 bg-gray-100 rounded-xl" />
                <div className="flex justify-between items-center pt-3 border-t">
                  <div className="w-20 h-8 bg-gray-200 rounded-lg" />
                  <div className="w-24 h-10 bg-gray-200 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTokens.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {filteredTokens.map((token) => (
              <MarketplaceCard
                key={token.id}
                token={token}
                onBuy={handleBuyClick}
                isOwner={currentUser?.id && (token as any).seller_id === currentUser.id}
              />
            ))}
          </div>
        ) : (
          /* Friendly Empty State */
          <div className="bg-white rounded-3xl p-12 text-center shadow-card border border-emerald-950/5 max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-full bg-brand-mint text-brand-primary flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed className="w-10 h-10 stroke-[2.2]" />
            </div>
            <h3 className="font-extrabold text-xl text-brand-dark">No Active Tokens Listed</h3>
            <p className="text-xs text-brand-muted mt-2 leading-relaxed max-w-sm mx-auto">
              All tokens for this filter may have been purchased or reached their 2-hour cutoff time. Check back soon or list your own meal!
            </p>

            {currentUser?.role === 'student' && (
              <Link
                href="/student"
                className="inline-flex items-center gap-2 mt-5 px-5 py-3 rounded-2xl bg-brand-primary text-white font-bold text-xs shadow-soft hover:bg-brand-dark transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                List Your Skipped Meal
              </Link>
            )}
          </div>
        )}
      </div>

      {/* DemoUPI Modal */}
      <DemoUPIModal
        token={selectedTokenToBuy}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </AppLayout>
  );
}
