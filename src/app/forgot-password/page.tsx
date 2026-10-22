'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { Mail, ArrowRight, Loader2, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [directResetUrl, setDirectResetUrl] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setError('');
    setDirectResetUrl('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset link.');
      }

      setIsSent(true);
      if (data.resetUrl) {
        setDirectResetUrl(data.resetUrl);
        setInfoMessage(data.message || 'Direct reset link ready.');
      }
      showToast('Password reset link processed successfully!', 'success');
    } catch (err: any) {
      setError(err.message || 'Error sending reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-brand-mint">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 shadow-ticket border border-emerald-950/10"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size="lg" showTagline />
          <h2 className="text-xl font-extrabold text-brand-dark mt-4">
            Reset Your Password
          </h2>
          <p className="text-xs text-brand-muted mt-1">
            We will help you securely set a new password for your account
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {isSent ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-brand-primary flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-base text-brand-dark">
                {directResetUrl ? 'Reset Link Ready' : 'Check Your Inbox'}
              </h3>
              <p className="text-xs text-brand-muted mt-1.5 leading-relaxed">
                {directResetUrl
                  ? infoMessage
                  : `We've sent a secure password reset link to ${email}. Click the link in your email to set a new password.`}
              </p>
            </div>

            {directResetUrl && (
              <div className="pt-2">
                <a
                  href={directResetUrl}
                  className="w-full py-3.5 px-4 rounded-2xl bg-brand-primary text-white font-extrabold text-xs shadow-soft hover:bg-brand-dark transition-all flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Click Here to Set New Password</span>
                </a>
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-brand-ink mb-1.5">
                Registered Email Address
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-brand-primary text-white font-extrabold text-sm shadow-soft hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Request...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-muted hover:text-brand-dark"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
