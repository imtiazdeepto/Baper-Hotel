import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeHtml,
  getAllowedNextStatuses,
  getDhakaDateString,
  getSafeRedirect,
  isAllowedOrderTransition,
  normalizeOrderPreferences
} from '../assets/js/appLogic.js';

test('redirect validation accepts only local application paths', () => {
  assert.equal(getSafeRedirect('/checkout.html?step=payment'), '/checkout.html?step=payment');
  assert.equal(getSafeRedirect('https://malicious.example'), null);
  assert.equal(getSafeRedirect('//malicious.example'), null);
  assert.equal(getSafeRedirect('/\\malicious.example'), null);
  assert.equal(getSafeRedirect('javascript:alert(1)'), null);
});

test('delivery and pickup use different status sequences', () => {
  assert.deepEqual(getAllowedNextStatuses('Delivery', 'Ready'), ['Out for Delivery']);
  assert.deepEqual(getAllowedNextStatuses('Pickup', 'Ready'), ['Completed']);
  assert.equal(isAllowedOrderTransition('Delivery', 'Ready', 'Completed'), false);
  assert.equal(isAllowedOrderTransition('Delivery', 'Out for Delivery', 'Completed'), true);
  assert.deepEqual(getAllowedNextStatuses('Dine In', 'Preparing'), ['Ready', 'Cancelled']);
  assert.deepEqual(getAllowedNextStatuses('Dine In', 'Ready'), ['Completed']);
});

test('Dhaka business date does not use the UTC calendar date', () => {
  const lateUtc = new Date('2026-11-11T19:30:00.000Z');
  assert.equal(getDhakaDateString(lateUtc), '2026-11-12');
});

test('preferences are constrained to supported values', () => {
  assert.deepEqual(normalizeOrderPreferences({ orderType: 'Delivery', paymentMethod: 'E-Wallet' }), {
    orderType: 'Delivery',
    paymentMethod: 'E-Wallet'
  });
  assert.deepEqual(normalizeOrderPreferences({ orderType: 'Teleport', paymentMethod: 'Crypto' }), {
    orderType: 'Dine In',
    paymentMethod: 'Cash'
  });
});

test('HTML escaping neutralizes stored cart markup', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml('"quoted" & \'single\''), '&quot;quoted&quot; &amp; &#039;single&#039;');
});
