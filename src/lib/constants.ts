export const PRICING_CONFIG = {
  MIN_PRICE: 5,
  MAX_PRICE: 1000,
  MIN_LIST_PRICE: 5,
  MAX_LIST_PRICE: 1000,
  DEFAULT_LIST_PRICE: 30,
  DEFAULT_BREAKFAST_PRICE: 25,
  DEFAULT_LUNCH_PRICE: 35,
  DEFAULT_DINNER_PRICE: 35,
} as const;

export const TIMING_CONFIG = {
  CUTOFF_HOURS_BEFORE: 2, // Cutoff 2 hours before serving time
  VALIDITY_MINUTES_AFTER: 90, // Valid until 90 minutes after meal time
  DEFAULT_MEAL_TIMES: {
    breakfast: '08:30',
    lunch: '13:00',
    dinner: '20:30',
  },
  DEFAULTS: {
    breakfast: { start: '08:30' },
    lunch: { start: '13:00' },
    dinner: { start: '20:30' },
  },
} as const;

export const POLICY_CONFIG = {
  MONTHLY_SELLER_LIMIT: 10, // Max 10 skipped meals per student per calendar month
} as const;

export const STATUS_COLORS = {
  listed: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
    label: 'Listed',
  },
  sold: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Ready / Sold',
  },
  used: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    label: 'Used',
  },
  expired: {
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    border: 'border-rose-300',
    dot: 'bg-rose-500',
    label: 'Expired',
  },
  cancelled: {
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    border: 'border-gray-300',
    dot: 'bg-gray-400',
    label: 'Cancelled',
  },
} as const;
