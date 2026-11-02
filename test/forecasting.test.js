const test = require('node:test');
const assert = require('node:assert/strict');
const forecasting = require('../forecasting.js');

const now = new Date('2026-11-02T12:00:00.000Z');

function material(overrides = {}) {
  return {
    sku: 'RM-INK',
    item: 'Water-based ink',
    onHand: '50 kg',
    unitCost: 12,
    reorderLevel: 30,
    leadTimeDays: 5,
    safetyStockDays: 2,
    reviewPeriodDays: 7,
    minimumOrderQty: 25,
    orderMultiple: 10,
    preferredSupplier: 'Pioneer Inks',
    ...overrides
  };
}

function movementsFor(quantity = 10, days = 14, sku = 'RM-INK') {
  return Array.from({ length: days }, (_, index) => ({
    id: 'MV-' + index,
    materialSku: sku,
    type: 'Consumption',
    direction: 'OUT',
    quantity,
    unit: 'kg',
    createdAt: new Date(now.getTime() - (index + 0.5) * 24 * 60 * 60 * 1000).toISOString()
  }));
}

test('calculates a weighted daily demand rate from recent and lookback consumption', () => {
  const movements = [
    ...movementsFor(10, 30),
    { id: 'MV-OLD', materialSku: 'RM-INK', type: 'Consumption', direction: 'OUT', quantity: 900, unit: 'kg', createdAt: '2026-09-01T12:00:00.000Z' }
  ];
  const history = forecasting.buildMovementHistory(material(), movements, {
    now,
    lookbackDays: 30,
    recentDays: 7
  });
  assert.equal(history.movementCount, 30);
  assert.equal(history.totalQty, 300);
  assert.equal(history.recentQty, 70);
  assert.equal(history.dailyRate, 10);
  assert.equal(history.activeConsumptionDays, 30);
});

test('uses open confirmed and partially received purchase orders as incoming supply', () => {
  const purchases = [
    { id: 'PO-1', materialSku: 'RM-INK', quantity: 30, receivedQty: 10, unit: 'kg', status: 'Part received' },
    { id: 'PO-2', material: 'Water-based ink', quantity: 20, receivedQty: 0, unit: 'kg', status: 'Confirmed' },
    { id: 'PO-3', materialSku: 'RM-INK', quantity: 500, receivedQty: 0, unit: 'kg', status: 'Draft' },
    { id: 'PO-4', materialSku: 'RM-INK', quantity: 50, receivedQty: 60, unit: 'kg', status: 'In transit' },
    { id: 'PO-5', materialSku: 'RM-INK', quantity: 50, receivedQty: 0, unit: 'sheets', status: 'Confirmed' }
  ];
  const result = forecasting.openIncomingFor(material(), purchases);
  assert.equal(result.quantity, 40);
  assert.deepEqual(result.orders.map((item) => item.id), ['PO-1', 'PO-2']);
});

test('recommends demand through lead time, safety and review windows', () => {
  const report = forecasting.forecastInventory(
    [material()],
    movementsFor(10, 14),
    [{ id: 'PO-1', materialSku: 'RM-INK', quantity: 20, receivedQty: 10, unit: 'kg', status: 'Part received' }],
    { now, lookbackDays: 30 }
  );
  const item = report.items[0];
  assert.equal(item.averageDailyDemand, 6.8);
  assert.equal(item.leadDemand, 34);
  assert.equal(item.safetyStockQty, 13.6);
  assert.equal(item.reorderPoint, 47.6);
  assert.equal(item.targetStock, 95.2);
  assert.equal(item.incomingQty, 10);
  assert.equal(item.inventoryPosition, 60);
  assert.equal(item.status, 'Watch');
  assert.equal(item.recommendedOrderQty, 0);
  assert.equal(report.reorderCount, 0);
});

test('respects reorder trigger, minimum order quantity and order multiple', () => {
  const report = forecasting.forecastInventory(
    [material({ onHand: '20 kg' })],
    movementsFor(10, 14),
    [],
    { now, lookbackDays: 30 }
  );
  const item = report.items[0];
  assert.equal(item.averageDailyDemand, 6.8);
  assert.equal(item.reorderPoint, 47.6);
  assert.equal(item.targetStock, 95.2);
  assert.equal(item.status, 'Critical');
  assert.equal(item.recommendedOrderQty, 80);
  assert.equal(item.recommendedOrderCost, 960);
  assert.equal(item.preferredSupplier, 'Pioneer Inks');
});

test('uses the configured reorder level as a transparent fallback when there is no movement history', () => {
  const report = forecasting.forecastInventory(
    [material({ onHand: '5 kg', reorderLevel: 30 })],
    [],
    []
  );
  const item = report.items[0];
  assert.equal(item.dataQuality, 'No history');
  assert.equal(item.status, 'Reorder');
  assert.equal(item.reorderPoint, 30);
  assert.equal(item.recommendedOrderQty, 30);
  assert.equal(report.noHistoryCount, 1);
});

test('does not recommend a purchase when open incoming supply already covers the target', () => {
  const report = forecasting.forecastInventory(
    [material({ onHand: '25 kg' })],
    movementsFor(10, 14),
    [{ id: 'PO-1', materialSku: 'RM-INK', quantity: 100, receivedQty: 0, unit: 'kg', status: 'Confirmed' }],
    { now, lookbackDays: 30 }
  );
  assert.equal(report.items[0].incomingQty, 100);
  assert.equal(report.items[0].reorderRecommended, false);
  assert.equal(report.items[0].recommendedOrderQty, 0);
});

test('flags invalid stock and mismatched movement units instead of generating an unsafe order', () => {
  const invalid = forecasting.forecastInventory(
    [material({ onHand: 'unknown' })],
    movementsFor(10, 14),
    [],
    { now }
  );
  assert.equal(invalid.items[0].status, 'Needs data');
  assert.equal(invalid.items[0].recommendedOrderQty, 0);

  const mismatch = forecasting.forecastInventory(
    [material()],
    [{ id: 'MV-BAD', materialSku: 'RM-INK', type: 'Consumption', direction: 'OUT', quantity: 5, unit: 'sheets', createdAt: now.toISOString() }],
    [],
    { now }
  );
  assert.equal(mismatch.items[0].dataQuality, 'No history');
  assert.ok(mismatch.items[0].issues.some((issue) => /unit does not match/i.test(issue.message)));
});

test('validates supplier lead time, safety stock, order minimum and order multiple settings', () => {
  const current = material();
  assert.deepEqual(forecasting.validateSettings({
    leadTimeDays: 12,
    safetyStockDays: 4,
    reviewPeriodDays: 5,
    minimumOrderQty: 50,
    orderMultiple: 25,
    preferredSupplier: 'Kraftline Papers'
  }, current), {
    leadTimeDays: 12,
    safetyStockDays: 4,
    reviewPeriodDays: 5,
    minimumOrderQty: 50,
    orderMultiple: 25,
    preferredSupplier: 'Kraftline Papers'
  });
  assert.throws(() => forecasting.validateSettings({ leadTimeDays: -1 }, current), /lead time/i);
  assert.throws(() => forecasting.validateSettings({ safetyStockDays: 3.5 }, current), /whole number/i);
  assert.throws(() => forecasting.validateSettings({ minimumOrderQty: -2 }, current), /minimum order quantity/i);
  assert.throws(() => forecasting.validateSettings({ orderMultiple: 0 }, current), /order multiple/i);
  assert.throws(() => forecasting.validateSettings({ preferredSupplier: 'S'.repeat(121) }, current), /120 characters/i);
});
