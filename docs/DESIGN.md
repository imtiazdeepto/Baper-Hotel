# UI/UX & Frontend Design Specification
## Restaurant Food Ordering and Management System

**Course:** SE331 — Software Engineering Design Capstone Project  
**Reference Document:** `design.txt`  
**Design Philosophy:** Clean, accessible, modern restaurant ordering dashboard with warm restaurant-inspired orange accents.

---

### 1. Visual Identity & Design Tokens

#### 1.1 Color Palette
- **Primary Brand:** `#E86A33` (Warm appetizing restaurant orange)
- **Primary Hover:** `#CF5524`
- **Primary Soft / Tint:** `#FFF0E8`
- **Neutrals / Inks:**
  - Ink (Headings): `#202124`
  - Body Text: `#4B5563`
  - Muted Supporting Text: `#7B8491`
- **Surfaces & Backgrounds:**
  - Page Canvas: `#F7F8FA`
  - Surface Cards: `#FFFFFF`
  - Subtle Borders: `#E7E9ED`
- **Status & Alerts:**
  - Success (Confirmed / Completed): `#21865B` (Soft: `#E8F5EE`)
  - Warning (Pending / In-Progress): `#A96A12` (Soft: `#FFF4DE`)
  - Danger (Cancelled / Error): `#C43D3D` (Soft: `#FCECEC`)
  - Info: `#2866A6` (Soft: `#EAF2FC`)

#### 1.2 Typography & Spacing
- **Font Stack:** `Inter`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `sans-serif`
- **Hierarchy:**
  - Main Page Title: `clamp(1.5rem, 2.2vw, 1.9rem)` (Bold)
  - Section Titles: `1.25rem` (Semibold)
  - Food Card Title: `1.05rem` (Semibold)
  - Body Copy: `15px / 1.5 line-height`
  - Secondary Metadata: `12px – 13px`
  - Currency & Prices: `1.15rem` (Bold, Primary Tint)
- **Radii:** `sm: 8px`, `md: 12px`, `lg: 18px`, `xl: 24px`, `pill: 9999px`

---

### 2. Layout Structure & Responsive Breakpoints

#### 2.1 Three-Zone Desktop Architecture ($\ge$ 1200px)
1. **Left Slim Navigation Sidebar (`76px` fixed width):**
   - Brand mark (`R` / Utensils logo).
   - Vertical navigation icons with tooltips: Menu, My Orders, Track Order, Kitchen Queue, Admin Portal.
   - Logout button near bottom.
2. **Central Food Browsing Area (Flexible):**
   - Topbar with eyebrow greeting, page title, real-time search box, and profile badge.
   - Horizontal category filter chips (`All Dishes`, `Pizza`, `Fast Food`, `Noodle`, `Dessert`, `Seafood`, `Sushi`, `Ramen`).
   - Food card grid with consistent 4:3 image aspect ratios, preparation times, prices in BDT (৳), and add-to-cart buttons.
   - Smart pairing recommendations section ("Recommended for you").
3. **Right Cart & Order Panel (`340px` fixed width):**
   - "My Order" header with badge counter and "Clear" action.
   - Dining type selector (`Dine In`, `Pickup`, `Delivery`).
   - Scrollable cart item rows with thumbnail, quantity stepper (`- / +`), and delete button.
   - Coupon code input and live discount badge.
   - Subtotal, discount deduction, and total bill.
   - Simulated payment method selection.
   - Primary "Continue to checkout" CTA.

#### 2.2 Responsive Adaptations
- **Tablet (768px – 1199px):** Sidebar compacts to `64px`; food grid adjusts to 2 columns; cart panel is accessible via toggle drawer.
- **Mobile (< 768px):** Top compact horizontal navigation; single or 2-column food grid; cart becomes a dedicated slide-in drawer; touch targets $\ge$ 44x44px; zero horizontal page scrolling.

---

### 3. Component Library
- **Category Chips (`.category-chip`):** Pill-shaped with soft-hover and active states.
- **Food Cards (`.food-card`):** Elevated cards with subtle shadows, stock availability badges, and interactive add-to-cart animations.
- **Quantity Steppers (`.cart-stepper`):** Compact inline steppers with min-quantity limits.
- **Recommendation Cards (`.recommendation-card`):** Compact cards displaying recommendation reasons ("Pairs well with Pizza 🍕", "Popular choice ⭐").
- **Order Tracking Stepper (`.tracking-timeline`):** Visual progress timeline from Pending through Completed.
