import { createClient } from '@supabase/supabase-js';

// Server-only admin client using SUPABASE_SECRET_KEY
// Strict: Never import in client components or expose to browser!
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: createAdminClient cannot be called on the client!');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error('Missing Supabase server credentials.');
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
