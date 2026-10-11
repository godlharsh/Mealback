'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { WalletEntry } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  Wallet,
  ArrowLeft,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

export default function StudentWalletPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [pendingBalance, setPendingBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadWallet() {
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
          .from('wallet_entries')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (data) {
          setEntries(data as WalletEntry[]);
          let avail = 0;
          let pend = 0;
          data.forEach((entry) => {
            if (entry.status === 'available' || entry.status === 'paid') {
              avail += Number(entry.amount);
            } else if (entry.status === 'pending') {
              pend += Number(entry.amount);
            }
          });
          setAvailableBalance(avail);
          setPendingBalance(pend);
        }
      }
      setLoading(false);
    }

    loadWallet();
  }, []);

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div>
          <Link
            href="/student"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-black text-brand-dark">Earnings Wallet</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Transparent payout ledger for your redeemed meal passes
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Available for Payout */}
          <div className="bg-gradient-to-br from-brand-dark to-brand-primary rounded-3xl p-6 text-white shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-200">
                <span>Available Balance</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="mt-3">
                <span className="text-4xl font-black text-white">₹{availableBalance}</span>
                <p className="text-xs text-emerald-100/90 mt-1">
                  Ready for UPI transfer to your bank account
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-emerald-200">Earned from verified scans</span>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-brand-yellow text-brand-dark font-extrabold hover:bg-yellow-400 transition-colors shadow-sm"
                onClick={() => alert('Payout request registered! Simulated UPI transfer initiated to student VPA.')}
              >
                Withdraw to UPI
              </button>
            </div>
          </div>

          {/* Pending Verification */}
          <div className="bg-white rounded-3xl p-6 shadow-card border border-emerald-950/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-700">
                <span>Pending Verification</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-3">
                <span className="text-4xl font-black text-brand-dark">₹{pendingBalance}</span>
                <p className="text-xs text-brand-muted mt-1">
                  Locked in escrow until the mess staff scans the buyer's token
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-brand-mint text-xs text-brand-muted flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Automatically unlocks to Available as soon as token is scanned.</span>
            </div>
          </div>
        </div>

        {/* Transaction History Ledger */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-card border border-emerald-950/5">
          <h2 className="text-lg font-extrabold text-brand-dark pb-4 border-b border-brand-mint">
            Wallet Ledger History
          </h2>

          <div className="mt-4">
            {loading ? (
              <div className="py-10 text-center text-xs text-brand-muted animate-pulse">
                Loading wallet transactions...
              </div>
            ) : entries.length > 0 ? (
              <div className="divide-y divide-brand-mint/60">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          entry.status === 'available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <ArrowDownLeft className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-brand-dark">
                          {entry.description || 'Meal Token Credit'}
                        </p>
                        <p className="text-[11px] text-brand-muted mt-0.5">
                          {new Date(entry.created_at).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-extrabold text-sm text-emerald-700">
                        +₹{entry.amount}
                      </span>
                      <span
                        className={`block text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                          entry.status === 'available'
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-brand-muted">
                No wallet transactions recorded yet. List a meal to start earning!
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
