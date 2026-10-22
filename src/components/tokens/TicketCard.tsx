'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
import { Token } from '@/types/database';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Calendar,
  Clock,
  MapPin,
  Star,
  Copy,
  Check,
  Utensils,
  AlertCircle,
} from 'lucide-react';

interface TicketCardProps {
  token: Token;
  onRate?: (token: Token) => void;
}

export function TicketCard({ token, onRate }: TicketCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (token.qr_secret) {
      QRCode.toDataURL(token.qr_secret, {
        width: 220,
        margin: 1.5,
        color: {
          dark: '#0F3D2E',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Error generating QR:', err));
    }
  }, [token.qr_secret]);

  const copyShortCode = () => {
    navigator.clipboard.writeText(token.short_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUsed = token.status === 'used';
  const isExpired = token.status === 'expired';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-ticket border border-emerald-950/10 overflow-hidden relative max-w-sm w-full mx-auto"
    >
      {/* Top Header of Ticket */}
      <div className="bg-brand-dark text-white p-5 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-yellow">
            Digital Meal Pass
          </span>
          <StatusBadge status={token.status} size="sm" />
        </div>

        <div className="mt-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-xl capitalize flex items-center gap-1.5">
              <span>{token.meal_type}</span>
              <Utensils className="w-4 h-4 text-emerald-400" />
            </h3>
            <p className="text-sm font-semibold text-emerald-200 truncate mt-0.5">
              {token.messes?.name || 'Campus Mess'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-brand-yellow">₹{token.list_price}</span>
            <p className="text-[10px] text-emerald-300/80 uppercase">One-time pass</p>
          </div>
        </div>
      </div>

      {/* Middle QR Code Section */}
      <div className="p-6 flex flex-col items-center justify-center bg-white">
        <div className="relative p-3 rounded-2xl border-2 border-dashed border-brand-primary/20 bg-brand-mint/20">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${token.short_code}`}
              className={`w-44 h-44 rounded-lg object-contain transition-all ${
                isUsed || isExpired ? 'opacity-30 grayscale blur-[1px]' : ''
              }`}
            />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center text-xs text-brand-muted">
              Loading QR...
            </div>
          )}

          {/* Overlay if used or expired */}
          {isUsed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-xl">
              <span className="px-3 py-1.5 bg-slate-800 text-white font-extrabold text-xs uppercase tracking-widest rounded-lg shadow-md">
                Redeemed
              </span>
              <span className="text-[10px] text-slate-600 mt-1 font-semibold">
                Used at {token.used_at ? new Date(token.used_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          )}

          {isExpired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-xl">
              <span className="px-3 py-1.5 bg-rose-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-lg shadow-md">
                Expired
              </span>
            </div>
          )}
        </div>

        {/* Short Code & Copy Button */}
        <div className="mt-4 flex items-center gap-2">
          <div className="px-4 py-1.5 bg-brand-mint rounded-xl border border-brand-primary/20">
            <span className="text-xs text-brand-muted mr-1">Code:</span>
            <span className="font-mono font-extrabold text-base tracking-wider text-brand-dark">
              {token.short_code}
            </span>
          </div>
          <button
            onClick={copyShortCode}
            className="p-2 rounded-xl border border-brand-primary/20 hover:bg-brand-mint text-brand-primary transition-colors"
            title="Copy Short Code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <p className="text-[11px] text-brand-muted text-center mt-2">
          Show this QR to the mess counter staff to receive your meal.
        </p>
      </div>

      {/* Ticket Perforated Divider with Notches */}
      <div className="relative flex items-center justify-center my-1">
        <div className="ticket-notch-left -top-3" />
        <div className="ticket-notch-right -top-3" />
        <div className="w-full border-t-2 border-dashed border-brand-mint" />
      </div>

      {/* Ticket Bottom Details */}
      <div className="p-5 pt-3 bg-brand-light space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-brand-muted flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-brand-primary" />
            Date
          </span>
          <span className="font-bold text-brand-ink">{token.meal_date}</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-brand-muted flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-brand-primary" />
            Serving Time
          </span>
          <span className="font-bold text-brand-ink">{token.meal_time.slice(0, 5)}</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-brand-muted flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-brand-coral" />
            Valid Until
          </span>
          <span className="font-bold text-brand-coral">
            {new Date(token.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Rate Meal Button (Available after redemption) */}
        {isUsed && onRate && (
          <div className="pt-3 border-t border-brand-mint/60">
            <button
              onClick={() => onRate(token)}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Star className="w-4 h-4 fill-amber-950" />
              Rate This Meal (1 to 5 Stars)
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
