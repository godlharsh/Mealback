'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { MessScanner } from '@/components/scanner/MessScanner';
import { useToast } from '@/components/ui/Toast';
import { ScanResult } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { QrCode, BarChart3, ChefHat, CheckCircle2, History } from 'lucide-react';

export default function MessScanPage() {
  const { showToast } = useToast();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [messInfo, setMessInfo] = useState<any>(null);

  useEffect(() => {
    async function loadMessStaff() {
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
        } else {
          setMessInfo({
            name: 'Boys Hostel A Mess',
            access_code: 'MESS-DEMO',
          });
        }
      }
    }

    loadMessStaff();
  }, []);

  const handleScanComplete = (result: ScanResult) => {
    if (result.result === 'VERIFIED') {
      showToast('Token verified! Serve meal.', 'success');
    } else {
      showToast(`Scan note: ${result.result}`, 'error');
    }
  };

  return (
    <AppLayout user={user}>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Mess Header Banner */}
        <div className="bg-gradient-to-r from-brand-dark to-brand-primary rounded-3xl p-6 text-white shadow-card flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-brand-yellow shrink-0">
              <ChefHat className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-yellow">
                Mess Staff Counter
              </span>
              <h1 className="text-xl font-black">
                {messInfo?.name || 'Boys Hostel A Mess'}
              </h1>
              <p className="text-xs text-emerald-200 mt-0.5">
                Authorized Verification & Meal Serving Station
              </p>
            </div>
          </div>

          <Link
            href="/mess/stats"
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs backdrop-blur-sm transition-colors border border-white/20"
          >
            <BarChart3 className="w-4 h-4" />
            Today's Stats
          </Link>
        </div>

        {/* Scanner Component with Camera + Fallback */}
        <MessScanner onScanComplete={handleScanComplete} />

        {/* Quick Links below */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href="/mess/stats"
            className="p-4 rounded-2xl bg-white border border-emerald-950/5 shadow-soft hover:shadow-card transition-all flex items-center gap-3 text-brand-dark"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-mint text-brand-primary flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs block">Today's Meal Stats</span>
              <span className="text-[10px] text-brand-muted">Listed, Sold, Used</span>
            </div>
          </Link>

          <Link
            href="/mess/history"
            className="p-4 rounded-2xl bg-white border border-emerald-950/5 shadow-soft hover:shadow-card transition-all flex items-center gap-3 text-brand-dark"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-mint text-brand-primary flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs block">Scan History Log</span>
              <span className="text-[10px] text-brand-muted">Recent verifications</span>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
