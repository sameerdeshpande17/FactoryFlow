const test = require('node:test');
const assert = require('node:assert/strict');
const optimizer = require('../scheduler-optimizer.js');

function dayDifference(start, end) {
  return Math.round((Date.parse(end + 'T00:00:00.000Z') - Date.parse(start + 'T00:00:00.000Z')) / 86400000);
}

function fixtures() {
  return {
    jobs: [
      { id: 'JB-URGENT', item: 'Urgent cartons', customer: 'North Foods', status: 'In production', estimatedHours: 12, priority: 'Urgent', dueDate: '2026-11-04', requiredSkill: 'Carton conversion' },
      { id: 'JB-NORMAL', item: 'Pouch run', customer: 'Fresh Foods', status: 'With worker', estimatedHours: 8, priority: 'Normal', dueDate: '2026-11-12', requiredSkill: 'Printing' },
      { id: 'JB-NO-ESTIMATE', item: 'Legacy order', customer: 'Old Foods', status: 'With worker' },
      { id: 'JB-CLOSED', item: 'Delivered order', customer: 'Done Foods', status: 'Delivered', estimatedHours: 4 }
    ],
    workers: [
      { id: 'WRK-CARTON', name: 'Ravi Cartons', skill: 'Carton conversion', capacityHoursPerDay: 8, active: true, unavailableDates: [] },
      { id: 'WRK-PRINT', name: 'Aman Printworks', skill: 'Printing', capacityHoursPerDay: 2, active: true, unavailableDates: ['2026-11-03'] },
      { id: 'WRK-INACTIVE', name: 'Inactive Worker', skill: 'Carton conversion', capacityHoursPerDay: 8, active: false, unavailableDates: [] }
    ],
    schedules: [],
    productionLogs: []
  };
}

const options = { startDate: '2026-11-02', horizonDays: 5, includeWeekends: false };

test('validates planning dates, horizons and weekend options', () => {
  assert.deepEqual(optimizer.normalizeOptions(options), options);
  assert.throws(() => optimizer.normalizeOptions({ ...options, startDate: '2026-02-30' }), /valid schedule start date/i);
  assert.throws(() => optimizer.normalizeOptions({ ...options, horizonDays: 0 }), /between 1 and 60/i);
  assert.throws(() => optimizer.normalizeOptions({ ...options, horizonDays: 61 }), /between 1 and 60/i);
  assert.throws(() => optimizer.normalizeOptions({ ...options, includeWeekends: 'yes' }), /true or false/i);
});

test('prioritizes urgent jobs and matches skill-compatible workers', () => {
  const { jobs, workers, schedules, productionLogs } = fixtures();
  const result = optimizer.optimizeSchedule(jobs, workers, schedules, productionLogs, options);
  assert.equal(result.proposals[0].jobId, 'JB-URGENT');
  assert.equal(result.proposals[0].workerId, 'WRK-CARTON');
  assert.ok(result.proposals.every((proposal) => proposal.jobId !== 'JB-CLOSED'));
  const normalProposals = result.proposals.filter((proposal) => proposal.jobId === 'JB-NORMAL');
  assert.ok(normalProposals.length > 0);
  assert.ok(normalProposals.every((proposal) => proposal.workerId === 'WRK-PRINT'));
});

test('keeps missing job estimates visible as explicit planning issues', () => {
  const { jobs, workers, schedules, productionLogs } = fixtures();
  const result = optimizer.optimizeSchedule(jobs, workers, schedules, productionLogs, options);
  const missing = result.jobPlans.find((item) => item.jobId === 'JB-NO-ESTIMATE');
  assert.equal(missing.status, 'Needs estimate');
  assert.equal(missing.unscheduledHours, 0);
  assert.ok(result.issues.some((issue) => issue.jobId === 'JB-NO-ESTIMATE' && issue.type === 'missing-estimate'));
});

test('subtracts recorded actual hours and already committed future sessions from job estimates', () => {
  const data = fixtures();
  data.jobs = [{ id: 'JB-1', item: 'Carton', status: 'In production', estimatedHours: 20 }];
  data.productionLogs = [{ id: 'PR-1', jobId: 'JB-1', actualHours: 5 }];
  data.schedules = [{ id: 'SC-1', jobId: 'JB-1', workerId: 'WRK-CARTON', date: '2026-11-03', hours: 6 }];
  const result = optimizer.optimizeSchedule(data.jobs, data.workers, data.schedules, data.productionLogs, options);
  const plan = result.jobPlans[0];
  assert.equal(plan.actualHours, 5);
  assert.equal(plan.committedHours, 6);
  assert.equal(plan.proposedHours + plan.unscheduledHours, 9);
});

test('does not exceed worker daily capacity when multiple jobs compete', () => {
  const data = fixtures();
  data.jobs = [
    { id: 'JB-1', status: 'In production', estimatedHours: 8, priority: 'Urgent' },
    { id: 'JB-2', status: 'In production', estimatedHours: 8, priority: 'High' }
  ];
  data.workers = [{ id: 'WRK-1', name: 'Single worker', skill: 'General', capacityHoursPerDay: 2, active: true, unavailableDates: [] }];
  const result = optimizer.optimizeSchedule(data.jobs, data.workers, [], [], options);
  const perDay = new Map();
  result.proposals.forEach((proposal) => perDay.set(proposal.date, (perDay.get(proposal.date) || 0) + proposal.hours));
  for (const [date, hours] of perDay) assert.ok(hours <= 2 + 1e-9, date + ' exceeded daily capacity');
  assert.equal(result.dailyLoads.some((load) => load.overCapacityHours > 0), false);
  assert.ok(result.summary.unscheduledHours > 0);
});

test('respects worker unavailability, inactive workers, weekends and skill mismatches', () => {
  const jobs = [{ id: 'JB-1', item: 'Cartons', status: 'In production', estimatedHours: 8, requiredSkill: 'Carton conversion' }];
  const workers = [
    { id: 'WRK-1', name: 'Unavailable', skill: 'Carton conversion', capacityHoursPerDay: 8, active: true, unavailableDates: ['2026-11-02'] },
    { id: 'WRK-2', name: 'Wrong skill', skill: 'Printing', capacityHoursPerDay: 8, active: true, unavailableDates: [] },
    { id: 'WRK-3', name: 'Inactive', skill: 'Carton conversion', capacityHoursPerDay: 8, active: false, unavailableDates: [] }
  ];
  const result = optimizer.optimizeSchedule(jobs, workers, [], [], options);
  assert.ok(result.proposals.length > 0);
  assert.ok(result.proposals.every((item) => item.workerId === 'WRK-1' && item.date !== '2026-11-02'));
  assert.equal(result.proposals.some((item) => item.workerId === 'WRK-2' || item.workerId === 'WRK-3'), false);

  const noSkillMatch = optimizer.optimizeSchedule(jobs, workers.slice(1), [], [], options);
  assert.equal(noSkillMatch.proposals.length, 0);
  assert.equal(noSkillMatch.jobPlans[0].status, 'Capacity gap');
  assert.ok(noSkillMatch.issues.some((issue) => issue.type === 'no-compatible-worker'));
});

test('distributes work across eligible weekdays and only uses weekends when opted in', () => {
  const jobs = [{ id: 'JB-1', status: 'In production', estimatedHours: 50 }];
  const workers = [{ id: 'WRK-1', name: 'Flexible', skill: 'General', capacityHoursPerDay: 8, active: true, unavailableDates: [] }];
  const weekdayOnly = optimizer.optimizeSchedule(jobs, workers, [], [], { ...options, horizonDays: 5 });
  assert.deepEqual([...new Set(weekdayOnly.proposals.map((item) => item.date))], ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  assert.ok(weekdayOnly.proposals.every((item) => !['2026-11-07', '2026-11-08'].includes(item.date)));
  const withWeekend = optimizer.optimizeSchedule(jobs, workers, [], [], { ...options, horizonDays: 7, includeWeekends: true });
  assert.ok(withWeekend.proposals.some((item) => item.date === '2026-11-07' || item.date === '2026-11-08'));
});

test('flags deadlines that cannot be met within available worker capacity', () => {
  const jobs = [{ id: 'JB-1', status: 'In production', estimatedHours: 40, dueDate: '2026-11-03', priority: 'Urgent' }];
  const workers = [{ id: 'WRK-1', name: 'Limited', skill: 'General', capacityHoursPerDay: 4, active: true, unavailableDates: [] }];
  const result = optimizer.optimizeSchedule(jobs, workers, [], [], options);
  assert.equal(result.jobPlans[0].deadlineRisk, true);
  assert.equal(result.summary.deadlineRiskCount, 1);
  assert.ok(result.jobPlans[0].unscheduledHours > 0);
});

test('does not mutate jobs, workers, or existing schedules when generating a preview', () => {
  const data = fixtures();
  const before = JSON.stringify(data);
  optimizer.optimizeSchedule(data.jobs, data.workers, data.schedules, data.productionLogs, options);
  assert.equal(JSON.stringify(data), before);
});

test('reports existing capacity conflicts rather than making the new proposal worse', () => {
  const jobs = [{ id: 'JB-1', status: 'In production', estimatedHours: 2 }];
  const workers = [{ id: 'WRK-1', name: 'Overbooked', skill: 'General', capacityHoursPerDay: 8, active: true, unavailableDates: [] }];
  const schedules = [
    { id: 'SC-1', jobId: 'JB-1', workerId: 'WRK-1', date: '2026-11-02', hours: 6 },
    { id: 'SC-2', jobId: 'JB-1', workerId: 'WRK-1', date: '2026-11-02', hours: 4 }
  ];
  const result = optimizer.optimizeSchedule(jobs, workers, schedules, [], options);
  assert.equal(result.dailyLoads[0].overCapacityHours, 2);
  assert.equal(result.proposals.length, 0);
});

test('keeps proposed allocations inside the selected planning horizon', () => {
  const jobs = [{ id: 'JB-1', status: 'In production', estimatedHours: 100 }];
  const workers = [{ id: 'WRK-1', name: 'Flexible', skill: 'General', capacityHoursPerDay: 8, active: true, unavailableDates: [] }];
  const result = optimizer.optimizeSchedule(jobs, workers, [], [], { ...options, horizonDays: 2 });
  assert.ok(result.proposals.every((proposal) => dayDifference(options.startDate, proposal.date) < 2));
});

test('allocates machine-bound jobs within per-machine daily capacity', () => {
  const jobs = [
    { id: 'JB-PRINT-1', item: 'Order 1', status: 'In production', estimatedHours: 12, requiredSkill: 'Printing' },
    { id: 'JB-PRINT-2', item: 'Order 2', status: 'In production', estimatedHours: 12, requiredSkill: 'Printing' }
  ];
  const workers = [{ id: 'WRK-1', name: 'Operator', skill: 'Printing', capacityHoursPerDay: 16, active: true, unavailableDates: [] }];
  const machines = [
    { id: 'MCH-101', name: 'Press A', code: 'PRESS-A', capacityHoursPerDay: 8, supportedSkills: ['Printing'], active: true, maintenanceWindows: [] },
    { id: 'MCH-102', name: 'Press B', code: 'PRESS-B', capacityHoursPerDay: 8, supportedSkills: ['Printing'], active: true, maintenanceWindows: [] }
  ];
  const result = optimizer.optimizeSchedule(jobs, workers, [], [], options, machines, []);
  assert.ok(result.proposals.length > 0);
  assert.ok(result.proposals.every((item) => item.machineId && item.machineName));
  for (const machine of machines) {
    const daily = new Map();
    result.proposals.filter((item) => item.machineId === machine.id).forEach((item) => {
      daily.set(item.date, (daily.get(item.date) || 0) + item.hours);
    });
    for (const hours of daily.values()) assert.ok(hours <= machine.capacityHoursPerDay + 1e-9);
  }
  assert.equal(result.summary.machinesUsed, 2);
  assert.ok(result.dailyMachineLoads.length > 0);
});

test('avoids machine maintenance windows and recorded downtime when optimizing', () => {
  const jobs = [{ id: 'JB-1', status: 'In production', estimatedHours: 8, requiredSkill: 'Printing' }];
  const workers = [{ id: 'WRK-1', name: 'Operator', skill: 'Printing', capacityHoursPerDay: 8, active: true, unavailableDates: [] }];
  const machines = [{
    id: 'MCH-101', name: 'Press A', code: 'PRESS-A', capacityHoursPerDay: 8,
    supportedSkills: ['Printing'], active: true,
    maintenanceWindows: [{ id: 'MW-101', startDate: '2026-11-02', endDate: '2026-11-02', reason: 'Preventive maintenance' }]
  }];
  const maintenancePlan = optimizer.optimizeSchedule(jobs, workers, [], [], options, machines, []);
  assert.ok(maintenancePlan.proposals.length > 0);
  assert.ok(maintenancePlan.proposals.every((item) => item.date !== '2026-11-02'));

  const downtimePlan = optimizer.optimizeSchedule(jobs, workers, [], [], options, [
    { ...machines[0], maintenanceWindows: [] }
  ], [{
    id: 'DT-101', machineId: 'MCH-101', machineName: 'Press A',
    startAt: '2026-11-02T08:00', endAt: '2026-11-02T12:00'
  }]);
  assert.ok(downtimePlan.proposals.length > 0);
  assert.ok(downtimePlan.proposals.every((item) => item.date !== '2026-11-02'));
});

test('honours a preferred machine and reports incompatible machine skills', () => {
  const workers = [{ id: 'WRK-1', name: 'Operator', skill: 'Printing', capacityHoursPerDay: 8, active: true, unavailableDates: [] }];
  const machines = [
    { id: 'MCH-101', name: 'Press A', code: 'PRESS-A', capacityHoursPerDay: 8, supportedSkills: ['Printing'], active: true, maintenanceWindows: [] },
    { id: 'MCH-102', name: 'Cutter B', code: 'CUT-B', capacityHoursPerDay: 8, supportedSkills: ['Cutting'], active: true, maintenanceWindows: [] }
  ];
  const preferred = optimizer.optimizeSchedule([
    { id: 'JB-1', status: 'In production', estimatedHours: 4, requiredSkill: 'Printing', machineId: 'MCH-101' }
  ], workers, [], [], options, machines, []);
  assert.ok(preferred.proposals.length > 0);
  assert.ok(preferred.proposals.every((item) => item.machineId === 'MCH-101'));

  const incompatible = optimizer.optimizeSchedule([
    { id: 'JB-2', status: 'In production', estimatedHours: 4, requiredSkill: 'Lamination', machineId: 'MCH-101' }
  ], workers, [], [], options, machines, []);
  assert.equal(incompatible.proposals.length, 0);
  assert.ok(incompatible.issues.some((item) => item.type === 'no-compatible-machine'));
});
