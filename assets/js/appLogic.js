// Shared, side-effect-free application rules.
// Keep this module browser/Node compatible so the business rules can be tested.

export const ORDER_STATUS_SEQUENCES = Object.freeze({
  'Dine In': Object.freeze(['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed']),
  Pickup: Object.freeze(['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed']),
  Delivery: Object.freeze(['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Completed'])
});

const CANCELLABLE_STATUSES = new Set(['Pending', 'Confirmed', 'Preparing']);
const DEFAULT_ORDER_TYPE = 'Dine In';
const DEFAULT_PAYMENT_METHOD = 'Cash';

export function getOrderStatusSequence(orderType) {
  return ORDER_STATUS_SEQUENCES[orderType] || ORDER_STATUS_SEQUENCES[DEFAULT_ORDER_TYPE];
}

export function getAllowedNextStatuses(orderType, currentStatus) {
  const sequence = getOrderStatusSequence(orderType);
  const currentIndex = sequence.indexOf(currentStatus);

  if (currentIndex < 0 || ['Completed', 'Cancelled'].includes(currentStatus)) {
    return [];
  }

  const allowed = [];
  if (currentIndex < sequence.length - 1) {
    allowed.push(sequence[currentIndex + 1]);
  }
  if (CANCELLABLE_STATUSES.has(currentStatus)) {
    allowed.push('Cancelled');
  }
  return allowed;
}

export function isAllowedOrderTransition(orderType, currentStatus, nextStatus) {
  return currentStatus === nextStatus || getAllowedNextStatuses(orderType, currentStatus).includes(nextStatus);
}

export function getSafeRedirect(value, fallback = null) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  if (/[\u0000-\u001f\u007f\\]/.test(value)) {
    return fallback;
  }

  try {
    const base = 'https://baper-hotel.local';
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getPathWithSearch(locationLike) {
  const pathname = locationLike?.pathname || '/';
  const search = locationLike?.search || '';
  return `${pathname}${search}`;
}

export function getDhakaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function normalizeOrderPreferences(value = {}) {
  const orderType = Object.hasOwn(ORDER_STATUS_SEQUENCES, value.orderType)
    ? value.orderType
    : DEFAULT_ORDER_TYPE;
  const paymentMethod = ['Cash', 'Debit Card', 'E-Wallet'].includes(value.paymentMethod)
    ? value.paymentMethod
    : DEFAULT_PAYMENT_METHOD;

  return { orderType, paymentMethod };
}

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getSafeImageUrl(value, fallback = '') {
  if (typeof value !== 'string' || !value.trim()) return fallback;

  try {
    const parsed = new URL(value, 'https://baper-hotel.local');
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallback;
    return value.trim();
  } catch {
    return fallback;
  }
}
