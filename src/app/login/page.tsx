'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { Lock, Mail, ArrowRight, Loader2, Sparkles, KeyRound } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectUrl = searchParams.get('redirect');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in.');
      }

      showToast(`Welcome back, ${data.user.email}!`, 'success');

      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (data.role === 'mess') {
        router.push('/mess');
      } else if (data.role === 'buyer') {
        router.push('/buyer/tokens');
      } else {
        router.push('/student');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('password123');
    setError('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white rounded-3xl p-8 shadow-ticket border border-emerald-950/10"
    >
      <div className="flex flex-col items-center text-center mb-6">
        <Logo size="lg" showTagline />
        <h2 className="text-xl font-extrabold text-brand-dark mt-4">
          Sign In to Your Account
        </h2>
        <p className="text-xs text-brand-muted mt-1">
          Access your meal tokens, wallet, or mess scanner
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-brand-ink mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@college.edu"
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:border-brand-primary focus:outline-none bg-brand-light"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-brand-ink mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:border-brand-primary focus:outline-none bg-brand-light"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 rounded-2xl bg-brand-primary text-white font-extrabold text-sm shadow-soft hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Quick Demo Fill Buttons */}
      <div className="mt-6 pt-5 border-t border-brand-mint">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-brand-dark mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-yellow fill-brand-yellow" />
          <span>One-Click Demo Credentials</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleDemoFill('student@mealback.demo')}
            className="p-2 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex flex-col items-center gap-1 transition-colors"
          >
            <span>🎓 Student</span>
            <span className="text-[10px] text-emerald-700 font-normal">Hostel A</span>
          </button>
          <button
            type="button"
            onClick={() => handleDemoFill('buyer@mealback.demo')}
            className="p-2 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-900 text-xs font-bold flex flex-col items-center gap-1 transition-colors"
          >
            <span>🛒 Buyer</span>
            <span className="text-[10px] text-blue-700 font-normal">Day Scholar</span>
          </button>
          <button
            type="button"
            onClick={() => handleDemoFill('mess@mealback.demo')}
            className="p-2 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100 text-amber-900 text-xs font-bold flex flex-col items-center gap-1 transition-colors"
          >
            <span>🍲 Mess Staff</span>
            <span className="text-[10px] text-amber-700 font-normal">Scanner</span>
          </button>
        </div>
      </div>

      {/* Bottom Switch to Sign Up */}
      <div className="mt-6 text-center text-xs text-brand-muted">
        Don't have an account yet?{' '}
        <Link
          href="/signup"
          className="font-bold text-brand-primary hover:underline"
        >
          Create an Account
        </Link>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-brand-mint">
      <Suspense
        fallback={
          <div className="p-8 bg-white rounded-3xl shadow-ticket text-center text-xs text-brand-muted">
            Loading sign in...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
