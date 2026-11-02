const test = require('node:test');
const assert = require('node:assert/strict');
const facilities = require('../facilities.js');

function emptyStore() {
  return {
    workspace: { name: 'Northstar Works', cluster: 'Packaging', locale: 'en-IN' },
    facilities: [],
    quotes: [], jobs: [], purchases: [], materials: [], deliveries: [],
    receipts: [], movements: [], requirements: [], workers: [], schedules: [],
    productionLogs: [], qcInspections: [], reworkLogs: [], downtimeLogs: [],
    users: [], auditLogs: []
  };
}

test('migrates a legacy single-factory workspace without losing records', () => {
  const store = emptyStore();
  store.jobs.push({ id: 'JB-1', customer: 'North Foods' });
  store.materials.push({ sku: 'RM-1', item: 'Kraft paper' });
  store.workers.push({ id: 'WRK-1', name: 'Ravi', active: true });
  store.users.push({ id: 'USR-1', role: 'manager' }, { id: 'USR-2', role: 'admin' });
  const result = facilities.ensureFacilityState(store);
  assert.equal(result.changed, true);
  assert.equal(store.facilities.length, 1);
  assert.equal(store.facilities[0].id, 'FAC-001');
  assert.equal(store.facilities[0].name, 'Northstar Works');
  assert.equal(store.workspace.defaultFacilityId, 'FAC-001');
  assert.equal(store.jobs[0].facilityId, 'FAC-001');
  assert.equal(store.materials[0].facilityId, 'FAC-001');
  assert.equal(store.workers[0].facilityId, 'FAC-001');
  assert.deepEqual(store.users[0].facilityIds, ['FAC-001']);
  assert.deepEqual(store.users[1].facilityIds, []);
});

test('migration is idempotent after the first facility assignment', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  const second = facilities.ensureFacilityState(store);
  assert.equal(second.changed, false);
  assert.equal(store.facilities.length, 1);
});

test('migrates an inactive or missing default to an active facility', () => {
  const store = emptyStore();
  store.facilities = [
    { id: 'FAC-001', code: 'MAIN', name: 'Main', active: false, isDefault: true },
    { id: 'FAC-002', code: 'PUNE', name: 'Pune', active: true, isDefault: false }
  ];
  store.workspace.defaultFacilityId = 'FAC-001';
  store.jobs.push({ id: 'JB-LEGACY', item: 'Legacy job' });
  const result = facilities.ensureFacilityState(store);
  assert.equal(result.defaultFacility.id, 'FAC-002');
  assert.equal(store.workspace.defaultFacilityId, 'FAC-002');
  assert.equal(store.facilities[0].isDefault, false);
  assert.equal(store.facilities[1].isDefault, true);
  assert.equal(store.jobs[0].facilityId, 'FAC-002');
  assert.equal(result.changed, true);
});

test('creates facilities with normalized unique codes and stable IDs', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  const first = facilities.createFacility({ name: 'Pune Plant', code: 'pune-01', city: 'Pune' }, store.facilities);
  assert.match(first.id, /^FAC-[A-F0-9]{10}$/);
  assert.equal(first.code, 'PUNE-01');
  assert.equal(first.city, 'Pune');
  assert.equal(first.active, true);
  assert.throws(() => facilities.createFacility({ name: 'Duplicate', code: 'PUNE-01' }, store.facilities), /already exists/i);
  assert.throws(() => facilities.createFacility({ name: '', code: 'X' }, store.facilities), /facility name/i);
});

test('validates facility codes and field lengths', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  assert.throws(() => facilities.createFacility({ name: 'Pune', code: 'x' }, store.facilities), /facility code/i);
  assert.throws(() => facilities.createFacility({ name: 'P'.repeat(101), code: 'PUNE' }, store.facilities), /facility name/i);
  assert.throws(() => facilities.createFacility({ name: 'Pune', code: 'PUNE', address: 'A'.repeat(251) }, store.facilities), /too long/i);
});

test('updates facility details and protects the default facility from deactivation', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  const main = store.facilities[0];
  const pune = facilities.createFacility({ name: 'Pune Plant', code: 'PUNE' }, store.facilities);
  assert.throws(() => facilities.updateFacility(main.id, { active: false }, store.facilities, store.workspace), /default facility/i);
  facilities.updateFacility(pune.id, { city: 'Pune', address: 'Industrial Area' }, store.facilities, store.workspace);
  assert.equal(pune.city, 'Pune');
  assert.equal(pune.address, 'Industrial Area');
  assert.equal(pune.active, true);
});

test('changes the default facility only to an active facility', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  const main = store.facilities[0];
  const pune = facilities.createFacility({ name: 'Pune Plant', code: 'PUNE' }, store.facilities);
  facilities.setDefaultFacility(pune.id, store.facilities, store.workspace);
  assert.equal(store.workspace.defaultFacilityId, pune.id);
  assert.equal(main.isDefault, false);
  assert.equal(pune.isDefault, true);
  facilities.updateFacility(main.id, { active: false }, store.facilities, store.workspace);
  assert.throws(() => facilities.setDefaultFacility(main.id, store.facilities, store.workspace), /active facility/i);
});

test('prevents deactivating the last active facility', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  const main = store.facilities[0];
  const side = facilities.createFacility({ name: 'Side Plant', code: 'SIDE' }, store.facilities);
  assert.throws(() => facilities.updateFacility(main.id, { isDefault: false }, store.facilities, store.workspace), /choose another active facility/i);
  facilities.setDefaultFacility(side.id, store.facilities, store.workspace);
  facilities.updateFacility(main.id, { active: false }, store.facilities, store.workspace);
  assert.throws(() => facilities.updateFacility(side.id, { active: false }, store.facilities, store.workspace), /at least one active facility/i);
});

test('resolves admin, manager, supervisor and worker facility scopes', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  const main = store.facilities[0];
  const pune = facilities.createFacility({ name: 'Pune Plant', code: 'PUNE' }, store.facilities);
  store.workers.push({ id: 'WRK-1', name: 'Worker', facilityId: main.id, active: true });
  assert.deepEqual(facilities.allowedFacilityIds({ role: 'admin' }, store.facilities, store), [main.id, pune.id]);
  assert.deepEqual(facilities.allowedFacilityIds({ role: 'manager', facilityIds: [pune.id] }, store.facilities, store), [pune.id]);
  assert.deepEqual(facilities.allowedFacilityIds({ role: 'supervisor', facilityIds: [main.id, pune.id] }, store.facilities, store), [main.id, pune.id]);
  assert.deepEqual(facilities.allowedFacilityIds({ role: 'worker', workerId: 'WRK-1', facilityIds: [main.id, pune.id] }, store.facilities, store), [main.id]);
  assert.equal(facilities.resolveFacility({ role: 'manager', facilityIds: [pune.id] }, store.facilities, store, main.id), null);
  assert.equal(facilities.resolveFacility({ role: 'manager', facilityIds: [pune.id] }, store.facilities, store, pune.id).id, pune.id);
});

test('filters workspace records to one facility and does not leak other facility records', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  const main = store.facilities[0];
  const pune = facilities.createFacility({ name: 'Pune Plant', code: 'PUNE' }, store.facilities);
  store.jobs.push({ id: 'JB-MAIN', facilityId: main.id }, { id: 'JB-PUNE', facilityId: pune.id });
  const projected = facilities.projectStoreForFacility(store, pune.id);
  assert.deepEqual(projected.jobs.map((job) => job.id), ['JB-PUNE']);
});

test('merges facility collections without overwriting another facility', () => {
  const main = 'FAC-001';
  const pune = 'FAC-002';
  const existing = [
    { id: 'JB-MAIN', facilityId: main, item: 'Main job' },
    { id: 'JB-PUNE', facilityId: pune, item: 'Pune job' }
  ];
  const merged = facilities.mergeFacilityCollection(existing, [
    { id: 'JB-PUNE', item: 'Updated Pune job' },
    { id: 'JB-PUNE-2', item: 'New Pune job' }
  ], pune);
  assert.deepEqual(merged.map((item) => item.id).sort(), ['JB-MAIN', 'JB-PUNE', 'JB-PUNE-2']);
  assert.equal(merged.find((item) => item.id === 'JB-MAIN').item, 'Main job');
  assert.equal(merged.find((item) => item.id === 'JB-PUNE').item, 'Updated Pune job');
  assert.equal(merged.find((item) => item.id === 'JB-PUNE-2').facilityId, pune);
});

test('rejects cross-facility record movement, duplicate IDs and invalid records', () => {
  const existing = [{ id: 'JB-MAIN', facilityId: 'FAC-001' }];
  assert.throws(() => facilities.mergeFacilityCollection(existing, [{ id: 'JB-MAIN' }], 'FAC-002'), /already belongs to another facility/i);
  assert.throws(() => facilities.mergeFacilityCollection([], [{ id: 'JB-1', facilityId: 'FAC-001' }], 'FAC-002'), /cannot move records across facilities/i);
  assert.throws(() => facilities.mergeFacilityCollection([], [{ id: 'JB-1' }, { id: 'JB-1' }], 'FAC-002'), /duplicate record ID/i);
  assert.throws(() => facilities.mergeFacilityCollection([], [{ item: 'missing id' }], 'FAC-002'), /valid ID/i);
});

test('summarizes operating metrics for a single facility only', () => {
  const store = emptyStore();
  facilities.ensureFacilityState(store);
  const main = store.facilities[0];
  const pune = facilities.createFacility({ name: 'Pune Plant', code: 'PUNE', city: 'Pune' }, store.facilities);
  store.jobs.push(
    { id: 'JB-1', facilityId: main.id, status: 'In production', qty: 100 },
    { id: 'JB-2', facilityId: pune.id, status: 'In production', qty: 200 }
  );
  store.productionLogs.push(
    { id: 'PR-1', facilityId: main.id, producedQty: 40, actualHours: 4 },
    { id: 'PR-2', facilityId: pune.id, producedQty: 90, actualHours: 6 }
  );
  store.workers.push({ id: 'WRK-1', facilityId: main.id, active: true }, { id: 'WRK-2', facilityId: pune.id, active: false });
  store.materials.push({ sku: 'RM-1', facilityId: main.id, status: 'Critical' }, { sku: 'RM-2', facilityId: pune.id, status: 'Low stock' });
  store.downtimeLogs.push({ id: 'DT-1', facilityId: main.id, durationMinutes: 30 }, { id: 'DT-2', facilityId: pune.id, durationMinutes: 60 });
  const mainSummary = facilities.summarizeFacility(store, main);
  const puneSummary = facilities.summarizeFacility(store, pune);
  assert.equal(mainSummary.activeJobs, 1);
  assert.equal(mainSummary.producedQty, 40);
  assert.equal(mainSummary.unitsPerActualHour, 10);
  assert.equal(mainSummary.activeWorkers, 1);
  assert.equal(mainSummary.stockAlerts, 1);
  assert.equal(mainSummary.downtimeHours, 0.5);
  assert.equal(puneSummary.activeJobs, 1);
  assert.equal(puneSummary.producedQty, 90);
  assert.equal(puneSummary.downtimeHours, 1);
});
