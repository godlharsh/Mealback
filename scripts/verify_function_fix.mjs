import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLiveFunction() {
  console.log('Testing live RPC public.list_meal_token on Supabase...');

  const { data: messes } = await supabase.from('messes').select('id, name').limit(1);
  const { data: students } = await supabase.from('profiles').select('id, email, role').eq('role', 'student').limit(1);

  if (!messes?.length || !students?.length) {
    console.error('Could not find existing mess or student profile to test with.');
    process.exit(1);
  }

  // Use a future date for non-destructive check
  const futureDate = '2026-11-20';
  const testPrice = 75;

  const { data, error } = await supabase.rpc('list_meal_token', {
    p_seller_id: students[0].id,
    p_mess_id: messes[0].id,
    p_meal_type: 'dinner',
    p_meal_date: futureDate,
    p_meal_time: '20:00:00',
    p_list_price: testPrice,
  });

  if (error) {
    if (error.message.includes('gen_random_bytes') || error.code === '42883') {
      console.log('STATUS: has_fixed_call = false');
      console.log('Detail: Function still calls unqualified gen_random_bytes(integer).');
      console.log('Action: Run supabase/migrations/20261023024500_fix_gen_random_bytes_schema.sql in Supabase SQL Editor.');
      return false;
    } else {
      console.log('STATUS: has_fixed_call = true');
      console.log('Detail: Function executed without gen_random_bytes error. Response:', error.message);
      return true;
    }
  }

  console.log('STATUS: has_fixed_call = true');
  console.log('Detail: Successfully listed test meal token! Token ID:', data?.token_id);
  
  // Clean up test token if created
  if (data?.token_id) {
    await supabase.from('tokens').delete().eq('id', data.token_id);
    console.log('Cleaned up test token:', data.token_id);
  }

  return true;
}

verifyLiveFunction().catch(console.error);
