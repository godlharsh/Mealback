'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { MessScanner } from '@/components/scanner/MessScanner';
import { useToast } from '@/components/ui/Toast';
import { ScanResult, Mess } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  QrCode,
  BarChart3,
  ChefHat,
  CheckCircle2,
  History,
  Building2,
  MapPin,
  KeyRound,
  Copy,
  Check,
  PlusCircle,
  Users,
  ShieldCheck,
  Loader2,
  ArrowRight,
} from 'lucide-react';

export default function MessScanPage() {
  const { showToast } = useToast();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [messInfo, setMessInfo] = useState<Mess | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Onboarding / Register / Join Form State
  const [onboardingMode, setOnboardingMode] = useState<'register' | 'join'>('register');
  const [regName, setRegName] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    async function loadMessStaff() {
      setIsLoading(true);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*, messes(*)')
          .eq('id', authUser.id)
          .single();

        setUser({
          id: authUser.id,
          email: authUser.email,
          role: userProfile?.role || 'mess',
          fullName: userProfile?.full_name,
        });

        setProfile(userProfile);

        if (userProfile?.messes) {
          setMessInfo(userProfile.messes);
        } else if (userProfile?.mess_id) {
          const { data: messData } = await supabase
            .from('messes')
            .select('*')
            .eq('id', userProfile.mess_id)
            .single();
          if (messData) setMessInfo(messData);
        }
      }
      setIsLoading(false);
    }

    loadMessStaff();
  }, []);

  const handleRegisterMess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setFormError('Please enter a mess name.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/mess/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, location: regLocation }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register mess.');
      }

      setMessInfo(data.mess);
      setProfile((prev: any) => ({
        ...prev,
        mess_id: data.mess.id,
        is_mess_manager: true,
      }));
      showToast(data.message || 'Mess registered successfully!', 'success');
    } catch (err: any) {
      setFormError(err.message || 'Error registering mess.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleJoinMess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setFormError('Please enter a mess access code.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/mess/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: joinCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join mess.');
      }

      setMessInfo(data.mess);
      setProfile((prev: any) => ({
        ...prev,
        mess_id: data.mess.id,
        is_mess_manager: false,
      }));
      showToast(data.message || 'Joined mess successfully!', 'success');
    } catch (err: any) {
      setFormError(err.message || 'Error joining mess.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const copyAccessCode = () => {
    if (messInfo?.access_code) {
      navigator.clipboard.writeText(messInfo.access_code);
      setCopiedCode(true);
      showToast('Mess Access Code copied to clipboard!', 'info');
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

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
        {isLoading ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-card border border-emerald-950/5 animate-pulse">
            <div className="w-12 h-12 bg-gray-200 rounded-2xl mx-auto mb-3" />
            <div className="w-48 h-5 bg-gray-200 rounded-lg mx-auto mb-2" />
            <div className="w-64 h-4 bg-gray-100 rounded-lg mx-auto" />
          </div>
        ) : !messInfo ? (
          /* MESS ONBOARDING CARD: Shown when user has no assigned mess */
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-card border border-emerald-950/5 space-y-6">
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
                <ChefHat className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-black text-brand-dark">Mess Staff Portal</h1>
              <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                To start verifying passes at the counter, register a new mess or join an existing dining hall using its access code.
              </p>
            </div>

            {/* Toggle Modes */}
            <div className="flex items-center gap-2 p-1 bg-brand-light rounded-2xl border border-gray-200 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  setOnboardingMode('register');
                  setFormError('');
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  onboardingMode === 'register'
                    ? 'bg-brand-primary text-white shadow-soft'
                    : 'text-brand-muted hover:text-brand-ink'
                }`}
              >
                Register New Mess
              </button>
              <button
                type="button"
                onClick={() => {
                  setOnboardingMode('join');
                  setFormError('');
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  onboardingMode === 'join'
                    ? 'bg-brand-primary text-white shadow-soft'
                    : 'text-brand-muted hover:text-brand-ink'
                }`}
              >
                Join Existing Mess
              </button>
            </div>

            {formError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-900">
                  <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Database Setup Action Required</span>
                </div>
                <p className="leading-relaxed">{formError}</p>
                {(formError.includes('schema cache') || formError.includes('public.messes') || formError.includes('SQL')) && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <a
                      href="https://supabase.com/dashboard/project/nspggfxbvsytgnzurqul/sql"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-rose-700 text-white font-bold text-[11px] hover:bg-rose-800 transition-colors inline-flex items-center gap-1"
                    >
                      Open Supabase SQL Editor &rarr;
                    </a>
                  </div>
                )}
              </div>
            )}

            {onboardingMode === 'register' ? (
              /* Register New Mess Form */
              <form onSubmit={handleRegisterMess} className="space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-xs font-bold text-brand-ink mb-1.5">
                    Mess / Dining Hall Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. North Wing Dining Hall"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:border-brand-primary focus:outline-none bg-brand-light font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-ink mb-1.5">
                    Campus Location (Optional)
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regLocation}
                      onChange={(e) => setRegLocation(e.target.value)}
                      placeholder="e.g. Hostel Block B, Ground Floor"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:border-brand-primary focus:outline-none bg-brand-light"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  <span className="font-bold">Administrator Notice: </span>
                  Registering this mess makes you the Mess Manager. A unique Mess Access Code will be generated for your dining staff to join your verification counter.
                </div>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-brand-primary text-white font-extrabold text-sm shadow-soft hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registering Mess...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Register Mess & Generate Access Code</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Join Existing Mess Form */
              <form onSubmit={handleJoinMess} className="space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-xs font-bold text-brand-ink mb-1.5">
                    Mess Staff Access Code
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. MESS-8492"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-amber-300 text-sm font-mono font-bold uppercase focus:border-brand-primary focus:outline-none bg-brand-light"
                    />
                  </div>
                  <p className="text-[11px] text-brand-muted mt-1">
                    Ask your mess manager for this code to connect your scanning account.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-brand-primary text-white font-extrabold text-sm shadow-soft hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Joining Mess...</span>
                    </>
                  ) : (
                    <>
                      <span>Connect to Mess Counter</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ACTIVE MESS STAFF DASHBOARD & SCANNER */
          <>
            {/* Mess Header Banner */}
            <div className="bg-gradient-to-r from-brand-dark to-brand-primary rounded-3xl p-6 text-white shadow-card flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-brand-yellow shrink-0">
                  <ChefHat className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-yellow">
                    Mess Counter Station
                  </span>
                  <h1 className="text-xl font-black">{messInfo.name}</h1>
                  {messInfo.location && (
                    <p className="text-xs text-emerald-200 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {messInfo.location}
                    </p>
                  )}
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

            {/* Manager Code Card: Visible to Mess Manager */}
            {profile?.is_mess_manager && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <KeyRound className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">
                      Mess Staff Access Code:
                    </span>
                    <p className="text-[11px] text-amber-800">
                      Share this code with your dining staff to join this scanning station.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="font-mono font-black text-sm bg-white px-3 py-1.5 rounded-xl border border-amber-300 text-brand-dark tracking-wider">
                    {messInfo.access_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyAccessCode}
                    className="p-2 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold transition-colors"
                    title="Copy Access Code"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Scanner Component */}
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
          </>
        )}
      </div>
    </AppLayout>
  );
}
