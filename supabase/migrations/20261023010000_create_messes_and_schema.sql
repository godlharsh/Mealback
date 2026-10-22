-- ============================================================================
-- MEALBACK DATABASE SCHEMA, RLS POLICIES & HARDENED RPC FUNCTIONS (PRODUCTION)
-- ============================================================================
-- Safe, ordered, non-destructive migration for Supabase PostgreSQL.
-- Safe to re-run multiple times (all tables, indexes, policies, and functions are idempotent).
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. MESSES TABLE (Campus dining halls)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    access_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive unique name constraint and query indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_messes_name_unique ON public.messes (lower(trim(name)));
CREATE INDEX IF NOT EXISTS idx_messes_access_code ON public.messes (access_code);
CREATE INDEX IF NOT EXISTS idx_messes_is_active ON public.messes (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_messes_created_by ON public.messes (created_by);

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE (Linked to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'buyer', 'mess')),
    mess_id UUID REFERENCES public.messes(id) ON DELETE SET NULL,
    is_mess_manager BOOLEAN NOT NULL DEFAULT false,
    hostel_room TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_mess_id ON public.profiles(mess_id);

-- ----------------------------------------------------------------------------
-- 3. TOKENS TABLE (Student-defined dynamic pricing meal passes)
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
    list_price NUMERIC(10, 2) NOT NULL CHECK (list_price >= 5.00 AND list_price <= 1000.00),
    status TEXT NOT NULL DEFAULT 'listed' CHECK (status IN ('listed', 'sold', 'used', 'expired', 'cancelled')),
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    qr_secret TEXT NOT NULL UNIQUE,
    short_code TEXT NOT NULL UNIQUE,
    sold_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes for Tokens
CREATE INDEX IF NOT EXISTS idx_tokens_marketplace ON public.tokens(status, cutoff_at) WHERE status = 'listed';
CREATE INDEX IF NOT EXISTS idx_tokens_seller_id ON public.tokens(seller_id);
CREATE INDEX IF NOT EXISTS idx_tokens_buyer_id ON public.tokens(buyer_id);
CREATE INDEX IF NOT EXISTS idx_tokens_mess_id ON public.tokens(mess_id);
CREATE INDEX IF NOT EXISTS idx_tokens_meal_date ON public.tokens(meal_date);
CREATE INDEX IF NOT EXISTS idx_tokens_qr_secret ON public.tokens(qr_secret);
CREATE INDEX IF NOT EXISTS idx_tokens_short_code ON public.tokens(short_code);

-- ----------------------------------------------------------------------------
-- 4. PAYMENTS TABLE (Audit ledger of purchases)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'upi_simulated',
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
-- 7. MARKETPLACE SECURE VIEW (security_invoker enabled, QR secrets protected)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.marketplace_tokens
WITH (security_invoker = true)
AS
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
    t.list_price,
    t.status,
    t.created_at
FROM public.tokens t
JOIN public.messes m ON t.mess_id = m.id
WHERE t.status = 'listed'
  AND m.is_active = true
  AND t.cutoff_at > now();

-- ----------------------------------------------------------------------------
-- 8. SECURITY HELPER FUNCTIONS (Non-recursive RLS checks)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_current_user_mess_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'mess'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_mess_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT mess_id FROM public.profiles
    WHERE id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.messes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- MESSES POLICIES
DROP POLICY IF EXISTS "Allow public read active messes" ON public.messes;
CREATE POLICY "Allow public read active messes"
    ON public.messes FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Mess owners can update their mess" ON public.messes;
CREATE POLICY "Mess owners can update their mess"
    ON public.messes FOR UPDATE
    TO authenticated
    USING (created_by = (SELECT auth.uid()))
    WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create a mess" ON public.messes;
CREATE POLICY "Authenticated users can create a mess"
    ON public.messes FOR INSERT
    TO authenticated
    WITH CHECK (created_by = (SELECT auth.uid()));

-- PROFILES POLICIES (No recursion; uses is_current_user_mess_staff)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Mess staff can view profiles" ON public.profiles;
CREATE POLICY "Mess staff can view profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_current_user_mess_staff());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = (SELECT auth.uid()));

-- TOKENS POLICIES
DROP POLICY IF EXISTS "Marketplace viewers can view listed tokens" ON public.tokens;
CREATE POLICY "Marketplace viewers can view listed tokens"
    ON public.tokens FOR SELECT
    TO anon, authenticated
    USING (status = 'listed' AND cutoff_at > now());

DROP POLICY IF EXISTS "Sellers can view own tokens" ON public.tokens;
CREATE POLICY "Sellers can view own tokens"
    ON public.tokens FOR SELECT
    TO authenticated
    USING (seller_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Buyers can view purchased tokens" ON public.tokens;
CREATE POLICY "Buyers can view purchased tokens"
    ON public.tokens FOR SELECT
    TO authenticated
    USING (buyer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Mess staff can view mess tokens" ON public.tokens;
CREATE POLICY "Mess staff can view mess tokens"
    ON public.tokens FOR SELECT
    TO authenticated
    USING (
        public.is_current_user_mess_staff() 
        AND mess_id = public.get_current_user_mess_id()
    );

DROP POLICY IF EXISTS "Sellers can insert own tokens" ON public.tokens;
CREATE POLICY "Sellers can insert own tokens"
    ON public.tokens FOR INSERT
    TO authenticated
    WITH CHECK (seller_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Sellers can update own tokens" ON public.tokens;
CREATE POLICY "Sellers can update own tokens"
    ON public.tokens FOR UPDATE
    TO authenticated
    USING (seller_id = (SELECT auth.uid()))
    WITH CHECK (seller_id = (SELECT auth.uid()));

-- PAYMENTS POLICIES
DROP POLICY IF EXISTS "Buyers can view own payments" ON public.payments;
CREATE POLICY "Buyers can view own payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (buyer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Buyers can insert own payments" ON public.payments;
CREATE POLICY "Buyers can insert own payments"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (buyer_id = (SELECT auth.uid()));

-- WALLET ENTRIES POLICIES
DROP POLICY IF EXISTS "Users can view own wallet entries" ON public.wallet_entries;
CREATE POLICY "Users can view own wallet entries"
    ON public.wallet_entries FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- RATINGS POLICIES
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Anyone can view ratings"
    ON public.ratings FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Buyers can insert own ratings" ON public.ratings;
CREATE POLICY "Buyers can insert own ratings"
    ON public.ratings FOR INSERT
    TO authenticated
    WITH CHECK (buyer_id = (SELECT auth.uid()));

-- ----------------------------------------------------------------------------
-- 10. PROFILE ROLE ESCALATION PROTECTION (Triggers)
-- ----------------------------------------------------------------------------

-- Trigger to prevent users from escalating role or claiming mess management via direct SDK updates
CREATE OR REPLACE FUNCTION public.prevent_profile_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Detect if role, manager flag, or mess_id is modified
    IF (NEW.role IS DISTINCT FROM OLD.role OR 
        NEW.is_mess_manager IS DISTINCT FROM OLD.is_mess_manager OR 
        NEW.mess_id IS DISTINCT FROM OLD.mess_id) THEN
        
        -- Allow modification ONLY if:
        -- 1. Executed by service_role (trusted Next.js server route handlers using secret key)
        -- 2. OR current_user is superuser/definer (e.g. postgres, supabase_admin)
        -- 3. OR within a trusted SECURITY DEFINER transaction (e.g. create_mess)
        IF auth.role() = 'service_role' 
           OR current_user IN ('postgres', 'supabase_admin')
           OR current_setting('mealback.trusted_mess_creation', true) = 'true' THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Unauthorized: Role, mess assignments, and manager privileges can only be modified through verified server routes.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_profile_escalation ON public.profiles;
CREATE TRIGGER tr_prevent_profile_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_escalation();

-- Trigger for auth.users signup: allows student, buyer, or mess role, but strictly prevents forged manager flags or mess assignments
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    initial_role TEXT;
BEGIN
    -- Allow 'student', 'buyer', or 'mess' from client-side signup metadata
    initial_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'student'));
    IF initial_role NOT IN ('student', 'buyer', 'mess') THEN
        initial_role := 'student';
    END IF;

    INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        role, 
        mess_id, 
        is_mess_manager,
        hostel_room
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
        initial_role,
        NULL,  -- Never grant mess assignment from raw signup metadata
        false, -- Never grant manager status from raw signup metadata
        NEW.raw_user_meta_data->>'hostel_room'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
        updated_at = now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth.users safely
INSERT INTO public.profiles (id, email, full_name, role, mess_id, is_mess_manager, hostel_room)
SELECT 
    id,
    email,
    COALESCE(NULLIF(TRIM(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1)),
    CASE 
        WHEN LOWER(raw_user_meta_data->>'role') IN ('student', 'buyer') THEN LOWER(raw_user_meta_data->>'role')
        ELSE 'student'
    END,
    NULL,
    false,
    raw_user_meta_data->>'hostel_room'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 11. HARDENED ATOMIC RPC FUNCTIONS (SECURITY DEFINER with server-side validation)
-- ----------------------------------------------------------------------------

-- Function: Create a new mess and generate unique access code
CREATE OR REPLACE FUNCTION public.create_mess(
    p_name TEXT,
    p_location TEXT,
    p_owner_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    new_access_code TEXT;
    new_mess RECORD;
    cleaned_name TEXT;
BEGIN
    -- Derive authenticated caller securely
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        IF auth.role() = 'service_role' AND p_owner_id IS NOT NULL THEN
            v_user_id := p_owner_id;
        ELSE
            RAISE EXCEPTION 'Authentication required to register a mess.';
        END IF;
    END IF;

    cleaned_name := trim(COALESCE(p_name, ''));
    IF cleaned_name = '' THEN
        RAISE EXCEPTION 'Mess name cannot be empty.';
    END IF;

    -- Check for duplicate active mess name
    IF EXISTS (SELECT 1 FROM public.messes WHERE lower(trim(name)) = lower(cleaned_name) AND is_active = true) THEN
        RAISE EXCEPTION 'A mess with the name "%" is already registered.', cleaned_name;
    END IF;

    -- Signal to the profile escalation trigger that this is an authorized mess creation
    PERFORM set_config('mealback.trusted_mess_creation', 'true', true);

    -- Generate random unique access code like MESS-7492
    new_access_code := 'MESS-' || floor(1000 + random() * 9000)::TEXT || upper(substring(md5(random()::TEXT) from 1 for 2));

    INSERT INTO public.messes (
        name,
        location,
        access_code,
        created_by,
        is_active
    ) VALUES (
        cleaned_name,
        nullif(trim(COALESCE(p_location, '')), ''),
        new_access_code,
        v_user_id,
        true
    )
    RETURNING * INTO new_mess;

    -- Update owner profile to mess manager (bypassing restriction trigger since function is SECURITY DEFINER)
    UPDATE public.profiles
    SET mess_id = new_mess.id,
        role = 'mess',
        is_mess_manager = true,
        updated_at = now()
    WHERE id = v_user_id;

    RETURN to_jsonb(new_mess);
END;
$$;

-- Function: Monthly listing count for seller
CREATE OR REPLACE FUNCTION public.get_seller_monthly_count(p_seller_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_seller_id UUID;
    count_val INTEGER;
    start_of_month TIMESTAMPTZ;
BEGIN
    v_seller_id := COALESCE(auth.uid(), p_seller_id);
    IF v_seller_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Authorization: authenticated users can only query their own monthly count unless mess staff or service_role
    IF auth.uid() IS NOT NULL AND auth.uid() != v_seller_id THEN
        IF NOT public.is_current_user_mess_staff() AND auth.role() IS DISTINCT FROM 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized: You may only query your own monthly listings.';
        END IF;
    END IF;

    start_of_month := date_trunc('month', now());
    
    SELECT COUNT(*)
    INTO count_val
    FROM public.tokens
    WHERE seller_id = v_seller_id
      AND status != 'cancelled'
      AND created_at >= start_of_month;

    RETURN COALESCE(count_val, 0);
END;
$$;

-- Function: List a new meal token
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
        'list_price', new_token.list_price,
        'message', 'Meal successfully listed on the marketplace'
    );
END;
$$;

-- Function: Buy a token atomically
CREATE OR REPLACE FUNCTION public.buy_token(
    p_token_id UUID,
    p_buyer_id UUID,
    p_payment_ref TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_buyer_id UUID;
    locked_token RECORD;
    seller_amount NUMERIC;
BEGIN
    -- Derive buyer from auth.uid()
    IF auth.uid() IS NOT NULL THEN
        IF p_buyer_id IS NOT NULL AND p_buyer_id != auth.uid() THEN
            RAISE EXCEPTION 'Unauthorized: Caller identity does not match buyer ID.';
        END IF;
        v_buyer_id := auth.uid();
    ELSE
        IF auth.role() = 'service_role' AND p_buyer_id IS NOT NULL THEN
            v_buyer_id := p_buyer_id;
        ELSE
            RAISE EXCEPTION 'Authentication required to purchase a meal.';
        END IF;
    END IF;

    IF p_payment_ref IS NULL OR length(trim(p_payment_ref)) < 4 THEN
        RAISE EXCEPTION 'Valid payment reference is required to issue a purchased token.';
    END IF;

    -- Atomic row lock using FOR UPDATE to prevent race conditions
    SELECT *
    INTO locked_token
    FROM public.tokens
    WHERE id = p_token_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meal token not found.';
    END IF;

    IF locked_token.status != 'listed' THEN
        RAISE EXCEPTION 'This meal token is no longer available (currently %).', locked_token.status;
    END IF;

    IF now() >= locked_token.cutoff_at THEN
        RAISE EXCEPTION 'The purchase cutoff time for this meal has passed.';
    END IF;

    IF locked_token.seller_id = v_buyer_id THEN
        RAISE EXCEPTION 'You cannot purchase your own listed meal token.';
    END IF;

    seller_amount := locked_token.list_price;

    -- Mark token as sold to the authenticated buyer
    UPDATE public.tokens
    SET status = 'sold',
        buyer_id = v_buyer_id,
        sold_at = now()
    WHERE id = p_token_id;

    -- Record transaction
    INSERT INTO public.payments (
        token_id,
        buyer_id,
        amount,
        payment_method,
        payment_ref,
        status
    ) VALUES (
        p_token_id,
        v_buyer_id,
        locked_token.list_price,
        'upi_simulated',
        p_payment_ref,
        'success'
    );

    -- Credit seller wallet entry
    INSERT INTO public.wallet_entries (
        user_id,
        token_id,
        amount,
        type,
        status,
        description
    ) VALUES (
        locked_token.seller_id,
        p_token_id,
        seller_amount,
        'credit',
        'pending',
        'Earnings for ' || locked_token.meal_type || ' on ' || locked_token.meal_date
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', locked_token.id,
        'short_code', locked_token.short_code,
        'qr_secret', locked_token.qr_secret,
        'status', 'sold',
        'list_price', locked_token.list_price,
        'meal_type', locked_token.meal_type,
        'message', 'Token successfully reserved and issued'
    );
END;
$$;

-- Function: Verify and use token (Staff scanner redemption)
CREATE OR REPLACE FUNCTION public.verify_and_use_token(
    p_identifier TEXT,
    p_mess_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_id UUID;
    v_staff_role TEXT;
    v_staff_mess_id UUID;
    target_token RECORD;
    seller_name TEXT;
    buyer_name TEXT;
    mess_name_val TEXT;
BEGIN
    -- Derive authenticated staff member
    IF auth.uid() IS NOT NULL THEN
        v_staff_id := auth.uid();
    ELSE
        IF auth.role() = 'service_role' AND p_staff_id IS NOT NULL THEN
            v_staff_id := p_staff_id;
        ELSE
            RETURN jsonb_build_object(
                'result', 'INVALID',
                'message', 'Authentication required. Please sign in as mess staff.'
            );
        END IF;
    END IF;

    -- Verify staff role and assigned mess directly from database
    SELECT role, mess_id INTO v_staff_role, v_staff_mess_id
    FROM public.profiles
    WHERE id = v_staff_id;

    IF v_staff_role IS DISTINCT FROM 'mess' OR v_staff_mess_id IS NULL THEN
        RETURN jsonb_build_object(
            'result', 'INVALID',
            'message', 'Unauthorized. Only active mess staff assigned to a mess can verify tokens.'
        );
    END IF;

    -- If caller supplied p_mess_id, ensure it matches staff member's assigned mess
    IF p_mess_id IS NOT NULL AND p_mess_id != v_staff_mess_id THEN
        RETURN jsonb_build_object(
            'result', 'INVALID',
            'message', 'Security mismatch: Staff is not authorized for the requested mess.'
        );
    END IF;

    SELECT *
    INTO target_token
    FROM public.tokens
    WHERE (qr_secret = p_identifier OR short_code = upper(trim(p_identifier)))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'result', 'INVALID',
            'message', 'Token not found. Verify the QR code or enter the 6-character short code.'
        );
    END IF;

    -- Validate mess match using the verified staff mess ID
    IF target_token.mess_id != v_staff_mess_id THEN
        SELECT name INTO mess_name_val FROM public.messes WHERE id = target_token.mess_id;
        RETURN jsonb_build_object(
            'result', 'WRONG_MESS',
            'message', 'This token belongs to ' || COALESCE(mess_name_val, 'another mess') || ', not your dining hall.',
            'token', jsonb_build_object(
                'id', target_token.id,
                'meal_type', target_token.meal_type,
                'meal_date', target_token.meal_date
            )
        );
    END IF;

    IF target_token.status = 'used' THEN
        RETURN jsonb_build_object(
            'result', 'ALREADY_USED',
            'message', 'This token was already scanned and redeemed at ' || to_char(target_token.used_at, 'HH12:MI AM on DD Mon'),
            'token', jsonb_build_object(
                'id', target_token.id,
                'used_at', target_token.used_at,
                'meal_type', target_token.meal_type
            )
        );
    END IF;

    IF target_token.status = 'expired' OR now() > target_token.valid_until THEN
        UPDATE public.tokens SET status = 'expired' WHERE id = target_token.id;
        RETURN jsonb_build_object(
            'result', 'EXPIRED',
            'message', 'This meal pass expired at ' || to_char(target_token.valid_until, 'HH12:MI AM'),
            'token', jsonb_build_object(
                'id', target_token.id,
                'valid_until', target_token.valid_until
            )
        );
    END IF;

    IF target_token.status != 'sold' THEN
        RETURN jsonb_build_object(
            'result', 'INVALID',
            'message', 'This token has not been sold yet (status: ' || target_token.status || ').'
        );
    END IF;

    -- Redeem token atomically
    UPDATE public.tokens
    SET status = 'used',
        used_at = now(),
        scanned_by = v_staff_id
    WHERE id = target_token.id;

    -- Unlock seller wallet earnings from 'pending' to 'available'
    UPDATE public.wallet_entries
    SET status = 'available'
    WHERE token_id = target_token.id AND status = 'pending';

    -- Retrieve names for scan display
    SELECT COALESCE(full_name, email) INTO seller_name FROM public.profiles WHERE id = target_token.seller_id;
    SELECT COALESCE(full_name, email) INTO buyer_name FROM public.profiles WHERE id = target_token.buyer_id;

    RETURN jsonb_build_object(
        'result', 'SUCCESS',
        'message', 'Token redeemed! Meal verified for counter issue.',
        'token', jsonb_build_object(
            'id', target_token.id,
            'meal_type', target_token.meal_type,
            'meal_date', target_token.meal_date,
            'short_code', target_token.short_code,
            'used_at', now(),
            'buyer_name', COALESCE(buyer_name, 'Guest Student'),
            'seller_name', COALESCE(seller_name, 'Seller')
        )
    );
END;
$$;

-- Function: Get Mess Analytics & Scans (Authorized for mess staff)
CREATE OR REPLACE FUNCTION public.get_mess_stats(p_mess_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_mess_id UUID;
    stats RECORD;
    meals RECORD;
    recent_scans JSONB;
    avg_rating NUMERIC;
BEGIN
    v_caller_id := auth.uid();
    
    -- Verify mess staff authorization
    IF v_caller_id IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
        SELECT role, mess_id INTO v_caller_role, v_caller_mess_id
        FROM public.profiles
        WHERE id = v_caller_id;

        IF v_caller_role IS DISTINCT FROM 'mess' OR v_caller_mess_id != p_mess_id THEN
            RAISE EXCEPTION 'Unauthorized: You can only view statistics for your assigned mess.';
        END IF;
    END IF;

    SELECT 
        COUNT(*) FILTER (WHERE status = 'listed') AS listed_count,
        COUNT(*) FILTER (WHERE status = 'sold') AS sold_count,
        COUNT(*) FILTER (WHERE status = 'used') AS used_count,
        COUNT(*) FILTER (WHERE status IN ('listed', 'sold')) AS pending_count
    INTO stats
    FROM public.tokens
    WHERE mess_id = p_mess_id AND meal_date = p_date;

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

-- ----------------------------------------------------------------------------
-- 12. PERMISSIONS & MINIMAL PRIVILEGE GRANTS
-- ----------------------------------------------------------------------------
-- Revoke all function execution from PUBLIC and anon
REVOKE ALL ON FUNCTION public.create_mess(TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_meal_token(UUID, UUID, TEXT, DATE, TIME, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buy_token(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_and_use_token(TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_mess_stats(UUID, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_seller_monthly_count(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_current_user_mess_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_current_user_mess_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prevent_profile_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Grant minimal required permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Authenticated table access (filtered by RLS)
GRANT ALL ON public.messes TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.tokens TO authenticated;
GRANT ALL ON public.payments TO authenticated;
GRANT ALL ON public.wallet_entries TO authenticated;
GRANT ALL ON public.ratings TO authenticated;

-- Public / Anonymous read access (filtered by RLS)
GRANT SELECT ON public.messes TO anon;
GRANT SELECT ON public.marketplace_tokens TO anon, authenticated;
GRANT SELECT ON public.tokens TO anon;
GRANT SELECT ON public.ratings TO anon;

-- Explicit RPC execution grants for authenticated clients
GRANT EXECUTE ON FUNCTION public.create_mess(TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_meal_token(UUID, UUID, TEXT, DATE, TIME, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buy_token(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_and_use_token(TEXT, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mess_stats(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_seller_monthly_count(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_user_mess_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_mess_id() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 13. RELOAD SCHEMA CACHE
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
