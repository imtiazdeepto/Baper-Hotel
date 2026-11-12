-- ============================================================
-- RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
-- Seed Data: Categories, Foods, Coupons
-- Course: SE331 - Software Engineering Design Capstone
-- ============================================================

-- Clean existing seed data if re-running
DELETE FROM public.order_items WHERE TRUE;
DELETE FROM public.orders WHERE TRUE;
DELETE FROM public.foods WHERE TRUE;
DELETE FROM public.categories WHERE TRUE;
DELETE FROM public.coupons WHERE TRUE;

-- ------------------------------------------------------------
-- 1. SEED CATEGORIES (7 Categories matching requirements)
-- ------------------------------------------------------------
INSERT INTO public.categories (id, name, slug, description, image_url, display_order) VALUES
('c1000000-0000-0000-0000-000000000001', 'Pizza', 'pizza', 'Artisanal stone-baked pizzas with fresh toppings', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80', 1),
('c1000000-0000-0000-0000-000000000002', 'Fast Food', 'fast-food', 'Crispy burgers, seasoned fries and golden wings', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 2),
('c1000000-0000-0000-0000-000000000003', 'Noodle', 'noodle', 'Stir-fried wok noodles and comforting broth bowls', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80', 3),
('c1000000-0000-0000-0000-000000000004', 'Dessert', 'dessert', 'Handcrafted pastries, molten cakes and creamy treats', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80', 4),
('c1000000-0000-0000-0000-000000000005', 'Seafood', 'seafood', 'Fresh coastal catches, garlic butter prawns and calamari', 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=400&q=80', 5),
('c1000000-0000-0000-0000-000000000006', 'Sushi', 'sushi', 'Hand-rolled maki, nigiri and premium sashimi platters', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80', 6),
('c1000000-0000-0000-0000-000000000007', 'Ramen', 'ramen', 'Slow-simmered rich broths with tender chashu & ajitsuke tamago', 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=400&q=80', 7);

-- ------------------------------------------------------------
-- 2. SEED FOODS (16 Delicious Items with BDT Pricing)
-- ------------------------------------------------------------
INSERT INTO public.foods (id, category_id, name, description, price, image_url, is_available, is_featured, preparation_time_minutes) VALUES
-- Pizza
('f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Margherita Supreme', 'Fresh mozzarella, basil leaves, San Marzano tomato puree, extra virgin olive oil on hand-stretched sourdough crust.', 550.00, 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 15),
('f1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Smoked Beef Pepperoni', 'Double spiced beef pepperoni slices, aged cheddar, mozzarella and signature oregano tomato sauce.', 680.00, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 20),
('f1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'BBQ Chicken Fiesta', 'Grilled barbecue chicken breast strips, caramelized onions, bell peppers and smoked barbecue drizzle.', 620.00, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 18),

-- Fast Food
('f1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002', 'Double Smash Cheeseburger', 'Two 100g smashed beef patties, melted American cheese, pickles, caramelized onions and secret burger sauce.', 420.00, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 12),
('f1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000002', 'Crispy Peri-Peri Wings', 'Eight pieces of double-crunch chicken wings tossed in fiery African bird’s eye peri-peri glaze with ranch dip.', 340.00, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 15),
('f1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000002', 'Loaded Truffle Fries', 'Crispy skin-on french fries seasoned with white truffle oil, parmesan snow, and spring herbs.', 220.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 10),

-- Noodle
('f1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000003', 'Pad Thai Wok Noodles', 'Traditional stir-fried rice noodles with prawns, scrambled egg, tofu, bean sprouts, crushed peanuts and lime.', 390.00, 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 14),
('f1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000003', 'Spicy Dan Dan Noodles', 'Springy wheat noodles tossed with spicy chili oil paste, minced chicken, bok choy, and roasted sesame seeds.', 360.00, 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 12),

-- Dessert
('f1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000004', 'Molten Belgian Lava Cake', 'Warm chocolate cake with a molten dark chocolate center, served with vanilla bean ice cream.', 280.00, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 15),
('f1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000004', 'New York Berry Cheesecake', 'Silky baked cream cheese tart topped with fresh blueberry and raspberry compote.', 310.00, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 5),

-- Seafood
('f1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000005', 'Garlic Butter Jumbo Prawns', 'Pan-seared jumbo tiger prawns drenched in aromatic garlic herb butter sauce with toasted baguette.', 650.00, 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 18),
('f1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000005', 'Golden Crispy Calamari', 'Tender squid rings dusted in seasoned semolina flour, fried golden and served with citrus tartar.', 450.00, 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 12),

-- Sushi
('f1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000006', 'Salmon Dragon Roll (8 pcs)', 'Inside-out sushi roll with crispy prawn tempura, avocado, draped with Norwegian salmon and tobiko.', 580.00, 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 15),
('f1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000006', 'Spicy Tuna Maki (8 pcs)', 'Fresh sashimi-grade yellowfin tuna, cucumber, spicy sriracha mayo, rolled in seasoned sushi rice and nori.', 520.00, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 15),

-- Ramen
('f1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000007', 'Classic Tonkotsu Ramen', '18-hour rich pork bone broth with hand-pulled noodles, braised chashu pork, seasoned soft egg, and nori.', 490.00, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', TRUE, TRUE, 16),
('f1000000-0000-0000-0000-000000000016', 'c1000000-0000-0000-0000-000000000007', 'Spicy Miso Ramen', 'Rich fermented red miso broth with chili oil, ground chicken, sweet corn, bamboo shoots, and scallions.', 460.00, 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=600&q=80', TRUE, FALSE, 15);

-- ------------------------------------------------------------
-- 3. SEED COUPONS
-- ------------------------------------------------------------
INSERT INTO public.coupons (
    id, code, description, discount_type, discount_value,
    minimum_order_amount, maximum_discount, usage_limit, used_count,
    start_date, expiry_date, is_active
) VALUES
('d1000000-0000-0000-0000-000000000001', 'WELCOME10', '10% discount on orders above ৳300 (Max ৳100)', 'percentage', 10.00, 300.00, 100.00, 500, 0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', TRUE),
('d1000000-0000-0000-0000-000000000002', 'SUPER50', 'Flat ৳50 off on orders above ৳500', 'fixed', 50.00, 500.00, NULL, 300, 0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', TRUE),
('d1000000-0000-0000-0000-000000000003', 'RAMEN15', '15% discount for Ramen & Japanese food lovers (Min ৳400)', 'percentage', 15.00, 400.00, 120.00, 200, 0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 year', TRUE);

-- ------------------------------------------------------------
-- INSTRUCTION FOR CREATING FIRST ADMIN ACCOUNT:
-- 1. Sign up a new user via the web interface or Supabase Dashboard Auth > Users.
-- 2. Then in the Supabase SQL Editor, run:
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';
-- 3. To create a staff account:
--    UPDATE public.profiles SET role = 'staff' WHERE email = 'your-staff-email@example.com';
-- ============================================================
