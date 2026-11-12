// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Staff Kitchen Queue & Operational Order Controller
// ============================================================

import { supabase, isSupabaseConfigured, checkAndDisplayConfigNotice } from './supabaseClient.js';
import { requireAuth, setupAuthNav } from './auth.js';
import { formatCurrency } from './cart.js';

let currentStaff = null;
let currentFilter = 'active'; // 'active' or 'all'

document.addEventListener('DOMContentLoaded', async () => {
  checkAndDisplayConfigNotice();
  await setupAuthNav();

  // Guard page: allow only staff or admin
  const authData = await requireAuth(['staff', 'admin']);
  if (!authData) return;
  currentStaff = authData;

  initFilters();
  await loadStaffOrders();

  // Polling every 15 seconds for new kitchen orders
  setInterval(() => {
    loadStaffOrders(true);
  }, 15000);
});

function initFilters() {
  document.querySelectorAll('.order-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      loadStaffOrders();
    });
  });
}

async function loadStaffOrders(isBackground = false) {
  const container = document.getElementById('staff-orders-container');
  if (!container) return;

  if (!isBackground) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="small text-muted mt-2">Loading incoming kitchen orders...</p>
      </div>
    `;
  }

  if (!isSupabaseConfigured()) {
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info rounded-4 text-center p-4">
          <i class="fa-solid fa-circle-info fs-3 mb-2 d-block"></i>
          Connect Supabase with your project credentials to view real kitchen orders.
        </div>
      </div>
    `;
    return;
  }

  try {
    let query = supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .order('created_at', { ascending: false });

    if (currentFilter === 'active') {
      query = query.not('order_status', 'in', '("Completed","Cancelled")');
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5 bg-light rounded-4 border border-dashed">
          <i class="fa-solid fa-bell-slash text-muted fs-1 mb-2"></i>
          <h5 class="fw-bold">No orders in queue</h5>
          <p class="text-muted small mb-0">All kitchen tickets have been prepared or no new orders have arrived.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => renderOrderCard(order)).join('');
    bindStatusUpdateButtons(container);

  } catch (err) {
    console.error('Error loading staff orders:', err);
    if (!isBackground) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-danger rounded-4 p-4 text-center">
            <i class="fa-solid fa-triangle-exclamation fs-3 mb-2 d-block"></i>
            Error loading orders: ${escapeHtml(err.message)}
          </div>
        </div>
      `;
    }
  }
}

function renderOrderCard(order) {
  const isDone = order.order_status === 'Completed' || order.order_status === 'Cancelled';
  return `
    <div class="col-md-6 col-xl-4">
      <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden order-ticket-card">
        <div class="card-header bg-light border-bottom p-3 d-flex justify-content-between align-items-center">
          <div>
            <span class="badge bg-dark rounded-pill px-2 py-1 small me-1">${escapeHtml(order.order_type)}</span>
            <strong class="text-dark">${escapeHtml(order.order_number)}</strong>
          </div>
          <span class="badge ${getStatusBadgeClass(order.order_status)} px-3 py-1 rounded-pill small">
            ${escapeHtml(order.order_status)}
          </span>
        </div>

        <div class="card-body p-3 d-flex flex-column">
          <div class="small text-muted mb-2 d-flex justify-content-between">
            <span>Customer: <strong class="text-dark">${escapeHtml(order.customer_name)}</strong></span>
            <span><i class="fa-regular fa-clock me-1"></i>${new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="small text-muted mb-3">Phone: <strong class="text-dark">${escapeHtml(order.phone)}</strong></div>

          <div class="bg-light rounded-3 p-3 flex-grow-1 mb-3">
            <div class="small fw-bold text-dark mb-2 border-bottom pb-1">Items to Prepare:</div>
            ${(order.items || []).map(i => `
              <div class="d-flex justify-content-between small py-1">
                <span><strong>${i.quantity}x</strong> ${escapeHtml(i.food_name_snapshot)}</span>
                <span class="text-muted">${formatCurrency(i.line_total)}</span>
              </div>
            `).join('')}
            ${order.notes ? `<div class="mt-2 pt-2 border-top text-danger small"><i class="fa-solid fa-comment-dots me-1"></i><strong>Note:</strong> ${escapeHtml(order.notes)}</div>` : ''}
          </div>

          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="small text-muted">Total: <strong class="text-dark">${formatCurrency(order.total_amount)}</strong></span>
            <span class="small text-muted">Payment: <strong class="text-dark">${escapeHtml(order.payment_method)} (${escapeHtml(order.payment_status)})</strong></span>
          </div>

          ${
            !isDone ? `
              <div class="d-flex gap-2 mt-auto">
                ${getNextStatusButton(order.id, order.order_status, order.order_type)}
                <button class="btn btn-sm btn-outline-danger rounded-pill px-2 cancel-order-btn" data-id="${order.id}">
                  Cancel
                </button>
              </div>
            ` : `<div class="text-center text-muted small mt-auto py-1">Order finalized</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function getNextStatusButton(orderId, currentStatus, orderType) {
  switch (currentStatus) {
    case 'Pending':
      return `<button class="btn btn-sm btn-primary rounded-pill flex-grow-1 update-status-btn" data-id="${orderId}" data-status="Confirmed"><i class="fa-solid fa-check me-1"></i> Confirm Order</button>`;
    case 'Confirmed':
      return `<button class="btn btn-sm btn-warning text-dark rounded-pill flex-grow-1 update-status-btn" data-id="${orderId}" data-status="Preparing"><i class="fa-solid fa-fire-burner me-1"></i> Start Preparing</button>`;
    case 'Preparing':
      return `<button class="btn btn-sm btn-info text-dark rounded-pill flex-grow-1 update-status-btn" data-id="${orderId}" data-status="Ready"><i class="fa-solid fa-bell-concierge me-1"></i> Mark as Ready</button>`;
    case 'Ready':
      if (orderType === 'Delivery') {
        return `<button class="btn btn-sm btn-primary rounded-pill flex-grow-1 update-status-btn" data-id="${orderId}" data-status="Out for Delivery"><i class="fa-solid fa-truck me-1"></i> Out for Delivery</button>`;
      }
      return `<button class="btn btn-sm btn-success rounded-pill flex-grow-1 update-status-btn" data-id="${orderId}" data-status="Completed"><i class="fa-solid fa-circle-check me-1"></i> Complete & Serve</button>`;
    case 'Out for Delivery':
      return `<button class="btn btn-sm btn-success rounded-pill flex-grow-1 update-status-btn" data-id="${orderId}" data-status="Completed"><i class="fa-solid fa-circle-check me-1"></i> Delivered & Complete</button>`;
    default:
      return '';
  }
}

function bindStatusUpdateButtons(container) {
  container.querySelectorAll('.update-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.getAttribute('data-id');
      const newStatus = btn.getAttribute('data-status');
      await executeStatusUpdate(orderId, newStatus);
    });
  });

  container.querySelectorAll('.cancel-order-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to cancel this order?')) {
        await executeStatusUpdate(orderId, 'Cancelled', 'Cancelled by kitchen staff.');
      }
    });
  });
}

async function executeStatusUpdate(orderId, newStatus, note = null) {
  try {
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_note: note
    });

    if (error) throw error;
    await loadStaffOrders();
  } catch (err) {
    console.error('Failed to update status:', err);
    alert('Error updating status: ' + err.message);
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

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
