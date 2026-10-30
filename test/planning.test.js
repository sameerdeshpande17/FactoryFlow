const test = require('node:test');
const assert = require('node:assert/strict');
const planning = require('../planning.js');

const jobs = [
  { id: 'JB-1', item: 'Carton run', customer: 'North Foods', status: 'In production' },
  { id: 'JB-2', item: 'Pouch run', customer: 'Fresh Foods', status: 'Material pending' },
  { id: 'JB-3', item: 'Delivered order', customer: 'Old Foods', status: 'Delivered' }
];
const materials = [
  { sku: 'RM-1', item: 'Kraft paper', onHand: '80 kg', stock: 80, capacity: 100, unitCost: 12 },
  { sku: 'RM-2', item: 'Carton board', onHand: '200 sheets', stock: 70, capacity: 285, unitCost: 4.5 }
];

test('upserts one requirement per job and material', () => {
  const requirements = [];
  const first = planning.upsertRequirement(requirements, jobs, materials, {
    jobId: 'JB-1', materialSku: 'RM-1', quantity: 40, unit: 'kgs', updatedAt: '2026-10-30T10:00:00.000Z'
  });
  const second = planning.upsertRequirement(requirements, jobs, materials, {
    jobId: 'JB-1', materialSku: 'RM-1', quantity: 55, unit: 'kg', updatedAt: '2026-10-30T11:00:00.000Z'
  });
  assert.equal(first.updated, false);
  assert.equal(second.updated, true);
  assert.equal(second.previousQuantity, 40);
  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].quantity, 55);
  assert.equal(requirements[0].unit, 'kg');
});

test('aggregates active jobs against shared stock counted once', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-1', quantity: 60, unit: 'kg' },
    { id: 'RQ-2', jobId: 'JB-2', materialSku: 'RM-1', quantity: 50, unit: 'kg' },
    { id: 'RQ-3', jobId: 'JB-3', materialSku: 'RM-1', quantity: 999, unit: 'kg' }
  ];
  const result = planning.calculatePlan(jobs, requirements, materials);
  assert.equal(result.activeJobCount, 2);
  assert.equal(result.requirementCount, 2);
  assert.equal(result.byMaterial.length, 1);
  assert.equal(result.byMaterial[0].requiredQty, 110);
  assert.equal(result.byMaterial[0].availableQty, 80);
  assert.equal(result.byMaterial[0].shortageQty, 30);
  assert.equal(result.byMaterial[0].estimatedShortageCost, 360);
  assert.equal(result.shortages.length, 1);
});

test('open purchase-order balance offsets a material shortage', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-1', quantity: 100, unit: 'kg' }
  ];
  const purchases = [
    { id: 'PO-1', materialSku: 'RM-1', quantity: 30, receivedQty: 10, unit: 'kg', status: 'Part received' }
  ];
  const result = planning.calculatePlan(jobs, requirements, materials, purchases);
  assert.equal(result.byMaterial[0].incomingQty, 20);
  assert.equal(result.byMaterial[0].projectedAvailableQty, 100);
  assert.equal(result.byMaterial[0].shortageQty, 0);
  assert.equal(result.shortages.length, 0);
});

test('cancelled and fully received purchase orders do not count as incoming', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-1', quantity: 100, unit: 'kg' }
  ];
  const purchases = [
    { id: 'PO-1', materialSku: 'RM-1', quantity: 50, receivedQty: 0, unit: 'kg', status: 'Cancelled' },
    { id: 'PO-2', materialSku: 'RM-1', quantity: 25, receivedQty: 25, unit: 'kg', status: 'Received' }
  ];
  const result = planning.calculatePlan(jobs, requirements, materials, purchases);
  assert.equal(result.byMaterial[0].incomingQty, 0);
  assert.equal(result.byMaterial[0].shortageQty, 20);
});

test('rejects inactive jobs, invalid quantities and incompatible units', () => {
  const requirements = [];
  assert.throws(() => planning.upsertRequirement(requirements, jobs, materials, {
    jobId: 'JB-3', materialSku: 'RM-1', quantity: 10, unit: 'kg'
  }), /active/i);
  assert.throws(() => planning.upsertRequirement(requirements, jobs, materials, {
    jobId: 'JB-1', materialSku: 'RM-1', quantity: 0, unit: 'kg'
  }), /greater than zero/i);
  assert.throws(() => planning.upsertRequirement(requirements, jobs, materials, {
    jobId: 'JB-1', materialSku: 'RM-2', quantity: 10, unit: 'kg'
  }), /Unit mismatch/i);
  assert.equal(requirements.length, 0);
});

test('reports issues for missing materials and legacy unit mismatches', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-MISSING', quantity: 5, unit: 'kg' },
    { id: 'RQ-2', jobId: 'JB-2', materialSku: 'RM-2', quantity: 20, unit: 'kg' }
  ];
  const result = planning.calculatePlan(jobs, requirements, materials);
  assert.equal(result.jobRequirements.length, 0);
  assert.equal(result.issues.length, 2);
  assert.match(result.issues[0].message, /missing from inventory/i);
  assert.match(result.issues[1].message, /unit mismatch/i);
});

test('keeps shortage cost unknown when material unit price is missing', () => {
  const noPriceMaterial = [{ sku: 'RM-9', item: 'Ink', onHand: '2 kg', stock: 20 }];
  const requirements = [
    { id: 'RQ-9', jobId: 'JB-1', materialSku: 'RM-9', quantity: 10, unit: 'kg' }
  ];
  const result = planning.calculatePlan(jobs, requirements, noPriceMaterial);
  assert.equal(result.byMaterial[0].shortageQty, 8);
  assert.equal(result.byMaterial[0].estimatedShortageCost, null);
});

test('matches open purchase orders by material name when older orders have no material SKU', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-1', quantity: 100, unit: 'kg' }
  ];
  const purchases = [
    { id: 'PO-1', material: 'Kraft paper', quantity: 10, receivedQty: 0, unit: 'kg', status: 'Confirmed' }
  ];
  const result = planning.calculatePlan(jobs, requirements, materials, purchases);
  assert.equal(result.byMaterial[0].incomingQty, 10);
  assert.equal(result.byMaterial[0].shortageQty, 10);
});

test('ignores over-received and incompatible-unit purchase orders for coverage', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-1', quantity: 100, unit: 'kg' }
  ];
  const purchases = [
    { id: 'PO-1', materialSku: 'RM-1', quantity: 80, receivedQty: 90, unit: 'kg', status: 'Part received' },
    { id: 'PO-2', materialSku: 'RM-1', quantity: 50, receivedQty: 0, unit: 'sheets', status: 'Confirmed' }
  ];
  const result = planning.calculatePlan(jobs, requirements, materials, purchases);
  assert.equal(result.byMaterial[0].incomingQty, 0);
  assert.equal(result.byMaterial[0].shortageQty, 20);
});

test('ignores requirements for closed jobs and keeps a clean empty plan', () => {
  const result = planning.calculatePlan(
    [{ id: 'JB-3', item: 'Done', customer: 'Old Foods', status: 'Delivered' }],
    [{ id: 'RQ-3', jobId: 'JB-3', materialSku: 'RM-1', quantity: 10, unit: 'kg' }],
    materials
  );
  assert.equal(result.activeJobCount, 0);
  assert.equal(result.requirementCount, 0);
  assert.deepEqual(result.byMaterial, []);
  assert.deepEqual(result.shortages, []);
});


test('draft purchase orders do not count as confirmed incoming supply', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-1', quantity: 100, unit: 'kg' }
  ];
  const purchases = [
    { id: 'PO-DRAFT', materialSku: 'RM-1', quantity: 40, receivedQty: 0, unit: 'kg', status: 'Draft' }
  ];
  const result = planning.calculatePlan(jobs, requirements, materials, purchases);
  assert.equal(result.byMaterial[0].incomingQty, 0);
  assert.equal(result.byMaterial[0].shortageQty, 20);
});


test('reduces a job material requirement by consumption already recorded for that job', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-1', quantity: 100, unit: 'kg' }
  ];
  const reducedMaterials = [
    { sku: 'RM-1', item: 'Kraft paper', onHand: '40 kg', stock: 40, capacity: 100, unitCost: 12 }
  ];
  const movements = [
    { id: 'MV-1', jobId: 'JB-1', materialSku: 'RM-1', type: 'Consumption', direction: 'OUT', quantity: 30, unit: 'kg' },
    { id: 'MV-2', jobId: 'JB-2', materialSku: 'RM-1', type: 'Consumption', direction: 'OUT', quantity: 15, unit: 'kg' },
    { id: 'MV-3', jobId: '', materialSku: 'RM-1', type: 'Receipt', direction: 'IN', quantity: 100, unit: 'kg' }
  ];
  const result = planning.calculatePlan(jobs, requirements, reducedMaterials, [], movements);
  assert.equal(result.jobRequirements[0].quantity, 100);
  assert.equal(result.jobRequirements[0].consumedQty, 30);
  assert.equal(result.jobRequirements[0].remainingQty, 70);
  assert.equal(result.byMaterial[0].plannedQty, 100);
  assert.equal(result.byMaterial[0].consumedQty, 30);
  assert.equal(result.byMaterial[0].requiredQty, 70);
  assert.equal(result.byMaterial[0].shortageQty, 30);
});

test('flags consumption movement unit mismatches rather than subtracting them', () => {
  const requirements = [
    { id: 'RQ-1', jobId: 'JB-1', materialSku: 'RM-1', quantity: 100, unit: 'kg' }
  ];
  const movements = [
    { id: 'MV-1', jobId: 'JB-1', materialSku: 'RM-1', type: 'Consumption', direction: 'OUT', quantity: 20, unit: 'sheets' }
  ];
  const result = planning.calculatePlan(jobs, requirements, materials, [], movements);
  assert.equal(result.jobRequirements[0].consumedQty, 0);
  assert.equal(result.byMaterial[0].requiredQty, 100);
  assert.ok(result.issues.some((issue) => /consumption unit mismatch/i.test(issue.message)));
});
