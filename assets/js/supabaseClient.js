// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Supabase Client Initializer & Environment Resolver
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { APP_CONFIG } from './config.js';

// Resolve configuration: check Vite env, then localStorage override, then config.js
const viteEnvUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : null;
const viteEnvKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : null;

const localOverrideUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('APP_SUPABASE_URL') : null;
const localOverrideKey = typeof localStorage !== 'undefined' ? localStorage.getItem('APP_SUPABASE_ANON_KEY') : null;

export const SUPABASE_URL = localOverrideUrl || viteEnvUrl || APP_CONFIG.SUPABASE_URL;
export const SUPABASE_ANON_KEY = localOverrideKey || viteEnvKey || APP_CONFIG.SUPABASE_ANON_KEY;

// Check if credentials are placeholders
export function isSupabaseConfigured() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-project-id') &&
    !SUPABASE_ANON_KEY.includes('your-anon-key-here') &&
    SUPABASE_URL.startsWith('http')
  );
}

// Create and export the Supabase Client
export const supabase = createClient(
  isSupabaseConfigured() ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// UI helper to display setup instructions if credentials are placeholders
export function checkAndDisplayConfigNotice() {
  if (isSupabaseConfigured()) return;

  const existingBanner = document.getElementById('supabase-config-banner');
  if (existingBanner) return;

  const banner = document.createElement('div');
  banner.id = 'supabase-config-banner';
  banner.className = 'alert alert-warning mb-0 text-center py-2 px-3 border-0 rounded-0 shadow-sm';
  banner.style.position = 'sticky';
  banner.style.top = '0';
  banner.style.zIndex = '9999';
  banner.innerHTML = `
    <div class="d-flex align-items-center justify-content-center gap-2 flex-wrap text-dark small">
      <span><i class="fa-solid fa-triangle-exclamation text-warning me-1"></i> <strong>Supabase Setup Required:</strong> Connect your online Supabase project to browse live data and authenticate.</span>
      <button class="btn btn-sm btn-dark py-0 px-2 rounded-pill ms-2" id="open-config-modal-btn">
        <i class="fa-solid fa-gear me-1"></i> Enter Credentials
      </button>
      <a href="/README.md" target="_blank" class="btn btn-sm btn-outline-dark py-0 px-2 rounded-pill">
        <i class="fa-solid fa-book me-1"></i> Setup Guide
      </a>
    </div>
  `;

  document.body.prepend(banner);

  document.getElementById('open-config-modal-btn')?.addEventListener('click', () => {
    promptForCredentials();
  });
}

export function promptForCredentials() {
  const currentUrl = localStorage.getItem('APP_SUPABASE_URL') || '';
  const currentKey = localStorage.getItem('APP_SUPABASE_ANON_KEY') || '';

  const modalHtml = `
    <div class="modal fade" id="configModal" tabindex="-1" aria-labelledby="configModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg border-0 rounded-4">
          <div class="modal-header bg-dark text-white rounded-top-4">
            <h5 class="modal-title fs-6" id="configModalLabel"><i class="fa-solid fa-plug text-warning me-2"></i>Configure Supabase Project</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <p class="text-muted small mb-3">
              Enter your live project URL and <strong>anon (public) key</strong> from your 
              <a href="https://supabase.com/dashboard" target="_blank" class="text-primary text-decoration-none fw-semibold">Supabase Dashboard &rarr; Project Settings &rarr; API</a>.
            </p>
            <div class="mb-3">
              <label class="form-label small fw-bold">Project URL</label>
              <input type="url" id="modal-supabase-url" class="form-control rounded-3" placeholder="https://xyzcompany.supabase.co">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-bold">Anon / Public Key</label>
              <textarea id="modal-supabase-key" class="form-control rounded-3" rows="3" placeholder="eyJhbGciOi..."></textarea>
              <div class="form-text text-danger small"><i class="fa-solid fa-shield-halved me-1"></i>Do not paste your service_role key here. Use only the anon key.</div>
            </div>
          </div>
          <div class="modal-footer bg-light rounded-bottom-4">
            <button type="button" class="btn btn-sm btn-secondary rounded-pill px-3" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-sm btn-primary rounded-pill px-3" id="save-config-btn">Save & Reload</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container);

  document.getElementById('modal-supabase-url').value = currentUrl;
  document.getElementById('modal-supabase-key').value = currentKey;

  // Initialize Bootstrap modal
  const modalEl = document.getElementById('configModal');
  const modal = new window.bootstrap.Modal(modalEl);
  modal.show();

  document.getElementById('save-config-btn').addEventListener('click', () => {
    const url = document.getElementById('modal-supabase-url').value.trim();
    const key = document.getElementById('modal-supabase-key').value.trim();

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      parsedUrl = null;
    }

    if (!parsedUrl || parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co') || !key) {
      alert('Enter a valid HTTPS Supabase project URL and anon public key.');
      return;
    }

    localStorage.setItem('APP_SUPABASE_URL', url);
    localStorage.setItem('APP_SUPABASE_ANON_KEY', key);
    window.location.reload();
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    container.remove();
  });
}
