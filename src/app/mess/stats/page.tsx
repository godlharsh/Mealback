'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart3,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  Star,
  Utensils,
  History,
  TrendingUp,
} from 'lucide-react';

export default function MessStatsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [messInfo, setMessInfo] = useState<any>(null);
  const [stats, setStats] = useState<any>({
    listed_count: 0,
    sold_count: 0,
    used_count: 0,
    pending_count: 0,
    average_rating: 4.8,
    meals: {
      breakfast: { listed: 0, sold: 0, used: 0 },
      lunch: { listed: 0, sold: 0, used: 0 },
      dinner: { listed: 0, sold: 0, used: 0 },
    },
    recent_scans: [],
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, messes(*)')
          .eq('id', authUser.id)
          .single();

        setUser({
          id: authUser.id,
          email: authUser.email,
          role: profile?.role || 'mess',
          fullName: profile?.full_name,
        });

        if (profile?.messes) {
          setMessInfo(profile.messes);
        }

        try {
          const res = await fetch('/api/mess/stats');
          if (res.ok) {
            const data = await res.json();
            setStats(data);
          }
        } catch (e) {
          console.warn('Error loading mess stats:', e);
        }
      }
      setLoading(false);
    }

    loadStats();
  }, []);

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div>
          <Link
            href="/mess"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Scanner
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-black text-brand-dark">Today's Mess Dashboard</h1>
              <p className="text-xs text-brand-muted mt-0.5">
                {messInfo?.name || 'Boys Hostel A Mess'} &bull; Real-time redemption analytics
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>Mess Average Rating: {stats.average_rating || 4.8} / 5.0</span>
            </div>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-card border border-emerald-950/5">
            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider block">
              Tokens Listed
            </span>
            <span className="text-3xl font-black text-brand-dark mt-1 block">
              {stats.listed_count}
            </span>
            <span className="text-[11px] text-amber-700 font-semibold mt-1 block">
              Available on market
            </span>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-card border border-emerald-950/5">
            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider block">
              Tokens Sold
            </span>
            <span className="text-3xl font-black text-brand-primary mt-1 block">
              {stats.sold_count}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
              Purchased by buyers
            </span>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-card border border-emerald-950/5">
            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider block">
              Meals Served
            </span>
            <span className="text-3xl font-black text-emerald-800 mt-1 block">
              {stats.used_count}
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
              Verified & Redeemed
            </span>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-card border border-emerald-950/5">
            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider block">
              Mess Commission
            </span>
            <span className="text-3xl font-black text-brand-dark mt-1 block">
              ₹{(stats.sold_count + stats.used_count) * 4}
            </span>
            <span className="text-[11px] text-brand-muted font-semibold mt-1 block">
              ₹4 per sold token
            </span>
          </div>
        </div>

        {/* Breakdown Per Meal */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-card border border-emerald-950/5">
          <h2 className="text-lg font-extrabold text-brand-dark pb-4 border-b border-brand-mint">
            Today's Breakdown Per Meal
          </h2>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'breakfast', name: 'Breakfast', icon: '🌅' },
              { id: 'lunch', name: 'Lunch', icon: '☀️' },
              { id: 'dinner', name: 'Dinner', icon: '🌙' },
            ].map((meal) => {
              const data = stats.meals?.[meal.id] || { listed: 0, sold: 0, used: 0 };
              return (
                <div
                  key={meal.id}
                  className="p-5 rounded-2xl bg-brand-light border border-brand-mint/80 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{meal.icon}</span>
                    <h3 className="font-extrabold text-base text-brand-dark">{meal.name}</h3>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-brand-muted">
                      <span>Currently Listed:</span>
                      <span className="font-bold text-brand-dark">{data.listed}</span>
                    </div>
                    <div className="flex justify-between items-center text-brand-muted">
                      <span>Sold (Awaiting Serve):</span>
                      <span className="font-bold text-brand-primary">{data.sold}</span>
                    </div>
                    <div className="flex justify-between items-center text-brand-muted pt-1 border-t border-brand-mint">
                      <span>Served & Used:</span>
                      <span className="font-extrabold text-emerald-800">{data.used}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Scans Log */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-card border border-emerald-950/5">
          <div className="flex items-center justify-between pb-4 border-b border-brand-mint">
            <h2 className="text-lg font-extrabold text-brand-dark flex items-center gap-2">
              <History className="w-5 h-5 text-brand-primary" />
              Recent Scans at Counter
            </h2>
            <Link
              href="/mess/history"
              className="text-xs font-bold text-brand-primary hover:underline"
            >
              Full Log &rarr;
            </Link>
          </div>

          <div className="mt-4">
            {stats.recent_scans && stats.recent_scans.length > 0 ? (
              <div className="divide-y divide-brand-mint/60">
                {stats.recent_scans.map((scan: any) => (
                  <div
                    key={scan.token_id}
                    className="py-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <div>
                        <span className="font-bold capitalize text-brand-dark">
                          {scan.meal_type} Meal Served
                        </span>
                        <span className="text-brand-muted block text-[11px]">
                          Code: {scan.short_code}
                        </span>
                      </div>
                    </div>

                    <span className="text-brand-muted font-medium">
                      {new Date(scan.used_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-brand-muted">
                No tokens scanned yet today. Start scanning from the Scan Token screen!
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
