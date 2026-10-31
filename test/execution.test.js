const test = require('node:test');
const assert = require('node:assert/strict');
const execution = require('../execution.js');

function fixture() {
  return {
    jobs: [{
      id: 'JB-1',
      customer: 'North Foods',
      item: 'Printed carton',
      qty: 10,
      status: 'With worker',
      progress: 0
    }],
    workers: [{
      id: 'WRK-1',
      name: 'Ravi Cartons',
      active: true
    }],
    productionLogs: [],
    qcInspections: [],
    reworkLogs: []
  };
}

function addProduction(data, input = {}) {
  return execution.recordProduction(data.productionLogs, data.jobs, data.workers, {
    jobId: 'JB-1',
    workerId: 'WRK-1',
    productionDate: '2026-10-31',
    shift: 'Day',
    producedQty: 10,
    goodQty: 10,
    rejectedQty: 0,
    ...input
  });
}

function inspect(data, input = {}) {
  return execution.recordInspection(data.qcInspections, data.productionLogs, data.reworkLogs, data.jobs, {
    jobId: 'JB-1',
    inspectionType: 'Initial',
    inspectedQty: 10,
    passedQty: 10,
    failedQty: 0,
    disposition: 'Rework',
    inspector: 'Quality Inspector',
    ...input
  });
}

test('records production output, reconciles good and rejected units, and updates progress', () => {
  const data = fixture();
  const result = addProduction(data, {
    producedQty: 8,
    goodQty: 7,
    rejectedQty: 1
  });
  assert.equal(result.record.id, 'PR-101');
  assert.equal(result.totals.producedQty, 8);
  assert.equal(result.totals.goodQty, 7);
  assert.equal(result.totals.rejectedQty, 1);
  assert.equal(result.remainingQty, 2);
  assert.equal(data.jobs[0].progress, 80);
  assert.equal(data.jobs[0].status, 'In production');
});

test('moves a job to QC review when reported production reaches its target', () => {
  const data = fixture();
  addProduction(data);
  assert.equal(data.jobs[0].progress, 100);
  assert.equal(data.jobs[0].status, 'QC review');
});

test('rejects production entries when good and rejected quantities do not equal output', () => {
  const data = fixture();
  assert.throws(() => addProduction(data, {
    producedQty: 10,
    goodQty: 8,
    rejectedQty: 1
  }), /must equal produced quantity/i);
  assert.equal(data.productionLogs.length, 0);
  assert.equal(data.jobs[0].progress, 0);
});

test('rejects non-integer output, invalid dates, and inactive workers', () => {
  const data = fixture();
  assert.throws(() => addProduction(data, { producedQty: 1.5, goodQty: 1, rejectedQty: 0 }), /whole number/i);
  assert.throws(() => addProduction(data, { productionDate: '2026-02-30' }), /valid production date/i);
  data.workers[0].active = false;
  assert.throws(() => addProduction(data), /active worker/i);
  assert.equal(data.productionLogs.length, 0);
});

test('requires production output before the first QC inspection', () => {
  const data = fixture();
  assert.throws(() => inspect(data), /before performing QC/i);
});

test('records initial QC disposition and prevents inspecting the same output twice', () => {
  const data = fixture();
  addProduction(data);
  const result = inspect(data, {
    inspectedQty: 10,
    passedQty: 8,
    failedQty: 2,
    disposition: 'Rework',
    defectCategory: 'Print defect'
  });
  assert.equal(result.record.id, 'QC-101');
  assert.equal(result.record.disposition, 'Rework');
  assert.equal(result.record.defectCategory, 'Print defect');
  assert.throws(() => inspect(data), /Only 0 produced unit\(s\) remain/i);
});

test('rejects QC inspection quantities that do not reconcile', () => {
  const data = fixture();
  addProduction(data);
  assert.throws(() => inspect(data, {
    inspectedQty: 10,
    passedQty: 8,
    failedQty: 1
  }), /must equal inspected quantity/i);
  assert.equal(data.qcInspections.length, 0);
});

test('records recovered and scrapped rework quantities against a QC inspection', () => {
  const data = fixture();
  addProduction(data);
  const initial = inspect(data, { passedQty: 8, failedQty: 2, disposition: 'Rework' });
  const rework = execution.recordRework(data.reworkLogs, data.qcInspections, data.jobs, {
    qcInspectionId: initial.record.id,
    reworkedQty: 2,
    recoveredQty: 1,
    scrappedQty: 1,
    notes: 'Adjusted print registration'
  });
  assert.equal(rework.record.id, 'RW-101');
  assert.equal(rework.totals.reworkedQty, 2);
  assert.equal(rework.totals.recoveredQty, 1);
  assert.equal(rework.totals.scrappedQty, 1);
  assert.equal(rework.pendingQty, 0);
});

test('prevents over-reworking and rejects unbalanced rework results', () => {
  const data = fixture();
  addProduction(data);
  const initial = inspect(data, { passedQty: 8, failedQty: 2, disposition: 'Rework' });
  assert.throws(() => execution.recordRework(data.reworkLogs, data.qcInspections, data.jobs, {
    qcInspectionId: initial.record.id,
    reworkedQty: 2,
    recoveredQty: 1,
    scrappedQty: 0
  }), /must equal reworked quantity/i);
  assert.throws(() => execution.recordRework(data.reworkLogs, data.qcInspections, data.jobs, {
    qcInspectionId: initial.record.id,
    reworkedQty: 3,
    recoveredQty: 3,
    scrappedQty: 0
  }), /Only 2 unit\(s\) remain/i);
  assert.equal(data.reworkLogs.length, 0);
});

test('reinspects only recovered rework units and adds passed units to accepted output', () => {
  const data = fixture();
  addProduction(data);
  const initial = inspect(data, { passedQty: 8, failedQty: 2, disposition: 'Rework' });
  execution.recordRework(data.reworkLogs, data.qcInspections, data.jobs, {
    qcInspectionId: initial.record.id,
    reworkedQty: 2,
    recoveredQty: 2,
    scrappedQty: 0
  });
  const reinspected = inspect(data, {
    inspectionType: 'Reinspection',
    sourceInspectionId: initial.record.id,
    inspectedQty: 2,
    passedQty: 2,
    failedQty: 0
  });
  assert.equal(reinspected.record.inspectionType, 'Reinspection');
  const summary = execution.summarizeJob(data.jobs[0], data.productionLogs, data.qcInspections, data.reworkLogs);
  assert.equal(summary.acceptedQty, 10);
  assert.equal(summary.pendingReworkQty, 0);
  assert.equal(summary.pendingReinspectionQty, 0);
  assert.equal(summary.readyForDelivery, true);
});

test('release is blocked until production target and complete QC coverage are reached', () => {
  const data = fixture();
  addProduction(data, { producedQty: 8, goodQty: 8, rejectedQty: 0 });
  assert.throws(() => execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1'), /2 unit\(s\) remain/i);
  assert.equal(data.jobs[0].readyForDelivery, undefined);

  addProduction(data, { producedQty: 2, goodQty: 2, rejectedQty: 0 });
  assert.throws(() => execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1'), /Initial QC must cover all 10/i);
});

test('full lifecycle requires rework, reinspection, and enough QC-accepted units before release', () => {
  const data = fixture();
  addProduction(data);
  const initial = inspect(data, { passedQty: 8, failedQty: 2, disposition: 'Rework' });
  assert.throws(() => execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1'), /Resolve all rework/i);

  execution.recordRework(data.reworkLogs, data.qcInspections, data.jobs, {
    qcInspectionId: initial.record.id,
    reworkedQty: 2,
    recoveredQty: 2,
    scrappedQty: 0
  });
  assert.throws(() => execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1'), /reinspect recovered units/i);

  inspect(data, {
    inspectionType: 'Reinspection',
    sourceInspectionId: initial.record.id,
    inspectedQty: 2,
    passedQty: 2,
    failedQty: 0
  });
  const released = execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1');
  assert.equal(released.job.readyForDelivery, true);
  assert.equal(released.job.status, 'QC review');
  assert.equal(released.summary.acceptedQty, 10);
});

test('scrapped QC rejects require replacement production and QC before delivery', () => {
  const data = fixture();
  addProduction(data);
  inspect(data, { passedQty: 9, failedQty: 1, disposition: 'Reject' });
  assert.throws(() => execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1'), /accepted 9 of 10/i);

  addProduction(data, { producedQty: 1, goodQty: 1, rejectedQty: 0 });
  inspect(data, { inspectedQty: 1, passedQty: 1, failedQty: 0 });
  const released = execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1');
  assert.equal(released.summary.acceptedQty, 10);
  assert.equal(released.job.readyForDelivery, true);
});

test('a new production entry invalidates a previous delivery release', () => {
  const data = fixture();
  addProduction(data);
  inspect(data);
  execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1');
  assert.equal(data.jobs[0].readyForDelivery, true);
  addProduction(data, { producedQty: 1, goodQty: 1, rejectedQty: 0 });
  assert.equal(data.jobs[0].readyForDelivery, false);
});

test('does not release closed jobs or release jobs without enough accepted units', () => {
  const data = fixture();
  data.jobs[0].status = 'Delivered';
  assert.throws(() => execution.releaseForDelivery(data.jobs, data.productionLogs, data.qcInspections, data.reworkLogs, 'JB-1'), /open job/i);
});
