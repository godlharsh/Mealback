import React from 'react';
import { TokenStatus } from '@/types/database';

interface StatusBadgeProps {
  status: TokenStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const configs = {
    listed: {
      label: 'Listed',
      bg: 'bg-amber-100 text-amber-900 border-amber-300',
      dot: 'bg-amber-500',
    },
    sold: {
      label: 'Ready / Sold',
      bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      dot: 'bg-emerald-500',
    },
    used: {
      label: 'Used',
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      dot: 'bg-slate-400',
    },
    expired: {
      label: 'Expired',
      bg: 'bg-rose-100 text-rose-900 border-rose-300',
      dot: 'bg-rose-500',
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-gray-100 text-gray-700 border-gray-300',
      dot: 'bg-gray-400',
    },
  };

  const current = configs[status] || configs.listed;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${current.bg} ${sizeClasses} shadow-sm transition-colors`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot} animate-pulse`} />
      {current.label}
    </span>
  );
}
