'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { UserRole } from '@/types/database';
import {
  GraduationCap,
  ShoppingBag,
  ChefHat,
  Mail,
  Lock,
  User,
  Home,
  KeyRound,
  ArrowRight,
  Loader2,
  Check,
  Building2,
  MapPin,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [role, setRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [hostelRoom, setHostelRoom] = useState('');

  // Mess role specific
  const [isMessManager, setIsMessManager] = useState(false);
  const [messName, setMessName] = useState('');
  const [messLocation, setMessLocation] = useState('');
  const [messAccessCode, setMessAccessCode] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationPending, setVerificationPending] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (role === 'mess') {
      if (isMessManager && !messName.trim()) {
        setError('Please enter the name of your mess.');
        return;
      }
      if (!isMessManager && !messAccessCode.trim()) {
        setError('Mess staff registration requires an Access Code from your mess manager.');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          hostelRoom: role === 'student' ? hostelRoom : undefined,
          isMessManager: role === 'mess' ? isMessManager : undefined,
          messName: role === 'mess' && isMessManager ? messName : undefined,
          messLocation: role === 'mess' && isMessManager ? messLocation : undefined,
          messAccessCode: role === 'mess' && !isMessManager ? messAccessCode : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      if (!data.isConfirmed) {
        setVerificationPending(true);
        showToast('Confirmation email sent! Please check your inbox.', 'info');
        return;
      }

      showToast('Account created successfully! Signing you in...', 'success');

      // Auto sign in
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (loginRes.ok) {
        if (role === 'mess') {
          router.push('/mess');
        } else if (role === 'buyer') {
          router.push('/buyer/tokens');
        } else {
          router.push('/student');
        }
      } else {
        router.push('/login');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    {
      id: 'student' as UserRole,
      title: 'Hostel Student',
      desc: 'Sell skipped meals & buy tokens',
      icon: GraduationCap,
      badge: 'List & Buy',
    },
    {
      id: 'buyer' as UserRole,
      title: 'General Buyer',
      desc: 'Day scholar, guest, friend (buy only)',
      icon: ShoppingBag,
      badge: 'Buy Only',
    },
    {
      id: 'mess' as UserRole,
      title: 'Mess Staff',
      desc: 'Scan QR passes & serve meals',
      icon: ChefHat,
      badge: 'Verification Staff',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 bg-brand-mint">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-ticket border border-emerald-950/10"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size="lg" showTagline />
          <h2 className="text-xl font-extrabold text-brand-dark mt-4">
            Create Your Account
          </h2>
          <p className="text-xs text-brand-muted mt-1">
            Choose your role to get started with MealBack
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {verificationPending ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-brand-primary flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-brand-dark">Verify Your Email</h3>
              <p className="text-xs text-brand-muted mt-2 leading-relaxed">
                We've sent a verification link to <span className="font-bold text-brand-dark">{email}</span>. Please click the link in your email to verify your account before logging in.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-soft hover:bg-brand-dark transition-colors"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-5">
            {/* Big Tappable Role Picker Cards */}
            <div>
              <label className="block text-xs font-bold text-brand-ink mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {roles.map((r) => {
                  const Icon = r.icon;
                  const isSelected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`p-3.5 rounded-2xl border-2 text-left flex flex-col justify-between transition-all relative ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/10 shadow-soft scale-[1.02]'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                              isSelected
                                ? 'bg-brand-primary text-white'
                                : 'bg-brand-mint text-brand-primary'
                            }`}
                          >
                            <Icon className="w-4 h-4 stroke-[2.2]" />
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="font-extrabold text-xs text-brand-dark leading-tight">
                          {r.title}
                        </p>
                        <p className="text-[10px] text-brand-muted mt-0.5 leading-snug">
                          {r.desc}
                        </p>
                      </div>
                      <span className="mt-2 text-[9px] font-bold uppercase tracking-wider text-brand-primary px-2 py-0.5 rounded-md bg-brand-primary/10 self-start">
                        {r.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:outline-none bg-brand-light"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1">
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:outline-none bg-brand-light"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:outline-none bg-brand-light"
                  />
                </div>
              </div>

              {/* Student specific: Hostel Room */}
              {role === 'student' && (
                <div>
                  <label className="block text-xs font-bold text-brand-ink mb-1">
                    Hostel & Room Number
                  </label>
                  <div className="relative">
                    <Home className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={hostelRoom}
                      onChange={(e) => setHostelRoom(e.target.value)}
                      placeholder="e.g. Hostel A, Room 204"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:outline-none bg-brand-light"
                    />
                  </div>
                </div>
              )}

              {/* Mess Staff specific: Register vs Join */}
              {role === 'mess' && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-200">
                    <button
                      type="button"
                      onClick={() => setIsMessManager(false)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        !isMessManager
                          ? 'bg-amber-900 text-white shadow-xs'
                          : 'bg-white/60 text-amber-900 hover:bg-white'
                      }`}
                    >
                      Join Existing Mess
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMessManager(true)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        isMessManager
                          ? 'bg-amber-900 text-white shadow-xs'
                          : 'bg-white/60 text-amber-900 hover:bg-white'
                      }`}
                    >
                      Register New Mess
                    </button>
                  </div>

                  {isMessManager ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-amber-950 mb-1">
                          Mess Name
                        </label>
                        <div className="relative">
                          <Building2 className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={messName}
                            onChange={(e) => setMessName(e.target.value)}
                            placeholder="e.g. North Wing Dining Hall"
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-amber-300 text-sm focus:border-brand-primary focus:outline-none bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-amber-950 mb-1">
                          Mess Location (Optional)
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={messLocation}
                            onChange={(e) => setMessLocation(e.target.value)}
                            placeholder="e.g. Block 4, Ground Floor"
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-amber-300 text-sm focus:border-brand-primary focus:outline-none bg-white"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-amber-800">
                        A unique Access Code will be automatically generated for your mess so your staff can join.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">
                        Mess Access Code
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={messAccessCode}
                          onChange={(e) => setMessAccessCode(e.target.value.toUpperCase())}
                          placeholder="e.g. MESS-4921"
                          className="w-full pl-10 pr-4 py-2 rounded-xl border border-amber-300 text-sm font-mono font-bold uppercase focus:border-brand-primary focus:outline-none bg-white"
                        />
                      </div>
                      <p className="text-[11px] text-amber-800 mt-1">
                        Obtain this code from your mess manager or dining in-charge.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-brand-primary text-white font-extrabold text-sm shadow-soft hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-brand-muted">
          Already registered?{' '}
          <Link href="/login" className="font-bold text-brand-primary hover:underline">
            Sign In here
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
