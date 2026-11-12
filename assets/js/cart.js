// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Shopping Cart & Recommendation Engine
// ============================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { APP_CONFIG } from './config.js';
import { normalizeOrderPreferences } from './appLogic.js';

const CART_STORAGE_KEY = 'restaurant_cart_items';
const COUPON_STORAGE_KEY = 'restaurant_applied_coupon';
const ORDER_PREFERENCES_STORAGE_KEY = 'restaurant_order_preferences';
const MAX_CART_QUANTITY = 99;

/**
 * Retrieve items in cart
 */
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizeCartItems(parsed);
  } catch (err) {
    console.error('Error reading cart:', err);
    return [];
  }
}

/**
 * Save cart items and trigger update event
 */
function saveCart(items) {
  const normalizedItems = normalizeCartItems(items);
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizedItems));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items: normalizedItems } }));
    updateCartBadges();
  } catch (err) {
    console.error('Error saving cart:', err);
  }
}

/**
 * Add food item to cart (or increment quantity if already exists)
 */
export function addToCart(food, quantity = 1) {
  if (!food || !food.id) return;
  const cart = getCart();
  const foodId = String(food.id);
  const safeQuantity = clampQuantity(quantity);
  const existingIndex = cart.findIndex(item => item.id === foodId);

  if (existingIndex > -1) {
    cart[existingIndex].quantity = clampQuantity(cart[existingIndex].quantity + safeQuantity);
  } else {
    cart.push({
      id: foodId,
      name: String(food.name || 'Menu item'),
      price: toMoney(food.price),
      image_url: typeof food.image_url === 'string' ? food.image_url : '',
      category_id: food.category_id ? String(food.category_id) : null,
      category_name: String(food.category_name || ''),
      quantity: safeQuantity
    });
  }

  saveCart(cart);
  revalidateCoupon();
}

/**
 * Update quantity of a food item in cart
 */
export function updateQuantity(foodId, newQuantity) {
  let cart = getCart();
  const normalizedId = String(foodId);
  const quantity = Number.parseInt(newQuantity, 10);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    cart = cart.filter(item => item.id !== normalizedId);
  } else {
    const item = cart.find(i => i.id === normalizedId);
    if (item) {
      item.quantity = clampQuantity(quantity);
    }
  }
  saveCart(cart);
  revalidateCoupon();
}

/**
 * Remove an item completely from cart
 */
export function removeFromCart(foodId) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== String(foodId));
  saveCart(cart);
  revalidateCoupon();
}

/**
 * Clear the entire cart and remove applied coupon
 */
export function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  localStorage.removeItem(COUPON_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items: [] } }));
  updateCartBadges();
}

/**
 * Get total quantity count of all items in cart
 */
export function getCartItemCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + clampQuantity(item.quantity), 0);
}

/**
 * Calculate cart subtotal
 */
export function calculateSubtotal() {
  const cart = getCart();
  const subtotal = cart.reduce((total, item) => {
    const price = parseFloat(item.price) || 0;
    const qty = parseInt(item.quantity) || 1;
    return total + (price * qty);
  }, 0);
  return Math.round(subtotal * 100) / 100;
}

/**
 * Get currently applied coupon
 */
export function getAppliedCoupon() {
  try {
    const raw = localStorage.getItem(COUPON_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Set applied coupon
 */
export function setAppliedCoupon(coupon) {
  if (coupon) {
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupon));
  } else {
    localStorage.removeItem(COUPON_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items: getCart() } }));
}

/**
 * Persist the menu's fulfillment/payment choices so checkout keeps them.
 */
export function getOrderPreferences() {
  try {
    const raw = localStorage.getItem(ORDER_PREFERENCES_STORAGE_KEY);
    return normalizeOrderPreferences(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeOrderPreferences();
  }
}

export function setOrderPreferences(nextPreferences) {
  const preferences = normalizeOrderPreferences({
    ...getOrderPreferences(),
    ...nextPreferences
  });
  localStorage.setItem(ORDER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent('order-preferences-updated', { detail: preferences }));
  return preferences;
}

/**
 * Refresh local cart snapshots from the database before checkout.
 * The server remains authoritative; unavailable/deleted items are removed.
 */
export async function revalidateCartAgainstCatalog() {
  const cart = getCart();
  if (!isSupabaseConfigured() || cart.length === 0) {
    return { changed: false, changes: [], items: cart };
  }

  const { data: foods, error } = await supabase
    .from('foods')
    .select('id, category_id, name, price, image_url, is_available, category:categories(name)')
    .in('id', cart.map(item => item.id));

  if (error) {
    throw new Error(`Could not verify current menu prices: ${error.message}`);
  }

  const foodById = new Map((foods || []).map(food => [String(food.id), food]));
  const changes = [];
  const refreshedItems = [];

  for (const item of cart) {
    const currentFood = foodById.get(item.id);
    if (!currentFood || currentFood.is_available === false) {
      changes.push({ type: 'removed', name: item.name });
      continue;
    }

    const currentPrice = toMoney(currentFood.price);
    if (currentPrice !== toMoney(item.price)) {
      changes.push({
        type: 'price',
        name: currentFood.name,
        oldPrice: toMoney(item.price),
        newPrice: currentPrice
      });
    }

    refreshedItems.push({
      ...item,
      name: String(currentFood.name || item.name),
      price: currentPrice,
      image_url: currentFood.image_url || '',
      category_id: currentFood.category_id ? String(currentFood.category_id) : null,
      category_name: String(currentFood.category?.name || '')
    });
  }

  if (changes.length > 0) {
    saveCart(refreshedItems);
    setAppliedCoupon(null);
  }

  return { changed: changes.length > 0, changes, items: refreshedItems };
}

/**
 * Apply a coupon code by validating through Supabase RPC
 */
export async function applyCoupon(code) {
  const subtotal = calculateSubtotal();
  if (subtotal <= 0) {
    throw new Error('Your cart is empty. Add food items before applying a coupon.');
  }

  if (!isSupabaseConfigured()) {
    // Demo fallback if Supabase is in placeholder mode
    if (code.toUpperCase() === 'WELCOME10') {
      const discount = Math.min(Math.round(subtotal * 0.1 * 100) / 100, 100);
      const couponObj = { code: 'WELCOME10', discount_type: 'percentage', discount_value: 10, discount_amount: discount };
      setAppliedCoupon(couponObj);
      return { is_valid: true, message: 'Coupon applied (Demo mode)!', discount_amount: discount };
    }
    throw new Error('Please configure Supabase to validate live coupons.');
  }

  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code: code.trim().toUpperCase(),
    p_subtotal: subtotal
  });

  if (error) {
    throw new Error(error.message || 'Failed to validate coupon.');
  }

  if (!data.is_valid) {
    throw new Error(data.message || 'Coupon is not eligible for this order.');
  }

  setAppliedCoupon(data);
  return data;
}

/**
 * Re-validates applied coupon against current cart subtotal
 */
export async function revalidateCoupon() {
  const coupon = getAppliedCoupon();
  if (!coupon) return;

  const subtotal = calculateSubtotal();
  if (subtotal <= 0) {
    setAppliedCoupon(null);
    return;
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: coupon.code,
        p_subtotal: subtotal
      });

      if (error) throw error;
      if (data && data.is_valid) {
        setAppliedCoupon(data);
      } else {
        setAppliedCoupon(null);
      }
    } catch (err) {
      console.warn('Coupon revalidation skipped:', err);
    }
  }
}

/**
 * Calculate final bill totals
 */
export function calculateTotals() {
  const subtotal = calculateSubtotal();
  const coupon = getAppliedCoupon();
  const discount = coupon?.discount_amount ? parseFloat(coupon.discount_amount) : 0;
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  return {
    subtotal,
    discount,
    total,
    coupon
  };
}

/**
 * Updates cart badge numbers in headers/sidebars
 */
export function updateCartBadges() {
  const count = getCartItemCount();
  document.querySelectorAll('.cart-badge').forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  });
}

/**
 * Bonus Recommendation Engine:
 * Generates smart food recommendations based on current cart contents
 */
export function getRecommendations(cartItems, allFoods) {
  if (!allFoods || allFoods.length === 0) return [];
  const cartFoodIds = new Set(cartItems.map(item => item.id));

  // Available foods not already in the cart
  const availableFoods = allFoods.filter(f => f.is_available && !cartFoodIds.has(f.id));
  if (availableFoods.length === 0) return [];

  // Determine categories currently in cart
  const cartCategoryNames = cartItems.map(i => (i.category_name || '').toLowerCase());

  const recommendations = [];

  // 1. Complementary pairings rule
  // If Pizza is in cart -> suggest Fast Food (sides/wings) or Dessert
  if (cartCategoryNames.some(c => c.includes('pizza'))) {
    const side = availableFoods.find(f => (f.category?.name || '').toLowerCase().includes('fast food'));
    if (side && !recommendations.some(r => r.id === side.id)) {
      recommendations.push({ ...side, reason: 'Pairs great with your pizza! 🍕' });
    }
    const dessert = availableFoods.find(f => (f.category?.name || '').toLowerCase().includes('dessert'));
    if (dessert && !recommendations.some(r => r.id === dessert.id)) {
      recommendations.push({ ...dessert, reason: 'Sweet finish for pizza lovers 🍰' });
    }
  }

  // If Ramen or Noodle in cart -> suggest Sushi or Dessert
  if (cartCategoryNames.some(c => c.includes('ramen') || c.includes('noodle'))) {
    const sushi = availableFoods.find(f => (f.category?.name || '').toLowerCase().includes('sushi'));
    if (sushi && !recommendations.some(r => r.id === sushi.id)) {
      recommendations.push({ ...sushi, reason: 'Popular Japanese combo 🍣' });
    }
  }

  // 2. Featured / Popular items fallback
  const featured = availableFoods.filter(f => f.is_featured && !recommendations.some(r => r.id === f.id));
  for (const item of featured) {
    if (recommendations.length >= 3) break;
    recommendations.push({ ...item, reason: 'Chef’s Popular Special ⭐' });
  }

  // 3. Fill up to 3 recommendations with any available items
  for (const item of availableFoods) {
    if (recommendations.length >= 3) break;
    if (!recommendations.some(r => r.id === item.id)) {
      recommendations.push({ ...item, reason: 'Customer favorite choice 👍' });
    }
  }

  return recommendations.slice(0, 3);
}

/**
 * Format currency with BDT symbol (৳)
 */
export function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return `${APP_CONFIG.CURRENCY_SYMBOL} ${num.toFixed(2)}`;
}

function normalizeCartItems(value) {
  if (!Array.isArray(value)) return [];

  const uniqueItems = new Map();
  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== 'object' || rawItem.id === null || rawItem.id === undefined) continue;

    const id = String(rawItem.id).trim().slice(0, 128);
    const price = Number.parseFloat(rawItem.price);
    if (!id || !Number.isFinite(price) || price < 0) continue;

    const item = {
      id,
      name: String(rawItem.name || 'Menu item').slice(0, 200),
      price: toMoney(price),
      image_url: typeof rawItem.image_url === 'string' ? rawItem.image_url.slice(0, 2048) : '',
      category_id: rawItem.category_id ? String(rawItem.category_id).slice(0, 128) : null,
      category_name: String(rawItem.category_name || '').slice(0, 120),
      quantity: clampQuantity(rawItem.quantity)
    };

    if (uniqueItems.has(id)) {
      item.quantity = clampQuantity(uniqueItems.get(id).quantity + item.quantity);
    }
    uniqueItems.set(id, item);
  }

  return [...uniqueItems.values()];
}

function clampQuantity(value) {
  const quantity = Number.parseInt(value, 10);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_CART_QUANTITY, Math.max(1, quantity));
}

function toMoney(value) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}
