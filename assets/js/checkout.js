// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Checkout Controller (Atomic Server-Side Order Creation)
// ============================================================

import { supabase, isSupabaseConfigured, checkAndDisplayConfigNotice } from './supabaseClient.js';
import { getCurrentUser, getUserProfile, setupAuthNav } from './auth.js';
import {
  getCart,
  clearCart,
  calculateTotals,
  formatCurrency,
  applyCoupon,
  setAppliedCoupon,
  getOrderPreferences,
  setOrderPreferences,
  revalidateCartAgainstCatalog
} from './cart.js';
import { escapeHtml, getPathWithSearch } from './appLogic.js';

let currentUser = null;
let userProfile = null;
let catalogChangesAcknowledged = true;

document.addEventListener('DOMContentLoaded', async () => {
  checkAndDisplayConfigNotice();

  // 1. Immediately render order summary so subtotal & items display with 0ms latency
  renderOrderSummary();
  window.addEventListener('cart-updated', renderOrderSummary);
  initCheckoutForm();
  hydrateOrderPreferences();

  // 2. Verify Cart Contents
  const cart = getCart();
  if (cart.length === 0) {
    alert('Your cart is empty. Please select food items from the menu first.');
    window.location.href = '/';
    return;
  }

  // 3. Verify User Authentication
  if (isSupabaseConfigured()) {
    currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(getPathWithSearch(window.location))}`;
      return;
    }

    userProfile = await getUserProfile(currentUser.id, currentUser);
    prefillCustomerInfo();
  }

  // 4. Refresh price/availability snapshots before final submission
  await verifyCatalogState();
  if (getCart().length === 0) {
    showError('The items in your cart are no longer available. Please choose from the current menu.');
    return;
  }
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

  const updateOrderTypeUi = () => {
    if (!orderTypeSelect || !addressGroup) return;
    const isDelivery = orderTypeSelect.value === 'Delivery';
    addressGroup.style.display = isDelivery ? 'block' : 'none';
    if (addressInput) {
      if (isDelivery) addressInput.setAttribute('required', 'required');
      else addressInput.removeAttribute('required');
    }
  };

  // Toggle delivery address field based on order type
  if (orderTypeSelect && addressGroup) {
    orderTypeSelect.addEventListener('change', () => {
      setOrderPreferences({ orderType: orderTypeSelect.value });
      updateOrderTypeUi();
    });
  }
  updateOrderTypeUi();

  // Payment method selection cards
  const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
  const cardDetailsSection = document.getElementById('card-details-section');
  const walletDetailsSection = document.getElementById('wallet-details-section');

  const updatePaymentUi = () => {
    const selected = document.querySelector('input[name="payment_method"]:checked')?.value || 'Cash';
    if (cardDetailsSection) cardDetailsSection.style.display = selected === 'Debit Card' ? 'block' : 'none';
    if (walletDetailsSection) walletDetailsSection.style.display = selected === 'E-Wallet' ? 'block' : 'none';
  };

  paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) setOrderPreferences({ paymentMethod: radio.value });
      updatePaymentUi();
    });
  });
  updatePaymentUi();

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

      const catalogIsCurrent = await verifyCatalogState();
      if (!catalogIsCurrent || !catalogChangesAcknowledged) return;

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

      if (!/^[+\d][\d\s()-]{6,19}$/.test(phone)) {
        showError('Please enter a valid phone number (7–20 digits/characters).');
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
          // Explicit local demo receipt. The confirmation page verifies this stored record.
          await new Promise(r => setTimeout(r, 1200));
          const demoOrderNumber = `ORD-DEMO-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
          const { subtotal, discount, total } = calculateTotals();
          const demoReceipt = {
            id: crypto.randomUUID(),
            order_number: demoOrderNumber,
            order_type: orderType,
            order_status: 'Pending',
            payment_method: paymentMethod,
            payment_status: paymentMethod === 'Cash' ? 'Pending' : 'Paid',
            customer_name: customerName,
            delivery_address: orderType === 'Delivery' ? address : null,
            created_at: new Date().toISOString(),
            subtotal,
            discount_amount: discount,
            total_amount: total,
            items: cart.map(item => ({
              food_name_snapshot: item.name,
              quantity: item.quantity,
              unit_price: item.price,
              line_total: Math.round(item.price * item.quantity * 100) / 100
            })),
            history: [{
              old_status: null,
              new_status: 'Pending',
              changed_at: new Date().toISOString(),
              note: 'Demo order placed locally.'
            }]
          };
          sessionStorage.setItem('restaurant_demo_receipt', JSON.stringify(demoReceipt));
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

        // Successfully placed order. Confirmation verifies the stored order before showing success.
        clearCart();
        const redirectUrl = `/order-confirmation.html?order_id=${encodeURIComponent(data.order_id)}&order_number=${encodeURIComponent(data.order_number)}&subtotal=${encodeURIComponent(data.subtotal)}&discount=${encodeURIComponent(data.discount_amount)}&total=${encodeURIComponent(data.total_amount)}`;
        window.location.href = redirectUrl;
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

function hydrateOrderPreferences() {
  const preferences = getOrderPreferences();
  const orderTypeSelect = document.getElementById('checkout-order-type');
  if (orderTypeSelect) orderTypeSelect.value = preferences.orderType;

  const paymentRadio = document.querySelector(`input[name="payment_method"][value="${preferences.paymentMethod}"]`);
  if (paymentRadio) paymentRadio.checked = true;
}

async function verifyCatalogState() {
  if (!isSupabaseConfigured()) return true;

  try {
    const result = await revalidateCartAgainstCatalog();
    if (result.changed) {
      catalogChangesAcknowledged = false;
      renderOrderSummary();
      showCatalogChangeNotice(result.changes);
      return false;
    }
    return catalogChangesAcknowledged;
  } catch (err) {
    showError(err.message || 'Could not verify current menu prices. Please try again.');
    return false;
  }
}

function showCatalogChangeNotice(changes) {
  const alertBox = document.getElementById('checkout-cart-change-alert');
  const messageBox = document.getElementById('checkout-cart-change-message');
  const acknowledgeButton = document.getElementById('acknowledge-cart-changes-btn');
  const submitButton = document.getElementById('place-order-btn');
  if (!alertBox || !messageBox || !acknowledgeButton) return;

  messageBox.innerHTML = changes.map(change => {
    if (change.type === 'price') {
      return `<li>${escapeHtml(change.name)} changed from ${formatCurrency(change.oldPrice)} to ${formatCurrency(change.newPrice)}.</li>`;
    }
    return `<li>${escapeHtml(change.name)} was removed because it is unavailable.</li>`;
  }).join('');

  alertBox.style.display = 'block';
  if (submitButton) submitButton.disabled = true;
  acknowledgeButton.onclick = () => {
    catalogChangesAcknowledged = true;
    alertBox.style.display = 'none';
    if (submitButton && getCart().length > 0) submitButton.disabled = false;
  };
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

