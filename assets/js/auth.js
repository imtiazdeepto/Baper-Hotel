// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Authentication & Role Management Module
// ============================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';

/**
 * Get current session user
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('Error getting current user:', err);
    return null;
  }
}

/**
 * Fetch profile data for a specific user ID
 */
export async function getUserProfile(userId) {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error fetching profile:', err);
    return null;
  }
}

/**
 * Login user with email and password
 */
export async function login(email, password) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase credentials are not configured. Please enter Project URL and Anon Key.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password
  });

  if (error) throw error;

  // Retrieve user profile to determine role
  const profile = await getUserProfile(data.user.id);
  return { user: data.user, profile };
}

/**
 * Register a new customer
 */
export async function register({ email, password, full_name, phone }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase credentials are not configured. Please enter Project URL and Anon Key.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password: password,
    options: {
      data: {
        full_name: full_name.trim(),
        phone: phone ? phone.trim() : null
      }
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Logout user and redirect
 */
export async function logout(redirectUrl = '/login.html') {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Error during signOut:', err);
  } finally {
    window.location.href = redirectUrl;
  }
}

/**
 * Page protection guard: checks auth state and role permissions
 */
export async function requireAuth(allowedRoles = []) {
  if (!isSupabaseConfigured()) return null;

  const user = await getCurrentUser();
  const currentPath = window.location.pathname;

  if (!user) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
    return null;
  }

  const profile = await getUserProfile(user.id);
  const role = profile?.role || 'customer';

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Role not authorized
    alert(`Access Denied: You must be a ${allowedRoles.join(' or ')} to view this page.`);
    if (role === 'admin') {
      window.location.href = '/admin/dashboard.html';
    } else if (role === 'staff') {
      window.location.href = '/staff/orders.html';
    } else {
      window.location.href = '/';
    }
    return null;
  }

  return { user, profile };
}

/**
 * Updates UI header/navbar across all pages dynamically
 */
export async function setupAuthNav() {
  const authContainer = document.getElementById('navbar-auth-section');
  if (!authContainer) return;

  const user = await getCurrentUser();

  if (!user) {
    authContainer.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <a href="/login.html" class="btn btn-outline-primary btn-sm rounded-pill px-3">
          <i class="fa-solid fa-right-to-bracket me-1"></i> Sign In
        </a>
        <a href="/register.html" class="btn btn-primary btn-sm rounded-pill px-3">
          <i class="fa-solid fa-user-plus me-1"></i> Register
        </a>
      </div>
    `;
    return;
  }

  const profile = await getUserProfile(user.id);
  const role = profile?.role || 'customer';
  const roleBadgeClass = role === 'admin' ? 'bg-danger' : role === 'staff' ? 'bg-info text-dark' : 'bg-secondary';

  authContainer.innerHTML = `
    <div class="dropdown">
      <button class="btn btn-light btn-sm dropdown-toggle rounded-pill px-3 border d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">
        <i class="fa-solid fa-circle-user text-primary fs-5"></i>
        <div class="text-start d-none d-sm-block">
          <div class="fw-semibold small leading-tight">${escapeHtml(profile?.full_name || user.email.split('@')[0])}</div>
          <span class="badge ${roleBadgeClass} p-1" style="font-size: 0.65rem;">${role.toUpperCase()}</span>
        </div>
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow border-0 rounded-3 mt-2">
        <li class="dropdown-header small text-muted">Signed in as <strong>${escapeHtml(user.email)}</strong></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item small" href="/order-history.html"><i class="fa-solid fa-receipt me-2 text-primary"></i>My Order History</a></li>
        <li><a class="dropdown-item small" href="/track-order.html"><i class="fa-solid fa-location-dot me-2 text-info"></i>Track Orders</a></li>
        ${
          role === 'admin'
            ? `<li><hr class="dropdown-divider"></li>
               <li><a class="dropdown-item small text-danger fw-semibold" href="/admin/dashboard.html"><i class="fa-solid fa-gauge-high me-2"></i>Admin Dashboard</a></li>
               <li><a class="dropdown-item small" href="/admin/foods.html"><i class="fa-solid fa-utensils me-2"></i>Food Management</a></li>
               <li><a class="dropdown-item small" href="/admin/orders.html"><i class="fa-solid fa-boxes-packing me-2"></i>Order Management</a></li>
               <li><a class="dropdown-item small" href="/admin/reports.html"><i class="fa-solid fa-chart-line me-2"></i>Sales Reports</a></li>`
            : ''
        }
        ${
          role === 'staff'
            ? `<li><hr class="dropdown-divider"></li>
               <li><a class="dropdown-item small text-info fw-semibold" href="/staff/orders.html"><i class="fa-solid fa-clipboard-list me-2"></i>Staff Kitchen Queue</a></li>`
            : ''
        }
        <li><hr class="dropdown-divider"></li>
        <li><button class="dropdown-item small text-danger" id="nav-logout-btn"><i class="fa-solid fa-arrow-right-from-bracket me-2"></i>Sign Out</button></li>
      </ul>
    </div>
  `;

  document.getElementById('nav-logout-btn')?.addEventListener('click', async () => {
    await logout();
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
