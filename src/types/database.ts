export type UserRole = 'student' | 'buyer' | 'mess';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type TokenStatus = 'listed' | 'sold' | 'used' | 'expired' | 'cancelled';

export interface Mess {
  id: string;
  name: string;
  location?: string | null;
  access_code: string;
  is_active?: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  mess_id: string | null;
  is_mess_manager?: boolean;
  hostel_room: string | null;
  created_at: string;
  updated_at: string;
}

export interface Token {
  id: string;
  seller_id: string;
  mess_id: string;
  meal_type: MealType;
  meal_date: string;
  meal_time: string;
  cutoff_at: string;
  valid_until: string;
  list_price: number;
  status: TokenStatus;
  buyer_id?: string | null;
  qr_secret?: string; // Only present for owner/buyer or admin
  short_code: string;
  sold_at?: string | null;
  used_at?: string | null;
  scanned_by?: string | null;
  created_at: string;
  // Joined relation fields:
  messes?: Mess;
  profiles?: Profile;
}

export interface MarketplaceToken {
  id: string;
  mess_id: string;
  mess_name: string;
  mess_location?: string | null;
  meal_type: MealType;
  meal_date: string;
  meal_time: string;
  cutoff_at: string;
  valid_until: string;
  list_price: number;
  status: TokenStatus;
  created_at: string;
}

export interface Payment {
  id: string;
  token_id: string;
  buyer_id: string;
  amount: number;
  payment_method: string;
  payment_ref: string;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
}

export interface WalletEntry {
  id: string;
  user_id: string;
  token_id?: string | null;
  amount: number;
  type: 'credit' | 'debit' | 'payout';
  status: 'pending' | 'available' | 'paid';
  description?: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  token_id: string;
  buyer_id: string;
  mess_id: string;
  meal_type: MealType;
  rating: number; // 1 to 5
  review?: string | null;
  created_at: string;
}

export type ScanResultStatus =
  | 'VERIFIED'
  | 'ALREADY_USED'
  | 'EXPIRED'
  | 'WRONG_MESS'
  | 'INVALID';

export interface ScanResult {
  result: ScanResultStatus;
  message: string;
  token_id?: string;
  meal_type?: MealType;
  meal_date?: string;
  meal_time?: string;
  short_code?: string;
  used_at?: string;
  valid_until?: string;
  token_mess_id?: string;
  expected_mess_id?: string;
}
