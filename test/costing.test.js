const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateJobCost } = require('../costing.js');

test('calculates gross profit and margin from revenue, material, worker and other costs', () => {
  const result = calculateJobCost(
    { id: 'JB-1', sellingValue: 1000, workerCost: 200, otherCost: 50 },
    [
      { id: 'MV-1', jobId: 'JB-1', type: 'Consumption', quantity: 10, unitCost: 30, costAmount: 300 },
      { id: 'MV-2', jobId: 'JB-OTHER', type: 'Consumption', quantity: 100, unitCost: 20, costAmount: 2000 }
    ]
  );
  assert.equal(result.revenue, 1000);
  assert.equal(result.materialCost, 300);
  assert.equal(result.workerCost, 200);
  assert.equal(result.otherCost, 50);
  assert.equal(result.knownCost, 550);
  assert.equal(result.profit, 450);
  assert.equal(result.marginPercent, 45);
  assert.equal(result.complete, true);
});

test('calculates material cost from a unit-cost snapshot when line total is absent', () => {
  const result = calculateJobCost(
    { id: 'JB-2', sellingValue: 1000, workerCost: 0, otherCost: 0 },
    [{ jobId: 'JB-2', direction: 'OUT', quantity: 2.5, unitCost: 12.4 }]
  );
  assert.equal(result.materialCost, 31);
  assert.equal(result.profit, 969);
  assert.equal(result.complete, true);
});

test('does not claim profit when any consumption entry is unpriced', () => {
  const result = calculateJobCost(
    { id: 'JB-3', sellingValue: 1000, workerCost: 100, otherCost: 0 },
    [
      { jobId: 'JB-3', type: 'Consumption', quantity: 2, unitCost: 5, costAmount: 10 },
      { jobId: 'JB-3', type: 'Consumption', quantity: 1, unitCost: null, costAmount: null }
    ]
  );
  assert.equal(result.materialCost, 10);
  assert.equal(result.unpricedMovements, 1);
  assert.equal(result.knownCost, 110);
  assert.equal(result.profit, null);
  assert.equal(result.marginPercent, null);
  assert.equal(result.complete, false);
});

test('does not claim profit when selling value is missing', () => {
  const result = calculateJobCost(
    { id: 'JB-4', workerCost: 20, otherCost: 5 },
    []
  );
  assert.equal(result.revenueConfigured, false);
  assert.equal(result.knownCost, 25);
  assert.equal(result.profit, null);
  assert.equal(result.complete, false);
});

test('handles zero revenue and zero-cost movements without dividing by zero', () => {
  const result = calculateJobCost(
    { id: 'JB-5', sellingValue: 0, workerCost: 0, otherCost: 0 },
    [{ jobId: 'JB-5', type: 'Consumption', quantity: 10, unitCost: 0, costAmount: 0 }]
  );
  assert.equal(result.profit, 0);
  assert.equal(result.marginPercent, null);
  assert.equal(result.complete, true);
});

test('ignores receipt movements and costs associated with other jobs', () => {
  const result = calculateJobCost(
    { id: 'JB-6', sellingValue: 500, workerCost: 0, otherCost: 0 },
    [
      { jobId: '', type: 'Receipt', direction: 'IN', quantity: 100, unitCost: 5, costAmount: 500 },
      { jobId: 'JB-OTHER', type: 'Consumption', direction: 'OUT', quantity: 5, unitCost: 20, costAmount: 100 }
    ]
  );
  assert.equal(result.materialCost, 0);
  assert.equal(result.profit, 500);
  assert.equal(result.complete, true);
});

test('rounds totals and margin to two decimal places', () => {
  const result = calculateJobCost(
    { id: 'JB-7', sellingValue: 10, workerCost: 0, otherCost: 0 },
    [{ jobId: 'JB-7', type: 'Consumption', quantity: 3, unitCost: 1.111, costAmount: 3.333 }]
  );
  assert.equal(result.materialCost, 3.33);
  assert.equal(result.profit, 6.67);
  assert.equal(result.marginPercent, 66.7);
});

test('invalid negative money values are treated as missing rather than negative cost', () => {
  const result = calculateJobCost(
    { id: 'JB-8', sellingValue: -100, workerCost: -5, otherCost: -2 },
    [{ jobId: 'JB-8', type: 'Consumption', quantity: 1, unitCost: -2, costAmount: -2 }]
  );
  assert.equal(result.revenueConfigured, false);
  assert.equal(result.workerCost, 0);
  assert.equal(result.otherCost, 0);
  assert.equal(result.profit, null);
  assert.equal(result.complete, false);
});
