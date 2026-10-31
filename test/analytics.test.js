const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../analytics.js');

function fixture() {
  return {
    jobs: [
      { id: 'JB-1', customer: 'North Foods', item: 'Carton run', qty: 100, status: 'Delivered', dueDate: '2026-10-16' },
      { id: 'JB-2', customer: 'Fresh Foods', item: 'Pouch run', qty: 200, status: 'Delivered', dueDate: '2026-10-19' },
      { id: 'JB-3', customer: 'River Retail', item: 'Label run', qty: 50, status: 'In production' }
    ],
    productionLogs: [
      { id: 'PR-1', jobId: 'JB-1', workerId: 'WRK-1', workerName: 'Ravi', productionDate: '2026-10-05', producedQty: 100, goodQty: 90, rejectedQty: 10, actualHours: 5, scheduleId: 'SC-1' },
      { id: 'PR-2', jobId: 'JB-1', workerId: 'WRK-1', workerName: 'Ravi', productionDate: '2026-10-06', producedQty: 50, goodQty: 45, rejectedQty: 5 },
      { id: 'PR-3', jobId: 'JB-2', workerId: 'WRK-2', workerName: 'Aman', productionDate: '2026-10-12', producedQty: 80, goodQty: 76, rejectedQty: 4, actualHours: 4, scheduleId: 'SC-2' },
      { id: 'PR-4', jobId: 'JB-1', workerId: 'WRK-1', workerName: 'Ravi', productionDate: '2026-09-30', producedQty: 25, goodQty: 20, rejectedQty: 5, actualHours: 2 }
    ],
    qcInspections: [
      { id: 'QC-1', jobId: 'JB-1', inspectedAt: '2026-10-05T11:00:00.000Z', inspectedQty: 100, passedQty: 95, failedQty: 5 },
      { id: 'QC-2', jobId: 'JB-2', inspectedAt: '2026-10-12T11:00:00.000Z', inspectedQty: 80, passedQty: 72, failedQty: 8 }
    ],
    reworkLogs: [
      { id: 'RW-1', jobId: 'JB-1', qcInspectionId: 'QC-1', completedAt: '2026-10-06T12:00:00.000Z', reworkedQty: 5, recoveredQty: 4, scrappedQty: 1 }
    ],
    schedules: [
      { id: 'SC-1', jobId: 'JB-1', workerId: 'WRK-1', date: '2026-10-05', hours: 4 },
      { id: 'SC-2', jobId: 'JB-2', workerId: 'WRK-2', date: '2026-10-12', hours: 3 }
    ],
    deliveries: [
      { id: 'DP-1', jobId: 'JB-1', deliveredAt: '2026-10-15' },
      { id: 'DP-2', jobId: 'JB-2', deliveredAt: '2026-10-20' }
    ],
    downtimeLogs: [
      { id: 'DT-1', machineName: 'Flexo 1', startAt: '2026-10-05T08:00', endAt: '2026-10-05T09:30', durationMinutes: 90, reason: 'Breakdown' },
      { id: 'DT-2', machineName: 'Flexo 1', startAt: '2026-10-06T13:00', endAt: '2026-10-06T14:00', durationMinutes: 60, reason: 'Breakdown' },
      { id: 'DT-3', machineName: 'Laminator', startAt: '2026-10-12T10:00', endAt: '2026-10-12T10:45', durationMinutes: 45, reason: 'Changeover / setup' }
    ]
  };
}

test('validates ISO calendar dates and inclusive date filters', () => {
  assert.equal(analytics.validDate('2024-02-29'), true);
  assert.equal(analytics.validDate('2025-02-29'), false);
  assert.equal(analytics.inRange('2026-10-05T09:30:00.000Z', '2026-10-05', '2026-10-05'), true);
  assert.equal(analytics.inRange('2026-10-06', '2026-10-05', '2026-10-05'), false);
});

test('aggregates production and excludes logs outside the selected date range', () => {
  const data = fixture();
  const result = analytics.buildAnalytics({
    ...data,
    fromDate: '2026-10-05',
    toDate: '2026-10-06'
  });
  assert.equal(result.totals.producedQty, 150);
  assert.equal(result.totals.goodQty, 135);
  assert.equal(result.totals.rejectedQty, 15);
  assert.equal(result.totals.productionYieldPercent, 90);
  assert.equal(result.totals.productionRejectPercent, 10);
  assert.equal(result.recordCounts.productionEntries, 2);
});

test('does not invent actual hours for legacy entries without time records', () => {
  const data = fixture();
  const result = analytics.buildAnalytics({
    ...data,
    fromDate: '2026-10-05',
    toDate: '2026-10-06'
  });
  assert.equal(result.totals.actualHours, 5);
  assert.equal(result.totals.entriesWithoutActualHours, 1);
  assert.equal(result.totals.unitsPerActualHour, 30);
  assert.equal(result.workers[0].entriesWithoutActualHours, 1);
});

test('groups production trend by week and month with sorted period keys', () => {
  const data = fixture();
  const weekly = analytics.buildAnalytics({ ...data, fromDate: '2026-10-01', toDate: '2026-10-31', groupBy: 'week' });
  assert.deepEqual(weekly.productionTrend.map((item) => item.period), ['2026-10-05', '2026-10-12']);
  assert.equal(weekly.productionTrend[0].producedQty, 150);
  const monthly = analytics.buildAnalytics({ ...data, fromDate: '2026-10-01', toDate: '2026-10-31', groupBy: 'month' });
  assert.deepEqual(monthly.productionTrend.map((item) => item.period), ['2026-10']);
  assert.equal(monthly.productionTrend[0].producedQty, 230);
});

test('calculates QC pass and failure rates separately from production yield', () => {
  const data = fixture();
  const result = analytics.buildAnalytics({ ...data, fromDate: '2026-10-01', toDate: '2026-10-31' });
  assert.equal(result.quality.inspectedQty, 180);
  assert.equal(result.quality.passedQty, 167);
  assert.equal(result.quality.failedQty, 13);
  assert.equal(result.quality.passRatePercent, 92.78);
  assert.equal(result.quality.failRatePercent, 7.22);
  assert.equal(result.recordCounts.qcInspections, 2);
});

test('aggregates worker output and rates using only recorded actual hours', () => {
  const data = fixture();
  const result = analytics.buildAnalytics({ ...data, fromDate: '2026-10-01', toDate: '2026-10-31' });
  const ravi = result.workers.find((worker) => worker.workerId === 'WRK-1');
  assert.equal(ravi.producedQty, 150);
  assert.equal(ravi.actualHours, 5);
  assert.equal(ravi.unitsPerActualHour, 30);
  assert.equal(ravi.goodYieldPercent, 90);
  assert.equal(ravi.rejectionPercent, 10);
});

test('compares planned and actual hours only for production entries linked to an in-range session', () => {
  const data = fixture();
  const result = analytics.buildAnalytics({
    ...data,
    fromDate: '2026-10-01',
    toDate: '2026-10-31'
  });
  assert.equal(result.planVsActual.scheduledSessions, 2);
  assert.equal(result.planVsActual.linkedSessions, 2);
  assert.equal(result.planVsActual.plannedHours, 7);
  assert.equal(result.planVsActual.actualHours, 9);
  assert.equal(result.planVsActual.varianceHours, 2);
  assert.equal(result.planVsActual.variancePercent, 28.57);
  assert.equal(result.planVsActual.unlinkedProductionEntries, 1);
  assert.equal(result.planVsActual.coveragePercent, 100);
});

test('calculates delivery timeliness only from dated delivered jobs inside the report range', () => {
  const data = fixture();
  const result = analytics.buildAnalytics({
    ...data,
    fromDate: '2026-10-01',
    toDate: '2026-10-16'
  });
  assert.equal(result.onTimeDelivery.eligibleJobs, 1);
  assert.equal(result.onTimeDelivery.onTimeJobs, 1);
  assert.equal(result.onTimeDelivery.onTimePercent, 100);
});

test('uses lifetime output for job completion and selected-range output for period activity', () => {
  const data = fixture();
  const result = analytics.buildAnalytics({
    ...data,
    fromDate: '2026-10-05',
    toDate: '2026-10-06'
  });
  const job = result.jobPerformance.find((item) => item.jobId === 'JB-1');
  assert.equal(job.periodProducedQty, 150);
  assert.equal(job.producedQty, 175);
  assert.equal(job.targetQty, 100);
  assert.equal(job.completionPercent, 100);
});

test('groups machine downtime and reasons into minutes and hours', () => {
  const data = fixture();
  const result = analytics.buildAnalytics({
    ...data,
    fromDate: '2026-10-01',
    toDate: '2026-10-31'
  });
  assert.equal(result.downtime.totalMinutes, 195);
  assert.equal(result.downtime.totalHours, 3.25);
  assert.equal(result.downtime.records, 3);
  assert.deepEqual(result.downtime.machineDowntime.map((item) => item.machineName), ['Flexo 1', 'Laminator']);
  assert.equal(result.downtime.machineDowntime[0].minutes, 150);
  assert.equal(result.downtime.reasons[0].reason, 'Breakdown');
  assert.equal(result.downtime.reasons[0].minutes, 150);
});

test('rejects invalid or reversed analytics date filters', () => {
  const data = fixture();
  assert.throws(() => analytics.buildAnalytics({ ...data, fromDate: '2026-02-30' }), /valid YYYY-MM-DD/i);
  assert.throws(() => analytics.buildAnalytics({ ...data, fromDate: '2026-10-20', toDate: '2026-10-01' }), /on or before/i);
});

test('records downtime with calculated duration and a stable sequential ID', () => {
  const data = fixture();
  const result = analytics.recordDowntime(data.downtimeLogs, data.jobs, {
    machineName: 'Die cutter 2',
    startAt: '2026-10-31T08:00',
    endAt: '2026-10-31T09:30',
    reason: 'Breakdown',
    jobId: 'JB-3',
    reportedBy: 'Shift supervisor',
    notes: 'Drive belt replaced'
  });
  assert.equal(result.id, 'DT-101');
  assert.equal(result.durationMinutes, 90);
  assert.equal(result.jobId, 'JB-3');
  assert.equal(data.downtimeLogs.length, 4);
});

test('rejects invalid downtime records and leaves log collection unchanged', () => {
  const data = fixture();
  const base = {
    machineName: 'Flexo 1',
    startAt: '2026-10-31T08:00',
    endAt: '2026-10-31T09:00',
    reason: 'Breakdown',
    reportedBy: 'Operator'
  };
  assert.throws(() => analytics.recordDowntime(data.downtimeLogs, data.jobs, { ...base, endAt: '2026-10-31T07:59' }), /end must be later/i);
  assert.throws(() => analytics.recordDowntime(data.downtimeLogs, data.jobs, { ...base, jobId: 'JB-MISSING' }), /job that exists/i);
  assert.throws(() => analytics.recordDowntime(data.downtimeLogs, data.jobs, { ...base, machineName: ' ' }), /machine or workstation/i);
  assert.throws(() => analytics.recordDowntime(data.downtimeLogs, data.jobs, { ...base, reportedBy: '' }), /reporting downtime/i);
  assert.equal(data.downtimeLogs.length, 3);
});

test('returns null rates instead of dividing by zero for an empty dataset', () => {
  const result = analytics.buildAnalytics({ jobs: [], productionLogs: [], qcInspections: [], reworkLogs: [], schedules: [], deliveries: [], downtimeLogs: [] });
  assert.equal(result.totals.productionYieldPercent, null);
  assert.equal(result.totals.unitsPerActualHour, null);
  assert.equal(result.quality.passRatePercent, null);
  assert.equal(result.onTimeDelivery.onTimePercent, null);
  assert.deepEqual(result.productionTrend, []);
});
