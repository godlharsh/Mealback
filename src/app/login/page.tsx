'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { Lock, Mail, ArrowRight, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState(searchParams.get('error') || '');
  const [infoMessage, setInfoMessage] = useState('');

  const redirectUrl = searchParams.get('redirect');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setIsLoading(true);
    setError('');
    setInfoMessage('');

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

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address to resend verification.');
      return;
    }
    setIsResending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend verification email.');
      }
      setInfoMessage(data.message || 'Verification email sent! Check your inbox.');
      showToast('Verification email resent!', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const isUnconfirmed = error.toLowerCase().includes('confirm') || error.toLowerCase().includes('verif');

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

      {infoMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {infoMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {isUnconfirmed && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isResending}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-800 underline hover:text-rose-950 self-start mt-1"
            >
              <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
              <span>Resend verification email</span>
            </button>
          )}
          {error.toLowerCase().includes('password') && (
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 underline hover:text-rose-950 self-start mt-0.5"
            >
              Reset your password with Forgot Password &rarr;
            </Link>
          )}
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-brand-ink">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-semibold text-brand-primary hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
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

      {/* Bottom Switch to Sign Up */}
      <div className="mt-6 text-center text-xs text-brand-muted pt-5 border-t border-brand-mint">
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
