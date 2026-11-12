// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Admin Control Center (Dashboard, Foods, Storage, Categories, Orders, Coupons, Reports)
// ============================================================

import { supabase, isSupabaseConfigured, checkAndDisplayConfigNotice } from './supabaseClient.js';
import { requireAuth, setupAuthNav } from './auth.js';
import { formatCurrency } from './cart.js';
import { APP_CONFIG } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  checkAndDisplayConfigNotice();
  await setupAuthNav();

  // Guard all admin routes strictly for 'admin' role
  const authData = await requireAuth(['admin']);
  if (!authData) return;

  const path = window.location.pathname;
  if (path.includes('dashboard.html')) {
    initDashboard();
  } else if (path.includes('food-form.html')) {
    initFoodForm();
  } else if (path.includes('foods.html')) {
    initFoodsList();
  } else if (path.includes('categories.html')) {
    initCategories();
  } else if (path.includes('orders.html')) {
    initOrdersManagement();
  } else if (path.includes('coupons.html')) {
    initCoupons();
  } else if (path.includes('reports.html')) {
    initReports();
  }
});

// ------------------------------------------------------------
// 1. ADMIN DASHBOARD
// ------------------------------------------------------------
async function initDashboard() {
  if (!isSupabaseConfigured()) return;

  try {
    // 1. Metrics summary
    const [ordersRes, foodsRes, couponsRes] = await Promise.all([
      supabase.from('orders').select('id, total_amount, order_status, created_at'),
      supabase.from('foods').select('id', { count: 'exact' }),
      supabase.from('coupons').select('id', { count: 'exact' }).eq('is_active', true)
    ]);

    const orders = ordersRes.data || [];
    const completedOrders = orders.filter(o => o.order_status === 'Completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const pendingOrders = orders.filter(o => !['Completed', 'Cancelled'].includes(o.order_status));

    document.getElementById('dash-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('dash-orders-count').textContent = orders.length;
    document.getElementById('dash-pending-count').textContent = pendingOrders.length;
    document.getElementById('dash-foods-count').textContent = foodsRes.count || 0;
    document.getElementById('dash-coupons-count').textContent = couponsRes.count || 0;

    // 2. Recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, order_type, total_amount, order_status, created_at')
      .order('created_at', { ascending: false })
      .limit(6);

    const recentTable = document.getElementById('dash-recent-orders-table');
    if (recentTable && recentOrders) {
      recentTable.innerHTML = recentOrders.map(o => `
        <tr>
          <td class="fw-bold">${escapeHtml(o.order_number)}</td>
          <td>${escapeHtml(o.customer_name)}</td>
          <td><span class="badge bg-light text-dark border">${escapeHtml(o.order_type)}</span></td>
          <td class="fw-bold">${formatCurrency(o.total_amount)}</td>
          <td><span class="badge ${getStatusBadgeClass(o.order_status)}">${escapeHtml(o.order_status)}</span></td>
          <td class="small text-muted">${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    }

  } catch (err) {
    console.error('Error initializing dashboard:', err);
  }
}

// ------------------------------------------------------------
// 2. FOODS MANAGEMENT (List, Toggle availability, Delete)
// ------------------------------------------------------------
async function initFoodsList() {
  const container = document.getElementById('admin-foods-tbody');
  if (!container) return;

  container.innerHTML = `<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> Loading foods...</td></tr>`;

  try {
    const { data: foods, error } = await supabase
      .from('foods')
      .select(`
        *,
        category:categories(name)
      `)
      .order('name', { ascending: true });

    if (error) throw error;

    if (!foods || foods.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No food items added yet. Click "+ Add New Food" above.</td></tr>`;
      return;
    }

    container.innerHTML = foods.map(f => `
      <tr>
        <td style="width: 60px;">
          <img src="${escapeHtml(f.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80')}" class="rounded-2" style="width: 48px; height: 48px; object-fit: cover;">
        </td>
        <td class="fw-bold text-dark">${escapeHtml(f.name)}</td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(f.category?.name || 'General')}</span></td>
        <td class="fw-bold text-dark">${formatCurrency(f.price)}</td>
        <td>
          <div class="form-check form-switch">
            <input class="form-check-input food-toggle-switch" type="checkbox" role="switch" data-id="${f.id}" ${f.is_available ? 'checked' : ''}>
            <label class="form-check-label small ${f.is_available ? 'text-success' : 'text-danger'}">${f.is_available ? 'In Stock' : 'Out of Stock'}</label>
          </div>
        </td>
        <td>
          ${f.is_featured ? '<span class="badge bg-warning text-dark"><i class="fa-solid fa-star me-1"></i>Featured</span>' : '<span class="text-muted small">Standard</span>'}
        </td>
        <td class="text-end">
          <a href="/admin/food-form.html?id=${f.id}" class="btn btn-sm btn-outline-primary rounded-pill px-2 me-1" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </a>
          <button class="btn btn-sm btn-outline-danger rounded-pill px-2 food-delete-btn" data-id="${f.id}" data-name="${escapeHtml(f.name)}" title="Delete">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Toggle switch listeners
    container.querySelectorAll('.food-toggle-switch').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const id = toggle.getAttribute('data-id');
        const newStatus = toggle.checked;
        const label = toggle.nextElementSibling;
        label.textContent = newStatus ? 'In Stock' : 'Out of Stock';
        label.className = `form-check-label small ${newStatus ? 'text-success' : 'text-danger'}`;

        await supabase.from('foods').update({ is_available: newStatus, updated_at: new Date() }).eq('id', id);
      });
    });

    // Delete buttons
    container.querySelectorAll('.food-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (confirm(`Are you sure you want to delete "${name}"? If it has historical orders, consider deactivating it instead.`)) {
          const { error } = await supabase.from('foods').delete().eq('id', id);
          if (error) {
            alert('Cannot delete food item directly because it is referenced in past customer orders. Deactivating it instead.');
            await supabase.from('foods').update({ is_available: false }).eq('id', id);
          }
          await initFoodsList();
        }
      });
    });

  } catch (err) {
    console.error('Error fetching foods list:', err);
    container.innerHTML = `<tr><td colspan="7" class="text-danger py-4 text-center">Failed to load foods: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ------------------------------------------------------------
// 3. FOOD FORM (Create / Edit Food + Supabase Storage Image Upload)
// ------------------------------------------------------------
async function initFoodForm() {
  const form = document.getElementById('food-upsert-form');
  const categorySelect = document.getElementById('food-category-select');
  const params = new URLSearchParams(window.location.search);
  const foodId = params.get('id');
  const titleEl = document.getElementById('food-form-title');
  const previewImg = document.getElementById('image-preview');

  // Load categories into dropdown
  const { data: categories } = await supabase.from('categories').select('id, name').order('name');
  if (categorySelect && categories) {
    categorySelect.innerHTML = `<option value="">Select Category...</option>` +
      categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  // If editing existing food, pre-fill values
  if (foodId) {
    if (titleEl) titleEl.textContent = 'Edit Food Item';
    const { data: food, error } = await supabase.from('foods').select('*').eq('id', foodId).single();
    if (food && !error) {
      document.getElementById('food-name').value = food.name;
      document.getElementById('food-category-select').value = food.category_id;
      document.getElementById('food-price').value = food.price;
      document.getElementById('food-prep-time').value = food.preparation_time_minutes || 15;
      document.getElementById('food-description').value = food.description || '';
      document.getElementById('food-image-url').value = food.image_url || '';
      document.getElementById('food-is-available').checked = food.is_available;
      document.getElementById('food-is-featured').checked = food.is_featured;
      if (previewImg && food.image_url) {
        previewImg.src = food.image_url;
        previewImg.style.display = 'block';
      }
    }
  }

  // Live image file preview & Storage upload handler
  const fileInput = document.getElementById('food-image-file');
  const urlInput = document.getElementById('food-image-url');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        // Validate MIME type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
          alert('Invalid file type. Please upload a JPG, PNG, or WebP image.');
          fileInput.value = '';
          return;
        }
        // Validate max size 2MB
        if (file.size > 2 * 1024 * 1024) {
          alert('Image exceeds 2MB limit. Please choose a smaller image.');
          fileInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          if (previewImg) {
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      if (previewImg && urlInput.value) {
        previewImg.src = urlInput.value;
        previewImg.style.display = 'block';
      }
    });
  }

  // Submit Handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('food-submit-btn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving Food...`;

      try {
        let finalImageUrl = urlInput?.value?.trim() || null;

        // If user uploaded a new image file, upload to Supabase Storage
        if (fileInput?.files?.length > 0) {
          const file = fileInput.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `food_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const filePath = fileName;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(APP_CONFIG.STORAGE_BUCKET)
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          const { data: publicUrlData } = supabase.storage
            .from(APP_CONFIG.STORAGE_BUCKET)
            .getPublicUrl(filePath);

          finalImageUrl = publicUrlData.publicUrl;
        }

        const payload = {
          name: document.getElementById('food-name').value.trim(),
          category_id: document.getElementById('food-category-select').value,
          price: parseFloat(document.getElementById('food-price').value),
          preparation_time_minutes: parseInt(document.getElementById('food-prep-time').value) || 15,
          description: document.getElementById('food-description').value.trim(),
          image_url: finalImageUrl,
          is_available: document.getElementById('food-is-available').checked,
          is_featured: document.getElementById('food-is-featured').checked,
          updated_at: new Date()
        };

        if (foodId) {
          const { error } = await supabase.from('foods').update(payload).eq('id', foodId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('foods').insert(payload);
          if (error) throw error;
        }

        window.location.href = '/admin/foods.html';
      } catch (err) {
        console.error('Error saving food:', err);
        alert('Failed to save food: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk me-2"></i>Save Food Item`;
      }
    });
  }
}

// ------------------------------------------------------------
// 4. CATEGORIES MANAGEMENT
// ------------------------------------------------------------
async function initCategories() {
  const container = document.getElementById('admin-categories-tbody');
  const addForm = document.getElementById('add-category-form');

  async function loadCats() {
    if (!container) return;
    const { data: cats, error } = await supabase.from('categories').select('*').order('display_order');
    if (error || !cats) return;

    container.innerHTML = cats.map(c => `
      <tr>
        <td class="fw-bold">${c.display_order}</td>
        <td class="fw-bold text-dark">${escapeHtml(c.name)}</td>
        <td><code>${escapeHtml(c.slug)}</code></td>
        <td class="small text-muted">${escapeHtml(c.description || '-')}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger rounded-pill px-2 delete-cat-btn" data-id="${c.id}" data-name="${escapeHtml(c.name)}">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join('');

    container.querySelectorAll('.delete-cat-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        const name = b.getAttribute('data-name');
        if (confirm(`Delete category "${name}"? (Will fail if foods are assigned to it).`)) {
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (error) alert('Cannot delete category: ' + error.message);
          else await loadCats();
        }
      });
    });
  }

  await loadCats();

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value.trim();
      const slug = document.getElementById('cat-slug').value.trim().toLowerCase();
      const description = document.getElementById('cat-desc').value.trim();
      const display_order = parseInt(document.getElementById('cat-order').value) || 0;

      const { error } = await supabase.from('categories').insert({ name, slug, description, display_order });
      if (error) {
        alert('Failed to add category: ' + error.message);
      } else {
        addForm.reset();
        await loadCats();
      }
    });
  }
}

// ------------------------------------------------------------
// 5. ORDERS MANAGEMENT (Search, Filter, Full Details, Status update)
// ------------------------------------------------------------
async function initOrdersManagement() {
  const tbody = document.getElementById('admin-orders-tbody');
  const filterSelect = document.getElementById('admin-order-status-filter');
  const searchInput = document.getElementById('admin-order-search');

  async function loadOrders() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Loading orders...</td></tr>`;

    let query = supabase.from('orders').select(`*, items:order_items(*)`).order('created_at', { ascending: false });

    if (filterSelect?.value && filterSelect.value !== 'all') {
      query = query.eq('order_status', filterSelect.value);
    }

    const { data: orders, error } = await query;
    if (error || !orders) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-danger py-4 text-center">Failed to load orders: ${escapeHtml(error?.message)}</td></tr>`;
      return;
    }

    let filtered = orders;
    const term = searchInput?.value.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(o =>
        o.order_number.toLowerCase().includes(term) ||
        o.customer_name.toLowerCase().includes(term) ||
        o.phone.includes(term)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No orders match criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(o => `
      <tr>
        <td class="fw-bold">${escapeHtml(o.order_number)}</td>
        <td>${escapeHtml(o.customer_name)}<br><small class="text-muted">${escapeHtml(o.phone)}</small></td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(o.order_type)}</span></td>
        <td class="fw-bold">${formatCurrency(o.total_amount)}</td>
        <td>
          <select class="form-select form-select-sm rounded-pill order-status-select" data-id="${o.id}">
            ${['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Completed', 'Cancelled'].map(s => `
              <option value="${s}" ${s === o.order_status ? 'selected' : ''}>${s}</option>
            `).join('')}
          </select>
        </td>
        <td><span class="badge ${o.payment_status === 'Paid' ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(o.payment_status)}</span></td>
        <td class="small text-muted">${new Date(o.created_at).toLocaleDateString()}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-info rounded-pill px-2 view-order-modal-btn" data-order='${JSON.stringify(o).replace(/'/g, "&apos;")}'>
            <i class="fa-solid fa-eye"></i> Details
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.order-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const orderId = sel.getAttribute('data-id');
        const newStatus = sel.value;
        const { error } = await supabase.rpc('update_order_status', {
          p_order_id: orderId,
          p_new_status: newStatus,
          p_note: `Status changed to ${newStatus} by admin.`
        });
        if (error) alert('Failed to update status: ' + error.message);
      });
    });

    tbody.querySelectorAll('.view-order-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderData = JSON.parse(btn.getAttribute('data-order'));
        showOrderDetailsModal(orderData);
      });
    });
  }

  filterSelect?.addEventListener('change', loadOrders);
  searchInput?.addEventListener('input', loadOrders);
  await loadOrders();
}

function showOrderDetailsModal(order) {
  const modalHtml = `
    <div class="modal fade" id="adminOrderDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4 border-0 shadow-lg">
          <div class="modal-header bg-dark text-white rounded-top-4">
            <h5 class="modal-title fs-6"><i class="fa-solid fa-receipt me-2 text-warning"></i>Order ${escapeHtml(order.order_number)}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <div class="row g-3 mb-4">
              <div class="col-sm-6">
                <div class="p-3 bg-light rounded-3">
                  <div class="small text-muted mb-1">Customer: <strong class="text-dark">${escapeHtml(order.customer_name)}</strong></div>
                  <div class="small text-muted mb-1">Phone: <strong class="text-dark">${escapeHtml(order.phone)}</strong></div>
                  <div class="small text-muted">Type: <span class="badge bg-primary rounded-pill">${escapeHtml(order.order_type)}</span></div>
                  ${order.delivery_address ? `<div class="small text-muted mt-1">Address: <strong class="text-dark">${escapeHtml(order.delivery_address)}</strong></div>` : ''}
                </div>
              </div>
              <div class="col-sm-6">
                <div class="p-3 bg-light rounded-3">
                  <div class="small text-muted mb-1">Placed: <strong class="text-dark">${new Date(order.created_at).toLocaleString()}</strong></div>
                  <div class="small text-muted mb-1">Payment Method: <strong class="text-dark">${escapeHtml(order.payment_method)}</strong></div>
                  <div class="small text-muted">Payment Status: <strong class="text-dark">${escapeHtml(order.payment_status)}</strong></div>
                </div>
              </div>
            </div>

            <h6 class="fw-bold mb-2 small text-dark">Items Ordered</h6>
            <div class="table-responsive border rounded-3 mb-3">
              <table class="table table-sm mb-0">
                <thead class="table-light">
                  <tr><th>Item</th><th>Unit Price</th><th>Qty</th><th class="text-end">Total</th></tr>
                </thead>
                <tbody>
                  ${(order.items || []).map(i => `
                    <tr>
                      <td class="fw-semibold">${escapeHtml(i.food_name_snapshot)}</td>
                      <td>${formatCurrency(i.unit_price)}</td>
                      <td>${i.quantity}</td>
                      <td class="text-end fw-bold">${formatCurrency(i.line_total)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="d-flex justify-content-end">
              <div class="text-end" style="min-width: 200px;">
                <div class="d-flex justify-content-between small text-muted"><span>Subtotal:</span> <span>${formatCurrency(order.subtotal)}</span></div>
                <div class="d-flex justify-content-between small text-success"><span>Discount:</span> <span>- ${formatCurrency(order.discount_amount)}</span></div>
                <div class="d-flex justify-content-between fs-6 fw-bold text-dark pt-1 border-top"><span>Total:</span> <span class="text-primary">${formatCurrency(order.total_amount)}</span></div>
              </div>
            </div>
          </div>
          <div class="modal-footer bg-light rounded-bottom-4">
            <button type="button" class="btn btn-sm btn-secondary rounded-pill px-3" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container);
  const modalEl = document.getElementById('adminOrderDetailsModal');
  const bsModal = new window.bootstrap.Modal(modalEl);
  bsModal.show();
  modalEl.addEventListener('hidden.bs.modal', () => container.remove());
}

// ------------------------------------------------------------
// 6. COUPONS MANAGEMENT
// ------------------------------------------------------------
async function initCoupons() {
  const container = document.getElementById('admin-coupons-tbody');
  const addForm = document.getElementById('add-coupon-form');

  async function loadCoupons() {
    if (!container) return;
    const { data: coupons, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error || !coupons) return;

    container.innerHTML = coupons.map(c => `
      <tr>
        <td class="fw-bold"><code>${escapeHtml(c.code)}</code></td>
        <td><span class="badge ${c.discount_type === 'percentage' ? 'bg-primary' : 'bg-info text-dark'}">${c.discount_type}</span></td>
        <td class="fw-bold">${c.discount_type === 'percentage' ? c.discount_value + '%' : formatCurrency(c.discount_value)}</td>
        <td>${formatCurrency(c.minimum_order_amount)}</td>
        <td>${c.used_count} / ${c.usage_limit || '∞'}</td>
        <td class="small">${new Date(c.expiry_date).toLocaleDateString()}</td>
        <td>
          <div class="form-check form-switch">
            <input class="form-check-input coupon-toggle" type="checkbox" role="switch" data-id="${c.id}" ${c.is_active ? 'checked' : ''}>
          </div>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger rounded-pill px-2 delete-coupon-btn" data-id="${c.id}">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join('');

    container.querySelectorAll('.coupon-toggle').forEach(t => {
      t.addEventListener('change', async () => {
        const id = t.getAttribute('data-id');
        await supabase.from('coupons').update({ is_active: t.checked }).eq('id', id);
      });
    });

    container.querySelectorAll('.delete-coupon-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        if (confirm('Delete this coupon?')) {
          await supabase.from('coupons').delete().eq('id', id);
          await loadCoupons();
        }
      });
    });
  }

  await loadCoupons();

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('coupon-code').value.trim().toUpperCase();
      const discount_type = document.getElementById('coupon-type').value;
      const discount_value = parseFloat(document.getElementById('coupon-value').value);
      const minimum_order_amount = parseFloat(document.getElementById('coupon-min-order').value) || 0;
      const maximum_discount = document.getElementById('coupon-max-discount').value ? parseFloat(document.getElementById('coupon-max-discount').value) : null;
      const usage_limit = document.getElementById('coupon-limit').value ? parseInt(document.getElementById('coupon-limit').value) : null;
      const expiry_date = document.getElementById('coupon-expiry').value;

      const { error } = await supabase.from('coupons').insert({
        code,
        discount_type,
        discount_value,
        minimum_order_amount,
        maximum_discount,
        usage_limit,
        expiry_date,
        is_active: true
      });

      if (error) alert('Error creating coupon: ' + error.message);
      else {
        addForm.reset();
        await loadCoupons();
      }
    });
  }
}

// ------------------------------------------------------------
// 7. DAILY SALES REPORT (Date Picker, Aggregated Revenue, Chart.js)
// ------------------------------------------------------------
async function initReports() {
  const dateInput = document.getElementById('report-date-picker');
  const fetchBtn = document.getElementById('generate-report-btn');

  // Default to today
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  async function generateReport() {
    const selectedDate = dateInput?.value || new Date().toISOString().split('T')[0];
    const tbody = document.getElementById('report-orders-tbody');

    try {
      const { data, error } = await supabase.rpc('get_daily_sales_report', {
        p_report_date: selectedDate
      });

      if (error) throw error;

      document.getElementById('rep-total-orders').textContent = data.total_orders;
      document.getElementById('rep-completed-orders').textContent = data.completed_orders;
      document.getElementById('rep-cancelled-orders').textContent = data.cancelled_orders;
      document.getElementById('rep-gross-sales').textContent = formatCurrency(data.gross_sales);
      document.getElementById('rep-discounts').textContent = formatCurrency(data.total_discounts);
      document.getElementById('rep-net-sales').textContent = formatCurrency(data.net_sales);

      if (tbody) {
        if (!data.orders || data.orders.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No orders recorded on ${selectedDate}.</td></tr>`;
        } else {
          tbody.innerHTML = data.orders.map(o => `
            <tr>
              <td class="fw-bold">${escapeHtml(o.order_number)}</td>
              <td>${escapeHtml(o.customer_name)}</td>
              <td><span class="badge bg-light text-dark border">${escapeHtml(o.order_type)}</span></td>
              <td>${formatCurrency(o.subtotal)}</td>
              <td class="text-success">${o.discount_amount > 0 ? '-' + formatCurrency(o.discount_amount) : '৳ 0.00'}</td>
              <td class="fw-bold text-dark">${formatCurrency(o.total_amount)}</td>
              <td><span class="badge ${getStatusBadgeClass(o.order_status)}">${escapeHtml(o.order_status)}</span></td>
            </tr>
          `).join('');
        }
      }

      // Render chart if canvas exists and Chart.js loaded
      renderSalesChart(data.completed_orders, data.cancelled_orders, data.total_orders - data.completed_orders - data.cancelled_orders);

    } catch (err) {
      console.error('Report generation error:', err);
      alert('Error fetching sales report: ' + err.message);
    }
  }

  fetchBtn?.addEventListener('click', generateReport);
  await generateReport();
}

let reportChartInstance = null;
function renderSalesChart(completed, cancelled, pending) {
  const canvas = document.getElementById('sales-breakdown-chart');
  if (!canvas || !window.Chart) return;

  if (reportChartInstance) {
    reportChartInstance.destroy();
  }

  reportChartInstance = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Completed Orders', 'Pending/In-Progress', 'Cancelled Orders'],
      datasets: [{
        data: [completed, pending, cancelled],
        backgroundColor: ['#198754', '#ffc107', '#dc3545'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
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
