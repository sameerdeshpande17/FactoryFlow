(function attachFactoryFlowExecution(root, factory) {
  const execution = factory();
  if (typeof module === 'object' && module.exports) module.exports = execution;
  if (root) root.FactoryFlowExecution = execution;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowExecution() {
  'use strict';

  const closedStatuses = new Set(['Delivered', 'Cancelled']);

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }

  function positiveInteger(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) {
      throw new Error(label + ' must be a whole number greater than zero.');
    }
    return number;
  }

  function nonNegativeInteger(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) {
      throw new Error(label + ' must be a whole number zero or greater.');
    }
    return number;
  }

  function nextId(records, prefix) {
    let max = 100;
    (Array.isArray(records) ? records : []).forEach((record) => {
      const match = new RegExp('^' + prefix + '-(\\d+)$').exec(String(record.id || ''));
      if (match) max = Math.max(max, Number(match[1]));
    });
    return prefix + '-' + (max + 1);
  }

  function getJob(jobs, jobId) {
    const job = (Array.isArray(jobs) ? jobs : []).find((item) => item.id === jobId);
    if (!job || closedStatuses.has(job.status)) {
      throw new Error('Choose a job that is still open.');
    }
    return job;
  }

  function productionTotals(productionLogs, jobId) {
    return (Array.isArray(productionLogs) ? productionLogs : [])
      .filter((entry) => entry.jobId === jobId)
      .reduce((total, entry) => {
        total.producedQty += Number(entry.producedQty || 0);
        total.goodQty += Number(entry.goodQty || 0);
        total.rejectedQty += Number(entry.rejectedQty || 0);
        return total;
      }, { producedQty: 0, goodQty: 0, rejectedQty: 0 });
  }

  function recordProduction(productionLogs, jobs, workers, input, scheduleRecords = []) {
    if (!Array.isArray(productionLogs)) throw new TypeError('Production records must be an array.');
    const job = getJob(jobs, input.jobId);
    const worker = (Array.isArray(workers) ? workers : []).find((item) => item.id === input.workerId);
    if (!worker || worker.active === false) throw new Error('Choose an active worker for this production entry.');
    if (!validDate(input.productionDate)) throw new Error('Choose a valid production date.');

    const producedQty = positiveInteger(input.producedQty, 'Produced quantity');
    const goodQty = nonNegativeInteger(input.goodQty, 'Good quantity');
    const rejectedQty = nonNegativeInteger(input.rejectedQty, 'Rejected quantity');
    if (goodQty + rejectedQty !== producedQty) {
      throw new Error('Good quantity plus rejected quantity must equal produced quantity.');
    }

    const shift = String(input.shift || '').trim();
    if (!shift) throw new Error('Choose or enter a production shift.');
    let actualHours = null;
    if (input.actualHours !== undefined && input.actualHours !== null && input.actualHours !== '') {
      actualHours = Number(input.actualHours);
      if (!Number.isFinite(actualHours) || actualHours <= 0 || actualHours > 24) {
        throw new Error('Actual production hours must be greater than zero and no more than 24.');
      }
    }
    const scheduleId = String(input.scheduleId || '').trim();
    if (scheduleId) {
      const scheduled = (Array.isArray(scheduleRecords) ? scheduleRecords : []).find((item) => item.id === scheduleId);
      if (!scheduled || scheduled.jobId !== job.id || scheduled.workerId !== worker.id || scheduled.date !== input.productionDate) {
        throw new Error('Choose a scheduled session for this job and worker.');
      }
    }

    const record = {
      id: nextId(productionLogs, 'PR'),
      jobId: job.id,
      workerId: worker.id,
      workerName: worker.name,
      productionDate: input.productionDate,
      shift,
      actualHours,
      scheduleId,
      producedQty,
      goodQty,
      rejectedQty,
      notes: String(input.notes || '').trim(),
      createdAt: input.createdAt || new Date().toISOString()
    };
    productionLogs.push(record);

    const totals = productionTotals(productionLogs, job.id);
    job.readyForDelivery = false;
    const target = Number(job.qty) || 0;
    job.progress = target > 0 ? Math.min(100, Math.round((totals.producedQty / target) * 100)) : 0;
    if (totals.producedQty >= target && target > 0) {
      job.status = 'QC review';
    } else if (totals.producedQty > 0 && !['Delivered', 'Cancelled'].includes(job.status)) {
      job.status = 'In production';
    }
    return { record, totals, target, remainingQty: Math.max(0, target - totals.producedQty) };
  }

  function reworkTotals(reworkLogs, inspectionId) {
    return (Array.isArray(reworkLogs) ? reworkLogs : [])
      .filter((record) => record.qcInspectionId === inspectionId)
      .reduce((total, record) => {
        total.reworkedQty += Number(record.reworkedQty || 0);
        total.recoveredQty += Number(record.recoveredQty || 0);
        total.scrappedQty += Number(record.scrappedQty || 0);
        return total;
      }, { reworkedQty: 0, recoveredQty: 0, scrappedQty: 0 });
  }

  function recordInspection(qcInspections, productionLogs, reworkLogs, jobs, input) {
    if (!Array.isArray(qcInspections)) throw new TypeError('QC records must be an array.');
    const job = getJob(jobs, input.jobId);
    const totals = productionTotals(productionLogs, job.id);
    const inspectionType = input.inspectionType === 'Reinspection' ? 'Reinspection' : 'Initial';
    const inspectedQty = positiveInteger(input.inspectedQty, 'Inspected quantity');
    const passedQty = nonNegativeInteger(input.passedQty, 'Passed quantity');
    const failedQty = nonNegativeInteger(input.failedQty, 'Failed quantity');
    if (passedQty + failedQty !== inspectedQty) {
      throw new Error('Passed quantity plus failed quantity must equal inspected quantity.');
    }
    if (!totals.producedQty) throw new Error('Record production output before performing QC.');

    let sourceInspection = null;
    if (inspectionType === 'Initial') {
      const alreadyInspected = qcInspections
        .filter((item) => item.jobId === job.id && item.inspectionType === 'Initial')
        .reduce((sum, item) => sum + Number(item.inspectedQty || 0), 0);
      const available = Math.max(0, totals.producedQty - alreadyInspected);
      if (inspectedQty > available) {
        throw new Error('Only ' + available + ' produced unit(s) remain for initial inspection.');
      }
    } else {
      sourceInspection = qcInspections.find((item) => item.id === input.sourceInspectionId);
      if (!sourceInspection || sourceInspection.jobId !== job.id || sourceInspection.disposition !== 'Rework') {
        throw new Error('Choose a rework inspection for this job.');
      }
      const rework = reworkTotals(reworkLogs, sourceInspection.id);
      const alreadyReinspected = qcInspections
        .filter((item) => item.inspectionType === 'Reinspection' && item.sourceInspectionId === sourceInspection.id)
        .reduce((sum, item) => sum + Number(item.inspectedQty || 0), 0);
      const available = Math.max(0, rework.recoveredQty - alreadyReinspected);
      if (inspectedQty > available) {
        throw new Error('Only ' + available + ' recovered unit(s) remain for reinspection.');
      }
    }

    let disposition = 'Accepted';
    if (failedQty > 0) {
      disposition = input.disposition === 'Rework' ? 'Rework' : 'Reject';
    }
    const inspector = String(input.inspector || '').trim();
    if (!inspector) throw new Error('Enter the inspector name.');
    const record = {
      id: nextId(qcInspections, 'QC'),
      jobId: job.id,
      inspectionType,
      sourceInspectionId: sourceInspection ? sourceInspection.id : '',
      inspectedQty,
      passedQty,
      failedQty,
      disposition,
      defectCategory: failedQty > 0 ? String(input.defectCategory || 'Other').trim() : '',
      inspector,
      notes: String(input.notes || '').trim(),
      inspectedAt: input.inspectedAt || new Date().toISOString()
    };
    qcInspections.push(record);
    job.readyForDelivery = false;
    return { record, disposition };
  }

  function recordRework(reworkLogs, qcInspections, jobs, input) {
    if (!Array.isArray(reworkLogs)) throw new TypeError('Rework records must be an array.');
    const inspection = (Array.isArray(qcInspections) ? qcInspections : [])
      .find((item) => item.id === input.qcInspectionId);
    if (!inspection || inspection.disposition !== 'Rework') {
      throw new Error('Choose a QC inspection marked for rework.');
    }
    const job = (Array.isArray(jobs) ? jobs : []).find((item) => item.id === inspection.jobId);
    if (!job || closedStatuses.has(job.status)) throw new Error('Choose a job that is still open.');

    const reworkedQty = positiveInteger(input.reworkedQty, 'Reworked quantity');
    const recoveredQty = nonNegativeInteger(input.recoveredQty, 'Recovered quantity');
    const scrappedQty = nonNegativeInteger(input.scrappedQty, 'Scrapped quantity');
    if (recoveredQty + scrappedQty !== reworkedQty) {
      throw new Error('Recovered quantity plus scrapped quantity must equal reworked quantity.');
    }
    const totals = reworkTotals(reworkLogs, inspection.id);
    const pending = Math.max(0, Number(inspection.failedQty) - totals.reworkedQty);
    if (reworkedQty > pending) {
      throw new Error('Only ' + pending + ' unit(s) remain in this rework queue.');
    }

    const record = {
      id: nextId(reworkLogs, 'RW'),
      qcInspectionId: inspection.id,
      jobId: inspection.jobId,
      reworkedQty,
      recoveredQty,
      scrappedQty,
      notes: String(input.notes || '').trim(),
      completedAt: input.completedAt || new Date().toISOString()
    };
    reworkLogs.push(record);
    job.readyForDelivery = false;
    return {
      record,
      totals: reworkTotals(reworkLogs, inspection.id),
      pendingQty: Math.max(0, Number(inspection.failedQty) - reworkTotals(reworkLogs, inspection.id).reworkedQty)
    };
  }

  function summarizeJob(job, productionLogs, qcInspections, reworkLogs) {
    const production = productionTotals(productionLogs, job.id);
    const inspections = (Array.isArray(qcInspections) ? qcInspections : []).filter((item) => item.jobId === job.id);
    const initialInspectedQty = inspections.filter((item) => item.inspectionType === 'Initial')
      .reduce((sum, item) => sum + Number(item.inspectedQty || 0), 0);
    const acceptedQty = inspections.reduce((sum, item) => sum + Number(item.passedQty || 0), 0);
    const rejectedByQcQty = inspections.filter((item) => item.disposition === 'Reject')
      .reduce((sum, item) => sum + Number(item.failedQty || 0), 0);
    const pendingRework = inspections.filter((item) => item.disposition === 'Rework').reduce((sum, item) => {
      return sum + Math.max(0, Number(item.failedQty || 0) - reworkTotals(reworkLogs, item.id).reworkedQty);
    }, 0);
    const pendingReinspection = inspections.filter((item) => item.disposition === 'Rework').reduce((sum, item) => {
      const work = reworkTotals(reworkLogs, item.id);
      const reinspected = inspections.filter((candidate) =>
        candidate.inspectionType === 'Reinspection' && candidate.sourceInspectionId === item.id
      ).reduce((total, candidate) => total + Number(candidate.inspectedQty || 0), 0);
      return sum + Math.max(0, work.recoveredQty - reinspected);
    }, 0);
    const reworkTotalsForJob = (Array.isArray(reworkLogs) ? reworkLogs : []).filter((item) => item.jobId === job.id)
      .reduce((total, item) => {
        total.reworkedQty += Number(item.reworkedQty || 0);
        total.recoveredQty += Number(item.recoveredQty || 0);
        total.scrappedQty += Number(item.scrappedQty || 0);
        return total;
      }, { reworkedQty: 0, recoveredQty: 0, scrappedQty: 0 });
    const target = Number(job.qty) || 0;
    const remainingProductionQty = Math.max(0, target - production.producedQty);
    const qcCoverageComplete = production.producedQty > 0 && initialInspectedQty >= production.producedQty;
    const qualityComplete = qcCoverageComplete && acceptedQty >= target && pendingRework === 0 && pendingReinspection === 0;
    const productionComplete = target > 0 && production.producedQty >= target;
    return {
      jobId: job.id,
      targetQty: target,
      producedQty: production.producedQty,
      goodQty: production.goodQty,
      rejectedQty: production.rejectedQty,
      remainingProductionQty,
      productionProgress: target > 0 ? Math.min(100, Math.round(production.producedQty / target * 100)) : 0,
      initialInspectedQty,
      acceptedQty,
      rejectedByQcQty,
      pendingReworkQty: pendingRework,
      pendingReinspectionQty: pendingReinspection,
      reworkedQty: reworkTotalsForJob.reworkedQty,
      recoveredQty: reworkTotalsForJob.recoveredQty,
      scrappedQty: reworkTotalsForJob.scrappedQty,
      qcCoverageComplete,
      productionComplete,
      qualityComplete,
      readyForDelivery: productionComplete && qualityComplete
    };
  }

  function releaseForDelivery(jobs, productionLogs, qcInspections, reworkLogs, jobId) {
    const job = (Array.isArray(jobs) ? jobs : []).find((item) => item.id === jobId);
    if (!job || closedStatuses.has(job.status)) throw new Error('Choose an open job.');
    const summary = summarizeJob(job, productionLogs, qcInspections, reworkLogs);
    if (!summary.productionComplete) {
      throw new Error('Production is incomplete. ' + summary.remainingProductionQty + ' unit(s) remain against the job target.');
    }
    if (!summary.qcCoverageComplete) {
      throw new Error('Initial QC must cover all ' + summary.producedQty + ' produced unit(s).');
    }
    if (summary.pendingReworkQty > 0 || summary.pendingReinspectionQty > 0) {
      throw new Error('Resolve all rework and reinspect recovered units before release.');
    }
    if (summary.acceptedQty < summary.targetQty) {
      throw new Error('QC has accepted ' + summary.acceptedQty + ' of ' + summary.targetQty + ' required good unit(s).');
    }
    job.status = 'QC review';
    job.progress = 100;
    job.readyForDelivery = true;
    return { job, summary };
  }

  return {
    validDate,
    activeJobs: (jobs) => (Array.isArray(jobs) ? jobs : []).filter((job) => job && !closedStatuses.has(job.status)),
    productionTotals,
    recordProduction,
    recordInspection,
    recordRework,
    summarizeJob,
    releaseForDelivery
  };
});
