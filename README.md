# Baper Hotel — Restaurant Food Ordering & Management System
### Cloud-Connected Supabase Online Database Edition

**Course:** SE331 — Software Engineering Design Capstone Project  
**Institution:** Daffodil International University  
**Technology Stack:** HTML5, CSS3, Bootstrap 5, Vanilla JavaScript (ES Modules), Supabase PostgreSQL, Supabase Auth, Supabase Storage  

---

## 📖 1. Project Overview

**Baper Hotel** is a restaurant food ordering and management platform designed to transition a restaurant from manual paper-based ordering to a real-time digital system.

### Key Capabilities:
- **Customer Portal:** Interactive digital menu with category filtering, real-time search, cart management, quantity steppers, coupon validation, atomic order creation, simulated payment methods, live milestone order tracking, and personal order history.
- **Smart Recommendations (Bonus):** Rule-based pairing engine that suggests complementary dishes based on current cart items (e.g., sides/desserts with pizza, sushi with ramen).
- **Staff Kitchen Queue:** Real-time operational ticket stream allowing chefs to advance ticket statuses (`Pending` $\rightarrow$ `Confirmed` $\rightarrow$ `Preparing` $\rightarrow$ `Ready` $\rightarrow$ `Completed`) with timestamped status history logs.
- **Administrator Management Portal:** Complete food catalog CRUD with file uploads to Supabase Storage, category structuring, coupon promotion engine, and daily sales reports with Chart.js analytics.
- **Database & Security Architecture:** Hosted Supabase PostgreSQL 15+ database with Row Level Security (RLS) on all 8 tables, atomic stored procedures (RPC) for order creation and coupon verification, and role-based access control.

---

## 🛠️ 2. Technology Stack

- **Frontend:**
  - Semantic HTML5 & CSS3
  - Bootstrap 5.3.3 (Responsive grid, modals, badges, utilities)
  - Vanilla JavaScript (Native ES Modules)
  - Supabase JavaScript Client Library (`@supabase/supabase-js` v2)
  - Font Awesome 6.5.1 (Icons)
  - Chart.js 4.4.1 (Sales reporting visualizations)
- **Backend & Cloud Managed Services:**
  - **Supabase PostgreSQL:** Relational database with UUID keys and `NUMERIC(10,2)` monetary precision.
  - **PostgreSQL RLS Policies:** Least-privilege data access enforcement.
  - **PL/pgSQL Functions (RPC):** Atomic order creation (`create_order`), coupon validation (`validate_coupon`), status updates (`update_order_status`), and reporting (`get_daily_sales_report`).
  - **Supabase Auth:** Email/password authentication, JWT sessions, and automated trigger-based profile creation.
  - **Supabase Storage:** S3-compatible cloud object storage bucket (`food-images`) for dish photographs.
- **Local Dev Server & Bundling:**
  - Vite 6+ / Static HTTP Server.

---

## 🚀 3. Supabase Online Project Setup Guide

Follow these steps to connect the application to your live Supabase project:

### Step 1: Create a Supabase Project
1. Visit [https://supabase.com/](https://supabase.com/) and sign in.
2. Click **New Project** and select your organization.
3. Enter a **Project Name** (e.g., `gourmet-haven-restaurant`).
4. Set a strong **Database Password** and save it securely.
5. Select a **Region** close to your users (e.g., `Singapore` for Bangladesh / Southeast Asia).
6. Click **Create new project** and wait 1–2 minutes for provisioning.

### Step 2: Retrieve API Credentials
1. In your Supabase Dashboard, go to **Project Settings** (gear icon) $\rightarrow$ **API**.
2. Locate the following two values:
   - **Project URL** (e.g., `https://xyzabcdefg.supabase.co`)
   - **Project API Keys** $\rightarrow$ **`anon` / `public`** key (e.g., `eyJhbGciOiJIUzI1NiIsInR5cCI...`)
3. ⚠️ **CRITICAL SECURITY NOTE:** **NEVER** copy or expose the `service_role` key! Only use the `anon` public key in client configuration.

### Step 3: Run Database Schema & Setup Scripts
You can set up the entire database in **one single click**:
1. Open the Supabase Dashboard and go to the **SQL Editor** (terminal icon in left menu).
2. Click **New query**.
3. Open [`supabase/all_in_one_setup.sql`](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/supabase/all_in_one_setup.sql) from this project, copy its entire contents, and paste them into the SQL Editor.
4. Click **Run** (or press `Ctrl+Enter`).
5. *Result:* All 8 relational tables, indexes, triggers, stored procedures, RLS policies, the `food-images` storage bucket, and seed data will be created!

*(Alternative: You may also run the individual SQL files in sequence: `schema.sql` $\rightarrow$ `functions.sql` $\rightarrow$ `policies.sql` $\rightarrow$ `storage_policies.sql` $\rightarrow$ `seed.sql`)*.

### Step 4: Configure Supabase Storage Bucket
The SQL script above automatically creates and configures the `food-images` bucket. To verify in your dashboard:
1. Navigate to **Storage** $\rightarrow$ **Buckets**.
2. Verify that `food-images` appears and is marked **Public**.

### Step 5: Configure Auth Redirect URLs
1. In your Supabase Dashboard, navigate to **Authentication** $\rightarrow$ **URL Configuration**.
2. Set **Site URL** to:
   - Local: `http://localhost:3000` (or `http://localhost:5173`)
   - Production: Your deployed URL (e.g., `https://your-app.vercel.app`)
3. Under **Redirect URLs**, add:
   - `http://localhost:3000/**`
   - `http://localhost:5173/**`

---

## 🔑 4. Creating the First Administrator Account

To access the `/admin/*` management portal safely:
1. Open the running application in your browser and click **Register** (or visit `/register.html`).
2. Sign up with your administrator email (e.g. `admin@restaurant.com`) and a password.
3. By design, the registration form always defaults user roles to `customer`.
4. To grant administrator privileges, open the **Supabase Dashboard $\rightarrow$ SQL Editor** and execute:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = 'admin@restaurant.com';
   ```
5. *(Optional) To create a kitchen staff account:*
   ```sql
   UPDATE public.profiles
   SET role = 'staff'
   WHERE email = 'staff@restaurant.com';
   ```
6. Sign out and sign back in on `/login.html`. You will now have access to the Admin Portal and Staff Kitchen Queue!

---

## 💻 5. Local Development & Running the Application

### Option A: Using Vite Development Server (Recommended)
```bash
# 1. Install dependencies
npm install

# 2. Configure environment credentials
cp .env.example .env
# Open .env and insert your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start local development server
npm run dev
```
Open your browser at `http://localhost:3000`.

### Option B: Using In-Browser Credential Setup
If running without a build tool (e.g. using `python -m http.server`, Live Server, or opening static files):
1. The app includes a built-in interactive setup banner.
2. Click **"Enter Credentials"** on the top notification bar to paste your Supabase Project URL and Anon Key directly, which saves securely to browser `localStorage`.
3. Or edit [`assets/js/config.js`](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/assets/js/config.js) directly.

---

## 🌐 6. Deploying to Production

The frontend is 100% static and can be deployed to Vercel, Netlify, or GitHub Pages in under 2 minutes:

### Deploy to Vercel:
```bash
npm install -g vercel
vercel
```
In the Vercel project settings, add the environment variables:
- `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOi...`

### Deploy to Netlify:
- Build command: `npm run build`
- Publish directory: `dist`
- Set Environment Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## 📁 7. Project File Structure

```
Deepto capstone/
├── index.html                   # Main customer menu, search, filter, and cart panel
├── login.html                   # Supabase Auth sign-in with role redirect
├── register.html                # Customer account registration
├── cart.html                    # Dedicated shopping cart page
├── checkout.html                # Atomic checkout & demo payment simulator
├── order-confirmation.html      # Receipt and order number confirmation
├── track-order.html             # Real-time milestone order tracker
├── order-history.html           # Customer order history (RLS-guarded)
│
├── admin/
│   ├── dashboard.html           # KPI overview metrics & recent orders
│   ├── foods.html               # Food catalog table & stock toggles
│   ├── food-form.html           # Add/edit dish & Supabase Storage upload
│   ├── categories.html          # Category management
│   ├── orders.html              # Order management, search, and details modal
│   ├── coupons.html             # Promotional coupon management
│   └── reports.html             # Daily sales reports with Chart.js
│
├── staff/
│   └── orders.html              # Kitchen order queue & status transitions
│
├── assets/
│   ├── css/
│   │   ├── style.css            # Main customer application styles
│   │   └── admin.css            # Staff & admin management portal styles
│   └── js/
│       ├── config.js            # Configuration placeholders & defaults
│       ├── supabaseClient.js    # Client initialization & setup resolver
│       ├── auth.js              # Session & role protection guards
│       ├── cart.js              # Cart state & smart recommendation engine
│       ├── menu.js              # Catalog rendering & filter controller
│       ├── checkout.js          # Atomic RPC order placement
│       ├── orders.js            # Tracking & order history controller
│       ├── staff.js             # Kitchen queue management
│       └── admin.js             # Admin catalog, reports & coupon logic
│
├── supabase/
│   ├── all_in_one_setup.sql     # Single-click master database setup script
│   ├── schema.sql               # Relational tables & indexes
│   ├── functions.sql            # Triggers & atomic RPC stored procedures
│   ├── policies.sql             # Least-privilege Row Level Security (RLS)
│   ├── storage_policies.sql     # 'food-images' bucket policies
│   └── seed.sql                 # Sample categories, foods, and coupons
│
├── docs/
│   ├── SRS.md                   # Software Requirements Specification
│   ├── TEST_PLAN.md             # Test cases matrix (39 test cases)
│   ├── VIVA_GUIDE.md            # Defense & viva voce presentation guide
│   └── diagrams/
│       ├── use-case.mmd         # Mermaid use case diagram
│       ├── er-diagram.mmd       # Mermaid entity relationship diagram
│       └── architecture.mmd     # Mermaid system architecture diagram
│
├── .env.example                 # Environment variables template
├── .gitignore                   # Git secrets exclusion
├── package.json                 # Project dependencies & Vite scripts
├── vite.config.js               # Multi-page Vite configuration
└── README.md                    # Complete project documentation
```

---

## 🔒 8. Security & Business Rules Summary

1. **Zero Client Price Trust:** Subtotal, discount, and total amounts are calculated strictly inside PostgreSQL stored procedures from database prices.
2. **Row Level Security (RLS):** Customers can only read their own profile, cart, and order history. Staff and Admins have role-restricted access.
3. **No Service Role Keys:** The Supabase `service_role` key is **never** used in frontend code or committed to source control.
4. **Immutable Snapshots:** `order_items` stores dish name and price snapshots so modifying the menu never alters past financial receipts.
5. **Exact Decimal Accounting:** Prices and totals utilize `NUMERIC(10,2)` to prevent floating-point rounding errors.
6. **Demo Payment Notice:** Debit card and e-wallet (bKash/Nagad) methods are clearly marked as academic simulations.

---

## 🎓 9. Academic Deliverables & Documentation Links
- 📄 [Software Requirements Specification (SRS)](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/docs/SRS.md)
- 🧪 [System Test Plan & Acceptance Matrix](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/docs/TEST_PLAN.md)
- 🎤 [Capstone Defense & Viva Voce Guide](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/docs/VIVA_GUIDE.md)
- 📊 [Architecture Diagram](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/docs/diagrams/architecture.mmd)
- 🗄️ [Entity Relationship Diagram](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/docs/diagrams/er-diagram.mmd)
- 👥 [Use Case Diagram](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/docs/diagrams/use-case.mmd)
- 🗃️ [All-In-One SQL Setup Script](file:///Users/imtiaz/project/sihabcapstone/Deepto%20capstone/supabase/all_in_one_setup.sql)
