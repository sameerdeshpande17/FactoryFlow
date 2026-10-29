const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../inventory.js');

test('parses formatted stock quantities and normalizes equivalent units', () => {
  assert.deepEqual(inventory.parseQuantity('3,840 kg'), {
    quantity: 3840,
    unit: 'kg',
    unitLabel: 'kg'
  });
  assert.equal(inventory.normalizeUnit('KILOGRAMS'), 'kg');
  assert.equal(inventory.normalizeUnit('sheets'), 'sheets');
  assert.equal(inventory.parseQuantity('not a quantity'), null);
});

test('receiving material increments stock and recalculates stock health', () => {
  const materials = [{
    sku: 'RM-0001',
    item: 'Water-based ink · black',
    category: 'Ink',
    location: 'C-18',
    onHand: '24 kg',
    capacity: 100,
    stock: 24,
    status: 'Low stock'
  }];

  const result = inventory.receiveIntoStock(materials, 'Water-based ink · black', 10, 'kgs');

  assert.equal(result.created, false);
  assert.equal(result.previousOnHand, '24 kg');
  assert.equal(result.material.onHand, '34 kg');
  assert.equal(result.material.stock, 34);
  assert.equal(result.material.status, 'In stock');
  assert.equal(materials.length, 1);
});

test('receiving material refreshes critical and low-stock signals when relevant', () => {
  const materials = [{
    sku: 'RM-0001',
    item: 'Packaging adhesive',
    category: 'Adhesive',
    location: 'D-09',
    onHand: '10 kg',
    capacity: 100,
    stock: 10,
    status: 'Critical'
  }];

  inventory.receiveIntoStock(materials, 'Packaging adhesive', 8, 'kg');
  assert.equal(materials[0].stock, 18);
  assert.equal(materials[0].status, 'Low stock');
});

test('rejects a unit mismatch without changing the on-hand quantity', () => {
  const materials = [{
    sku: 'RM-0001',
    item: 'Mono-carton board',
    category: 'Board',
    location: 'B-22',
    onHand: '640 sheets',
    capacity: 1000,
    stock: 64,
    status: 'In stock'
  }];

  assert.throws(
    () => inventory.receiveIntoStock(materials, 'Mono-carton board', 10, 'kg'),
    /Unit mismatch/i
  );
  assert.equal(materials[0].onHand, '640 sheets');
  assert.equal(materials[0].stock, 64);
});

test('creates a new inventory item when receiving a material not yet tracked', () => {
  const materials = [{
    sku: 'RM-0142',
    item: 'Kraft paper · 180 GSM',
    category: 'Paper',
    location: 'A-12',
    onHand: '3,840 kg',
    stock: 82,
    status: 'In stock'
  }];

  const result = inventory.receiveIntoStock(materials, 'Corrugated paper liner', 250, 'kg');

  assert.equal(result.created, true);
  assert.equal(result.material.sku, 'RM-0143');
  assert.equal(result.material.category, 'Paper');
  assert.equal(result.material.location, 'Receiving');
  assert.equal(result.material.onHand, '250 kg');
  assert.equal(materials.length, 2);
});

test('rejects zero, negative, or non-numeric receipt quantities', () => {
  const materials = [];
  for (const quantity of [0, -2, 'invalid', NaN, Infinity]) {
    assert.throws(
      () => inventory.receiveIntoStock(materials, 'Kraft paper', quantity, 'kg'),
      /greater than zero/i
    );
  }
  assert.equal(materials.length, 0);
});


test('consuming material reduces on-hand quantity and recalculates stock health', () => {
  const materials = [{
    sku: 'RM-0001',
    item: 'Water-based ink · black',
    category: 'Ink',
    location: 'C-18',
    onHand: '34 kg',
    capacity: 100,
    stock: 34,
    status: 'In stock'
  }];

  const result = inventory.consumeFromStock(materials, 'RM-0001', 10, 'kg');

  assert.equal(result.previousOnHand, '34 kg');
  assert.equal(result.onHand, '24 kg');
  assert.equal(result.usedQuantity, 10);
  assert.equal(result.material.stock, 24);
  assert.equal(result.material.status, 'Low stock');
});

test('rejects consumption greater than available stock without mutation', () => {
  const materials = [{
    sku: 'RM-0001',
    item: 'Packaging adhesive',
    onHand: '5 kg',
    capacity: 20,
    stock: 25,
    status: 'Critical'
  }];
  assert.throws(
    () => inventory.consumeFromStock(materials, 'RM-0001', 6, 'kg'),
    /Insufficient stock/i
  );
  assert.equal(materials[0].onHand, '5 kg');
  assert.equal(materials[0].stock, 25);
});

test('rejects a consumption unit mismatch without changing inventory', () => {
  const materials = [{
    sku: 'RM-0001',
    item: 'Mono-carton board',
    onHand: '640 sheets',
    capacity: 1000,
    stock: 64,
    status: 'In stock'
  }];
  assert.throws(
    () => inventory.consumeFromStock(materials, 'RM-0001', 5, 'kg'),
    /Unit mismatch/i
  );
  assert.equal(materials[0].onHand, '640 sheets');
});

test('consuming all available stock preserves zero stock and marks the material critical', () => {
  const materials = [{
    sku: 'RM-0001',
    item: 'Water-based ink',
    onHand: '12 kg',
    capacity: 100,
    stock: 12,
    status: 'Critical'
  }];
  const result = inventory.consumeFromStock(materials, 'RM-0001', 12, 'kg');
  assert.equal(result.onHand, '0 kg');
  assert.equal(materials[0].stock, 0);
  assert.equal(materials[0].status, 'Critical');
});

test('rejects a material SKU that does not exist', () => {
  assert.throws(
    () => inventory.consumeFromStock([], 'RM-MISSING', 1, 'kg'),
    /Select a material/i
  );
});
