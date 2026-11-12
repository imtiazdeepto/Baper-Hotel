# Software Test Plan & Test Execution Matrix
## Restaurant Food Ordering and Management System (Supabase Edition)

**Course:** SE331 — Software Engineering Design Capstone  
**Assessment:** Assessment 2 — Full Stack Verification  

---

### 1. Test Overview & Objectives
This test plan provides comprehensive verification for the Restaurant Food Ordering and Management System across customer workflows, kitchen staff queues, administrative management, PostgreSQL Row Level Security (RLS) policies, and atomic stored procedures (RPC).

---

### 2. Detailed Test Cases Matrix

| Test ID | Test Category | Precondition | Test Steps | Expected Result | Status |
|---|---|---|---|---|---|
| **TC-01** | Customer Auth | Unregistered user | Navigate to `/register.html`, enter full name, valid email, phone, and password ($\ge$6 chars), click Register. | Account created via Supabase Auth; trigger creates `profiles` record with `role='customer'`. | Implemented |
| **TC-02** | Customer Auth | Email already registered | Attempt to register with the identical email address. | Supabase Auth rejects with "User already registered" message. Form displays error. | Implemented |
| **TC-03** | Customer Auth | Registered account | Enter email and password on `/login.html`, submit; then click "Sign Out". | User session established; redirects to menu/dashboard; logout terminates JWT session. | Implemented |
| **TC-04** | Food Menu | Seed data initialized | Load home page `/`. | Menu grid renders available dishes with image, price in BDT (৳), name, prep time, and category pill. | Implemented |
| **TC-05** | Category Filter | Menu loaded | Click "Pizza" category pill, then "Dessert", then "All Dishes". | Food grid dynamically filters items to match category; "All" restores complete catalog. | Implemented |
| **TC-06** | Search Filter | Menu loaded | Type "Truffle" into search bar; then type "xyznonsense". | "Truffle" displays matching loaded fries; "xyznonsense" renders empty-state "No food items found". | Implemented |
| **TC-07** | Shopping Cart | Empty cart | Click "Add to Cart" on "Margherita Supreme". | Item appears in right cart panel; cart badge updates from 0 to 1; subtotal updates. | Implemented |
| **TC-08** | Shopping Cart | Item in cart | Click "Add to Cart" again on "Margherita Supreme". | Quantity increments to 2; single row maintained; subtotal doubles. | Implemented |
| **TC-09** | Cart Stepper | Item quantity = 2 | Click plus (+) button, then minus (-) button. | Plus increases quantity to 3; minus decreases quantity to 2; totals adjust instantly. | Implemented |
| **TC-10** | Cart Stepper | Item in cart | Click trash can remove button. | Item is removed from cart; badge decrements; totals recalculate. | Implemented |
| **TC-11** | Bill Calculation | Multiple items | Add items worth ৳550 and ৳220. | Subtotal calculates exactly ৳770.00; delivery fee shows free promo. | Implemented |
| **TC-12** | Coupon Engine | Cart subtotal $\ge$ ৳300 | Enter code `WELCOME10` and click Apply. | 10% discount (৳77.00) deducted; net total becomes ৳693.00. | Implemented |
| **TC-13** | Coupon Engine | Cart subtotal < ৳300 | Apply `WELCOME10` on a ৳220 item. | System rejects: "Minimum order amount for this coupon is ৳300". Total unchanged. | Implemented |
| **TC-14** | Checkout Guard | Empty cart | Directly navigate to `/checkout.html`. | System displays alert "Cart is empty" and redirects user to menu `/`. | Implemented |
| **TC-15** | Order Placement | Logged in with cart | Select "Delivery", enter address, choose "Cash", submit order. | Atomic RPC `create_order` succeeds; cart cleared; redirects to `/order-confirmation.html`. | Implemented |
| **TC-16** | DB Integrity | Placed order | Inspect `orders` and `order_items` in Supabase table editor. | Parent `orders` row inserted with unique `order_number`; child items inserted with price snapshots. | Implemented |
| **TC-17** | Total Protection | Browser inspection | Attempt to manipulate JavaScript subtotal before placing order. | PostgreSQL recalculates subtotal strictly from `foods` table; manipulated client values ignored. | Implemented |
| **TC-18** | Order Tracking | Placed order number | Open `/track-order.html?order_number=ORD-...`. | Tracking stepper displays active progress (Pending $\rightarrow$ Confirmed, etc.) and timestamped logs. | Implemented |
| **TC-19** | Order History | Logged-in customer | Open `/order-history.html`. | Displays personal order history cards sorted chronologically with view receipts link. | Implemented |
| **TC-20** | RLS Isolation | Customer A & B | Customer A attempts query on `orders` with `user_id = Customer B`. | PostgreSQL RLS policy blocks access, returning empty dataset for other users' rows. | Implemented |
| **TC-21** | RLS Update Guard | Customer account | Attempt direct `UPDATE orders SET total_amount = 0`. | PostgreSQL RLS denies UPDATE operation; customers have SELECT/INSERT permissions only. | Implemented |
| **TC-22** | Out of Stock Guard | Dish unavailable | Admin marks dish unavailable; customer attempts RPC `create_order`. | Database stored procedure raises exception: 'Item "X" is currently unavailable'. | Implemented |
| **TC-23** | Route Protection | Logged-out visitor | Attempt direct navigation to `/admin/dashboard.html`. | Guard `requireAuth(['admin'])` redirects visitor to `/login.html?redirect=...`. | Implemented |
| **TC-24** | Role Separation | Customer login | Logged-in customer navigates to `/admin/dashboard.html`. | Guard blocks access: "Access Denied: You must be an admin"; redirects to home page. | Implemented |
| **TC-25** | Role Escalation | Customer account | Attempt `UPDATE profiles SET role = 'admin' WHERE id = auth.uid()`. | RLS WITH CHECK policy ensures role matches existing role; privilege escalation rejected. | Implemented |
| **TC-26** | Admin Food CRUD | Admin logged in | Go to `/admin/foods.html`, toggle stock switch; edit price; delete. | Stock switch toggles live `is_available`; updates reflect immediately on customer menu. | Implemented |
| **TC-27** | Admin Categories | Admin logged in | Add category "Mocktails" on `/admin/categories.html`. | Category saved into PostgreSQL; immediately appears in customer filter pills. | Implemented |
| **TC-28** | Storage Upload | Admin logged in | Upload a 500KB PNG food photo on `/admin/food-form.html`. | Uploaded to `food-images` bucket; public URL generated and saved into `foods.image_url`. | Implemented |
| **TC-29** | Staff Queue | Staff logged in | Open `/staff/orders.html` as new order is submitted. | Ticket appears in queue with order number, dining type, items list, and elapsed timer. | Implemented |
| **TC-30** | Staff Progression | Staff ticket | Click "Start Preparing", then "Mark as Ready". | RPC `update_order_status` transitions status; adds entry to `order_status_history`. | Implemented |
| **TC-31** | Staff Privilege | Staff logged in | Attempt to open `/admin/coupons.html`. | Access denied; staff restricted to kitchen operations only. | Implemented |
| **TC-32** | Coupon Management | Admin logged in | Create coupon `FLASH25` with 25% discount, min ৳500 on `/admin/coupons.html`. | Coupon row created in `coupons` table; immediately applicable on checkout. | Implemented |
| **TC-33** | Sales Analytics | Admin logged in | Open `/admin/reports.html` and select today's date. | Displays total orders, completed count, gross sales, discounts, net sales, and doughnut chart. | Implemented |
| **TC-34** | RLS Verification | Anon / All roles | Query public REST endpoints via anon key. | Tables strictly honor least-privilege policies; private profiles/orders protected. | Implemented |
| **TC-35** | Storage RLS | Anonymous visitor | Attempt direct HTTP POST to `food-images` bucket. | Supabase Storage policy rejects upload; only admin users can insert objects. | Implemented |
| **TC-36** | Mobile Layout | Viewport 375px | Open site on smartphone / mobile emulation. | Sidebar folds gracefully; cart becomes toggle drawer; cards scale smoothly. | Implemented |
| **TC-37** | Error States | Disconnect DB | Simulate invalid credentials or offline network. | Friendly UI notification alerts user without raw database errors or white screen crashes. | Implemented |
| **TC-38** | Secret Protection | Source inspection | Search entire project codebase for `service_role`. | Verified: zero occurrences of `service_role` in frontend code; only anon public key used. | Implemented |
| **TC-39** | Navigation & Links | Full walk-through | Click every menu item, sidebar button, profile dropdown, and receipt link. | All internal anchors and routes function cleanly without dead links or JavaScript errors. | Implemented |
