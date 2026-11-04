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
  assert.equal(machine.idealUnitsPerHour, 0);
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

test('validates and persists an ideal machine throughput rate', () => {
  const records = [];
  const machine = machines.createMachine(records, {
    code: 'PRESS-02', name: 'Press 02', capacityHoursPerDay: 8, idealUnitsPerHour: 125.5
  });
  assert.equal(machine.idealUnitsPerHour, 125.5);
  const updated = machines.updateMachine(records, machine.id, { idealUnitsPerHour: 140 });
  assert.equal(updated.idealUnitsPerHour, 140);
  assert.throws(() => machines.updateMachine(records, machine.id, { idealUnitsPerHour: -1 }), /ideal output rate/i);
  assert.throws(() => machines.updateMachine(records, machine.id, { idealUnitsPerHour: 1000001 }), /ideal output rate/i);
});

test('validates machine preventive service intervals and reminder lead times', () => {
  const records = [];
  const machine = machines.createMachine(records, {
    code: 'PRESS-03',
    name: 'Press 03',
    capacityHoursPerDay: 8,
    serviceIntervalHours: 500,
    serviceIntervalDays: 90,
    serviceAlertLeadHours: 20,
    serviceAlertLeadDays: 10
  });
  assert.equal(machine.serviceIntervalHours, 500);
  assert.equal(machine.serviceIntervalDays, 90);
  assert.equal(machine.serviceAlertLeadHours, 20);
  assert.throws(() => machines.updateMachine(records, machine.id, { serviceIntervalHours: -1 }), /maintenance intervals/i);
  assert.throws(() => machines.updateMachine(records, machine.id, { serviceIntervalDays: 4000 }), /maintenance intervals/i);
});

test('records completed machine service with facility identity and audit-friendly fields', () => {
  const machineList = [];
  const machine = machines.createMachine(machineList, {
    code: 'LAM-03', name: 'Laminator 03', capacityHoursPerDay: 8
  });
  machine.facilityId = 'FAC-001';
  const records = [];
  const record = machines.recordService(records, machineList, machine.id, {
    serviceDate: new Date().toISOString().slice(0, 10),
    serviceType: 'Preventive service',
    performedBy: 'Maintenance technician',
    notes: 'Lubricated rollers and checked belt tension'
  }, { id: 'USR-1', name: 'Supervisor' });
  assert.equal(record.id, 'SRV-101');
  assert.equal(record.machineId, machine.id);
  assert.equal(record.facilityId, 'FAC-001');
  assert.equal(record.performedBy, 'Maintenance technician');
  assert.equal(record.createdBy, 'USR-1');
  assert.equal(records.length, 1);
  assert.throws(() => machines.recordService(records, machineList, machine.id, {
    serviceDate: '2999-01-01', serviceType: 'Inspection', performedBy: 'Tech'
  }), /not in the future/i);
  assert.throws(() => machines.recordService(records, machineList, 'MCH-MISSING', {
    serviceDate: new Date().toISOString().slice(0, 10), serviceType: 'Inspection', performedBy: 'Tech'
  }), /not found/i);
});

test('builds machine service status and transparent health risk from schedule usage and downtime', () => {
  const health = machines.buildMachineHealth({
    asOfDate: '2026-11-03',
    lookbackDays: 90,
    machines: [
      {
        id: 'MCH-101', code: 'PRESS-01', name: 'Press 01', createdAt: '2026-01-01T00:00:00.000Z',
        serviceIntervalHours: 40, serviceIntervalDays: 60, serviceAlertLeadHours: 10, serviceAlertLeadDays: 7
      },
      {
        id: 'MCH-102', code: 'CUT-01', name: 'Cutter 01', createdAt: '2026-01-01T00:00:00.000Z',
        serviceIntervalDays: 30, serviceAlertLeadDays: 7
      },
      {
        id: 'MCH-103', code: 'PACK-01', name: 'Packer 01', createdAt: '2026-01-01T00:00:00.000Z'
      }
    ],
    schedules: [
      { id: 'SC-1', machineId: 'MCH-101', date: '2026-09-16', hours: 16 },
      { id: 'SC-2', machineId: 'MCH-101', date: '2026-09-20', hours: 24 }
    ],
    productionLogs: [
      { id: 'PR-1', scheduleId: 'SC-1', actualHours: 14 },
      { id: 'PR-2', scheduleId: 'SC-2', actualHours: 22 }
    ],
    maintenanceRecords: [
      { id: 'SRV-101', machineId: 'MCH-101', serviceDate: '2026-09-15', serviceType: 'Preventive service' },
      { id: 'SRV-102', machineId: 'MCH-102', serviceDate: '2026-10-01', serviceType: 'Inspection' }
    ],
    downtimeLogs: [
      { id: 'DT-1', machineId: 'MCH-101', startAt: '2026-10-01T08:00', durationMinutes: 90, reason: 'Breakdown' },
      { id: 'DT-2', machineId: 'MCH-101', startAt: '2026-10-15T08:00', durationMinutes: 60, reason: 'Mechanical failure' },
      { id: 'DT-3', machineId: 'MCH-101', startAt: '2026-10-20T08:00', durationMinutes: 60, reason: 'Repair' }
    ]
  });
  const press = health.machines.find((item) => item.machineId === 'MCH-101');
  const cutter = health.machines.find((item) => item.machineId === 'MCH-102');
  const packer = health.machines.find((item) => item.machineId === 'MCH-103');
  assert.equal(press.usageHoursSinceService, 36);
  assert.equal(press.hoursUntilDue, 4);
  assert.equal(press.serviceStatus, 'Due soon');
  assert.equal(press.downtimeEvents, 3);
  assert.equal(press.downtimeHours, 3.5);
  assert.equal(press.breakdownEvents, 3);
  assert.equal(press.riskScore, 71);
  assert.equal(press.riskLevel, 'High');
  assert.equal(cutter.serviceStatus, 'Overdue');
  assert.equal(packer.serviceStatus, 'Not configured');
  assert.equal(health.summary.overdueCount, 1);
  assert.equal(health.summary.dueSoonCount, 1);
  assert.equal(health.summary.highRiskCount, 1);
  assert.equal(health.downtimeTrend.length, 3);
});

test('uses planned session hours when actual hours are missing and rejects invalid health dates', () => {
  const health = machines.buildMachineHealth({
    asOfDate: '2026-11-03',
    machines: [{
      id: 'MCH-1', name: 'Cutter', createdAt: '2026-10-01T00:00:00.000Z',
      serviceIntervalHours: 20, serviceAlertLeadHours: 5
    }],
    schedules: [{ id: 'SC-1', machineId: 'MCH-1', date: '2026-10-10', hours: 18 }],
    productionLogs: [],
    downtimeLogs: [],
    maintenanceRecords: []
  });
  assert.equal(health.machines[0].usageHoursSinceService, 18);
  assert.equal(health.machines[0].hoursUntilDue, 2);
  assert.equal(health.machines[0].serviceStatus, 'Due soon');
  assert.throws(() => machines.buildMachineHealth({ asOfDate: '2026-02-30' }), /valid YYYY-MM-DD/i);
});
