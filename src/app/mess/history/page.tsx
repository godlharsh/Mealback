'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { History, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function MessHistoryPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadHistory() {
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

        if (profile?.mess_id) {
          const { data } = await supabase
            .from('tokens')
            .select('*')
            .eq('mess_id', profile.mess_id)
            .eq('status', 'used')
            .order('used_at', { ascending: false });

          if (data) {
            setScans(data);
          }
        }
      }
      setLoading(false);
    }

    loadHistory();
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
          <h1 className="text-2xl font-black text-brand-dark">Mess Scan History</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Audit trail of verified token redemptions
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-card border border-emerald-950/5">
          {loading ? (
            <div className="py-12 text-center text-xs text-brand-muted animate-pulse">
              Loading scan log...
            </div>
          ) : scans.length > 0 ? (
            <div className="divide-y divide-brand-mint/80">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-brand-dark capitalize">
                        {scan.meal_type} Meal Served
                      </p>
                      <p className="text-brand-muted mt-0.5">
                        Token Code: <span className="font-mono font-bold">{scan.short_code}</span> &bull; Meal Date: {scan.meal_date}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-brand-dark block">
                      {new Date(scan.used_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="text-brand-muted">
                      {new Date(scan.used_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-brand-muted">
              No scan history found yet.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
