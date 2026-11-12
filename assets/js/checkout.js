// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Checkout Controller (Atomic Server-Side Order Creation)
// ============================================================

import { supabase, isSupabaseConfigured, checkAndDisplayConfigNotice } from './supabaseClient.js';
import { getCurrentUser, getUserProfile, setupAuthNav } from './auth.js';
import { getCart, clearCart, calculateTotals, formatCurrency, applyCoupon, setAppliedCoupon, getAppliedCoupon } from './cart.js';

let currentUser = null;
let userProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  checkAndDisplayConfigNotice();
  await setupAuthNav();

  // 1. Verify User Authentication
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  userProfile = await getUserProfile(currentUser.id);

  // 2. Verify Cart Contents
  const cart = getCart();
  if (cart.length === 0) {
    alert('Your cart is empty. Please select food items from the menu first.');
    window.location.href = '/';
    return;
  }

  // 3. Pre-fill customer contact fields
  prefillCustomerInfo();

  // 4. Render Checkout Order Summary
  renderOrderSummary();
  window.addEventListener('cart-updated', renderOrderSummary);

  // 5. Setup Form Interactions
  initCheckoutForm();
});

function prefillCustomerInfo() {
  const nameInput = document.getElementById('checkout-name');
  const phoneInput = document.getElementById('checkout-phone');
  const emailInput = document.getElementById('checkout-email');

  if (nameInput && userProfile?.full_name) {
    nameInput.value = userProfile.full_name;
  }
  if (phoneInput && userProfile?.phone) {
    phoneInput.value = userProfile.phone;
  }
  if (emailInput && currentUser?.email) {
    emailInput.value = currentUser.email;
  }
}

function renderOrderSummary() {
  const itemsContainer = document.getElementById('checkout-items-list');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const discountEl = document.getElementById('checkout-discount');
  const totalEl = document.getElementById('checkout-total');
  const discountRow = document.getElementById('checkout-discount-row');
  const couponBox = document.getElementById('checkout-coupon-box');
  const couponError = document.getElementById('checkout-coupon-error');

  const cart = getCart();
  const { subtotal, discount, total, coupon } = calculateTotals();

  if (itemsContainer) {
    itemsContainer.innerHTML = cart.map(item => `
      <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-light text-dark border px-2 py-1">${item.quantity}x</span>
          <span class="small fw-semibold text-dark">${escapeHtml(item.name)}</span>
        </div>
        <span class="small fw-bold text-dark">${formatCurrency(item.price * item.quantity)}</span>
      </div>
    `).join('');
  }

  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);

  if (discountRow) {
    if (discount > 0 && coupon) {
      discountRow.style.display = 'flex';
      if (discountEl) discountEl.textContent = `- ${formatCurrency(discount)} (${escapeHtml(coupon.code)})`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  if (totalEl) totalEl.textContent = formatCurrency(total);

  // Render Coupon state inside Checkout
  if (couponBox) {
    if (coupon) {
      couponBox.innerHTML = `
        <div class="d-flex align-items-center justify-content-between p-2 bg-success-subtle text-success border border-success-subtle rounded-3">
          <span class="small fw-bold"><i class="fa-solid fa-circle-check me-1"></i>${escapeHtml(coupon.code)} applied (-${formatCurrency(discount)})</span>
          <button type="button" class="btn btn-sm btn-link text-danger p-0 text-decoration-none small fw-semibold" id="checkout-remove-coupon-btn">Remove</button>
        </div>
      `;
      document.getElementById('checkout-remove-coupon-btn')?.addEventListener('click', () => {
        setAppliedCoupon(null);
        if (couponError) couponError.style.display = 'none';
      });
    } else {
      couponBox.innerHTML = `
        <div class="input-group input-group-sm mb-2">
          <input type="text" id="checkout-coupon-input" class="form-control rounded-start-pill text-uppercase" placeholder="e.g. WELCOME10">
          <button class="btn btn-dark rounded-end-pill px-3" type="button" id="checkout-apply-coupon-btn">Apply</button>
        </div>
      `;

      const input = document.getElementById('checkout-coupon-input');
      const applyBtn = document.getElementById('checkout-apply-coupon-btn');

      const triggerApply = async (codeToApply) => {
        const code = (codeToApply || input?.value || '').trim();
        if (!code) return;
        if (couponError) couponError.style.display = 'none';
        applyBtn.disabled = true;
        applyBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

        try {
          await applyCoupon(code);
        } catch (err) {
          if (couponError) {
            couponError.textContent = err.message || 'Invalid coupon code.';
            couponError.style.display = 'block';
          }
        } finally {
          applyBtn.disabled = false;
          applyBtn.innerHTML = 'Apply';
        }
      };

      applyBtn?.addEventListener('click', () => triggerApply());
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerApply();
        }
      });
    }
  }

  // Quick coupon badge click triggers
  document.querySelectorAll('.coupon-quick-btn').forEach(btn => {
    btn.onclick = async () => {
      const code = btn.getAttribute('data-code');
      const input = document.getElementById('checkout-coupon-input');
      if (input) input.value = code;
      const applyBtn = document.getElementById('checkout-apply-coupon-btn');
      if (applyBtn) applyBtn.click();
    };
  });
}

function initCheckoutForm() {
  const orderTypeSelect = document.getElementById('checkout-order-type');
  const addressGroup = document.getElementById('delivery-address-group');
  const addressInput = document.getElementById('checkout-address');

  // Toggle delivery address field based on order type
  if (orderTypeSelect && addressGroup) {
    orderTypeSelect.addEventListener('change', () => {
      if (orderTypeSelect.value === 'Delivery') {
        addressGroup.style.display = 'block';
        if (addressInput) addressInput.setAttribute('required', 'required');
      } else {
        addressGroup.style.display = 'none';
        if (addressInput) addressInput.removeAttribute('required');
      }
    });
  }

  // Payment method selection cards
  const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
  const cardDetailsSection = document.getElementById('card-details-section');
  const walletDetailsSection = document.getElementById('wallet-details-section');

  paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (cardDetailsSection) cardDetailsSection.style.display = radio.value === 'Debit Card' ? 'block' : 'none';
      if (walletDetailsSection) walletDetailsSection.style.display = radio.value === 'E-Wallet' ? 'block' : 'none';
    });
  });

  // Handle Form Submission
  const checkoutForm = document.getElementById('checkout-form');
  const submitBtn = document.getElementById('place-order-btn');
  const errorAlert = document.getElementById('checkout-error-alert');

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorAlert) errorAlert.style.display = 'none';

      const cart = getCart();
      if (cart.length === 0) {
        alert('Cart is empty.');
        window.location.href = '/';
        return;
      }

      // Gather input values
      const orderType = orderTypeSelect ? orderTypeSelect.value : 'Dine In';
      const customerName = document.getElementById('checkout-name')?.value.trim();
      const phone = document.getElementById('checkout-phone')?.value.trim();
      const address = addressInput ? addressInput.value.trim() : null;
      const notes = document.getElementById('checkout-notes')?.value.trim() || null;
      const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'Cash';
      const { coupon } = calculateTotals();
      const couponCode = coupon ? coupon.code : null;

      if (!customerName || !phone) {
        showError('Please fill in your name and phone number.');
        return;
      }

      if (orderType === 'Delivery' && !address) {
        showError('Please provide a complete delivery address for Delivery orders.');
        return;
      }

      // Prepare items for PostgreSQL RPC function
      const itemsPayload = cart.map(item => ({
        food_id: item.id,
        quantity: item.quantity
      }));

      // Disable button to prevent duplicate submissions
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Processing Secure Order...
        `;
      }

      try {
        if (!isSupabaseConfigured()) {
          // Fallback demo simulation
          await new Promise(r => setTimeout(r, 1200));
          const demoOrderNumber = 'ORD-DEMO-' + Math.floor(100000 + Math.random() * 900000);
          clearCart();
          window.location.href = `/order-confirmation.html?order_number=${demoOrderNumber}&status=Pending&demo=true`;
          return;
        }

        // Call atomic PostgreSQL RPC function
        const { data, error } = await supabase.rpc('create_order', {
          p_order_type: orderType,
          p_payment_method: paymentMethod,
          p_customer_name: customerName,
          p_phone: phone,
          p_delivery_address: address,
          p_notes: notes,
          p_coupon_code: couponCode,
          p_items: itemsPayload
        });

        if (error) {
          throw error;
        }

        if (!data || !data.success) {
          throw new Error(data?.message || 'Failed to place order.');
        }

        // Successfully placed order!
        clearCart();
        window.location.href = `/order-confirmation.html?order_id=${data.order_id}&order_number=${data.order_number}`;
      } catch (err) {
        console.error('Order creation error:', err);
        showError(err.message || 'An error occurred while creating your order. Please try again.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i class="fa-solid fa-lock me-2"></i>Confirm & Place Order`;
        }
      }
    });
  }
}

function showError(msg) {
  const errorAlert = document.getElementById('checkout-error-alert');
  if (errorAlert) {
    errorAlert.textContent = msg;
    errorAlert.style.display = 'block';
    errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    alert(msg);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
