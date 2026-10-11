// Money split of one Rs 30 token: seller Rs 22, mess Rs 4, MealBack Rs 4
export const TOKEN_CONFIG = {
  FACE_PRICE: 40,
  LIST_PRICE: 30,
  SELLER_PAYOUT: 22,
  MESS_SHARE: 4,
  PLATFORM_FEE: 4,
  MONTHLY_SELLER_LIMIT: 10,
  CUTOFF_HOURS_BEFORE: 2, // Cutoff 2 hours before meal
  VALIDITY_MINUTES_AFTER: 90, // Valid until 90 minutes after meal time
} as const;

export const DEMO_CONFIG = {
  DEMO_MESS_ACCESS_CODE: 'MESS-DEMO',
  DEFAULT_MESS_NAME: 'Boys Hostel A Mess',
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
