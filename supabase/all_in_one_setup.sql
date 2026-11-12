-- ============================================================
-- RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
-- ALL-IN-ONE SUPABASE DATABASE SETUP SCRIPT
-- Course: SE331 - Software Engineering Design Capstone
-- ============================================================
-- Paste this entire script into your Supabase Project SQL Editor
-- and click "RUN" to initialize tables, functions, triggers,
-- RLS security policies, and seed data in a single step!
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if re-running
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS coupon_usages CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS foods CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. CREATE TABLES
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_display_order ON categories(display_order);

CREATE TABLE foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    preparation_time_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_foods_category ON foods(category_id);
CREATE INDEX idx_foods_available ON foods(is_available);
CREATE INDEX idx_foods_name ON foods(name);

CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    minimum_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (minimum_order_amount >= 0),
    maximum_discount NUMERIC(10,2) CHECK (maximum_discount IS NULL OR maximum_discount > 0),
    usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
    used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    order_type TEXT NOT NULL CHECK (order_type IN ('Dine In', 'Pickup', 'Delivery')),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Debit Card', 'E-Wallet')),
    payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Refunded')),
    order_status TEXT NOT NULL DEFAULT 'Pending' CHECK (order_status IN ('Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Completed', 'Cancelled')),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    delivery_address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_number ON orders(order_number);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
    food_name_snapshot TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(10,2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_food ON order_items(food_id);

CREATE TABLE coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user ON coupon_usages(user_id);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT
);

CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- 3. FUNCTIONS & TRIGGERS
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
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role IN ('staff', 'admin') FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.validate_coupon(
    p_code TEXT,
    p_subtotal NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coupon RECORD;
    v_discount NUMERIC(10,2) := 0;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE UPPER(code) = UPPER(TRIM(p_code));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'Coupon code does not exist.');
    END IF;

    IF NOT v_coupon.is_active THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'This coupon is currently inactive.');
    END IF;

    IF v_now < v_coupon.start_date THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'This coupon has not started yet.');
    END IF;

    IF v_now > v_coupon.expiry_date THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'This coupon has expired.');
    END IF;

    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'This coupon has reached its maximum usage limit.');
    END IF;

    IF p_subtotal < v_coupon.minimum_order_amount THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'Minimum order amount for this coupon is ৳' || v_coupon.minimum_order_amount);
    END IF;

    IF v_coupon.discount_type = 'percentage' THEN
        v_discount := ROUND((p_subtotal * (v_coupon.discount_value / 100.0)), 2);
        IF v_coupon.maximum_discount IS NOT NULL AND v_discount > v_coupon.maximum_discount THEN
            v_discount := v_coupon.maximum_discount;
        END IF;
    ELSE
        v_discount := v_coupon.discount_value;
    END IF;

    IF v_discount > p_subtotal THEN
        v_discount := p_subtotal;
    END IF;

    RETURN jsonb_build_object(
        'is_valid', TRUE,
        'message', 'Coupon applied successfully!',
        'coupon_id', v_coupon.id,
        'code', v_coupon.code,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'discount_amount', v_discount
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order(
    p_order_type TEXT,
    p_payment_method TEXT,
    p_customer_name TEXT,
    p_phone TEXT,
    p_delivery_address TEXT,
    p_notes TEXT,
    p_coupon_code TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_order_id UUID;
    v_order_number TEXT;
    v_item RECORD;
    v_food RECORD;
    v_subtotal NUMERIC(10,2) := 0;
    v_discount NUMERIC(10,2) := 0;
    v_total NUMERIC(10,2) := 0;
    v_coupon_id UUID := NULL;
    v_coupon_result JSONB;
    v_item_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to place an order.';
    END IF;

    IF p_customer_name IS NULL OR TRIM(p_customer_name) = '' THEN
        RAISE EXCEPTION 'Customer name is required.';
    END IF;

    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RAISE EXCEPTION 'Phone number is required.';
    END IF;

    IF p_order_type NOT IN ('Dine In', 'Pickup', 'Delivery') THEN
        RAISE EXCEPTION 'Invalid order type: %', p_order_type;
    END IF;

    IF p_order_type = 'Delivery' AND (p_delivery_address IS NULL OR TRIM(p_delivery_address) = '') THEN
        RAISE EXCEPTION 'Delivery address is required for Delivery orders.';
    END IF;

    IF p_payment_method NOT IN ('Cash', 'Debit Card', 'E-Wallet') THEN
        RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
    END IF;

    v_item_count := jsonb_array_length(p_items);
    IF v_item_count IS NULL OR v_item_count = 0 THEN
        RAISE EXCEPTION 'Cart is empty. Please add items before placing order.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(food_id UUID, quantity INTEGER)
    LOOP
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity must be at least 1.';
        END IF;

        SELECT id, name, price, is_available INTO v_food
        FROM public.foods
        WHERE id = v_item.food_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Food item not found.';
        END IF;

        IF NOT v_food.is_available THEN
            RAISE EXCEPTION 'Item "%" is currently unavailable.', v_food.name;
        END IF;

        v_subtotal := v_subtotal + (v_food.price * v_item.quantity);
    END LOOP;

    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        v_coupon_result := public.validate_coupon(p_coupon_code, v_subtotal);
        IF (v_coupon_result->>'is_valid')::BOOLEAN THEN
            v_coupon_id := (v_coupon_result->>'coupon_id')::UUID;
            v_discount := (v_coupon_result->>'discount_amount')::NUMERIC;
        ELSE
            RAISE EXCEPTION 'Coupon error: %', (v_coupon_result->>'message');
        END IF;
    END IF;

    v_total := v_subtotal - v_discount;
    IF v_total < 0 THEN
        v_total := 0;
    END IF;

    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTR(MD5(gen_random_uuid()::TEXT), 1, 6));

    INSERT INTO public.orders (
        order_number, user_id, order_type, subtotal, discount_amount, total_amount,
        coupon_id, payment_method, payment_status, order_status, customer_name,
        phone, delivery_address, notes
    ) VALUES (
        v_order_number, v_user_id, p_order_type, v_subtotal, v_discount, v_total,
        v_coupon_id, p_payment_method,
        CASE WHEN p_payment_method IN ('Debit Card', 'E-Wallet') THEN 'Paid' ELSE 'Pending' END,
        'Pending', TRIM(p_customer_name), TRIM(p_phone), TRIM(p_delivery_address), TRIM(p_notes)
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(food_id UUID, quantity INTEGER)
    LOOP
        SELECT id, name, price INTO v_food
        FROM public.foods
        WHERE id = v_item.food_id;

        INSERT INTO public.order_items (
            order_id, food_id, food_name_snapshot, unit_price, quantity, line_total
        ) VALUES (
            v_order_id, v_food.id, v_food.name, v_food.price, v_item.quantity,
            v_food.price * v_item.quantity
        );
    END LOOP;

    IF v_coupon_id IS NOT NULL THEN
        UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_coupon_id;
        INSERT INTO public.coupon_usages (coupon_id, user_id, order_id)
        VALUES (v_coupon_id, v_user_id, v_order_id);
    END IF;

    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, note)
    VALUES (v_order_id, NULL, 'Pending', v_user_id, 'Order placed by customer.');

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'discount_amount', v_discount,
        'total_amount', v_total
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id UUID,
    p_new_status TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_status TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF NOT public.is_staff_or_admin() THEN
        RAISE EXCEPTION 'Access denied. Only staff and admin can update order status.';
    END IF;

    IF p_new_status NOT IN ('Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Completed', 'Cancelled') THEN
        RAISE EXCEPTION 'Invalid order status: %', p_new_status;
    END IF;

    SELECT order_status INTO v_old_status FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object('success', TRUE, 'message', 'Status unchanged.');
    END IF;

    UPDATE public.orders
    SET order_status = p_new_status,
        payment_status = CASE 
            WHEN p_new_status = 'Completed' AND payment_method = 'Cash' THEN 'Paid'
            ELSE payment_status
        END,
        updated_at = NOW()
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, note)
    VALUES (p_order_id, v_old_status, p_new_status, v_user_id, COALESCE(p_note, 'Status updated to ' || p_new_status));

    RETURN jsonb_build_object('success', TRUE, 'old_status', v_old_status, 'new_status', p_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_sales_report(p_report_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_orders INTEGER := 0;
    v_completed_orders INTEGER := 0;
    v_cancelled_orders INTEGER := 0;
    v_gross_sales NUMERIC(10,2) := 0;
    v_discounts NUMERIC(10,2) := 0;
    v_net_sales NUMERIC(10,2) := 0;
    v_orders JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE order_status = 'Completed'),
        COUNT(*) FILTER (WHERE order_status = 'Cancelled'),
        COALESCE(SUM(subtotal) FILTER (WHERE order_status != 'Cancelled'), 0),
        COALESCE(SUM(discount_amount) FILTER (WHERE order_status != 'Cancelled'), 0),
        COALESCE(SUM(total_amount) FILTER (WHERE order_status = 'Completed'), 0)
    INTO
        v_total_orders, v_completed_orders, v_cancelled_orders,
        v_gross_sales, v_discounts, v_net_sales
    FROM public.orders
    WHERE DATE(created_at AT TIME ZONE 'UTC') = p_report_date;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'customer_name', o.customer_name,
            'order_type', o.order_type,
            'payment_method', o.payment_method,
            'order_status', o.order_status,
            'subtotal', o.subtotal,
            'discount_amount', o.discount_amount,
            'total_amount', o.total_amount,
            'created_at', o.created_at
        ) ORDER BY o.created_at DESC
    ), '[]'::jsonb)
    INTO v_orders
    FROM public.orders o
    WHERE DATE(o.created_at AT TIME ZONE 'UTC') = p_report_date;

    RETURN jsonb_build_object(
        'report_date', p_report_date,
        'total_orders', v_total_orders,
        'completed_orders', v_completed_orders,
        'cancelled_orders', v_cancelled_orders,
        'gross_sales', v_gross_sales,
        'total_discounts', v_discounts,
        'net_sales', v_net_sales,
        'orders', v_orders
    );
END;
$$;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND (role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) OR public.is_admin()));

-- Categories
DROP POLICY IF EXISTS "categories_select" ON public.categories;
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "categories_insert" ON public.categories;
CREATE POLICY "categories_insert" ON public.categories FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_update" ON public.categories;
CREATE POLICY "categories_update" ON public.categories FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_delete" ON public.categories;
CREATE POLICY "categories_delete" ON public.categories FOR DELETE USING (public.is_admin());

-- Foods
DROP POLICY IF EXISTS "foods_select" ON public.foods;
CREATE POLICY "foods_select" ON public.foods FOR SELECT USING (is_available = TRUE OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "foods_insert" ON public.foods;
CREATE POLICY "foods_insert" ON public.foods FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "foods_update" ON public.foods;
CREATE POLICY "foods_update" ON public.foods FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "foods_delete" ON public.foods;
CREATE POLICY "foods_delete" ON public.foods FOR DELETE USING (public.is_admin());

-- Coupons
DROP POLICY IF EXISTS "coupons_select" ON public.coupons;
CREATE POLICY "coupons_select" ON public.coupons FOR SELECT USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "coupons_insert" ON public.coupons;
CREATE POLICY "coupons_insert" ON public.coupons FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coupons_update" ON public.coupons;
CREATE POLICY "coupons_update" ON public.coupons FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coupons_delete" ON public.coupons;
CREATE POLICY "coupons_delete" ON public.coupons FOR DELETE USING (public.is_admin());

-- Orders
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update" ON public.orders FOR UPDATE USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_delete" ON public.orders FOR DELETE USING (public.is_admin());

-- Order Items
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR public.is_staff_or_admin()))
);

DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);

-- Coupon Usages
DROP POLICY IF EXISTS "coupon_usages_select" ON public.coupon_usages;
CREATE POLICY "coupon_usages_select" ON public.coupon_usages FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Order Status History
DROP POLICY IF EXISTS "order_status_history_select" ON public.order_status_history;
CREATE POLICY "order_status_history_select" ON public.order_status_history FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND (o.user_id = auth.uid() OR public.is_staff_or_admin()))
);

-- 5. STORAGE BUCKET & POLICIES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'food-images',
    'food-images',
    TRUE,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "storage_food_images_select" ON storage.objects;
CREATE POLICY "storage_food_images_select" ON storage.objects FOR SELECT USING (bucket_id = 'food-images');

DROP POLICY IF EXISTS "storage_food_images_insert" ON storage.objects;
CREATE POLICY "storage_food_images_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'food-images' AND public.is_admin());

DROP POLICY IF EXISTS "storage_food_images_update" ON storage.objects;
CREATE POLICY "storage_food_images_update" ON storage.objects FOR UPDATE USING (bucket_id = 'food-images' AND public.is_admin());

DROP POLICY IF EXISTS "storage_food_images_delete" ON storage.objects;
CREATE POLICY "storage_food_images_delete" ON storage.objects FOR DELETE USING (bucket_id = 'food-images' AND public.is_admin());

-- 6. SEED DATA
INSERT INTO public.categories (id, name, slug, description, image_url, display_order) VALUES
('c1000000-0000-0000-0000-000000000001', 'Pizza', 'pizza', 'Artisanal stone-baked pizzas with fresh toppings', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80', 1),
('c1000000-0000-0000-0000-000000000002', 'Fast Food', 'fast-food', 'Crispy burgers, seasoned fries and golden wings', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 2),
('c1000000-0000-0000-0000-000000000003', 'Noodle', 'noodle', 'Stir-fried wok noodles and comforting broth bowls', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80', 3),
('c1000000-0000-0000-0000-000000000004', 'Dessert', 'dessert', 'Handcrafted pastries, molten cakes and creamy treats', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80', 4),
('c1000000-0000-0000-0000-000000000005', 'Seafood', 'seafood', 'Fresh coastal catches, garlic butter prawns and calamari', 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=400&q=80', 5),
('c1000000-0000-0000-0000-000000000006', 'Sushi', 'sushi', 'Hand-rolled maki, nigiri and premium sashimi platters', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80', 6),
('c1000000-0000-0000-0000-000000000007', 'Ramen', 'ramen', 'Slow-simmered rich broths with tender chashu & ajitsuke tamago', 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=400&q=80', 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.foods (id, category_id, name, description, price, image_url, is_available, is_featured, preparation_time_minutes) VALUES
('f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Margherita Supreme', 'Fresh mozzarella, basil leaves, San Marzano tomato puree, extra virgin olive oil on hand-stretched sourdough crust.', 550.00, 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 15),
('f1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Smoked Beef Pepperoni', 'Double spiced beef pepperoni slices, aged cheddar, mozzarella and signature oregano tomato sauce.', 680.00, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 20),
('f1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'BBQ Chicken Fiesta', 'Grilled barbecue chicken breast strips, caramelized onions, bell peppers and smoked barbecue drizzle.', 620.00, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 18),
('f1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002', 'Double Smash Cheeseburger', 'Two 100g smashed beef patties, melted American cheese, pickles, caramelized onions and secret burger sauce.', 420.00, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 12),
('f1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000002', 'Crispy Peri-Peri Wings', 'Eight pieces of double-crunch chicken wings tossed in fiery African bird’s eye peri-peri glaze with ranch dip.', 340.00, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 15),
('f1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000002', 'Loaded Truffle Fries', 'Crispy skin-on french fries seasoned with white truffle oil, parmesan snow, and spring herbs.', 220.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 10),
('f1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'Pad Thai Wok Noodles', 'Traditional stir-fried rice noodles with prawns, scrambled egg, tofu, bean sprouts, crushed peanuts and lime.', 390.00, 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 14),
('f1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000003', 'Spicy Dan Dan Noodles', 'Springy wheat noodles tossed with spicy chili oil paste, minced chicken, bok choy, and roasted sesame seeds.', 360.00, 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 12),
('f1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000004', 'Molten Belgian Lava Cake', 'Warm chocolate cake with a molten dark chocolate center, served with vanilla bean ice cream.', 280.00, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 15),
('f1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000004', 'New York Berry Cheesecake', 'Silky baked cream cheese tart topped with fresh blueberry and raspberry compote.', 310.00, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 5),
('f1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000005', 'Garlic Butter Jumbo Prawns', 'Pan-seared jumbo tiger prawns drenched in aromatic garlic herb butter sauce with toasted baguette.', 650.00, 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 18),
('f1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000005', 'Golden Crispy Calamari', 'Tender squid rings dusted in seasoned semolina flour, fried golden and served with citrus tartar.', 450.00, 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 12),
('f1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000006', 'Salmon Dragon Roll (8 pcs)', 'Inside-out sushi roll with crispy prawn tempura, avocado, draped with Norwegian salmon and tobiko.', 580.00, 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 15),
('f1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000006', 'Spicy Tuna Maki (8 pcs)', 'Fresh sashimi-grade yellowfin tuna, cucumber, spicy sriracha mayo, rolled in seasoned sushi rice and nori.', 520.00, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 15),
('f1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000007', 'Classic Tonkotsu Ramen', '18-hour rich pork bone broth with hand-pulled noodles, braised chashu pork, seasoned soft egg, and nori.', 490.00, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 16),
('f1000000-0000-0000-0000-000000000016', 'c1000000-0000-0000-0000-000000000007', 'Spicy Miso Ramen', 'Rich fermented red miso broth with chili oil, ground chicken, sweet corn, bamboo shoots, and scallions.', 460.00, 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.coupons (id, code, description, discount_type, discount_value, minimum_order_amount, maximum_discount, usage_limit, used_count, start_date, expiry_date, is_active)
VALUES
('d1000000-0000-0000-0000-000000000001', 'WELCOME10', '10% discount on orders above ৳300 (Max ৳100)', 'percentage', 10.00, 300.00, 100.00, 500, 0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', TRUE),
('d1000000-0000-0000-0000-000000000002', 'SUPER50', 'Flat ৳50 off on orders above ৳500', 'fixed', 50.00, 500.00, NULL, 300, 0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', TRUE),
('d1000000-0000-0000-0000-000000000003', 'RAMEN15', '15% discount for Ramen lovers (Min ৳400)', 'percentage', 15.00, 400.00, 120.00, 200, 0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', TRUE)
ON CONFLICT (id) DO NOTHING;
