'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { createClient } from '@/lib/supabase/client';
import {
  UtensilsCrossed,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  QrCode,
  Wallet,
  Clock,
  Store,
  GraduationCap,
  ShoppingBag,
  ChefHat,
  ChevronRight,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        setUser(authUser);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-brand-mint text-brand-ink flex flex-col justify-between selection:bg-brand-primary selection:text-white">
      {/* Top Navbar */}
      <header className="px-6 py-4 max-w-6xl w-full mx-auto flex items-center justify-between">
        <Logo size="md" showTagline />

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/marketplace"
              className="px-5 py-2.5 rounded-2xl bg-brand-primary text-white text-xs font-bold shadow-soft hover:bg-brand-dark transition-colors flex items-center gap-1.5"
            >
              <span>Go to App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl text-xs font-bold text-brand-dark hover:bg-white/50 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-soft hover:bg-brand-dark transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl w-full mx-auto px-6 py-12 md:py-16 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-soft border border-emerald-950/5 text-xs font-bold text-brand-primary">
          <Sparkles className="w-3.5 h-3.5 text-brand-yellow fill-brand-yellow" />
          <span>Campus Meal Token Exchange</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-brand-dark max-w-3xl mx-auto leading-[1.15]">
          Skip a meal. <br />
          <span className="text-brand-primary">Get value back.</span>
        </h1>

        <p className="text-sm md:text-base text-brand-muted max-w-xl mx-auto leading-relaxed">
          Hostel students who skip mess meals can list them as digital tokens at their chosen price. Anyone can purchase available meal tokens with secure instant QR verification at the mess counter.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <Link
            href="/marketplace"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-brand-primary text-white font-extrabold text-base shadow-card hover:bg-brand-dark transition-all flex items-center justify-center gap-2 group"
          >
            <Store className="w-5 h-5" />
            <span>Explore Meal Marketplace</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-brand-dark font-extrabold text-base shadow-soft hover:bg-brand-light transition-all border border-emerald-950/5 flex items-center justify-center gap-2"
          >
            <span>Create Free Account</span>
          </Link>
        </div>

        {/* Role Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-8 text-left">
          <Link
            href="/student"
            className="bg-white rounded-3xl p-6 shadow-card border border-emerald-950/5 hover:border-brand-primary/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-brand-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-brand-dark">For Hostel Students</h3>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">
              List up to 10 skipped meals per calendar month. Set your own asking price and receive payouts directly to your digital wallet upon verified scan.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary mt-4 group-hover:underline">
              Enter Student Dashboard &rarr;
            </span>
          </Link>

          <Link
            href="/marketplace"
            className="bg-white rounded-3xl p-6 shadow-card border border-emerald-950/5 hover:border-brand-primary/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-brand-dark">For Day Scholars & Guests</h3>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">
              Browse available breakfast, lunch, and dinner passes at student-listed prices. Pay with simulated UPI and get your QR.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary mt-4 group-hover:underline">
              Browse Marketplace &rarr;
            </span>
          </Link>

          <Link
            href="/mess"
            className="bg-white rounded-3xl p-6 shadow-card border border-emerald-950/5 hover:border-brand-primary/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <ChefHat className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-brand-dark">For Mess Staff</h3>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">
              Scan passes with device camera or enter short code. Massive instant status screen: VERIFIED "Serve karo".
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary mt-4 group-hover:underline">
              Open Mess Scanner &rarr;
            </span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-950/5 py-6 text-center text-xs font-medium text-brand-muted">
        <p>MealBack &bull; "Skip a meal. Get value back." &bull; Campus Food Token Platform</p>
      </footer>
    </div>
  );
}
