-- ============================================================================
-- MEALBACK CLEANUP SCRIPT: DELETE DEMO / TEST DATA ONLY
-- ============================================================================
-- REVIEW BEFORE RUNNING IN SUPABASE SQL EDITOR!
-- This script safely removes ONLY test/seeded data (*@mealback.demo, MESS-DEMO, etc.)
-- Legitimate users (e.g. harshm6390@gmail.com) and their data are preserved.

BEGIN;

-- 1. Identify demo user IDs
DO $$
DECLARE
    demo_user_ids UUID[];
    demo_mess_ids UUID[];
BEGIN
    -- Collect demo auth IDs
    SELECT array_agg(id) INTO demo_user_ids
    FROM auth.users
    WHERE email LIKE '%@mealback.demo';

    -- Collect demo mess IDs (created with MESS-DEMO or MESS-ALT)
    SELECT array_agg(id) INTO demo_mess_ids
    FROM public.messes
    WHERE access_code IN ('MESS-DEMO', 'MESS-ALT');

    -- 2. Delete test ratings
    IF demo_mess_ids IS NOT NULL THEN
        DELETE FROM public.ratings WHERE mess_id = ANY(demo_mess_ids);
    END IF;
    IF demo_user_ids IS NOT NULL THEN
        DELETE FROM public.ratings WHERE buyer_id = ANY(demo_user_ids);
    END IF;

    -- 3. Delete test wallet entries
    IF demo_user_ids IS NOT NULL THEN
        DELETE FROM public.wallet_entries WHERE user_id = ANY(demo_user_ids);
    END IF;

    -- 4. Delete test payments
    IF demo_user_ids IS NOT NULL THEN
        DELETE FROM public.payments WHERE buyer_id = ANY(demo_user_ids);
    END IF;

    -- 5. Delete test tokens
    IF demo_user_ids IS NOT NULL THEN
        DELETE FROM public.tokens WHERE seller_id = ANY(demo_user_ids) OR buyer_id = ANY(demo_user_ids);
    END IF;
    IF demo_mess_ids IS NOT NULL THEN
        DELETE FROM public.tokens WHERE mess_id = ANY(demo_mess_ids);
    END IF;

    -- 6. Delete test profiles
    IF demo_user_ids IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id = ANY(demo_user_ids);
    END IF;

    -- 7. Delete test messes
    IF demo_mess_ids IS NOT NULL THEN
        DELETE FROM public.messes WHERE id = ANY(demo_mess_ids);
    END IF;

    -- 8. Delete demo auth users from auth.users
    IF demo_user_ids IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = ANY(demo_user_ids);
    END IF;

    RAISE NOTICE 'Demo data cleaned successfully while preserving all legitimate accounts.';
END $$;

COMMIT;
