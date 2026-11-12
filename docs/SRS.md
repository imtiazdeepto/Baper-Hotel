# Software Requirements Specification (SRS)
## Restaurant Food Ordering and Management System (Supabase Edition)

**Course:** SE331 — Software Engineering Design Capstone Project  
**Institution:** Daffodil International University  
**System:** Cloud-Integrated Online Restaurant Ordering & Operations Platform  

---

### 1. Introduction

#### 1.1 Purpose
The purpose of this document is to specify the comprehensive software requirements for the Restaurant Food Ordering and Management System. The system digitizes restaurant operations, replacing traditional paper ordering with an interactive customer digital menu, a real-time kitchen preparation queue, and an administrative analytics portal powered by an online Supabase PostgreSQL database.

#### 1.2 Scope
The system encompasses:
- Customer-facing responsive web portal: food discovery, category filtering, search, dynamic cart management, coupon discounts, checkout, live order tracking, and personal order history.
- Staff operational interface: real-time incoming kitchen tickets and orderly preparation status updates.
- Administrator management console: food catalog maintenance, category structuring, storage image uploads, coupon promotion controls, and daily sales analytics.
- Managed Cloud Backend: Supabase Auth, PostgreSQL 15+ database with Row Level Security (RLS), atomic stored procedures (RPC), and Supabase Storage for dish imagery.

---

### 2. Stakeholders & User Roles

| Role | Description | Access Scope |
|---|---|---|
| **Anonymous Visitor** | Browses the restaurant menu and categories. | Read-only access to available foods and active categories. |
| **Customer** | Registered diner who orders food. | Profile management, cart building, atomic checkout, order tracking, personal order history. |
| **Kitchen Staff** | Kitchen and front-desk personnel. | View incoming tickets, update preparation statuses (Pending $\rightarrow$ Preparing $\rightarrow$ Ready). |
| **Administrator** | Restaurant owner/manager. | Full operational control: food catalog, category management, coupon creation, daily sales and revenue reports. |

---

### 3. Functional Requirements

#### 3.1 Customer Ordering Module
- **FR-01 (Menu Display):** The system shall display all available food items with food name, description, category, preparation time, and price in Bangladeshi Taka (BDT ৳).
- **FR-02 (Category Filtering):** The system shall allow users to filter dishes by categories (Pizza, Fast Food, Noodle, Dessert, Seafood, Sushi, Ramen, and All).
- **FR-03 (Search Food Items):** The system shall enable searching food items by name and description with real-time query matching, combined with active category filters.
- **FR-04 (Shopping Cart):** The system shall allow customers to add items to the cart, automatically incrementing quantity for existing items and recalculating the cart item badge count.
- **FR-05 (Quantity Stepper):** The system shall permit incrementing/decrementing item quantities (minimum 1) and removing items from the cart.
- **FR-06 (Total Bill Calculation):** The system shall compute subtotal, eligible coupon discount, and net total bill using exact decimal values.
- **FR-07 (Atomic Order Placement):** The system shall atomically create the order and snapshot order item rows using the PostgreSQL stored procedure `create_order`. Unavailable items or empty carts shall be rejected.
- **FR-08 (Order Types):** The system shall support `Dine In`, `Pickup`, and `Delivery`. Delivery orders must mandate a physical street address.
- **FR-09 (Payment Simulation):** The system shall support Cash on Delivery, Simulated Debit Card, and Simulated E-Wallet (bKash/Nagad) methods with clear demo labeling.
- **FR-10 (Order Tracking):** The system shall allow tracking any order via unique order number (`ORD-YYYYMMDD-XXXX`), displaying status milestones (Pending, Confirmed, Preparing, Ready, Out for Delivery, Completed).
- **FR-11 (Customer Order History):** Authenticated customers shall view their personal past orders, backed by PostgreSQL RLS.

#### 3.2 Staff Kitchen Module
- **FR-12 (Kitchen Queue):** Staff shall view real-time incoming orders with item quantities, special customer cooking notes, and elapsed timestamps.
- **FR-13 (Status Progression):** Staff shall update active tickets through legitimate sequential states (`Pending` $\rightarrow$ `Confirmed` $\rightarrow$ `Preparing` $\rightarrow$ `Ready` $\rightarrow$ `Completed`) with automated logging into `order_status_history`.

#### 3.3 Administrator Control Module
- **FR-14 (Food Catalog Management):** Admins shall create, edit, deactivate, or delete food items. Image files shall be uploaded to the Supabase `food-images` bucket with type and size validation.
- **FR-15 (Category Management):** Admins shall manage category names, slugs, and display priorities.
- **FR-16 (Coupon Promotions):** Admins shall generate percentage and fixed discount coupons with minimum order thresholds, maximum caps, expiry dates, and usage limits.
- **FR-17 (Daily Sales Reporting):** Admins shall generate daily financial reports displaying gross sales, total discounts, net realized revenue, and order distribution charts.

#### 3.4 Recommendation Engine (Bonus)
- **FR-18 (Smart Pairing Engine):** The system shall recommend complementary or popular dishes based on active cart contents (e.g. suggesting fries/drinks when pizza is selected), excluding unavailable items or items already in the cart.

---

### 4. Non-Functional Requirements

- **NFR-01 (Security & Least Privilege):** Row Level Security (RLS) is strictly enabled on all tables. Anonymous or customer users cannot read private records or elevate user roles.
- **NFR-02 (Data Integrity):** Sensitive operations (order creation, coupon validation) execute as atomic database transactions inside PostgreSQL `SECURITY DEFINER` functions with safe `search_path`.
- **NFR-03 (Performance):** Menu queries utilize B-tree indexes on `category_id`, `is_available`, and `order_status` for sub-100ms response times.
- **NFR-04 (Currency Precision):** Monetary values use `NUMERIC(10,2)` to prevent floating-point calculation inaccuracies.
- **NFR-05 (Responsiveness):** UI renders seamlessly on mobile devices ($\ge$320px), tablets, and desktop workstations ($\ge$1200px).

---

### 5. External Interfaces
- **Supabase Auth API:** Manages secure JWT tokens, user signup, login, session renewal, and password hashing via bcrypt.
- **Supabase PostgreSQL Data API:** RESTful PostgREST and RPC interfaces over HTTPS.
- **Supabase Storage API:** S3-compatible cloud object storage for dish images.
