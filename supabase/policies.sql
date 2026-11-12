-- ============================================================
-- RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
-- Row Level Security (RLS) Policies
-- Least-Privilege Access Control
-- ============================================================

-- Enable RLS on every public table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ------------------------------------------------------------
-- Any user can view their own profile; staff and admin can view all profiles
DROP POLICY IF EXISTS "Users can view own profile or staff/admin can view all" ON public.profiles;
CREATE POLICY "Users can view own profile or staff/admin can view all"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_staff_or_admin());

-- Users can update only their own profile details (role tampering prevented)
DROP POLICY IF EXISTS "Users can update own profile contact info" ON public.profiles;
CREATE POLICY "Users can update own profile contact info"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND (role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) OR public.is_admin())
    );

-- Authenticated users can insert their own profile row if missing
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. CATEGORIES POLICIES
-- ------------------------------------------------------------
-- Public read access: Anyone can browse food categories
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories"
    ON public.categories FOR SELECT
    USING (TRUE);

-- Admin only can insert, update, or delete categories
DROP POLICY IF EXISTS "Admin can insert categories" ON public.categories;
CREATE POLICY "Admin can insert categories"
    ON public.categories FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update categories" ON public.categories;
CREATE POLICY "Admin can update categories"
    ON public.categories FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete categories" ON public.categories;
CREATE POLICY "Admin can delete categories"
    ON public.categories FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------
-- 3. FOODS POLICIES
-- ------------------------------------------------------------
-- Public read access: Active items visible to all; staff/admin can see inactive items too
DROP POLICY IF EXISTS "Public can view available foods; staff/admin view all" ON public.foods;
CREATE POLICY "Public can view available foods; staff/admin view all"
    ON public.foods FOR SELECT
    USING (is_available = TRUE OR public.is_staff_or_admin());

-- Admin only can insert, update, or delete food items
DROP POLICY IF EXISTS "Admin can insert foods" ON public.foods;
CREATE POLICY "Admin can insert foods"
    ON public.foods FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update foods" ON public.foods;
CREATE POLICY "Admin can update foods"
    ON public.foods FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete foods" ON public.foods;
CREATE POLICY "Admin can delete foods"
    ON public.foods FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------
-- 4. COUPONS POLICIES
-- ------------------------------------------------------------
-- Public/customers can view active coupons
DROP POLICY IF EXISTS "Users can view active coupons; admin view all" ON public.coupons;
CREATE POLICY "Users can view active coupons; admin view all"
    ON public.coupons FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

-- Admin only can insert, update, or delete coupons
DROP POLICY IF EXISTS "Admin can insert coupons" ON public.coupons;
CREATE POLICY "Admin can insert coupons"
    ON public.coupons FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update coupons" ON public.coupons;
CREATE POLICY "Admin can update coupons"
    ON public.coupons FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete coupons" ON public.coupons;
CREATE POLICY "Admin can delete coupons"
    ON public.coupons FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------
-- 5. ORDERS POLICIES
-- ------------------------------------------------------------
-- Customers view only their own orders; staff and admin view all orders
DROP POLICY IF EXISTS "Customers view own orders; staff/admin view all" ON public.orders;
CREATE POLICY "Customers view own orders; staff/admin view all"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id OR public.is_staff_or_admin());

-- Customers insert their own orders (and RPC create_order uses SECURITY DEFINER)
DROP POLICY IF EXISTS "Authenticated customers can insert own orders" ON public.orders;
CREATE POLICY "Authenticated customers can insert own orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Staff and Admin can update orders (e.g. status)
DROP POLICY IF EXISTS "Staff and Admin can update orders" ON public.orders;
CREATE POLICY "Staff and Admin can update orders"
    ON public.orders FOR UPDATE
    USING (public.is_staff_or_admin())
    WITH CHECK (public.is_staff_or_admin());

-- Admin can delete orders if necessary
DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;
CREATE POLICY "Admin can delete orders"
    ON public.orders FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------
-- 6. ORDER ITEMS POLICIES
-- ------------------------------------------------------------
-- Customers view items of their own orders; staff and admin view all
DROP POLICY IF EXISTS "View order items" ON public.order_items;
CREATE POLICY "View order items"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (o.user_id = auth.uid() OR public.is_staff_or_admin())
        )
    );

-- Insertion is permitted for the order owner
DROP POLICY IF EXISTS "Insert order items" ON public.order_items;
CREATE POLICY "Insert order items"
    ON public.order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------
-- 7. COUPON USAGES POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own coupon usage; admin view all" ON public.coupon_usages;
CREATE POLICY "Users view own coupon usage; admin view all"
    ON public.coupon_usages FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------
-- 8. ORDER STATUS HISTORY POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "View order status history" ON public.order_status_history;
CREATE POLICY "View order status history"
    ON public.order_status_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_status_history.order_id
            AND (o.user_id = auth.uid() OR public.is_staff_or_admin())
        )
    );
