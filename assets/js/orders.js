// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Order Confirmation, Order Tracking & Customer Order History
// ============================================================

import { supabase, isSupabaseConfigured, checkAndDisplayConfigNotice } from './supabaseClient.js';
import { getCurrentUser, setupAuthNav } from './auth.js';
import { formatCurrency } from './cart.js';
import { escapeHtml, getOrderStatusSequence } from './appLogic.js';

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

  const iconEl = document.getElementById('confirmation-icon');
  const titleEl = document.getElementById('confirmation-title');
  const messageEl = document.getElementById('confirmation-message');
  const detailsEl = document.getElementById('confirmation-details');
  const actionsEl = document.getElementById('confirmation-actions');

  const orderNumEl = document.getElementById('conf-order-number');
  const dateEl = document.getElementById('conf-order-date');
  const statusEl = document.getElementById('conf-order-status');
  const itemsContainer = document.getElementById('conf-items-list');
  const subtotalEl = document.getElementById('conf-subtotal');
  const discountEl = document.getElementById('conf-discount');
  const totalEl = document.getElementById('conf-total');
  const trackLink = document.getElementById('conf-track-link');

  // Case 1: Page opened directly without an order identifier or demo flag
  if (!orderId && !orderNumber && !isDemo) {
    if (iconEl) {
      iconEl.style.backgroundColor = '#fff3cd';
      iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-warning fs-2"></i>';
    }
    if (titleEl) titleEl.textContent = 'No Active Order Found';
    if (messageEl) messageEl.textContent = 'We could not find an active order to display. Please browse our menu to place an order or track an existing order by order number.';
    if (detailsEl) detailsEl.style.display = 'none';
    if (actionsEl) {
      actionsEl.innerHTML = `
        <a href="/" class="btn btn-primary py-3 rounded-pill fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2">
          <i class="fa-solid fa-utensils"></i>
          <span>Browse Fresh Menu</span>
        </a>
        <a href="/track-order.html" class="btn btn-outline-secondary py-2 rounded-pill small">
          <i class="fa-solid fa-location-dot me-1"></i> Track Order by Number
        </a>
      `;
      actionsEl.style.display = 'flex';
    }
    return;
  }

  // Case 2: Demo mode receipt
  if (isDemo) {
    let demoData = null;
    try {
      demoData = JSON.parse(sessionStorage.getItem('restaurant_demo_receipt') || 'null');
    } catch {
      demoData = null;
    }

    if (demoData && (demoData.order_number === orderNumber || !orderNumber)) {
      if (iconEl) {
        iconEl.style.backgroundColor = '#d1e7dd';
        iconEl.innerHTML = '<i class="fa-solid fa-check text-success fs-2"></i>';
      }
      if (titleEl) titleEl.textContent = 'Thank You! Demo Order Recorded 🎉';
      if (messageEl) messageEl.textContent = 'This is a local demo order simulation (Supabase is running in offline demo mode).';

      if (orderNumEl) orderNumEl.textContent = demoData.order_number;
      if (dateEl) dateEl.textContent = new Date(demoData.created_at || Date.now()).toLocaleString();
      if (statusEl) statusEl.innerHTML = `<span class="badge bg-warning text-dark px-3 py-1 rounded-pill">Pending (Demo Mode)</span>`;

      if (itemsContainer && demoData.items) {
        itemsContainer.innerHTML = demoData.items.map(item => `
          <div class="d-flex justify-content-between py-2 border-bottom small">
            <div>
              <span class="fw-semibold text-dark">${escapeHtml(item.food_name_snapshot)}</span>
              <span class="text-muted ms-1">(${item.quantity} × ${formatCurrency(item.unit_price)})</span>
            </div>
            <span class="fw-bold text-dark">${formatCurrency(item.line_total)}</span>
          </div>
        `).join('');
      }

      if (subtotalEl) subtotalEl.textContent = formatCurrency(demoData.subtotal);
      if (discountEl) discountEl.textContent = demoData.discount_amount > 0 ? `- ${formatCurrency(demoData.discount_amount)}` : formatCurrency(0);
      if (totalEl) totalEl.textContent = formatCurrency(demoData.total_amount);

      if (detailsEl) detailsEl.style.display = 'block';
      if (actionsEl) {
        if (trackLink) trackLink.href = `/track-order.html?order_number=${encodeURIComponent(demoData.order_number)}`;
        actionsEl.style.display = 'flex';
      }
      return;
    } else {
      if (iconEl) {
        iconEl.style.backgroundColor = '#f8d7da';
        iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark text-danger fs-2"></i>';
      }
      if (titleEl) titleEl.textContent = 'Demo Order Expired';
      if (messageEl) messageEl.textContent = 'The temporary demo receipt was not found in browser storage.';
      if (detailsEl) detailsEl.style.display = 'none';
      if (actionsEl) {
        actionsEl.innerHTML = `
          <a href="/" class="btn btn-primary py-3 rounded-pill fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2">
            <i class="fa-solid fa-utensils"></i>
            <span>Return to Menu</span>
          </a>
        `;
        actionsEl.style.display = 'flex';
      }
      return;
    }
  }

  // Pre-fill URL metadata if available while network request resolves
  const urlSubtotal = params.get('subtotal');
  const urlDiscount = params.get('discount');
  const urlTotal = params.get('total');
  if (orderNumEl && orderNumber) orderNumEl.textContent = orderNumber;
  if (dateEl) dateEl.textContent = new Date().toLocaleString();
  if (urlSubtotal && subtotalEl) subtotalEl.textContent = formatCurrency(urlSubtotal);
  if (urlDiscount && discountEl) discountEl.textContent = parseFloat(urlDiscount) > 0 ? `- ${formatCurrency(urlDiscount)}` : formatCurrency(0);
  if (urlTotal && totalEl) totalEl.textContent = formatCurrency(urlTotal);

  if (trackLink && orderNumber) {
    trackLink.href = `/track-order.html?order_number=${encodeURIComponent(orderNumber)}`;
  }

  // Ensure Supabase auth session token is loaded into client
  await getCurrentUser();

  try {
    let order = null;

    // 1. Try track_order RPC first (safe, fast, returns items atomically)
    if (orderNumber) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('track_order', {
        p_order_number: orderNumber.trim()
      });
      if (!rpcError && rpcData && rpcData.order_number) {
        order = rpcData;
      }
    }

    // 2. Fallback: direct table query by id or order_number
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
      // Order requested was not found in database
      if (iconEl) {
        iconEl.style.backgroundColor = '#f8d7da';
        iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark text-danger fs-2"></i>';
      }
      if (titleEl) titleEl.textContent = 'Order Not Found';
      if (messageEl) messageEl.textContent = `We could not locate order "${escapeHtml(orderNumber || orderId)}". Please verify your order number and try again.`;
      if (detailsEl) detailsEl.style.display = 'none';
      if (actionsEl) {
        actionsEl.innerHTML = `
          <a href="/" class="btn btn-primary py-3 rounded-pill fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2">
            <i class="fa-solid fa-utensils"></i>
            <span>Browse Fresh Menu</span>
          </a>
          <a href="/track-order.html" class="btn btn-outline-secondary py-2 rounded-pill small">
            <i class="fa-solid fa-location-dot me-1"></i> Track Order by Number
          </a>
        `;
        actionsEl.style.display = 'flex';
      }
      return;
    }

    // Order successfully verified
    if (iconEl) {
      iconEl.style.backgroundColor = '#d1e7dd';
      iconEl.innerHTML = '<i class="fa-solid fa-check text-success fs-2"></i>';
    }
    if (titleEl) titleEl.textContent = 'Thank You! Order Confirmed 🎉';
    if (messageEl) messageEl.textContent = 'Your order has been received by the kitchen and is being processed.';

    if (orderNumEl) orderNumEl.textContent = order.order_number;
    if (dateEl) dateEl.textContent = new Date(order.created_at).toLocaleString();
    if (statusEl) {
      statusEl.innerHTML = `<span class="badge ${getStatusBadgeClass(order.order_status)} px-3 py-1 rounded-pill">${escapeHtml(order.order_status)}</span>`;
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

    if (detailsEl) detailsEl.style.display = 'block';
    if (actionsEl) {
      if (trackLink) trackLink.href = `/track-order.html?order_number=${encodeURIComponent(order.order_number)}`;
      actionsEl.style.display = 'flex';
    }

  } catch (err) {
    console.warn('Could not fetch full order confirmation details:', err);
    if (iconEl) {
      iconEl.style.backgroundColor = '#f8d7da';
      iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark text-danger fs-2"></i>';
    }
    if (titleEl) titleEl.textContent = 'Error Loading Order';
    if (messageEl) messageEl.textContent = err.message || 'Unable to load order details. Please check your network connection.';
    if (detailsEl) detailsEl.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'flex';
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

  // Immediately pre-fill search input if order_number parameter is present
  if (initialOrderNumber && searchInput) {
    searchInput.value = initialOrderNumber.trim();
  }

  // Hydrate auth session
  await getCurrentUser();

  if (initialOrderNumber) {
    if (searchInput) searchInput.value = initialOrderNumber.trim();
    await fetchAndRenderTracking(initialOrderNumber.trim());
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

  const orderType = order.order_type || 'Dine In';
  const statuses = getOrderStatusSequence(orderType);
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
          const isDone = currentIndex >= 0 && idx <= currentIndex;
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

  const customerName = order.customer_name || 'Customer';
  const phoneDisplay = order.phone
    ? escapeHtml(order.phone)
    : '<span class="text-muted fst-italic">Protected for customer privacy</span>';
  const addressDisplay = order.delivery_address
    ? `<div class="small text-muted mb-1">Address: <strong class="text-dark">${escapeHtml(order.delivery_address)}</strong></div>`
    : (orderType === 'Delivery' ? '<div class="small text-muted mb-1">Address: <span class="text-muted fst-italic">Protected for customer privacy</span></div>' : '');

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
              <div class="small text-muted mb-1">Name: <strong class="text-dark">${escapeHtml(customerName)}</strong></div>
              <div class="small text-muted mb-1">Phone: <strong class="text-dark">${phoneDisplay}</strong></div>
              ${addressDisplay}
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
    // Filter strictly to current user's own orders (so staff/admin personal history only shows their own)
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('user_id', user.id)
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
