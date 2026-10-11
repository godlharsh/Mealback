-- ============================================================================
-- MEALBACK DATABASE SCHEMA, RLS POLICIES & ATOMIC RPC FUNCTIONS
-- ============================================================================
-- Run this script in the Supabase SQL Editor.
-- Ensure pgcrypto extension is active for gen_random_uuid() and gen_random_bytes()

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. MESSES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    access_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE (linked to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('student', 'buyer', 'mess')),
    mess_id UUID REFERENCES public.messes(id) ON DELETE SET NULL,
    hostel_room TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. TOKENS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mess_id UUID NOT NULL REFERENCES public.messes(id) ON DELETE CASCADE,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
    meal_date DATE NOT NULL,
    meal_time TIME NOT NULL,
    cutoff_at TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    face_price NUMERIC(10, 2) NOT NULL DEFAULT 40.00,
    list_price NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
    seller_payout NUMERIC(10, 2) NOT NULL DEFAULT 22.00,
    mess_share NUMERIC(10, 2) NOT NULL DEFAULT 4.00,
    platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 4.00,
    status TEXT NOT NULL DEFAULT 'listed' CHECK (status IN ('listed', 'sold', 'used', 'expired', 'cancelled')),
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    qr_secret TEXT NOT NULL UNIQUE,
    short_code TEXT NOT NULL UNIQUE,
    sold_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_seller_id ON public.tokens(seller_id);
CREATE INDEX IF NOT EXISTS idx_tokens_buyer_id ON public.tokens(buyer_id);
CREATE INDEX IF NOT EXISTS idx_tokens_mess_id ON public.tokens(mess_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON public.tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_cutoff_at ON public.tokens(cutoff_at);
CREATE INDEX IF NOT EXISTS idx_tokens_qr_secret ON public.tokens(qr_secret);
CREATE INDEX IF NOT EXISTS idx_tokens_short_code ON public.tokens(short_code);

-- ----------------------------------------------------------------------------
-- 4. PAYMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'upi',
    payment_ref TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_token_id ON public.payments(token_id);
CREATE INDEX IF NOT EXISTS idx_payments_buyer_id ON public.payments(buyer_id);

-- ----------------------------------------------------------------------------
-- 5. WALLET ENTRIES TABLE (Seller earnings ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_id UUID REFERENCES public.tokens(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'payout')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_entries_user_id ON public.wallet_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_entries_status ON public.wallet_entries(status);

-- ----------------------------------------------------------------------------
-- 6. RATINGS TABLE (Optional meal ratings after token used)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL UNIQUE REFERENCES public.tokens(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mess_id UUID NOT NULL REFERENCES public.messes(id) ON DELETE CASCADE,
    meal_type TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ratings_mess_id ON public.ratings(mess_id);

-- ----------------------------------------------------------------------------
-- 7. MARKETPLACE SECURE VIEW
-- (Excludes seller_id and qr_secret, only listed tokens before cutoff)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.marketplace_tokens AS
SELECT 
    t.id,
    t.mess_id,
    m.name AS mess_name,
    m.location AS mess_location,
    t.meal_type,
    t.meal_date,
    t.meal_time,
    t.cutoff_at,
    t.valid_until,
    t.face_price,
    t.list_price,
    t.status,
    t.created_at
FROM public.tokens t
JOIN public.messes m ON t.mess_id = m.id
WHERE t.status = 'listed'
  AND t.cutoff_at > now();

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.messes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Messes: Any authenticated user can read messes list
CREATE POLICY "Allow authenticated users to read messes"
    ON public.messes FOR SELECT
    TO authenticated
    USING (true);

-- Profiles: Users can read their own profile, mess staff can view profiles for operations
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Mess staff can view user names"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles staff 
            WHERE staff.id = auth.uid() AND staff.role = 'mess'
        )
    );

-- Tokens policies:
-- Seller can view all tokens they listed
CREATE POLICY "Sellers can view own tokens"
    ON public.tokens FOR SELECT
    TO authenticated
    USING (seller_id = auth.uid());

-- Buyers can view their purchased tokens (includes qr_secret)
CREATE POLICY "Buyers can view purchased tokens"
    ON public.tokens FOR SELECT
    TO authenticated
    USING (buyer_id = auth.uid());

-- Mess staff can view tokens for their mess
CREATE POLICY "Mess staff can view mess tokens"
    ON public.tokens FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles staff
            WHERE staff.id = auth.uid() 
              AND staff.role = 'mess' 
              AND staff.mess_id = tokens.mess_id
        )
    );

-- Payments policies:
CREATE POLICY "Buyers can view own payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (buyer_id = auth.uid());

CREATE POLICY "Buyers can insert own payments"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (buyer_id = auth.uid());

-- Wallet Entries policies:
CREATE POLICY "Users can view own wallet entries"
    ON public.wallet_entries FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Ratings policies:
CREATE POLICY "Buyers can insert own ratings"
    ON public.ratings FOR INSERT
    TO authenticated
    WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers can view own ratings"
    ON public.ratings FOR SELECT
    TO authenticated
    USING (buyer_id = auth.uid());

CREATE POLICY "Mess staff can view ratings for their mess"
    ON public.ratings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles staff
            WHERE staff.id = auth.uid() 
              AND staff.role = 'mess' 
              AND staff.mess_id = ratings.mess_id
        )
    );

-- ----------------------------------------------------------------------------
-- 9. ATOMIC RPC FUNCTIONS (SECURITY DEFINER, RACE-SAFE)
-- ----------------------------------------------------------------------------

-- Function: Monthly listing count for seller
CREATE OR REPLACE FUNCTION public.get_seller_monthly_count(p_seller_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    listing_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO listing_count
    FROM public.tokens
    WHERE seller_id = p_seller_id
      AND date_trunc('month', created_at) = date_trunc('month', now())
      AND status != 'cancelled';

    RETURN listing_count;
END;
$$;

-- Function: List a new meal token
CREATE OR REPLACE FUNCTION public.list_meal_token(
    p_seller_id UUID,
    p_mess_id UUID,
    p_meal_type TEXT,
    p_meal_date DATE,
    p_meal_time TIME,
    p_list_price NUMERIC DEFAULT 30.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    meal_ts TIMESTAMPTZ;
    cutoff_ts TIMESTAMPTZ;
    valid_ts TIMESTAMPTZ;
    monthly_count INTEGER;
    new_qr_secret TEXT;
    new_short_code TEXT;
    new_token RECORD;
    seller_role TEXT;
BEGIN
    -- Verify seller role
    SELECT role INTO seller_role FROM public.profiles WHERE id = p_seller_id;
    IF seller_role IS NULL OR seller_role != 'student' THEN
        RAISE EXCEPTION 'Only students can list meal tokens.';
    END IF;

    -- Calculate timestamps
    meal_ts := (p_meal_date || ' ' || p_meal_time)::TIMESTAMPTZ;
    cutoff_ts := meal_ts - INTERVAL '2 hours';
    valid_ts := meal_ts + INTERVAL '90 minutes';

    -- Validate cutoff time
    IF now() >= cutoff_ts THEN
        RAISE EXCEPTION 'Listing cutoff time has already passed for this meal (cutoff is 2 hours before meal time).';
    END IF;

    -- Enforce monthly limit (max 10 per calendar month)
    SELECT COUNT(*)
    INTO monthly_count
    FROM public.tokens
    WHERE seller_id = p_seller_id
      AND date_trunc('month', created_at) = date_trunc('month', now())
      AND status != 'cancelled';

    IF monthly_count >= 10 THEN
        RAISE EXCEPTION 'Monthly listing limit reached! You can only list at most 10 meals per calendar month.';
    END IF;

    -- Generate random opaque QR secret (32 hex characters)
    new_qr_secret := encode(gen_random_bytes(24), 'hex');

    -- Generate random short code like 4821-KX9
    new_short_code := floor(1000 + random() * 9000)::TEXT || '-' || upper(substring(md5(random()::TEXT) from 1 for 3));

    -- Insert token
    INSERT INTO public.tokens (
        seller_id,
        mess_id,
        meal_type,
        meal_date,
        meal_time,
        cutoff_at,
        valid_until,
        face_price,
        list_price,
        seller_payout,
        mess_share,
        platform_fee,
        status,
        qr_secret,
        short_code
    ) VALUES (
        p_seller_id,
        p_mess_id,
        p_meal_type,
        p_meal_date,
        p_meal_time,
        cutoff_ts,
        valid_ts,
        40.00,
        COALESCE(p_list_price, 30.00),
        22.00,
        4.00,
        4.00,
        'listed',
        new_qr_secret,
        new_short_code
    )
    RETURNING * INTO new_token;

    RETURN jsonb_build_object(
        'success', true,
        'token_id', new_token.id,
        'short_code', new_token.short_code,
        'monthly_count', monthly_count + 1
    );
END;
$$;

-- Function: Buy a token atomically with row locking
CREATE OR REPLACE FUNCTION public.buy_token(
    p_token_id UUID,
    p_buyer_id UUID,
    p_payment_ref TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_token RECORD;
    buyer_role TEXT;
BEGIN
    -- Check buyer profile
    SELECT role INTO buyer_role FROM public.profiles WHERE id = p_buyer_id;
    IF buyer_role IS NULL THEN
        RAISE EXCEPTION 'Buyer profile not found.';
    END IF;

    -- Lock token row for update to eliminate race conditions
    SELECT * INTO target_token
    FROM public.tokens
    WHERE id = p_token_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Token not found.';
    END IF;

    -- Prevent self-purchase
    IF target_token.seller_id = p_buyer_id THEN
        RAISE EXCEPTION 'You cannot buy your own listed meal token.';
    END IF;

    -- Verify status
    IF target_token.status != 'listed' THEN
        RAISE EXCEPTION 'Token is no longer available (current status: %)', target_token.status;
    END IF;

    -- Verify cutoff
    IF now() >= target_token.cutoff_at THEN
        -- Mark as expired
        UPDATE public.tokens SET status = 'expired' WHERE id = p_token_id;
        RAISE EXCEPTION 'The purchase cutoff for this meal has passed.';
    END IF;

    -- Atomic status update to sold
    UPDATE public.tokens
    SET status = 'sold',
        buyer_id = p_buyer_id,
        sold_at = now()
    WHERE id = p_token_id;

    -- Record payment
    INSERT INTO public.payments (
        token_id,
        buyer_id,
        amount,
        payment_method,
        payment_ref,
        status
    ) VALUES (
        p_token_id,
        p_buyer_id,
        target_token.list_price,
        'upi',
        p_payment_ref,
        'success'
    );

    -- Create pending wallet credit for seller
    INSERT INTO public.wallet_entries (
        user_id,
        token_id,
        amount,
        type,
        status,
        description
    ) VALUES (
        target_token.seller_id,
        p_token_id,
        target_token.seller_payout,
        'credit',
        'pending',
        'Token sold: ' || initcap(target_token.meal_type) || ' (' || target_token.meal_date::TEXT || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'token_id', target_token.id,
        'qr_secret', target_token.qr_secret,
        'short_code', target_token.short_code,
        'amount', target_token.list_price,
        'message', 'Token purchased successfully.'
    );
END;
$$;

-- Function: Verify and use token (QR scan or manual code entry)
-- Returns specific status: VERIFIED, ALREADY_USED, EXPIRED, WRONG_MESS, INVALID
CREATE OR REPLACE FUNCTION public.verify_and_use_token(
    p_identifier TEXT,
    p_mess_id UUID,
    p_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_token RECORD;
    cleaned_input TEXT;
    staff_mess_id UUID;
    mess_record RECORD;
BEGIN
    cleaned_input := trim(p_identifier);

    -- Verify scanning staff is authorized for this mess
    SELECT mess_id INTO staff_mess_id 
    FROM public.profiles 
    WHERE id = p_staff_id AND role = 'mess';

    IF staff_mess_id IS NULL OR staff_mess_id != p_mess_id THEN
        RETURN jsonb_build_object(
            'result', 'INVALID',
            'message', 'Staff member is not authorized for this mess.'
        );
    END IF;

    -- Lock token row by matching qr_secret or short_code
    SELECT * INTO target_token
    FROM public.tokens
    WHERE qr_secret = cleaned_input 
       OR upper(short_code) = upper(cleaned_input)
    FOR UPDATE;

    -- 1. Check if token exists
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'result', 'INVALID',
            'message', 'No meal token found with this code or QR.'
        );
    END IF;

    -- 2. Check if token belongs to this mess
    IF target_token.mess_id != p_mess_id THEN
        SELECT name INTO mess_record FROM public.messes WHERE id = target_token.mess_id;
        RETURN jsonb_build_object(
            'result', 'WRONG_MESS',
            'message', 'This token belongs to ' || COALESCE(mess_record.name, 'another mess') || '.',
            'token_mess_id', target_token.mess_id,
            'expected_mess_id', p_mess_id,
            'meal_type', target_token.meal_type
        );
    END IF;

    -- 3. Check if already used
    IF target_token.status = 'used' THEN
        RETURN jsonb_build_object(
            'result', 'ALREADY_USED',
            'message', 'This token has already been scanned and redeemed.',
            'used_at', target_token.used_at,
            'meal_type', target_token.meal_type,
            'short_code', target_token.short_code
        );
    END IF;

    -- 4. Check if expired (valid_until passed or status = 'expired')
    IF target_token.status = 'expired' OR now() > target_token.valid_until THEN
        IF target_token.status != 'expired' THEN
            UPDATE public.tokens SET status = 'expired' WHERE id = target_token.id;
        END IF;
        RETURN jsonb_build_object(
            'result', 'EXPIRED',
            'message', 'This meal token has expired (validity was until ' || to_char(target_token.valid_until, 'HH12:MI AM') || ').',
            'valid_until', target_token.valid_until,
            'meal_type', target_token.meal_type,
            'short_code', target_token.short_code
        );
    END IF;

    -- 5. Check if it was never purchased
    IF target_token.status = 'listed' THEN
        RETURN jsonb_build_object(
            'result', 'INVALID',
            'message', 'This token was listed but has not been purchased yet.'
        );
    END IF;

    IF target_token.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'result', 'INVALID',
            'message', 'This token was cancelled.'
        );
    END IF;

    -- 6. VERIFIED: Mark as used atomically
    UPDATE public.tokens
    SET status = 'used',
        used_at = now(),
        scanned_by = p_staff_id
    WHERE id = target_token.id;

    -- Release pending wallet credit to available for seller
    UPDATE public.wallet_entries
    SET status = 'available'
    WHERE token_id = target_token.id 
      AND user_id = target_token.seller_id;

    RETURN jsonb_build_object(
        'result', 'VERIFIED',
        'message', 'Serve karo! Meal token verified successfully.',
        'token_id', target_token.id,
        'meal_type', target_token.meal_type,
        'meal_date', target_token.meal_date,
        'meal_time', target_token.meal_time,
        'short_code', target_token.short_code,
        'used_at', now()
    );
END;
$$;

-- Function: Get Mess Analytics & Scans
CREATE OR REPLACE FUNCTION public.get_mess_stats(p_mess_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stats RECORD;
    meals RECORD;
    recent_scans JSONB;
    avg_rating NUMERIC;
BEGIN
    -- Overall counts for specified date
    SELECT 
        COUNT(*) FILTER (WHERE status = 'listed') AS listed_count,
        COUNT(*) FILTER (WHERE status = 'sold') AS sold_count,
        COUNT(*) FILTER (WHERE status = 'used') AS used_count,
        COUNT(*) FILTER (WHERE status IN ('listed', 'sold')) AS pending_count
    INTO stats
    FROM public.tokens
    WHERE mess_id = p_mess_id AND meal_date = p_date;

    -- Meal breakdown
    SELECT jsonb_object_agg(
        meal_type, 
        jsonb_build_object(
            'listed', count_listed,
            'sold', count_sold,
            'used', count_used
        )
    ) INTO meals
    FROM (
        SELECT 
            meal_type,
            COUNT(*) FILTER (WHERE status = 'listed') AS count_listed,
            COUNT(*) FILTER (WHERE status = 'sold') AS count_sold,
            COUNT(*) FILTER (WHERE status = 'used') AS count_used
        FROM public.tokens
        WHERE mess_id = p_mess_id AND meal_date = p_date
        GROUP BY meal_type
    ) sub;

    -- Recent scans
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'token_id', t.id,
            'meal_type', t.meal_type,
            'meal_date', t.meal_date,
            'short_code', t.short_code,
            'used_at', t.used_at
        ) ORDER BY t.used_at DESC
    ), '[]'::JSONB)
    INTO recent_scans
    FROM public.tokens t
    WHERE t.mess_id = p_mess_id AND t.status = 'used' AND t.used_at IS NOT NULL
    LIMIT 10;

    -- Average rating
    SELECT ROUND(AVG(rating), 1) INTO avg_rating
    FROM public.ratings
    WHERE mess_id = p_mess_id;

    RETURN jsonb_build_object(
        'date', p_date,
        'listed_count', COALESCE(stats.listed_count, 0),
        'sold_count', COALESCE(stats.sold_count, 0),
        'used_count', COALESCE(stats.used_count, 0),
        'pending_count', COALESCE(stats.pending_count, 0),
        'meals', COALESCE(meals.jsonb_object_agg, '{}'::JSONB),
        'recent_scans', recent_scans,
        'average_rating', COALESCE(avg_rating, 0)
    );
END;
$$;

-- Enable Supabase Realtime for tokens table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tokens;
