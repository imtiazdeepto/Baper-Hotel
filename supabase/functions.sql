-- ============================================================
-- RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
-- Supabase PostgreSQL Functions, Triggers, and Stored Procedures (RPC)
-- ============================================================

-- ------------------------------------------------------------
-- 1. AUTH TRIGGER: Automatically populate profiles table on signup
-- ------------------------------------------------------------
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
        'customer' -- Always default to customer for public registration
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. ROLE CHECK HELPER FUNCTIONS (Prevents RLS Recursion)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 3. COUPON VALIDATION FUNCTION
-- ------------------------------------------------------------
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
        RETURN jsonb_build_object(
            'is_valid', FALSE,
            'message', 'Coupon code does not exist.'
        );
    END IF;

    IF NOT v_coupon.is_active THEN
        RETURN jsonb_build_object(
            'is_valid', FALSE,
            'message', 'This coupon is currently inactive.'
        );
    END IF;

    IF v_now < v_coupon.start_date THEN
        RETURN jsonb_build_object(
            'is_valid', FALSE,
            'message', 'This coupon has not started yet.'
        );
    END IF;

    IF v_now > v_coupon.expiry_date THEN
        RETURN jsonb_build_object(
            'is_valid', FALSE,
            'message', 'This coupon has expired.'
        );
    END IF;

    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object(
            'is_valid', FALSE,
            'message', 'This coupon has reached its maximum usage limit.'
        );
    END IF;

    IF p_subtotal < v_coupon.minimum_order_amount THEN
        RETURN jsonb_build_object(
            'is_valid', FALSE,
            'message', 'Minimum order amount for this coupon is ৳' || v_coupon.minimum_order_amount
        );
    END IF;

    -- Calculate discount
    IF v_coupon.discount_type = 'percentage' THEN
        v_discount := ROUND((p_subtotal * (v_coupon.discount_value / 100.0)), 2);
        IF v_coupon.maximum_discount IS NOT NULL AND v_discount > v_coupon.maximum_discount THEN
            v_discount := v_coupon.maximum_discount;
        END IF;
    ELSE
        -- Fixed discount
        v_discount := v_coupon.discount_value;
    END IF;

    -- Discount cannot exceed subtotal
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

-- ------------------------------------------------------------
-- 4. ATOMIC ORDER CREATION RPC FUNCTION
-- ------------------------------------------------------------
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

    -- Validate user is authenticated
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to place an order.';
    END IF;

    -- Validate inputs
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

    -- Validate items array
    v_item_count := jsonb_array_length(p_items);
    IF v_item_count IS NULL OR v_item_count = 0 THEN
        RAISE EXCEPTION 'Cart is empty. Please add items before placing order.';
    END IF;

    -- Calculate subtotal strictly using trusted database prices
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(food_id UUID, quantity INTEGER)
    LOOP
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity must be at least 1 for all items.';
        END IF;

        SELECT id, name, price, is_available INTO v_food
        FROM public.foods
        WHERE id = v_item.food_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Food item not found: %', v_item.food_id;
        END IF;

        IF NOT v_food.is_available THEN
            RAISE EXCEPTION 'Item "%" is currently unavailable.', v_food.name;
        END IF;

        v_subtotal := v_subtotal + (v_food.price * v_item.quantity);
    END LOOP;

    -- Validate coupon if provided
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

    -- Generate unique human-friendly order number (e.g. ORD-20261112-AB12)
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTR(MD5(gen_random_uuid()::TEXT), 1, 6));

    -- Insert Order
    INSERT INTO public.orders (
        order_number,
        user_id,
        order_type,
        subtotal,
        discount_amount,
        total_amount,
        coupon_id,
        payment_method,
        payment_status,
        order_status,
        customer_name,
        phone,
        delivery_address,
        notes
    ) VALUES (
        v_order_number,
        v_user_id,
        p_order_type,
        v_subtotal,
        v_discount,
        v_total,
        v_coupon_id,
        p_payment_method,
        CASE WHEN p_payment_method IN ('Debit Card', 'E-Wallet') THEN 'Paid' ELSE 'Pending' END,
        'Pending',
        TRIM(p_customer_name),
        TRIM(p_phone),
        TRIM(p_delivery_address),
        TRIM(p_notes)
    ) RETURNING id INTO v_order_id;

    -- Insert Order Items with exact database price snapshots
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(food_id UUID, quantity INTEGER)
    LOOP
        SELECT id, name, price INTO v_food
        FROM public.foods
        WHERE id = v_item.food_id;

        INSERT INTO public.order_items (
            order_id,
            food_id,
            food_name_snapshot,
            unit_price,
            quantity,
            line_total
        ) VALUES (
            v_order_id,
            v_food.id,
            v_food.name,
            v_food.price,
            v_item.quantity,
            v_food.price * v_item.quantity
        );
    END LOOP;

    -- Record coupon usage and increment used count
    IF v_coupon_id IS NOT NULL THEN
        UPDATE public.coupons
        SET used_count = used_count + 1
        WHERE id = v_coupon_id;

        INSERT INTO public.coupon_usages (coupon_id, user_id, order_id)
        VALUES (v_coupon_id, v_user_id, v_order_id);
    END IF;

    -- Record initial order status history
    INSERT INTO public.order_status_history (
        order_id,
        old_status,
        new_status,
        changed_by,
        note
    ) VALUES (
        v_order_id,
        NULL,
        'Pending',
        v_user_id,
        'Order placed by customer.'
    );

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

-- ------------------------------------------------------------
-- 5. ORDER STATUS UPDATER (Staff/Admin Only)
-- ------------------------------------------------------------
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
    v_is_authorized BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    -- Check staff or admin permission
    SELECT public.is_staff_or_admin() INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access denied. Only staff and admin can update order status.';
    END IF;

    -- Validate allowed statuses
    IF p_new_status NOT IN ('Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Completed', 'Cancelled') THEN
        RAISE EXCEPTION 'Invalid order status: %', p_new_status;
    END IF;

    -- Fetch current status
    SELECT order_status INTO v_old_status
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object('success', TRUE, 'message', 'Status unchanged.');
    END IF;

    -- Update order status
    UPDATE public.orders
    SET order_status = p_new_status,
        payment_status = CASE 
            WHEN p_new_status = 'Completed' AND payment_method = 'Cash' THEN 'Paid'
            ELSE payment_status
        END,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Record status history
    INSERT INTO public.order_status_history (
        order_id,
        old_status,
        new_status,
        changed_by,
        note
    ) VALUES (
        p_order_id,
        v_old_status,
        p_new_status,
        v_user_id,
        COALESCE(p_note, 'Status updated to ' || p_new_status)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'old_status', v_old_status,
        'new_status', p_new_status
    );
END;
$$;

-- ------------------------------------------------------------
-- 6. DAILY SALES REPORT AGGREGATION FUNCTION (Admin Only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_sales_report(
    p_report_date DATE
)
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
        v_total_orders,
        v_completed_orders,
        v_cancelled_orders,
        v_gross_sales,
        v_discounts,
        v_net_sales
    FROM public.orders
    WHERE DATE(created_at AT TIME ZONE 'UTC') = p_report_date;

    -- Fetch order list for the day
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

-- ------------------------------------------------------------
-- 7. SAFE ORDER TRACKING FUNCTION (SECURITY DEFINER)
-- ------------------------------------------------------------
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
