'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MarketplaceToken } from '@/types/database';
import { Clock, MapPin, Sparkles, Utensils } from 'lucide-react';

interface MarketplaceCardProps {
  token: MarketplaceToken;
  onBuy: (token: MarketplaceToken) => void;
  isOwner?: boolean;
}

export function MarketplaceCard({ token, onBuy, isOwner }: MarketplaceCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState<boolean>(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const cutoff = new Date(token.cutoff_at).getTime();
      const diff = cutoff - now;

      if (diff <= 0) {
        setTimeLeft('Cutoff reached');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours < 1) {
        setIsUrgent(true);
        setTimeLeft(`${minutes}m ${seconds}s left`);
      } else {
        setIsUrgent(false);
        setTimeLeft(`${hours}h ${minutes}m left`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [token.cutoff_at]);

  const mealIcons = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
  };

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-white rounded-3xl p-5 shadow-card border border-emerald-950/5 flex flex-col justify-between relative overflow-hidden group"
    >
      {/* Top accent badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label={token.meal_type}>
            {mealIcons[token.meal_type] || '🍽️'}
          </span>
          <span className="font-bold text-base capitalize text-brand-dark">
            {token.meal_type}
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isUrgent
              ? 'bg-rose-100 text-rose-800 animate-pulse'
              : 'bg-brand-mint text-brand-primary'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft}</span>
        </div>
      </div>

      {/* Mess Details */}
      <div className="mb-4">
        <h3 className="font-extrabold text-lg text-brand-ink group-hover:text-brand-primary transition-colors truncate">
          {token.mess_name}
        </h3>
        {token.mess_location && (
          <p className="text-xs text-brand-muted flex items-center gap-1 mt-0.5 truncate">
            <MapPin className="w-3 h-3 text-brand-primary/70 shrink-0" />
            {token.mess_location}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs font-medium text-brand-muted bg-brand-mint/50 p-2.5 rounded-xl">
          <div className="flex items-center gap-1">
            <Utensils className="w-3.5 h-3.5 text-brand-primary" />
            <span>Serving at {token.meal_time.slice(0, 5)}</span>
          </div>
          <span>&bull;</span>
          <span>Date: {token.meal_date}</span>
        </div>
      </div>

      {/* Price & Action */}
      <div className="pt-3 border-t border-brand-mint/80 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-brand-dark">
              ₹{token.list_price}
            </span>
          </div>
          <p className="text-[11px] font-medium text-brand-muted">
            Student listed price
          </p>
        </div>

        {isOwner ? (
          <span className="text-xs font-semibold text-brand-muted px-4 py-2.5 rounded-2xl bg-gray-100">
            Your Listing
          </span>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onBuy(token)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-primary text-white font-bold text-sm shadow-soft hover:bg-brand-dark transition-all"
          >
            <Sparkles className="w-4 h-4 text-brand-yellow fill-brand-yellow" />
            Buy Now
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
