'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { TicketCard } from '@/components/tokens/TicketCard';
import { RatingModal } from '@/components/tokens/RatingModal';
import { useToast } from '@/components/ui/Toast';
import { Token } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { Ticket, Store, Sparkles, Filter } from 'lucide-react';

export default function BuyerTokensPage() {
  const { showToast } = useToast();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Rating modal state
  const [selectedTokenToRate, setSelectedTokenToRate] = useState<Token | null>(null);
  const [isRatingOpen, setIsRatingOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadBuyerData() {
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
        role: profile?.role || authUser.user_metadata?.role || 'buyer',
        fullName: profile?.full_name,
      });

      await fetchTokens(authUser.id);
      setIsLoading(false);
    }

    loadBuyerData();

    // Realtime listener on tokens: when mess scans token, it updates to 'used' live!
    const channel = supabase
      .channel('buyer-tokens-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            if (user?.id && updated.buyer_id === user.id) {
              fetchTokens(user.id);
              if (updated.status === 'used') {
                showToast('✅ Token redeemed! Your meal is being served.', 'success');
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTokens = async (buyerId: string) => {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*, messes(*)')
        .eq('buyer_id', buyerId)
        .order('sold_at', { ascending: false });

      if (data && !error) {
        setTokens(data as Token[]);
      }
    } catch (e) {
      console.warn('Fetch buyer tokens note:', e);
    }
  };

  const handleRate = (token: Token) => {
    setSelectedTokenToRate(token);
    setIsRatingOpen(true);
  };

  const handleRatingSuccess = () => {
    showToast('Thank you! Your rating has been shared with the mess management.', 'success');
    if (user?.id) fetchTokens(user.id);
  };

  const filteredTokens = tokens.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-dark flex items-center gap-2">
              <Ticket className="w-6 h-6 text-brand-primary" />
              My Digital Meal Passes
            </h1>
            <p className="text-xs text-brand-muted mt-0.5">
              Show your one-time QR code at the mess counter to be served
            </p>
          </div>

          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-primary text-white font-bold text-xs shadow-soft hover:bg-brand-dark transition-colors self-start"
          >
            <Store className="w-4 h-4" />
            Browse More Meals
          </Link>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brand-primary" />
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All Tokens' },
              { id: 'sold', label: 'Active Passes' },
              { id: 'used', label: 'Redeemed' },
              { id: 'expired', label: 'Expired' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === pill.id
                    ? 'bg-brand-primary text-white shadow-soft'
                    : 'bg-white text-brand-muted hover:text-brand-ink border border-gray-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tickets Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 shadow-soft border border-gray-100 animate-pulse h-96"
              />
            ))}
          </div>
        ) : filteredTokens.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTokens.map((token) => (
              <TicketCard key={token.id} token={token} onRate={handleRate} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center shadow-card border border-emerald-950/5 max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-full bg-brand-mint text-brand-primary flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-10 h-10 stroke-[2.2]" />
            </div>
            <h3 className="font-extrabold text-xl text-brand-dark">No Meal Tokens Found</h3>
            <p className="text-xs text-brand-muted mt-2 leading-relaxed max-w-sm mx-auto">
              You haven't purchased any meal passes in this category yet. Explore today's available meals on the marketplace!
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 mt-5 px-5 py-3 rounded-2xl bg-brand-primary text-white font-bold text-xs shadow-soft hover:bg-brand-dark transition-colors"
            >
              <Sparkles className="w-4 h-4 text-brand-yellow fill-brand-yellow" />
              Explore Marketplace (₹30 Meals)
            </Link>
          </div>
        )}
      </div>

      {/* Rating Modal */}
      <RatingModal
        token={selectedTokenToRate}
        isOpen={isRatingOpen}
        onClose={() => setIsRatingOpen(false)}
        onSuccess={handleRatingSuccess}
      />
    </AppLayout>
  );
}
