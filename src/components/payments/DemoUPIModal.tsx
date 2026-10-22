'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { MarketplaceToken } from '@/types/database';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Smartphone,
  Lock,
  X,
  CreditCard,
} from 'lucide-react';

interface DemoUPIModalProps {
  token: MarketplaceToken | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokenData: any) => void;
}

export function DemoUPIModal({
  token,
  isOpen,
  onClose,
  onSuccess,
}: DemoUPIModalProps) {
  const [step, setStep] = useState<'prompt' | 'processing' | 'success' | 'failed'>('prompt');
  const [selectedUPIApp, setSelectedUPIApp] = useState<'gpay' | 'phonepe' | 'paytm'>('gpay');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !token) return null;

  const handlePay = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep('processing');
    setErrorMessage('');

    try {
      const res = await fetch('/api/tokens/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: token.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Payment failed. Please try again.');
        setStep('failed');
        setIsSubmitting(false);
        return;
      }

      // Successful payment
      setStep('success');

      // Trigger realistic confetti celebration
      try {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#1F7A4D', '#F6C945', '#0F3D2E', '#E8704A'],
        });
      } catch (e) {
        console.warn('Confetti note:', e);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onSuccess(data.token);
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred during payment.');
      setStep('failed');
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep('prompt');
    setErrorMessage('');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-ticket border border-emerald-950/10"
        >
          {/* UPI App Header Bar */}
          <div className="bg-brand-dark text-white p-5 flex items-center justify-between relative">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-brand-yellow font-black text-sm">
                ₹
              </div>
              <div>
                <h4 className="font-extrabold text-sm tracking-wide">MealBack Sandbox Checkout</h4>
                <div className="flex items-center gap-1 text-[11px] text-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Sandbox Environment &bull; No Real Funds Debited</span>
                </div>
              </div>
            </div>

            {step !== 'processing' && (
              <button
                onClick={handleReset}
                className="text-white/70 hover:text-white p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Test Mode Label Banner */}
          <div className="bg-amber-100 text-amber-900 px-4 py-2 text-xs font-semibold text-center flex items-center justify-center gap-1.5 border-b border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Sandbox Mode: Payment gateway not configured. Simulating purchase.</span>
          </div>

          <div className="p-6">
            {step === 'prompt' && (
              <div className="space-y-5">
                {/* Meal & Price Breakdown */}
                <div className="bg-brand-mint/60 p-4 rounded-2xl border border-brand-primary/15 text-center">
                  <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Paying For
                  </p>
                  <p className="font-extrabold text-brand-dark text-lg capitalize mt-0.5">
                    {token.meal_type} at {token.mess_name}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {token.meal_date} &bull; Serving at {token.meal_time.slice(0, 5)}
                  </p>

                  <div className="mt-3 pt-3 border-t border-brand-primary/10 flex items-center justify-center gap-2">
                    <span className="text-3xl font-black text-brand-dark">
                      ₹{token.list_price}
                    </span>
                  </div>
                </div>

                {/* Simulated UPI App Selector */}
                <div>
                  <p className="text-xs font-bold text-brand-ink mb-2">Simulate Paying Via:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'gpay', name: 'Google Pay', icon: '🟢' },
                      { id: 'phonepe', name: 'PhonePe', icon: '🟣' },
                      { id: 'paytm', name: 'Paytm UPI', icon: '🔵' },
                    ].map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setSelectedUPIApp(app.id as any)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          selectedUPIApp === app.id
                            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 text-brand-muted'
                        }`}
                      >
                        <span className="text-base">{app.icon}</span>
                        <span>{app.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pay Action Button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePay}
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-2xl bg-brand-primary text-white font-extrabold text-base shadow-card hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initiating UPI...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{token.list_price}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-brand-muted">
                  <Lock className="w-3 h-3 text-brand-primary" />
                  <span>Sandbox checkout for development & testing</span>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="py-8 text-center space-y-4">
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                  <Loader2 className="w-16 h-16 text-brand-primary animate-spin" />
                  <Smartphone className="w-7 h-7 text-brand-dark absolute" />
                </div>
                <div>
                  <h4 className="font-extrabold text-lg text-brand-ink">
                    Reserving Token...
                  </h4>
                  <p className="text-xs text-brand-muted mt-1">
                    Processing atomic token reservation in Supabase...
                  </p>
                </div>
              </div>
            )}

            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="font-black text-xl text-emerald-900">
                    Payment Successful!
                  </h4>
                  <p className="text-xs text-emerald-700 font-semibold mt-1">
                    Token booked! Generating your QR ticket...
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'failed' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <X className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="font-extrabold text-lg text-rose-900">Purchase Failed</h4>
                  <p className="text-xs text-rose-700 mt-1">{errorMessage}</p>
                </div>
                <button
                  onClick={() => setStep('prompt')}
                  className="w-full py-3 rounded-2xl bg-brand-primary text-white font-bold text-sm"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
