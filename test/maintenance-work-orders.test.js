const test = require('node:test');
const assert = require('node:assert/strict');
const workOrders = require('../maintenance-work-orders.js');

function machine() {
  return { id: 'MCH-101', code: 'PRESS-01', name: 'Press 01', facilityId: 'FAC-001' };
}

test('creates facility-linked maintenance work orders with validated priority and assignment', () => {
  const records = [];
  const order = workOrders.createWorkOrder(records, [machine()], {
    machineId: 'MCH-101',
    title: 'Investigate abnormal vibration',
    description: 'Check bearings and drive alignment.',
    type: 'Breakdown repair',
    priority: 'Urgent',
    dueDate: '2026-11-08',
    assignedTo: 'Ravi',
    laborHours: 3.5,
    laborRate: 400
  }, { id: 'USR-1', name: 'Manager' });
  assert.equal(order.id, 'MWO-101');
  assert.equal(order.facilityId, 'FAC-001');
  assert.equal(order.machineId, 'MCH-101');
  assert.equal(order.status, 'Assigned');
  assert.equal(order.laborHours, 3.5);
  assert.equal(order.laborCost, 1400);
  assert.equal(order.createdBy, 'USR-1');
  assert.deepEqual(order.partsUsed, []);
  assert.throws(() => workOrders.createWorkOrder(records, [machine()], {
    machineId: 'MCH-101', title: 'x', description: 'bad'
  }), /3–120 characters/i);
  assert.throws(() => workOrders.createWorkOrder(records, [], {
    machineId: 'MCH-MISSING', title: 'Repair motor', description: 'Check motor'
  }), /active facility/i);
});

test('validates allowed work order transitions and requires assignment and completion notes', () => {
  const orders = [];
  const order = workOrders.createWorkOrder(orders, [machine()], {
    machineId: 'MCH-101', title: 'Replace worn belt', description: 'Belt is slipping.'
  });
  assert.throws(() => workOrders.updateWorkOrder(orders, order.id, { status: 'Assigned' }), /assign a technician/i);
  workOrders.updateWorkOrder(orders, order.id, { assignedTo: 'Aman', status: 'Assigned' });
  assert.equal(order.status, 'Assigned');
  workOrders.updateWorkOrder(orders, order.id, { status: 'In progress' });
  assert.ok(order.startedAt);
  assert.throws(() => workOrders.updateWorkOrder(orders, order.id, { status: 'Completed' }), /completion notes/i);
  workOrders.updateWorkOrder(orders, order.id, { resolutionNotes: 'Replaced belt and verified alignment.' });
  workOrders.updateWorkOrder(orders, order.id, { status: 'Completed' }, { id: 'USR-2' });
  assert.equal(order.status, 'Completed');
  assert.ok(order.completedAt);
  assert.equal(order.completedBy, 'USR-2');
  assert.throws(() => workOrders.updateWorkOrder(orders, order.id, { priority: 'Urgent' }), /cannot be changed/i);
});

test('rejects invalid status transitions and due dates', () => {
  const orders = [];
  const order = workOrders.createWorkOrder(orders, [machine()], {
    machineId: 'MCH-101', title: 'Inspect press rollers', description: 'Inspect rollers.'
  });
  assert.throws(() => workOrders.updateWorkOrder(orders, order.id, { status: 'Completed' }), /cannot move/i);
  assert.throws(() => workOrders.updateWorkOrder(orders, order.id, { dueDate: '2026-02-30' }), /valid YYYY-MM-DD/i);
  assert.throws(() => workOrders.updateWorkOrder(orders, order.id, { status: 'Unknown' }), /supported work-order status/i);
});

test('records priced spare part usage and rejects unflagged parts or terminal work orders', () => {
  const orders = [];
  const order = workOrders.createWorkOrder(orders, [machine()], {
    machineId: 'MCH-101', title: 'Replace drive belt', description: 'Replace belt.'
  });
  const material = { sku: 'SP-001', item: 'Drive belt', maintenancePart: true, unitCost: 250 };
  const part = workOrders.recordPartUsage(orders, order.id, material, 2, 'pieces', { id: 'USR-1', name: 'Supervisor' });
  assert.equal(part.id, 'WOP-101');
  assert.equal(part.materialSku, 'SP-001');
  assert.equal(part.costAmount, 500);
  assert.equal(part.issuedBy, 'USR-1');
  assert.equal(order.partsUsed.length, 1);
  assert.throws(() => workOrders.recordPartUsage(orders, order.id, {
    sku: 'RM-1', item: 'Paper', maintenancePart: false
  }, 1, 'kg'), /marked as a maintenance spare part/i);
  workOrders.updateWorkOrder(orders, order.id, { assignedTo: 'Aman', status: 'Assigned' });
  workOrders.updateWorkOrder(orders, order.id, { status: 'In progress' });
  workOrders.updateWorkOrder(orders, order.id, { resolutionNotes: 'Repaired.' });
  workOrders.updateWorkOrder(orders, order.id, { status: 'Completed' });
  assert.throws(() => workOrders.recordPartUsage(orders, order.id, material, 1, 'pieces'), /completed or cancelled/i);
});

test('uses unpriced spare-part snapshots without inventing a cost', () => {
  const orders = [];
  const order = workOrders.createWorkOrder(orders, [machine()], {
    machineId: 'MCH-101', title: 'Inspect electrical panel', description: 'Check terminal.'
  });
  const part = workOrders.recordPartUsage(orders, order.id, {
    sku: 'SP-002', item: 'Fuse', maintenancePart: true
  }, 3, 'pieces');
  assert.equal(part.unitCost, null);
  assert.equal(part.costAmount, null);
});

test('updates labour estimates and recalculates repair labour cost', () => {
  const orders = [];
  const order = workOrders.createWorkOrder(orders, [machine()], {
    machineId: 'MCH-101', title: 'Repair drive motor', description: 'Replace motor bearings.'
  });
  workOrders.updateWorkOrder(orders, order.id, { laborHours: 2.5, laborRate: 600 });
  assert.equal(order.laborCost, 1500);
  workOrders.updateWorkOrder(orders, order.id, { laborHours: 4 });
  assert.equal(order.laborRate, 600);
  assert.equal(order.laborCost, 2400);
  assert.throws(() => workOrders.updateWorkOrder(orders, order.id, { laborRate: -1 }), /labour hours and hourly rate/i);
});

test('creates technician profiles with validated working days and unavailable dates', () => {
  const technicians = [];
  const created = workOrders.createTechnician(technicians, {
    name: 'Ravi Maintenance',
    specialty: 'Mechanical',
    capacityHoursPerDay: 8,
    hourlyRate: 450,
    workingDays: [1, 2, 3, 4, 5],
    unavailableDates: ['2026-11-07']
  }, { id: 'USR-1' });
  assert.equal(created.id, 'TECH-101');
  assert.deepEqual(created.workingDays, [1, 2, 3, 4, 5]);
  assert.throws(() => workOrders.createTechnician(technicians, {
    name: 'ravi maintenance', workingDays: [1]
  }), /already exists/i);
  assert.throws(() => workOrders.createTechnician(technicians, {
    name: 'No weekdays', workingDays: []
  }), /working day/i);
  assert.throws(() => workOrders.createTechnician(technicians, {
    name: 'Bad date', unavailableDates: ['2026-02-30']
  }), /unavailable dates/i);
});

test('schedules work orders without overlaps and enforces weekday, unavailable date and daily capacity', () => {
  const technicians = [];
  const technician = workOrders.createTechnician(technicians, {
    name: 'Ravi', capacityHoursPerDay: 4, hourlyRate: 500,
    workingDays: [1, 2, 3, 4, 5], unavailableDates: ['2026-11-09']
  });
  const orders = [];
  const machineList = [machine()];
  const first = workOrders.createWorkOrder(orders, machineList, {
    machineId: 'MCH-101', title: 'Repair press belt', description: 'Replace the worn belt.'
  });
  workOrders.scheduleWorkOrder(orders, technicians, first.id, {
    technicianId: technician.id, scheduledDate: '2026-11-06', startTime: '09:00', endTime: '11:00'
  }, { id: 'USR-1' });
  assert.equal(first.technicianId, technician.id);
  assert.equal(first.assignedTo, 'Ravi');
  assert.equal(first.scheduledHours, 2);
  assert.equal(first.laborRate, 500);
  assert.equal(first.laborCost, 1000);
  const second = workOrders.createWorkOrder(orders, machineList, {
    machineId: 'MCH-101', title: 'Inspect drive roller', description: 'Inspect the drive roller.'
  });
  assert.throws(() => workOrders.scheduleWorkOrder(orders, technicians, second.id, {
    technicianId: technician.id, scheduledDate: '2026-11-06', startTime: '10:00', endTime: '12:00'
  }), /overlaps work order/i);
  assert.throws(() => workOrders.scheduleWorkOrder(orders, technicians, second.id, {
    technicianId: technician.id, scheduledDate: '2026-11-06', startTime: '11:00', endTime: '14:00'
  }), /daily capacity would be exceeded/i);
  assert.throws(() => workOrders.scheduleWorkOrder(orders, technicians, second.id, {
    technicianId: technician.id, scheduledDate: '2026-11-07', startTime: '09:00', endTime: '10:00'
  }), /not scheduled to work/i);
  assert.throws(() => workOrders.scheduleWorkOrder(orders, technicians, second.id, {
    technicianId: technician.id, scheduledDate: '2026-11-09', startTime: '09:00', endTime: '10:00'
  }), /unavailable/i);
  assert.throws(() => workOrders.scheduleWorkOrder(orders, technicians, second.id, {
    technicianId: technician.id, scheduledDate: '2026-11-06', startTime: '15:00', endTime: '16:00'
  }), /daily capacity would be exceeded/i);
});

test('builds a seven-day technician calendar with scheduled and remaining capacity', () => {
  const technicians = [];
  const technician = workOrders.createTechnician(technicians, {
    name: 'Aman', capacityHoursPerDay: 8, workingDays: [1, 2, 3, 4, 5]
  });
  const orders = [];
  const order = workOrders.createWorkOrder(orders, [machine()], {
    machineId: 'MCH-101', title: 'Calibrate press', description: 'Calibrate the press.'
  });
  workOrders.scheduleWorkOrder(orders, technicians, order.id, {
    technicianId: technician.id, scheduledDate: '2026-11-06', startTime: '09:00', endTime: '12:00'
  });
  const calendar = workOrders.buildTechnicianCalendar(orders, technicians, '2026-11-02', 7);
  assert.equal(calendar.dates.length, 7);
  assert.equal(calendar.fromDate, '2026-11-02');
  assert.equal(calendar.toDate, '2026-11-08');
  assert.equal(calendar.events.length, 1);
  assert.equal(calendar.events[0].workOrderId, order.id);
  const friday = calendar.capacity[0].days.find((day) => day.date === '2026-11-06');
  assert.equal(friday.available, true);
  assert.equal(friday.scheduledHours, 3);
  assert.equal(friday.remainingHours, 5);
  const sunday = calendar.capacity[0].days.find((day) => day.date === '2026-11-08');
  assert.equal(sunday.available, false);
  assert.throws(() => workOrders.buildTechnicianCalendar(orders, technicians, '2026-02-30', 7), /valid YYYY-MM-DD/i);
});
