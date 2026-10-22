-- ============================================================================
-- MEALBACK MIGRATION: Fix gen_random_bytes() schema resolution in list_meal_token
-- ============================================================================
-- Resolves: "function gen_random_bytes(integer) does not exist"
-- Cause: pgcrypto functions reside in the 'extensions' schema on Supabase.
-- When list_meal_token executed with 'SET search_path = public, pg_temp',
-- PostgreSQL could not resolve the unqualified gen_random_bytes(24) call.
--
-- Fix:
-- 1. Updates search_path to 'public, extensions, pg_temp'
-- 2. Explicitly qualifies call as 'extensions.gen_random_bytes(24)'
-- 3. Preserves all SECURITY DEFINER protections and caller verification
-- 4. Re-applies minimal execution grants (authenticated, service_role)
-- 5. Signals PostgREST to reload schema cache
-- ============================================================================

-- Ensure pgcrypto extension is active in schema 'extensions'
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Update list_meal_token function with explicit schema qualification
CREATE OR REPLACE FUNCTION public.list_meal_token(
    p_seller_id UUID,
    p_mess_id UUID,
    p_meal_type TEXT,
    p_meal_date DATE,
    p_meal_time TIME,
    p_list_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_seller_id UUID;
    meal_ts TIMESTAMPTZ;
    cutoff_ts TIMESTAMPTZ;
    valid_ts TIMESTAMPTZ;
    monthly_count INTEGER;
    new_qr_secret TEXT;
    new_short_code TEXT;
    new_token RECORD;
    seller_role TEXT;
BEGIN
    -- Derive seller from auth.uid()
    IF auth.uid() IS NOT NULL THEN
        IF p_seller_id IS NOT NULL AND p_seller_id != auth.uid() THEN
            RAISE EXCEPTION 'Unauthorized: Caller identity does not match seller ID.';
        END IF;
        v_seller_id := auth.uid();
    ELSE
        IF auth.role() = 'service_role' AND p_seller_id IS NOT NULL THEN
            v_seller_id := p_seller_id;
        ELSE
            RAISE EXCEPTION 'Authentication required to list a meal.';
        END IF;
    END IF;

    IF p_list_price IS NULL OR p_list_price < 5.00 OR p_list_price > 1000.00 THEN
        RAISE EXCEPTION 'Invalid price. Asking price must be between ₹5 and ₹1,000.';
    END IF;

    SELECT role INTO seller_role FROM public.profiles WHERE id = v_seller_id;
    IF seller_role IS NULL OR seller_role != 'student' THEN
        RAISE EXCEPTION 'Only registered hostel students can list meal passes.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.messes WHERE id = p_mess_id AND is_active = true) THEN
        RAISE EXCEPTION 'Selected mess does not exist or is inactive.';
    END IF;

    meal_ts := (p_meal_date || ' ' || p_meal_time)::TIMESTAMPTZ;
    cutoff_ts := meal_ts - INTERVAL '2 hours';
    valid_ts := meal_ts + INTERVAL '90 minutes';

    IF now() >= cutoff_ts THEN
        RAISE EXCEPTION 'Cutoff passed! Meals must be listed at least 2 hours before serving time (% on %)', p_meal_time, p_meal_date;
    END IF;

    SELECT COUNT(*)
    INTO monthly_count
    FROM public.tokens
    WHERE seller_id = v_seller_id
      AND status != 'cancelled'
      AND created_at >= date_trunc('month', now());

    IF monthly_count >= 15 THEN
        RAISE EXCEPTION 'Monthly listing limit reached (15/15 meals listed this calendar month).';
    END IF;

    -- Check for duplicate listing by same seller for exact same meal & date
    IF EXISTS (
        SELECT 1 FROM public.tokens
        WHERE seller_id = v_seller_id
          AND meal_date = p_meal_date
          AND meal_type = p_meal_type
          AND status IN ('listed', 'sold', 'used')
    ) THEN
        RAISE EXCEPTION 'You have already listed a % pass for %.', p_meal_type, p_meal_date;
    END IF;

    -- Generate secure cryptographic QR secret and human short code
    new_qr_secret := encode(extensions.gen_random_bytes(24), 'hex');
    new_short_code := upper(substring(md5(random()::TEXT) from 1 for 6));

    INSERT INTO public.tokens (
        seller_id,
        mess_id,
        meal_type,
        meal_date,
        meal_time,
        cutoff_at,
        valid_until,
        list_price,
        status,
        qr_secret,
        short_code
    ) VALUES (
        v_seller_id,
        p_mess_id,
        p_meal_type,
        p_meal_date,
        p_meal_time,
        cutoff_ts,
        valid_ts,
        round(p_list_price, 2),
        'listed',
        new_qr_secret,
        new_short_code
    )
    RETURNING * INTO new_token;

    RETURN jsonb_build_object(
        'success', true,
        'token_id', new_token.id,
        'short_code', new_token.short_code,
        'qr_secret', new_token.qr_secret,
        'cutoff_at', new_token.cutoff_at,
        'valid_until', new_token.valid_until,
        'message', 'Meal pass listed successfully'
    );
END;
$$;

-- Secure function privileges
REVOKE ALL ON FUNCTION public.list_meal_token(UUID, UUID, TEXT, DATE, TIME, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_meal_token(UUID, UUID, TEXT, DATE, TIME, NUMERIC) TO authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
