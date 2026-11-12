// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Menu Page Controller (Categories, Search, Sort, Cards, Cart Sidebar)
// Aligned strictly with design.txt specification
// ============================================================

import { supabase, isSupabaseConfigured, checkAndDisplayConfigNotice } from './supabaseClient.js';
import {
  addToCart,
  getCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  calculateTotals,
  applyCoupon,
  setAppliedCoupon,
  getRecommendations,
  formatCurrency,
  updateCartBadges,
  getOrderPreferences,
  setOrderPreferences
} from './cart.js';
import { setupAuthNav, logout } from './auth.js';
import { escapeHtml, getSafeImageUrl } from './appLogic.js';

let allFoods = [];
let allCategories = [];
let activeCategoryId = 'all';
let searchQuery = '';
let currentSort = 'popular';

// Realistic seeded fallback data in case Supabase is not yet connected
const FALLBACK_CATEGORIES = [
  { id: 'all', name: 'All Dishes' },
  { id: 'c1', name: 'Pizza' },
  { id: 'c2', name: 'Fast Food' },
  { id: 'c3', name: 'Noodle' },
  { id: 'c4', name: 'Dessert' },
  { id: 'c5', name: 'Seafood' },
  { id: 'c6', name: 'Sushi' },
  { id: 'c7', name: 'Ramen' }
];

const FALLBACK_FOODS = [
  { id: 'f1', category_id: 'c1', category: { name: 'Pizza' }, name: 'Margherita Supreme', description: 'Fresh mozzarella, basil leaves, San Marzano tomato puree, extra virgin olive oil.', price: 550, image_url: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: true, preparation_time_minutes: 15 },
  { id: 'f2', category_id: 'c1', category: { name: 'Pizza' }, name: 'Smoked Beef Pepperoni', description: 'Double spiced beef pepperoni slices, aged cheddar, mozzarella and signature oregano tomato sauce.', price: 680, image_url: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: true, preparation_time_minutes: 20 },
  { id: 'f3', category_id: 'c2', category: { name: 'Fast Food' }, name: 'Double Smash Cheeseburger', description: 'Two 100g smashed beef patties, melted American cheese, pickles, caramelized onions.', price: 420, image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: true, preparation_time_minutes: 12 },
  { id: 'f4', category_id: 'c2', category: { name: 'Fast Food' }, name: 'Loaded Truffle Fries', description: 'Crispy skin-on french fries seasoned with white truffle oil, parmesan snow, and herbs.', price: 220, image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: false, preparation_time_minutes: 10 },
  { id: 'f5', category_id: 'c3', category: { name: 'Noodle' }, name: 'Pad Thai Wok Noodles', description: 'Traditional stir-fried rice noodles with prawns, scrambled egg, tofu, bean sprouts, crushed peanuts.', price: 390, image_url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: true, preparation_time_minutes: 14 },
  { id: 'f6', category_id: 'c4', category: { name: 'Dessert' }, name: 'Molten Belgian Lava Cake', description: 'Warm chocolate cake with a molten dark chocolate center, served with vanilla bean ice cream.', price: 280, image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: true, preparation_time_minutes: 15 },
  { id: 'f7', category_id: 'c5', category: { name: 'Seafood' }, name: 'Garlic Butter Jumbo Prawns', description: 'Pan-seared jumbo tiger prawns drenched in aromatic garlic herb butter sauce.', price: 650, image_url: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: true, preparation_time_minutes: 18 },
  { id: 'f8', category_id: 'c6', category: { name: 'Sushi' }, name: 'Salmon Dragon Roll (8 pcs)', description: 'Inside-out sushi roll with crispy prawn tempura, avocado, draped with Norwegian salmon and tobiko.', price: 580, image_url: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: true, preparation_time_minutes: 15 },
  { id: 'f9', category_id: 'c7', category: { name: 'Ramen' }, name: 'Classic Tonkotsu Ramen', description: '18-hour rich pork bone broth with hand-pulled noodles, braised chashu, seasoned soft egg, and nori.', price: 490, image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', is_available: true, is_featured: true, preparation_time_minutes: 16 }
];

document.addEventListener('DOMContentLoaded', async () => {
  checkAndDisplayConfigNotice();
  await setupAuthNav();
  updateCartBadges();
  hydrateOrderPreferences();
  initEventListeners();
  await loadMenuData();
  renderCartSidebar();
});

function initEventListeners() {
  // Real-time search input with live filtering
  const searchInput = document.getElementById('search-food-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderFoodsGrid();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('foodSort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderFoodsGrid();
    });
  }

  const orderTypeSelect = document.getElementById('orderType');
  orderTypeSelect?.addEventListener('change', () => {
    setOrderPreferences({ orderType: orderTypeSelect.value });
  });

  document.querySelectorAll('input[name="quickPaymentMethod"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) setOrderPreferences({ paymentMethod: radio.value });
    });
  });

  // Cart update event listener
  window.addEventListener('cart-updated', () => {
    renderCartSidebar();
  });

  // Mobile cart toggle drawer button
  const mobileCartBtn = document.getElementById('mobile-cart-toggle-btn');
  if (mobileCartBtn) {
    mobileCartBtn.addEventListener('click', () => {
      const cartSidebar = document.getElementById('order-sidebar');
      if (cartSidebar) {
        cartSidebar.classList.toggle('show-mobile');
      }
    });
  }

  // Close mobile cart button
  const closeMobileCartBtn = document.getElementById('close-mobile-cart-btn');
  if (closeMobileCartBtn) {
    closeMobileCartBtn.addEventListener('click', () => {
      const cartSidebar = document.getElementById('order-sidebar');
      if (cartSidebar) {
        cartSidebar.classList.remove('show-mobile');
      }
    });
  }

  // Clear cart button
  const clearCartBtn = document.getElementById('clearCartButton');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your current order?')) {
        clearCart();
      }
    });
  }

  // Sidebar Logout button
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', async () => {
      await logout();
    });
  }
}

/**
 * Fetch categories and foods from Supabase database
 */
async function loadMenuData() {
  const container = document.getElementById('foods-grid-container');
  if (container) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading food menu...</span>
        </div>
        <p class="muted mt-2 small-text">Loading freshly prepared menu...</p>
      </div>
    `;
  }

  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, displaying sample showcase menu.');
    allCategories = FALLBACK_CATEGORIES;
    allFoods = FALLBACK_FOODS;
    renderCategories();
    renderFoodsGrid();
    return;
  }

  try {
    // 1. Fetch categories
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id, name, slug, description, image_url, display_order')
      .order('display_order', { ascending: true });

    if (catError) throw catError;
    allCategories = [{ id: 'all', name: 'All Dishes' }, ...(catData || [])];

    // 2. Fetch available foods
    const { data: foodData, error: foodError } = await supabase
      .from('foods')
      .select(`
        id, category_id, name, description, price, image_url,
        is_available, is_featured, preparation_time_minutes,
        category:categories(id, name)
      `)
      .order('name', { ascending: true });

    if (foodError) throw foodError;
    allFoods = foodData || [];

    renderCategories();
    renderFoodsGrid();
  } catch (err) {
    console.error('Error loading menu:', err);
    if (container) {
      container.innerHTML = `
        <div class="col-12 py-5 text-center">
          <div class="empty-state d-inline-block px-4 py-3">
            <i class="fa-solid fa-triangle-exclamation text-danger fs-3 mb-2 d-block"></i>
            <h6 class="fw-bold mb-1">Unable to Load Food Menu</h6>
            <p class="small text-muted mb-3">${escapeHtml(err.message || 'Database connection error.')}</p>
            <button class="button button-primary" onclick="window.location.reload()">
              <i class="fa-solid fa-rotate-right me-1"></i> Retry
            </button>
          </div>
        </div>
      `;
    }
  }
}

/**
 * Render category filter chips
 */
function renderCategories() {
  const container = document.getElementById('category-filter-list');
  if (!container) return;

  container.innerHTML = allCategories.map(cat => {
    const isActive = cat.id === activeCategoryId;
    return `
      <button type="button" class="category-chip ${isActive ? 'is-active' : ''}" data-cat-id="${cat.id}">
        ${escapeHtml(cat.name)}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.category-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.category-chip').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeCategoryId = btn.getAttribute('data-cat-id');
      renderFoodsGrid();
    });
  });
}

/**
 * Filter, sort, and render food cards
 */
function renderFoodsGrid() {
  const container = document.getElementById('foods-grid-container');
  const emptyState = document.getElementById('foodEmptyState');
  const resultCount = document.getElementById('foodResultCount');
  if (!container) return;

  let filtered = [...allFoods];

  // Category filter
  if (activeCategoryId !== 'all') {
    filtered = filtered.filter(f => f.category_id === activeCategoryId);
  }

  // Search filter
  if (searchQuery) {
    filtered = filtered.filter(f =>
      f.name.toLowerCase().includes(searchQuery) ||
      (f.description && f.description.toLowerCase().includes(searchQuery))
    );
  }

  // Sort
  if (currentSort === 'price-asc') {
    filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  } else if (currentSort === 'price-desc') {
    filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  } else if (currentSort === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // popular
    filtered.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
  }

  if (resultCount) {
    resultCount.textContent = `Showing ${filtered.length} delicious dish${filtered.length === 1 ? '' : 'es'}`;
  }

  // Empty state
  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  container.innerHTML = filtered.map(food => {
    const categoryName = food.category?.name || 'General';
    const isAvailable = food.is_available !== false;
    const placeholderImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
    const imageUrl = getSafeImageUrl(food.image_url, placeholderImg);

    return `
      <article class="food-card ${!isAvailable ? 'unavailable' : ''}">
        <div class="food-card-image-wrapper">
          <img src="${escapeHtml(imageUrl)}" class="food-card-image" alt="${escapeHtml(food.name)}" loading="lazy" onerror="this.src='${placeholderImg}'">
          ${food.is_featured ? '<span class="status-badge position-absolute top-0 start-0 m-2" style="background:#fff3cd; color:#856404;"><i class="fa-solid fa-fire me-1 text-danger"></i>Popular</span>' : ''}
          ${!isAvailable ? '<span class="status-badge position-absolute top-0 end-0 m-2" style="background:#e2e3e5; color:#383d41;">Out of Stock</span>' : ''}
        </div>

        <div class="food-card-body">
          <div class="food-card-header">
            <span class="status-badge" style="background:var(--color-primary-soft); color:var(--color-primary);">${escapeHtml(categoryName)}</span>
            <span class="small text-muted"><i class="fa-regular fa-clock me-1"></i>${food.preparation_time_minutes || 15}m</span>
          </div>

          <h3 class="food-card-title text-truncate" title="${escapeHtml(food.name)}">${escapeHtml(food.name)}</h3>
          <p class="food-card-description">${escapeHtml(food.description || 'Freshly made with quality seasonal ingredients.')}</p>

          <div class="food-card-footer">
            <span class="food-price">${formatCurrency(food.price)}</span>
            ${
              isAvailable
                ? `<button class="button button-primary add-to-cart-btn" data-food-id="${food.id}" aria-label="Add ${escapeHtml(food.name)} to cart">
                    <i class="fa-solid fa-cart-plus"></i> Add to cart
                   </button>`
                : `<button class="button button-secondary disabled" disabled aria-label="Unavailable">
                    Unavailable
                   </button>`
            }
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Bind add-to-cart clicks
  container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const foodId = btn.getAttribute('data-food-id');
      const food = allFoods.find(f => f.id === foodId);
      if (food) {
        addToCart({
          id: food.id,
          name: food.name,
          price: food.price,
          image_url: food.image_url,
          category_id: food.category_id,
          category_name: food.category?.name
        });

        // Visible button feedback
        const originalText = btn.innerHTML;
        btn.style.backgroundColor = 'var(--color-success)';
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
        setTimeout(() => {
          btn.style.backgroundColor = '';
          btn.innerHTML = originalText;
        }, 800);
      }
    });
  });
}

/**
 * Render Right Cart Sidebar Summary & Recommendations
 */
function renderCartSidebar() {
  const container = document.getElementById('cart-items-container');
  const emptyState = document.getElementById('cart-empty-state');
  const filledState = document.getElementById('cart-filled-state');
  const subtotalEl = document.getElementById('cart-subtotal-val');
  const discountEl = document.getElementById('cart-discount-val');
  const totalEl = document.getElementById('cart-total-val');
  const couponSection = document.getElementById('applied-coupon-pill');
  const recommendationsSection = document.getElementById('cart-recommendations-section');

  const cart = getCart();
  const { subtotal, discount, total, coupon } = calculateTotals();

  if (cart.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (filledState) filledState.style.display = 'none';
    if (recommendationsSection) recommendationsSection.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (filledState) filledState.style.display = 'flex';

  // Render cart items
  if (container) {
    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${escapeHtml(getSafeImageUrl(item.image_url, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'))}" alt="${escapeHtml(item.name)}">
        <div class="min-w-0">
          <div class="fw-bold small text-dark text-truncate">${escapeHtml(item.name)}</div>
          <div class="small text-muted">${formatCurrency(item.price)} each</div>
        </div>
        <div class="d-flex align-items-center gap-1">
          <div class="cart-stepper">
            <button type="button" class="cart-minus-btn" data-id="${escapeHtml(item.id)}" aria-label="Decrease quantity"><i class="fa-solid fa-minus"></i></button>
            <span>${item.quantity}</span>
            <button type="button" class="cart-plus-btn" data-id="${escapeHtml(item.id)}" aria-label="Increase quantity"><i class="fa-solid fa-plus"></i></button>
          </div>
          <button type="button" class="button button-secondary p-1 border-0 cart-remove-btn text-danger" data-id="${escapeHtml(item.id)}" aria-label="Remove item">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.cart-minus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = cart.find(i => i.id === id);
        if (item) updateQuantity(id, item.quantity - 1);
      });
    });

    container.querySelectorAll('.cart-plus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = cart.find(i => i.id === id);
        if (item) updateQuantity(id, item.quantity + 1);
      });
    });

    container.querySelectorAll('.cart-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromCart(btn.getAttribute('data-id'));
      });
    });
  }

  // Render totals
  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (discountEl) discountEl.textContent = discount > 0 ? `- ${formatCurrency(discount)}` : formatCurrency(0);
  if (totalEl) totalEl.textContent = formatCurrency(total);

  // Render coupon row
  if (couponSection) {
    if (coupon) {
      couponSection.innerHTML = `
        <div class="d-flex align-items-center justify-content-between p-2 rounded-3 bg-success-subtle text-success border border-success-subtle">
          <span class="small fw-semibold"><i class="fa-solid fa-tag me-1"></i>${escapeHtml(coupon.code)}: -${formatCurrency(coupon.discount_amount)}</span>
          <button class="button button-secondary py-0 px-2 small-text text-danger border-0" id="remove-coupon-btn">Remove</button>
        </div>
      `;
      document.getElementById('remove-coupon-btn')?.addEventListener('click', () => {
        setAppliedCoupon(null);
      });
    } else {
      couponSection.innerHTML = `
        <div class="coupon-row mb-1">
          <input type="text" id="coupon-code-input" placeholder="Coupon (e.g. WELCOME10)" class="text-uppercase">
          <button class="button button-secondary py-1 px-3" type="button" id="apply-coupon-btn">Apply</button>
        </div>
        <div id="coupon-error-msg" class="text-danger small mb-1" style="display:none;"></div>
        <div class="d-flex flex-wrap gap-1 align-items-center mt-1">
          <span class="text-muted small" style="font-size:0.72rem;">Try:</span>
          <button type="button" class="badge bg-light text-dark border rounded-pill py-1 px-2 sidebar-quick-coupon" data-code="WELCOME10">WELCOME10</button>
          <button type="button" class="badge bg-light text-dark border rounded-pill py-1 px-2 sidebar-quick-coupon" data-code="SUPER50">SUPER50</button>
          <button type="button" class="badge bg-light text-dark border rounded-pill py-1 px-2 sidebar-quick-coupon" data-code="RAMEN15">RAMEN15</button>
        </div>
      `;

      const couponInput = document.getElementById('coupon-code-input');
      const applyBtn = document.getElementById('apply-coupon-btn');
      const errorEl = document.getElementById('coupon-error-msg');

      const triggerApplyCoupon = async (codeToApply) => {
        const code = (codeToApply || couponInput?.value || '').trim();
        if (!code) return;
        try {
          if (errorEl) errorEl.style.display = 'none';
          if (applyBtn) {
            applyBtn.disabled = true;
            applyBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
          }
          await applyCoupon(code);
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err.message || 'Invalid coupon.';
            errorEl.style.display = 'block';
          }
        } finally {
          if (applyBtn) {
            applyBtn.disabled = false;
            applyBtn.innerHTML = 'Apply';
          }
        }
      };

      applyBtn?.addEventListener('click', () => triggerApplyCoupon());
      couponInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerApplyCoupon();
        }
      });

      document.querySelectorAll('.sidebar-quick-coupon').forEach(badge => {
        badge.onclick = () => {
          const c = badge.getAttribute('data-code');
          if (couponInput) couponInput.value = c;
          triggerApplyCoupon(c);
        };
      });
    }
  }

  // Render Recommendations
  if (recommendationsSection && allFoods.length > 0) {
    const recs = getRecommendations(cart, allFoods);
    if (recs.length > 0) {
      recommendationsSection.innerHTML = recs.map(rec => `
        <div class="recommendation-card">
          <img src="${escapeHtml(getSafeImageUrl(rec.image_url, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80'))}" alt="${escapeHtml(rec.name)}">
          <div class="min-w-0">
            <h4 class="small fw-bold text-dark text-truncate mb-0">${escapeHtml(rec.name)}</h4>
            <div class="rec-reason">${escapeHtml(rec.reason)}</div>
            <div class="food-price small">${formatCurrency(rec.price)}</div>
          </div>
          <button class="button button-primary py-1 px-2 small-text rec-add-btn" data-id="${rec.id}">
            <i class="fa-solid fa-plus"></i> Add
          </button>
        </div>
      `).join('');

      recommendationsSection.querySelectorAll('.rec-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const recId = btn.getAttribute('data-id');
          const recItem = allFoods.find(f => f.id === recId);
          if (recItem) {
            addToCart({
              id: recItem.id,
              name: recItem.name,
              price: recItem.price,
              image_url: recItem.image_url,
              category_id: recItem.category_id,
              category_name: recItem.category?.name
            });
          }
        });
      });
    } else {
      recommendationsSection.innerHTML = '<p class="muted small-text">Add items to cart to see smart pairing recommendations.</p>';
    }
  }
}

function hydrateOrderPreferences() {
  const preferences = getOrderPreferences();
  const orderTypeSelect = document.getElementById('orderType');
  if (orderTypeSelect) orderTypeSelect.value = preferences.orderType;

  const paymentRadio = document.querySelector(`input[name="quickPaymentMethod"][value="${preferences.paymentMethod}"]`);
  if (paymentRadio) paymentRadio.checked = true;
}
