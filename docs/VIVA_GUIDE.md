# Capstone Defense & Viva Voce Guide
## Restaurant Food Ordering and Management System (Supabase Edition)

**Course:** SE331 — Software Engineering Design Capstone Project  
**Institution:** Daffodil International University  

---

### 1. High-Level Architecture Explanation
> **Q: Explain the overall architecture of your system.**  
> **Model Answer:**  
> "Our application implements a modern cloud-native decoupled architecture consisting of a lightweight, responsive frontend and an online Supabase-hosted PostgreSQL managed backend. The frontend is built with HTML5, Bootstrap 5, and modular Vanilla ES JavaScript, communicating with Supabase through HTTPS and WebSocket channels. Rather than trusting client calculations, all business-critical operations—such as order creation, coupon validation, and sales aggregation—are executed inside atomic PostgreSQL stored procedures (PL/pgSQL RPCs) guarded by strict Row Level Security (RLS) policies."

---

### 2. Core Architectural & Design Decisions

#### A. Atomic Server-Side Order Creation (`create_order` RPC)
> **Q: Why don't you insert orders and items directly from JavaScript?**  
> **Model Answer:**  
> "Allowing the browser to submit totals or prices is a critical financial vulnerability—a malicious user could alter the JavaScript payload to buy items for ৳1. Instead, our frontend sends only the food IDs and quantities. The PostgreSQL `create_order` function runs inside an atomic database transaction (`BEGIN ... COMMIT`), re-queries live prices from the `foods` table, re-verifies item availability, validates coupon rules on the server, creates the order and item snapshots, updates coupon usage counts, and inserts an audit log into `order_status_history`. If any validation fails, the entire transaction rolls back automatically."

#### B. Historical Data Integrity (Snapshots)
> **Q: What happens to past customer receipts when an administrator updates a food's price or deletes it?**  
> **Model Answer:**  
> "Our database design decouples past orders from the mutable food menu. When an order is placed, `order_items` stores an immutable snapshot of `food_name_snapshot` and `unit_price`. If the restaurant changes a pizza from ৳550 to ৳600 tomorrow, or soft-deletes the dish, all past receipts and financial reports retain their exact historical totals."

#### C. Financial Decimal Precision (`NUMERIC(10,2)`)
> **Q: Why did you choose `NUMERIC` instead of `FLOAT` or `DOUBLE` for prices?**  
> **Model Answer:**  
> "IEEE-754 binary floating-point numbers cannot accurately represent decimal fractions, leading to rounding errors (e.g. `0.1 + 0.2 = 0.30000000000000004`). In financial systems, monetary calculations must use exact fixed-point decimals (`NUMERIC(10,2)` in PostgreSQL and fixed precision in JavaScript) to avoid accumulating discrepancies in cash accounting."

#### D. Role-Based Security & Preventing Privilege Escalation
> **Q: How does the system prevent a customer from promoting themselves to an Administrator?**  
> **Model Answer:**  
> "We implement defense-in-depth:
> 1. When a user registers via Supabase Auth, a database trigger `handle_new_user()` inserts a profile with `role='customer'`. The registration form cannot pass a custom role.
> 2. The `profiles` table RLS `WITH CHECK` policy ensures that when a user updates their profile, their `role` cannot be changed unless executed by an admin.
> 3. Frontend route guards (`requireAuth`) redirect unauthorized users, while server-side RLS and RPC functions enforce authorization using the secure `is_admin()` and `is_staff_or_admin()` functions."

#### E. Avoiding RLS Recursion
> **Q: What is RLS policy recursion and how did you resolve it?**  
> **Model Answer:**  
> "If an RLS policy on the `profiles` table queries `SELECT role FROM profiles WHERE id = auth.uid()`, the subquery triggers the RLS policy again, leading to an infinite recursive loop. We resolved this by creating helper functions `public.get_user_role()` and `public.is_admin()` with `SECURITY DEFINER` and `SET search_path = public`, which safely execute with elevated system privileges to retrieve the role without re-evaluating RLS policies."

#### F. Supabase Storage for Images
> **Q: How are dish images managed and stored?**  
> **Model Answer:**  
> "Food images are not stored as large binary blobs in PostgreSQL, which would degrade database performance. Instead, images are uploaded to the Supabase Storage S3-compatible `food-images` bucket. Storage policies allow public read access for menu display, while restrict upload, update, and delete permissions strictly to administrators (`public.is_admin()`). The database only stores the lightweight public URL string."

---

### 3. Key Viva Demonstration Walkthrough

1. **Menu Browsing & Search:** Demonstrate category pills and real-time search query matching.
2. **Dynamic Cart & Recommendations:** Show item addition, +/- quantity controls, live subtotal updates, and smart complementary pairings (e.g. Pizza recommending sides/desserts).
3. **Coupon Application:** Apply `WELCOME10` to showcase live discount deduction.
4. **Checkout & Order Creation:** Place an order and show how PostgreSQL generates a human-friendly unique order number (`ORD-YYYYMMDD-XXXX`).
5. **Live Order Tracking:** Search the order number to view milestone stepper and timestamped status logs.
6. **Staff Kitchen Queue:** Show the incoming ticket and click "Start Preparing" $\rightarrow$ "Mark as Ready".
7. **Admin Portal & Storage:** Show food catalog management, image file upload to Supabase Storage, and daily sales report generation with Chart.js.
