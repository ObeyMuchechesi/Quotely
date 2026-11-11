import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateQuote } from './quote.js';

test('calculates line item totals, tax, and grand total in cents', () => {
  const quote = calculateQuote({
    jobDescription: 'Install two fixtures',
    lineItems: [
      { description: 'Fixture installation', quantity: 2, unitPrice: 125.5 },
      { description: 'Supplies', quantity: 1, unitPrice: 19.99 },
    ],
    notes: '',
  }, 'USD', 8.25);

  assert.equal(quote.subtotal, 270.99);
  assert.equal(quote.tax, 22.36);
  assert.equal(quote.total, 293.35);
  assert.deepEqual(quote.lineItems.map((item) => item.total), [251, 19.99]);
});

test('supports zero tax without changing the quote subtotal', () => {
  const quote = calculateQuote({
    jobDescription: 'Repair a leaking tap',
    lineItems: [{ description: 'Repair', quantity: 1, unitPrice: 85 }],
    notes: 'Price is an estimate.',
  }, 'GBP', 0);

  assert.equal(quote.currency, 'GBP');
  assert.equal(quote.tax, 0);
  assert.equal(quote.total, 85);
});
