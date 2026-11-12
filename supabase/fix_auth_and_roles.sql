-- ============================================================
-- BAPER HOTEL — SUPABASE AUTH & ADMIN SETUP SCRIPT
-- Run this in your Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Ensure authenticated users can create their own profile row
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles 
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- 2. Update trigger to safely handle profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        'customer'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Sync all existing users from auth.users to public.profiles
INSERT INTO public.profiles (id, full_name, email, role)
SELECT 
    id,
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    email,
    'customer'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Set your Admin account role:
-- Replace 'admin@baperhotel.com' with your actual registered email address
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@baperhotel.com';

-- 5. Safe Order Tracking Function (permits order tracking by unique order number across devices)
DROP FUNCTION IF EXISTS public.track_order(TEXT);
CREATE OR REPLACE FUNCTION public.track_order(p_order_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_items JSONB;
    v_history JSONB;
BEGIN
    SELECT * INTO v_order
    FROM public.orders
    WHERE order_number = TRIM(p_order_number);

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'food_name_snapshot', food_name_snapshot,
        'quantity', quantity,
        'unit_price', unit_price,
        'line_total', line_total
    )), '[]'::jsonb) INTO v_items
    FROM public.order_items
    WHERE order_id = v_order.id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'old_status', old_status,
        'new_status', new_status,
        'changed_at', changed_at,
        'note', note
    ) ORDER BY changed_at ASC), '[]'::jsonb) INTO v_history
    FROM public.order_status_history
    WHERE order_id = v_order.id;

    RETURN jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'order_type', v_order.order_type,
        'order_status', v_order.order_status,
        'subtotal', v_order.subtotal,
        'discount_amount', v_order.discount_amount,
        'total_amount', v_order.total_amount,
        'payment_method', v_order.payment_method,
        'payment_status', v_order.payment_status,
        'customer_name', v_order.customer_name,
        'phone', v_order.phone,
        'delivery_address', v_order.delivery_address,
        'notes', v_order.notes,
        'created_at', v_order.created_at,
        'items', v_items,
        'history', v_history
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_order(TEXT) TO anon, authenticated;

-- 6. Verification query: Run this to see all users and their assigned roles
SELECT id, full_name, email, role, created_at FROM public.profiles;
