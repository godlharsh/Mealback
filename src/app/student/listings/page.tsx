'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Token, TokenStatus } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { ListOrdered, PlusCircle, ArrowLeft, Clock } from 'lucide-react';

export default function StudentListingsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
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
        });

        const { data } = await supabase
          .from('tokens')
          .select('*, messes(*)')
          .eq('seller_id', authUser.id)
          .order('created_at', { ascending: false });

        if (data) {
          setTokens(data as Token[]);
        }
      }
      setLoading(false);
    }

    loadData();
  }, []);

  const filteredTokens = tokens.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/student"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-black text-brand-dark">My Listings History</h1>
            <p className="text-xs text-brand-muted mt-0.5">
              Track all your listed, sold, and redeemed meal tokens
            </p>
          </div>

          <Link
            href="/student"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-primary text-white font-bold text-xs shadow-soft hover:bg-brand-dark transition-colors self-start"
          >
            <PlusCircle className="w-4 h-4" />
            List Another Meal
          </Link>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'listed', 'sold', 'used', 'expired'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                statusFilter === filter
                  ? 'bg-brand-primary text-white shadow-soft'
                  : 'bg-white text-brand-muted hover:text-brand-ink border border-gray-200'
              }`}
            >
              {filter === 'sold' ? 'Sold / Ready' : filter}
            </button>
          ))}
        </div>

        {/* Listings List */}
        <div className="bg-white rounded-3xl p-6 shadow-card border border-emerald-950/5">
          {loading ? (
            <div className="py-12 text-center text-xs text-brand-muted animate-pulse">
              Loading listings...
            </div>
          ) : filteredTokens.length > 0 ? (
            <div className="divide-y divide-brand-mint/80">
              {filteredTokens.map((token) => (
                <div
                  key={token.id}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-base text-brand-dark capitalize">
                        {token.meal_type}
                      </span>
                      <StatusBadge status={token.status} size="sm" />
                    </div>
                    <p className="text-xs text-brand-muted">
                      {token.messes?.name || 'Boys Hostel A Mess'} &bull; Date: {token.meal_date} &bull; Serving: {token.meal_time.slice(0, 5)}
                    </p>
                    <p className="text-[11px] text-brand-muted flex items-center gap-1">
                      <Clock className="w-3 h-3 text-brand-primary" />
                      Cutoff was: {new Date(token.cutoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-5">
                    <div className="text-left md:text-right">
                      <span className="text-xs text-brand-muted block">Short Code</span>
                      <span className="font-mono font-bold text-sm text-brand-ink">
                        {token.short_code}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-brand-muted block">Your Payout</span>
                      <span className="font-extrabold text-base text-brand-primary">
                        ₹{token.seller_payout}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-brand-muted">
              No tokens found matching this filter.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
