import test from 'node:test';
import assert from 'node:assert/strict';
import { calcTotals } from '../utils/calc.js';
import { canTransition } from '../utils/stateMachine.js';
const lines = [{ price: 1000, qty: 2 }, { price: 450, qty: 1 }];
test('totals with tax', () => assert.deepEqual(calcTotals(lines, { taxRate: 16 }), { subtotal: 2450, discount: 0, tax: 392, total: 2842 }));
test('percent discount applies before tax', () => assert.deepEqual(calcTotals(lines, { discountType: 'percent', discountValue: 10, taxRate: 16 }), { subtotal: 2450, discount: 245, tax: 352.8, total: 2557.8 }));
test('fixed discount cannot exceed subtotal', () => assert.equal(calcTotals(lines, { discountType: 'fixed', discountValue: 99999 }).total, 0));
test('order state machine', () => {
  assert.ok(canTransition('confirmed', 'preparing'));
  assert.ok(!canTransition('confirmed', 'completed'));
  assert.ok(!canTransition('completed', 'cancelled'));
});
