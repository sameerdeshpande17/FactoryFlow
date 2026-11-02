const test = require('node:test');
const assert = require('node:assert/strict');
const machines = require('../machines.js');

test('creates machine profiles with normalized skills and a stable identifier', () => {
  const records = [];
  const machine = machines.createMachine(records, {
    code: 'press-01',
    name: 'Flexo Press 01',
    type: 'Flexographic printer',
    location: 'Shop floor A',
    capacityHoursPerDay: 16,
    supportedSkills: ['Flexo printing', 'Ink setup', 'flexo printing']
  });
  assert.equal(machine.id, 'MCH-101');
  assert.equal(machine.code, 'PRESS-01');
  assert.deepEqual(machine.supportedSkills, ['Flexo printing', 'Ink setup']);
  assert.equal(machine.active, true);
  assert.equal(records.length, 1);
});

test('rejects duplicate machine codes and invalid daily capacity', () => {
  const records = [];
  machines.createMachine(records, { code: 'CUT-01', name: 'Cutter', capacityHoursPerDay: 8 });
  assert.throws(() => machines.createMachine(records, { code: 'cut-01', name: 'Other cutter', capacityHoursPerDay: 8 }), /already exists/i);
  assert.throws(() => machines.createMachine(records, { code: 'CUT-02', name: 'Cutter 2', capacityHoursPerDay: 25 }), /between 0.25 and 24/i);
  assert.throws(() => machines.createMachine(records, { code: 'C', name: 'Bad code', capacityHoursPerDay: 8 }), /machine code/i);
});

test('updates machine metadata without replacing its identity', () => {
  const records = [];
  const created = machines.createMachine(records, { code: 'LAM-01', name: 'Lamination line', capacityHoursPerDay: 8 });
  const updated = machines.updateMachine(records, created.id, { name: 'Lamination line 2', active: false });
  assert.equal(updated.id, created.id);
  assert.equal(updated.code, 'LAM-01');
  assert.equal(updated.name, 'Lamination line 2');
  assert.equal(updated.active, false);
});

test('validates and respects inclusive maintenance windows', () => {
  const records = [];
  const machine = machines.createMachine(records, { code: 'DIE-01', name: 'Die cutter', capacityHoursPerDay: 8 });
  const window = machines.addMaintenanceWindow(records, machine.id, {
    startDate: '2026-11-04',
    endDate: '2026-11-05',
    reason: 'Preventive maintenance'
  });
  assert.equal(machines.isAvailableOn(machine, '2026-11-03'), true);
  assert.equal(machines.isAvailableOn(machine, '2026-11-04'), false);
  assert.equal(machines.isAvailableOn(machine, '2026-11-05'), false);
  assert.equal(machines.isAvailableOn(machine, '2026-11-06'), true);
  machines.removeMaintenanceWindow(records, machine.id, window.id);
  assert.equal(machines.isAvailableOn(machine, '2026-11-04'), true);
  assert.throws(() => machines.addMaintenanceWindow(records, machine.id, {
    startDate: '2026-11-06', endDate: '2026-11-05', reason: 'Invalid range'
  }), /valid maintenance start/i);
});

test('inactive machines and invalid dates are never available', () => {
  const records = [];
  const machine = machines.createMachine(records, { code: 'PACK-01', name: 'Packer', capacityHoursPerDay: 8 });
  assert.equal(machines.isAvailableOn({ ...machine, active: false }, '2026-11-02'), false);
  assert.equal(machines.isAvailableOn(machine, '2026-02-30'), false);
});
