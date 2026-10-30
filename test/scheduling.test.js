const test = require('node:test');
const assert = require('node:assert/strict');
const scheduling = require('../scheduling.js');

function fixture() {
  return {
    jobs: [
      { id: 'JB-1', item: 'Carton run', customer: 'North Foods', status: 'In production' },
      { id: 'JB-2', item: 'Pouch run', customer: 'Fresh Foods', status: 'With worker' },
      { id: 'JB-3', item: 'Delivered order', customer: 'Old Foods', status: 'Delivered' }
    ],
    workers: [
      { id: 'WRK-1', name: 'Ravi Cartons', skill: 'Carton conversion', capacityHoursPerDay: 8, active: true, unavailableDates: [] },
      { id: 'WRK-2', name: 'Aman Printworks', skill: 'Flexo printing', capacityHoursPerDay: 6, active: true, unavailableDates: ['2026-11-02'] }
    ],
    schedules: []
  };
}

test('accepts valid calendar dates and rejects impossible dates', () => {
  assert.equal(scheduling.validDate('2024-02-29'), true);
  assert.equal(scheduling.validDate('2025-02-29'), false);
  assert.equal(scheduling.validDate('2026-13-01'), false);
  assert.equal(scheduling.validDate('30-10-2026'), false);
});

test('returns only jobs that are not delivered, in QC review, or cancelled', () => {
  const jobs = [
    { id: 'JB-1', status: 'In production' },
    { id: 'JB-2', status: 'Delivered' },
    { id: 'JB-3', status: 'QC review' },
    { id: 'JB-4', status: 'Cancelled' }
  ];
  assert.deepEqual(scheduling.activeJobs(jobs).map((job) => job.id), ['JB-1']);
});

test('schedules a production session and assigns the selected worker to the job', () => {
  const { jobs, workers, schedules } = fixture();
  const result = scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-1',
    workerId: 'WRK-1',
    date: '2026-10-31',
    hours: 4,
    dueDate: '2026-11-03',
    note: 'Carton cutting'
  });
  assert.equal(result.session.id, 'SC-101');
  assert.equal(result.session.jobId, 'JB-1');
  assert.equal(result.session.workerName, 'Ravi Cartons');
  assert.equal(result.remainingCapacity, 4);
  assert.equal(jobs[0].worker, 'Ravi Cartons');
  assert.equal(jobs[0].dueDate, '2026-11-03');
  assert.equal(schedules.length, 1);
});

test('enforces combined worker daily capacity across multiple jobs', () => {
  const { jobs, workers, schedules } = fixture();
  scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-31', hours: 5
  });
  assert.throws(() => scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-2', workerId: 'WRK-1', date: '2026-10-31', hours: 4
  }), /only 3 hours available/i);
  assert.equal(schedules.length, 1);
});

test('blocks a worker on an unavailable date', () => {
  const { jobs, workers, schedules } = fixture();
  assert.throws(() => scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-1', workerId: 'WRK-2', date: '2026-11-02', hours: 2
  }), /unavailable/i);
  assert.equal(schedules.length, 0);
});

test('rejects inactive workers and closed jobs', () => {
  const { jobs, workers, schedules } = fixture();
  workers[0].active = false;
  assert.throws(() => scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-31', hours: 2
  }), /active job worker/i);
  assert.throws(() => scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-3', workerId: 'WRK-2', date: '2026-10-31', hours: 2
  }), /active/i);
  assert.equal(schedules.length, 0);
});

test('rejects invalid dates, invalid hours and invalid deadline dates without mutation', () => {
  const { jobs, workers, schedules } = fixture();
  for (const input of [
    { jobId: 'JB-1', workerId: 'WRK-1', date: '2026-02-30', hours: 2 },
    { jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-31', hours: 0 },
    { jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-31', hours: 25 },
    { jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-31', hours: 2, dueDate: 'not-a-date' }
  ]) {
    assert.throws(() => scheduling.scheduleSession(schedules, jobs, workers, input));
  }
  assert.equal(schedules.length, 0);
  assert.equal(jobs[0].dueDate, undefined);
});

test('generates unique session IDs after a session is removed', () => {
  const { jobs, workers, schedules } = fixture();
  const first = scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-31', hours: 2
  });
  scheduling.removeSession(schedules, first.session.id);
  const second = scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-2', workerId: 'WRK-1', date: '2026-11-01', hours: 2
  });
  assert.equal(second.session.id, 'SC-102');
});

test('analyses daily capacity and reports capacity conflicts in legacy schedules', () => {
  const { jobs, workers } = fixture();
  const result = scheduling.analyzeSchedule(jobs, [
    { id: 'SC-1', jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-31', hours: 6 },
    { id: 'SC-2', jobId: 'JB-2', workerId: 'WRK-1', date: '2026-10-31', hours: 4 }
  ], workers);
  assert.equal(result.dailyLoads[0].assignedHours, 10);
  assert.equal(result.capacityConflicts.length, 1);
  assert.equal(result.capacityConflicts[0].overflowHours, 2);
});

test('flags sessions scheduled after a job deadline and on worker unavailable dates', () => {
  const { jobs, workers } = fixture();
  jobs[0].dueDate = '2026-10-31';
  workers[0].unavailableDates = ['2026-11-02'];
  const result = scheduling.analyzeSchedule(jobs, [
    { id: 'SC-1', jobId: 'JB-1', workerId: 'WRK-1', date: '2026-11-02', hours: 2 }
  ], workers);
  assert.equal(result.deadlineRisks.length, 1);
  assert.equal(result.sessions[0].deadlineRisk, true);
  assert.equal(result.sessions[0].workerUnavailable, true);
  assert.ok(result.issues.some((issue) => /unavailable/i.test(issue.message)));
});

test('removes a session safely and returns null for an unknown session', () => {
  const { jobs, workers, schedules } = fixture();
  const { session } = scheduling.scheduleSession(schedules, jobs, workers, {
    jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-31', hours: 2
  });
  assert.equal(scheduling.removeSession(schedules, 'SC-MISSING'), null);
  assert.equal(scheduling.removeSession(schedules, session.id).id, session.id);
  assert.equal(schedules.length, 0);
});

test('updates worker capacity, active status and validated unavailable dates', () => {
  const { workers } = fixture();
  const worker = scheduling.updateWorker(workers, 'WRK-1', {
    name: 'Ravi Packaging',
    skill: 'Carton conversion',
    capacityHoursPerDay: 7.5,
    active: true,
    unavailableDates: ['2026-11-04', '2026-11-05']
  });
  assert.equal(worker.name, 'Ravi Packaging');
  assert.equal(worker.capacityHoursPerDay, 7.5);
  assert.deepEqual(worker.unavailableDates, ['2026-11-04', '2026-11-05']);
  assert.throws(() => scheduling.updateWorker(workers, 'WRK-1', {
    name: 'Ravi Packaging', skill: 'Cartons', capacityHoursPerDay: 30, active: true, unavailableDates: []
  }), /between 0 and 24/i);
  assert.throws(() => scheduling.updateWorker(workers, 'WRK-1', {
    name: 'Ravi Packaging', skill: 'Cartons', capacityHoursPerDay: 8, active: true, unavailableDates: ['tomorrow']
  }), /YYYY-MM-DD/i);
});
