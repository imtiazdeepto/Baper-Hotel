// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Order Confirmation, Order Tracking & Customer Order History
// ============================================================

import { supabase, isSupabaseConfigured, checkAndDisplayConfigNotice } from './supabaseClient.js';
import { getCurrentUser, setupAuthNav } from './auth.js';
import { formatCurrency } from './cart.js';

document.addEventListener('DOMContentLoaded', async () => {
  checkAndDisplayConfigNotice();
  await setupAuthNav();

  const path = window.location.pathname.toLowerCase();
  if (document.getElementById('conf-order-number') || path.includes('order-confirmation')) {
    await initOrderConfirmation();
  } else if (document.getElementById('track-search-form') || path.includes('track-order')) {
    await initOrderTracking();
  } else if (document.getElementById('order-history-list') || path.includes('order-history')) {
    await initOrderHistory();
  }
});

// ------------------------------------------------------------
// 1. ORDER CONFIRMATION PAGE
// ------------------------------------------------------------
async function initOrderConfirmation() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');
  const orderNumber = params.get('order_number');
  const isDemo = params.get('demo') === 'true';

  const orderNumEl = document.getElementById('conf-order-number');
  const dateEl = document.getElementById('conf-order-date');
  const statusEl = document.getElementById('conf-order-status');
  const itemsContainer = document.getElementById('conf-items-list');
  const subtotalEl = document.getElementById('conf-subtotal');
  const discountEl = document.getElementById('conf-discount');
  const totalEl = document.getElementById('conf-total');
  const trackLink = document.getElementById('conf-track-link');

  if (orderNumEl) orderNumEl.textContent = orderNumber || 'ORD-RECENT';
  if (dateEl) dateEl.textContent = new Date().toLocaleString();
  if (trackLink && orderNumber) {
    trackLink.href = `/track-order.html?order_number=${encodeURIComponent(orderNumber)}`;
  }

  if (isDemo || !isSupabaseConfigured() || (!orderId && !orderNumber)) {
    if (statusEl) statusEl.innerHTML = `<span class="badge bg-warning text-dark px-3 py-2 rounded-pill">Pending (Demo Mode)</span>`;
    return;
  }

  // Ensure Supabase auth session token is loaded into client
  await getCurrentUser();

  try {
    let order = null;

    // Try track_order RPC first (safe, fast, returns items atomically)
    if (orderNumber) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('track_order', {
        p_order_number: orderNumber.trim()
      });
      if (!rpcError && rpcData && rpcData.order_number) {
        order = rpcData;
      }
    }

    // Fallback: direct table query by id or order_number
    if (!order) {
      let query = supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `);

      if (orderId) {
        query = query.eq('id', orderId);
      } else {
        query = query.eq('order_number', orderNumber);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        order = data;
      }
    }

    if (!order) {
      console.warn('Order confirmation details not found yet for id/number.');
      return;
    }

    if (orderNumEl) orderNumEl.textContent = order.order_number;
    if (dateEl) dateEl.textContent = new Date(order.created_at).toLocaleString();
    if (statusEl) {
      statusEl.innerHTML = `<span class="badge ${getStatusBadgeClass(order.order_status)} px-3 py-2 rounded-pill">${escapeHtml(order.order_status)}</span>`;
    }

    if (itemsContainer && order.items && order.items.length > 0) {
      itemsContainer.innerHTML = order.items.map(item => `
        <div class="d-flex justify-content-between py-2 border-bottom small">
          <div>
            <span class="fw-semibold text-dark">${escapeHtml(item.food_name_snapshot)}</span>
            <span class="text-muted ms-1">(${item.quantity} × ${formatCurrency(item.unit_price)})</span>
          </div>
          <span class="fw-bold text-dark">${formatCurrency(item.line_total)}</span>
        </div>
      `).join('');
    } else if (itemsContainer) {
      itemsContainer.innerHTML = `<div class="text-success small"><i class="fa-solid fa-check me-1"></i>Items recorded in kitchen order queue.</div>`;
    }

    if (subtotalEl) subtotalEl.textContent = formatCurrency(order.subtotal);
    if (discountEl) discountEl.textContent = order.discount_amount > 0 ? `- ${formatCurrency(order.discount_amount)}` : formatCurrency(0);
    if (totalEl) totalEl.textContent = formatCurrency(order.total_amount);

  } catch (err) {
    console.warn('Could not fetch full order confirmation details:', err);
  }
}

// ------------------------------------------------------------
// 2. ORDER TRACKING PAGE
// ------------------------------------------------------------
async function initOrderTracking() {
  const searchForm = document.getElementById('track-search-form');
  const searchInput = document.getElementById('track-order-number-input');
  const params = new URLSearchParams(window.location.search);
  const initialOrderNumber = params.get('order_number');

  // Hydrate auth session
  await getCurrentUser();

  if (initialOrderNumber && searchInput) {
    searchInput.value = initialOrderNumber;
    await fetchAndRenderTracking(initialOrderNumber);
  }

  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const num = searchInput?.value.trim();
      if (num) {
        // Update URL query string without reloading page for bookmarkability
        const newUrl = `${window.location.pathname}?order_number=${encodeURIComponent(num)}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
        await fetchAndRenderTracking(num);
      }
    });
  }
}

async function fetchAndRenderTracking(orderNumber) {
  const resultCard = document.getElementById('tracking-result-container');
  const errorAlert = document.getElementById('tracking-error-alert');

  if (errorAlert) errorAlert.style.display = 'none';
  if (resultCard) resultCard.style.display = 'none';

  if (!isSupabaseConfigured()) {
    // Demo mode presentation
    renderTrackingResult({
      order_number: orderNumber,
      order_status: 'Preparing',
      order_type: 'Delivery',
      created_at: new Date().toISOString(),
      customer_name: 'Demo Customer',
      payment_method: 'Cash',
      payment_status: 'Pending',
      total_amount: 850.00,
      delivery_address: 'House 42, Road 11, Banani, Dhaka',
      items: [
        { food_name_snapshot: 'Smoked Beef Pepperoni', quantity: 1, unit_price: 680, line_total: 680 },
        { food_name_snapshot: 'Loaded Truffle Fries', quantity: 1, unit_price: 220, line_total: 220 }
      ],
      history: [
        { old_status: null, new_status: 'Pending', changed_at: new Date(Date.now() - 15 * 60000).toISOString(), note: 'Order placed' },
        { old_status: 'Pending', new_status: 'Confirmed', changed_at: new Date(Date.now() - 10 * 60000).toISOString(), note: 'Confirmed by kitchen' },
        { old_status: 'Confirmed', new_status: 'Preparing', changed_at: new Date(Date.now() - 5 * 60000).toISOString(), note: 'In the oven' }
      ]
    });
    return;
  }

  try {
    let order = null;

    // 1. Try track_order RPC first (bypasses RLS ownership restrictions safely for order tracking)
    const { data: rpcData, error: rpcError } = await supabase.rpc('track_order', {
      p_order_number: orderNumber.trim()
    });

    if (!rpcError && rpcData && rpcData.order_number) {
      order = rpcData;
    }

    // 2. Fallback to direct table query
    if (!order) {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*),
          history:order_status_history(*)
        `)
        .eq('order_number', orderNumber.trim())
        .maybeSingle();

      if (error) throw error;
      order = data;
    }

    if (!order) {
      if (errorAlert) {
        errorAlert.textContent = `No order found with order number "${orderNumber}". Please verify your order number and try again.`;
        errorAlert.style.display = 'block';
      }
      return;
    }

    renderTrackingResult(order);
  } catch (err) {
    console.error('Error tracking order:', err);
    if (errorAlert) {
      errorAlert.textContent = err.message || 'Error tracking order. Please check your credentials or try again.';
      errorAlert.style.display = 'block';
    }
  }
}

function renderTrackingResult(order) {
  const resultCard = document.getElementById('tracking-result-container');
  if (!resultCard) return;

  const statuses = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Completed'];
  const currentIndex = statuses.indexOf(order.order_status);
  const isCancelled = order.order_status === 'Cancelled';

  // Build progress stepper HTML
  let stepperHtml = '';
  if (isCancelled) {
    stepperHtml = `
      <div class="alert alert-danger text-center rounded-3 p-3 mb-4">
        <i class="fa-solid fa-circle-xmark fs-3 mb-2 d-block"></i>
        <h5 class="fw-bold mb-0">This Order Has Been Cancelled</h5>
      </div>
    `;
  } else {
    stepperHtml = `
      <div class="tracking-timeline d-flex justify-content-between position-relative my-4">
        ${statuses.map((s, idx) => {
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const icon = getStatusIcon(s);
          return `
            <div class="timeline-step text-center position-relative ${isDone ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
              <div class="step-circle rounded-circle shadow-sm d-flex align-items-center justify-content-center mx-auto mb-2 ${isDone ? 'bg-primary text-white' : 'bg-light text-muted border'}">
                <i class="${icon}"></i>
              </div>
              <div class="step-label small fw-semibold ${isCurrent ? 'text-primary' : 'text-muted'}">${s}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // History timeline
  const historyList = (order.history || []).sort((a,b) => new Date(a.changed_at) - new Date(b.changed_at));
  const historyHtml = historyList.length > 0 ? `
    <div class="mt-4 pt-3 border-top">
      <h6 class="fw-bold mb-3 small text-dark"><i class="fa-solid fa-clock-rotate-left me-1"></i> Status Log</h6>
      <div class="timeline-logs ps-3 border-start">
        ${historyList.map(h => `
          <div class="timeline-log-entry mb-2 position-relative ps-3">
            <span class="badge ${getStatusBadgeClass(h.new_status)} rounded-pill me-2">${escapeHtml(h.new_status)}</span>
            <span class="small text-muted">${new Date(h.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div class="small text-dark mt-1">${escapeHtml(h.note || '')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  resultCard.innerHTML = `
    <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
      <div class="card-header bg-dark text-white p-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <span class="badge bg-primary px-3 py-1 rounded-pill small mb-1">${escapeHtml(order.order_type)}</span>
            <h4 class="fw-bold mb-0">${escapeHtml(order.order_number)}</h4>
            <div class="small text-white-50 mt-1">Placed on ${new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div class="text-end">
            <span class="badge ${getStatusBadgeClass(order.order_status)} fs-6 px-3 py-2 rounded-pill">${escapeHtml(order.order_status)}</span>
            <div class="fs-5 fw-bold text-warning mt-1">${formatCurrency(order.total_amount)}</div>
          </div>
        </div>
      </div>
      
      <div class="card-body p-4">
        ${stepperHtml}

        <div class="row g-4 mt-2">
          <div class="col-md-6">
            <div class="p-3 bg-light rounded-3 h-100">
              <h6 class="fw-bold text-dark small mb-2"><i class="fa-solid fa-user me-1 text-primary"></i> Customer Details</h6>
              <div class="small text-muted mb-1">Name: <strong class="text-dark">${escapeHtml(order.customer_name)}</strong></div>
              <div class="small text-muted mb-1">Phone: <strong class="text-dark">${escapeHtml(order.phone)}</strong></div>
              ${order.delivery_address ? `<div class="small text-muted mb-1">Address: <strong class="text-dark">${escapeHtml(order.delivery_address)}</strong></div>` : ''}
              <div class="small text-muted">Payment: <strong class="text-dark">${escapeHtml(order.payment_method)} (${escapeHtml(order.payment_status)})</strong></div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="p-3 bg-light rounded-3 h-100">
              <h6 class="fw-bold text-dark small mb-2"><i class="fa-solid fa-utensils me-1 text-primary"></i> Order Items</h6>
              ${(order.items || []).map(item => `
                <div class="d-flex justify-content-between small py-1 border-bottom border-light-subtle">
                  <span>${escapeHtml(item.food_name_snapshot)} × ${item.quantity}</span>
                  <span class="fw-bold">${formatCurrency(item.line_total)}</span>
                </div>
              `).join('')}
              <div class="d-flex justify-content-between small pt-2 fw-bold text-dark">
                <span>Total Bill</span>
                <span class="text-primary">${formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        ${historyHtml}
      </div>
    </div>
  `;

  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth' });
}

// ------------------------------------------------------------
// 3. CUSTOMER ORDER HISTORY PAGE
// ------------------------------------------------------------
async function initOrderHistory() {
  const container = document.getElementById('order-history-list');
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  if (container) {
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="small text-muted mt-2">Loading your past orders...</p>
      </div>
    `;
  }

  if (!isSupabaseConfigured()) {
    if (container) {
      container.innerHTML = `
        <div class="alert alert-info rounded-4 text-center p-4">
          <i class="fa-solid fa-circle-info fs-3 mb-2 d-block"></i>
          Connect Supabase with your project credentials to view real account order history.
        </div>
      `;
    }
    return;
  }

  try {
    // Enforced by RLS: customers can only read their own rows
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 bg-light rounded-4 border border-dashed">
          <i class="fa-solid fa-receipt text-muted fs-1 mb-2"></i>
          <h5 class="fw-bold">No orders placed yet</h5>
          <p class="text-muted small mb-3">Explore our delicious food menu and place your first order!</p>
          <a href="/" class="btn btn-primary rounded-pill px-4">Browse Menu</a>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => `
      <div class="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden">
        <div class="card-body p-4">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <span class="badge bg-light text-dark border rounded-pill px-3 py-1 small me-2">${escapeHtml(order.order_type)}</span>
              <span class="fw-bold text-dark fs-6">${escapeHtml(order.order_number)}</span>
              <div class="small text-muted mt-1"><i class="fa-regular fa-calendar me-1"></i>${new Date(order.created_at).toLocaleString()}</div>
            </div>
            <div class="text-end">
              <span class="badge ${getStatusBadgeClass(order.order_status)} px-3 py-2 rounded-pill small mb-1">${escapeHtml(order.order_status)}</span>
              <div class="fw-bold fs-5 text-dark">${formatCurrency(order.total_amount)}</div>
            </div>
          </div>

          <div class="p-3 bg-light rounded-3 mb-3">
            <div class="small text-muted mb-1 fw-bold">Items Ordered:</div>
            <div class="d-flex flex-wrap gap-2">
              ${(order.items || []).map(i => `
                <span class="badge bg-white text-dark border px-2 py-1 small">
                  ${escapeHtml(i.food_name_snapshot)} × ${i.quantity}
                </span>
              `).join('')}
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center">
            <div class="small text-muted">
              Payment: <strong class="text-dark">${escapeHtml(order.payment_method)} (${escapeHtml(order.payment_status)})</strong>
            </div>
            <a href="/track-order.html?order_number=${encodeURIComponent(order.order_number)}" class="btn btn-sm btn-outline-primary rounded-pill px-3">
              <i class="fa-solid fa-location-dot me-1"></i> Track Live
            </a>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error fetching order history:', err);
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger rounded-4 p-4 text-center">
          <i class="fa-solid fa-triangle-exclamation fs-3 mb-2 d-block"></i>
          Failed to load order history: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Pending': return 'bg-warning text-dark';
    case 'Confirmed': return 'bg-info text-dark';
    case 'Preparing': return 'bg-primary text-white';
    case 'Ready': return 'bg-indigo text-white';
    case 'Out for Delivery': return 'bg-info text-dark';
    case 'Completed': return 'bg-success text-white';
    case 'Cancelled': return 'bg-danger text-white';
    default: return 'bg-secondary text-white';
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'Pending': return 'fa-solid fa-clock';
    case 'Confirmed': return 'fa-solid fa-clipboard-check';
    case 'Preparing': return 'fa-solid fa-fire-burner';
    case 'Ready': return 'fa-solid fa-bell-concierge';
    case 'Out for Delivery': return 'fa-solid fa-motorcycle';
    case 'Completed': return 'fa-solid fa-circle-check';
    default: return 'fa-solid fa-circle';
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
