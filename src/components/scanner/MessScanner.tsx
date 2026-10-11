'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanResult } from '@/types/database';
import {
  Camera,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Utensils,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface MessScannerProps {
  onScanComplete?: (result: ScanResult) => void;
}

export function MessScanner({ onScanComplete }: MessScannerProps) {
  const [manualCode, setManualCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const processVerification = async (identifier: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/tokens/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data: ScanResult = await res.json();
      setScanResult(data);
      if (onScanComplete) {
        onScanComplete(data);
      }
    } catch (err: any) {
      setScanResult({
        result: 'INVALID',
        message: err.message || 'Network error verifying token',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'camera') {
      const scanner = new Html5QrcodeScanner(
        'mealback-qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          aspectRatio: 1.0,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          // Pause and verify
          processVerification(decodedText);
        },
        (errorMessage) => {
          // ignore common scan frame noise
        }
      );

      scannerRef.current = scanner;

      return () => {
        try {
          scanner.clear();
        } catch (e) {
          // cleanup
        }
      };
    }
  }, [activeTab]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processVerification(manualCode.trim());
  };

  const handleNextScan = () => {
    setScanResult(null);
    setManualCode('');
  };

  return (
    <div className="relative">
      {/* Mode toggle */}
      <div className="flex bg-brand-mint/80 p-1.5 rounded-2xl max-w-sm mx-auto mb-6 border border-brand-primary/10">
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'camera'
              ? 'bg-brand-primary text-white shadow-soft'
              : 'text-brand-muted hover:text-brand-ink'
          }`}
        >
          <Camera className="w-4 h-4" />
          Camera Scanner
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'manual'
              ? 'bg-brand-primary text-white shadow-soft'
              : 'text-brand-muted hover:text-brand-ink'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          Enter Code Fallback
        </button>
      </div>

      {/* Main scanner container */}
      <div className="bg-white rounded-3xl p-6 shadow-card border border-emerald-950/5 max-w-lg mx-auto">
        {activeTab === 'camera' ? (
          <div>
            <div className="text-center mb-4">
              <h3 className="font-extrabold text-base text-brand-dark">
                Scan Student Meal QR
              </h3>
              <p className="text-xs text-brand-muted mt-0.5">
                Align the buyer's QR code within the viewfinder
              </p>
            </div>

            <div
              id="mealback-qr-reader"
              className="rounded-2xl overflow-hidden border-2 border-brand-mint min-h-[300px]"
            />

            {isProcessing && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-brand-primary">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying token with mess database...</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="text-center mb-5">
              <h3 className="font-extrabold text-base text-brand-dark">
                Manual Token Code Verification
              </h3>
              <p className="text-xs text-brand-muted mt-0.5">
                If the phone screen is cracked or camera is unavailable, enter the short code
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1.5">
                  Enter 8-digit Short Code (e.g. 5521-VAL) or Secret
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. 5521-VAL"
                  className="w-full text-center text-lg font-mono font-bold tracking-widest uppercase p-3.5 rounded-2xl border-2 border-brand-mint focus:border-brand-primary focus:outline-none bg-brand-light"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing || !manualCode.trim()}
                className="w-full py-3.5 rounded-2xl bg-brand-primary text-white font-extrabold text-sm shadow-soft hover:bg-brand-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Test Buttons */}
            <div className="mt-6 pt-5 border-t border-brand-mint">
              <p className="text-[11px] font-bold text-brand-muted uppercase tracking-wider mb-2 text-center">
                Quick Test Shortcuts (Seeded demo tokens)
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setManualCode('5521-VAL');
                    processVerification('5521-VAL');
                  }}
                  className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 text-left"
                >
                  🟢 5521-VAL (Ready)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualCode('9999-USD');
                    processVerification('9999-USD');
                  }}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold border border-rose-200 text-left"
                >
                  🔴 9999-USD (Used)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualCode('7777-EXP');
                    processVerification('7777-EXP');
                  }}
                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 text-left"
                >
                  🟡 7777-EXP (Expired)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualCode('4444-WNG');
                    processVerification('4444-WNG');
                  }}
                  className="p-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold border border-orange-200 text-left"
                >
                  🟠 4444-WNG (Other Mess)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HUGE FULL-SCREEN RESULT MODAL */}
      <AnimatePresence>
        {scanResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              className={`max-w-md w-full rounded-3xl overflow-hidden shadow-2xl border-4 text-center p-8 ${
                scanResult.result === 'VERIFIED'
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : scanResult.result === 'ALREADY_USED'
                  ? 'bg-rose-700 text-white border-rose-500'
                  : scanResult.result === 'EXPIRED'
                  ? 'bg-amber-500 text-amber-950 border-amber-300'
                  : scanResult.result === 'WRONG_MESS'
                  ? 'bg-orange-600 text-white border-orange-400'
                  : 'bg-slate-700 text-white border-slate-500'
              }`}
            >
              {/* Icon state */}
              <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center shadow-lg bg-white/20 backdrop-blur-sm mb-6">
                {scanResult.result === 'VERIFIED' && (
                  <CheckCircle2 className="w-16 h-16 text-white stroke-[2.5]" />
                )}
                {scanResult.result === 'ALREADY_USED' && (
                  <XCircle className="w-16 h-16 text-white stroke-[2.5]" />
                )}
                {scanResult.result === 'EXPIRED' && (
                  <AlertTriangle className="w-16 h-16 text-amber-950 stroke-[2.5]" />
                )}
                {scanResult.result === 'WRONG_MESS' && (
                  <ShieldAlert className="w-16 h-16 text-white stroke-[2.5]" />
                )}
                {scanResult.result === 'INVALID' && (
                  <HelpCircle className="w-16 h-16 text-white stroke-[2.5]" />
                )}
              </div>

              {/* Status Header */}
              <div className="space-y-2">
                <span className="text-xs font-black tracking-widest uppercase px-3 py-1 rounded-full bg-black/20">
                  {scanResult.result}
                </span>

                <h2 className="text-4xl font-black tracking-tight">
                  {scanResult.result === 'VERIFIED' && 'Serve karo!'}
                  {scanResult.result === 'ALREADY_USED' && 'ALREADY USED!'}
                  {scanResult.result === 'EXPIRED' && 'TOKEN EXPIRED!'}
                  {scanResult.result === 'WRONG_MESS' && 'WRONG MESS!'}
                  {scanResult.result === 'INVALID' && 'INVALID TOKEN!'}
                </h2>

                <p className="text-sm font-semibold opacity-90 max-w-xs mx-auto">
                  {scanResult.message}
                </p>
              </div>

              {/* Detailed Context Box */}
              <div className="my-6 p-4 rounded-2xl bg-black/20 backdrop-blur-sm text-xs font-medium space-y-1.5">
                {scanResult.meal_type && (
                  <div className="flex justify-between items-center">
                    <span className="opacity-75">Meal Type:</span>
                    <span className="font-bold text-sm uppercase">
                      {scanResult.meal_type}
                    </span>
                  </div>
                )}
                {scanResult.short_code && (
                  <div className="flex justify-between items-center">
                    <span className="opacity-75">Short Code:</span>
                    <span className="font-mono font-bold">{scanResult.short_code}</span>
                  </div>
                )}
                {scanResult.used_at && (
                  <div className="flex justify-between items-center">
                    <span className="opacity-75">Used At:</span>
                    <span className="font-bold">
                      {new Date(scanResult.used_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                {scanResult.valid_until && (
                  <div className="flex justify-between items-center">
                    <span className="opacity-75">Validity Expired:</span>
                    <span className="font-bold">
                      {new Date(scanResult.valid_until).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleNextScan}
                className="w-full py-4 rounded-2xl bg-white text-brand-dark font-black text-base shadow-lg hover:bg-brand-mint transition-colors"
              >
                Next Scan
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
