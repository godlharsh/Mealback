'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Token } from '@/types/database';
import { Star, X, Check, Loader2 } from 'lucide-react';

interface RatingModalProps {
  token: Token | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RatingModal({ token, isOpen, onClose, onSuccess }: RatingModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [review, setReview] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !token) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/tokens/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: token.id,
          messId: token.mess_id,
          mealType: token.meal_type,
          rating,
          review,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit rating.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error submitting rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-ticket border border-emerald-950/10 p-6"
        >
          <div className="flex items-center justify-between pb-3 border-b border-brand-mint">
            <h3 className="font-extrabold text-lg text-brand-dark">Rate Your Meal</h3>
            <button
              onClick={onClose}
              className="text-brand-muted hover:text-brand-ink p-1 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="text-center">
              <p className="text-xs font-semibold text-brand-muted capitalize">
                {token.meal_type} at {token.messes?.name || 'Mess'}
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        (hoverRating || rating) >= star
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs font-bold text-amber-900 mt-1">
                {rating === 5 && '🌟 Excellent Food!'}
                {rating === 4 && '👍 Good Quality'}
                {rating === 3 && '👌 Average Meal'}
                {rating === 2 && '👎 Needs Improvement'}
                {rating === 1 && '⚠️ Poor Experience'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-ink mb-1">
                Feedback (Private to mess management)
              </label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="How was the taste, hygiene, or quantity?"
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:border-brand-primary focus:outline-none resize-none"
              />
            </div>

            {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-2xl bg-brand-primary text-white font-bold text-sm shadow-soft hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Rating</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
