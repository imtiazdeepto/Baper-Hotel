-- ============================================================
-- BAPER HOTEL: REMEDIATION MIGRATION SCRIPT
-- Deploys:
-- 1. public.track_order (Safe order tracking with privacy masking)
-- 2. public.update_order_status (Strict sequential status progression)
-- 3. public.get_daily_sales_report (Dhaka timezone-aware sales reporting)
-- ============================================================

-- 1. SAFE ORDER TRACKING (SECURITY DEFINER with PII masking)
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
    v_is_owner_or_staff BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_order
    FROM public.orders
    WHERE order_number = TRIM(p_order_number);

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Privacy check: only order owner or staff/admin can view raw PII
    IF auth.uid() IS NOT NULL AND (auth.uid() = v_order.user_id OR public.is_staff_or_admin()) THEN
        v_is_owner_or_staff := TRUE;
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
        -- Privacy protection: mask personal data if anonymous or not owner/staff
        'customer_name', CASE WHEN v_is_owner_or_staff THEN v_order.customer_name ELSE 'Customer' END,
        'phone', CASE WHEN v_is_owner_or_staff THEN v_order.phone ELSE NULL END,
        'delivery_address', CASE WHEN v_is_owner_or_staff THEN v_order.delivery_address ELSE NULL END,
        'notes', CASE WHEN v_is_owner_or_staff THEN v_order.notes ELSE NULL END,
        'created_at', v_order.created_at,
        'items', v_items,
        'history', v_history,
        'is_owner_or_staff', v_is_owner_or_staff
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_order(TEXT) TO anon, authenticated;


-- 2. STRICT STATUS PROGRESSION ENFORCER (Prevents invalid/skipped status jumps)
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
    v_order_type TEXT;
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

    -- Fetch current status and order type
    SELECT order_status, order_type INTO v_old_status, v_order_type
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object('success', TRUE, 'message', 'Status unchanged.');
    END IF;

    -- Enforce terminal state
    IF v_old_status IN ('Completed', 'Cancelled') THEN
        RAISE EXCEPTION 'Order is already % and cannot be changed.', v_old_status;
    END IF;

    -- Enforce valid sequential transitions
    IF p_new_status = 'Cancelled' THEN
        IF v_old_status NOT IN ('Pending', 'Confirmed', 'Preparing') THEN
            RAISE EXCEPTION 'Order cannot be cancelled once it is %.', v_old_status;
        END IF;
    ELSE
        IF v_order_type = 'Delivery' THEN
            IF NOT (
                (v_old_status = 'Pending' AND p_new_status = 'Confirmed') OR
                (v_old_status = 'Confirmed' AND p_new_status = 'Preparing') OR
                (v_old_status = 'Preparing' AND p_new_status = 'Ready') OR
                (v_old_status = 'Ready' AND p_new_status = 'Out for Delivery') OR
                (v_old_status = 'Out for Delivery' AND p_new_status = 'Completed')
            ) THEN
                RAISE EXCEPTION 'Invalid status transition for Delivery order from % to %.', v_old_status, p_new_status;
            END IF;
        ELSE
            IF p_new_status = 'Out for Delivery' THEN
                RAISE EXCEPTION 'Status "Out for Delivery" is only applicable to Delivery orders.';
            END IF;
            IF NOT (
                (v_old_status = 'Pending' AND p_new_status = 'Confirmed') OR
                (v_old_status = 'Confirmed' AND p_new_status = 'Preparing') OR
                (v_old_status = 'Preparing' AND p_new_status = 'Ready') OR
                (v_old_status = 'Ready' AND p_new_status = 'Completed')
            ) THEN
                RAISE EXCEPTION 'Invalid status transition for % order from % to %.', v_order_type, v_old_status, p_new_status;
            END IF;
        END IF;
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

GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT, TEXT) TO authenticated;


-- 3. DHAKA TIMEZONE-ALIGNED DAILY SALES REPORT
CREATE OR REPLACE FUNCTION public.get_daily_sales_report(p_report_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_total_orders INTEGER;
    v_completed_orders INTEGER;
    v_cancelled_orders INTEGER;
    v_gross_sales NUMERIC(10,2);
    v_discounts NUMERIC(10,2);
    v_net_sales NUMERIC(10,2);
    v_orders JSONB;
BEGIN
    -- Check admin permission
    SELECT public.is_admin() INTO v_is_admin;
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied. Only admin can generate sales reports.';
    END IF;

    -- Aggregate metrics for the specified Dhaka calendar day
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE order_status = 'Completed'),
        COUNT(*) FILTER (WHERE order_status = 'Cancelled'),
        COALESCE(SUM(subtotal) FILTER (WHERE order_status != 'Cancelled'), 0.00),
        COALESCE(SUM(discount_amount) FILTER (WHERE order_status != 'Cancelled'), 0.00),
        COALESCE(SUM(total_amount) FILTER (WHERE order_status != 'Cancelled'), 0.00)
    INTO
        v_total_orders,
        v_completed_orders,
        v_cancelled_orders,
        v_gross_sales,
        v_discounts,
        v_net_sales
    FROM public.orders
    WHERE DATE(created_at AT TIME ZONE 'Asia/Dhaka') = p_report_date;

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
    WHERE DATE(o.created_at AT TIME ZONE 'Asia/Dhaka') = p_report_date;

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

GRANT EXECUTE ON FUNCTION public.get_daily_sales_report(DATE) TO authenticated;
