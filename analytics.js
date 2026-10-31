(function attachFactoryFlowAnalytics(root, factory) {
  const analytics = factory();
  if (typeof module === 'object' && module.exports) module.exports = analytics;
  if (root) root.FactoryFlowAnalytics = analytics;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowAnalytics() {
  'use strict';

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function dateOnly(value) {
    if (typeof value !== 'string') return '';
    const candidate = value.slice(0, 10);
    return validDate(candidate) ? candidate : '';
  }

  function inRange(value, fromDate, toDate) {
    const date = dateOnly(value);
    return Boolean(date && (!fromDate || date >= fromDate) && (!toDate || date <= toDate));
  }

  function round(value, places = 2) {
    const factor = 10 ** places;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function groupPeriod(date, groupBy) {
    if (groupBy === 'month') return date.slice(0, 7);
    if (groupBy === 'week') {
      const [year, month, day] = date.split('-').map(Number);
      const value = new Date(Date.UTC(year, month - 1, day));
      const offset = (value.getUTCDay() + 6) % 7;
      value.setUTCDate(value.getUTCDate() - offset);
      return value.toISOString().slice(0, 10);
    }
    return date;
  }

  function buildAnalytics(input = {}) {
    const productionLogs = Array.isArray(input.productionLogs) ? input.productionLogs : [];
    const qcInspections = Array.isArray(input.qcInspections) ? input.qcInspections : [];
    const reworkLogs = Array.isArray(input.reworkLogs) ? input.reworkLogs : [];
    const schedules = Array.isArray(input.schedules) ? input.schedules : [];
    const jobs = Array.isArray(input.jobs) ? input.jobs : [];
    const downtimeLogs = Array.isArray(input.downtimeLogs) ? input.downtimeLogs : [];
    const fromDate = input.fromDate || '';
    const toDate = input.toDate || '';
    const groupBy = ['day', 'week', 'month'].includes(input.groupBy) ? input.groupBy : 'day';
    if ((fromDate && !validDate(fromDate)) || (toDate && !validDate(toDate))) {
      throw new Error('Analytics date filters must use valid YYYY-MM-DD dates.');
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new Error('Analytics start date must be on or before end date.');
    }

    const production = productionLogs.filter((entry) => inRange(entry.productionDate, fromDate, toDate));
    const quality = qcInspections.filter((entry) => inRange(entry.inspectedAt, fromDate, toDate));
    const rework = reworkLogs.filter((entry) => inRange(entry.completedAt, fromDate, toDate));
    const downtime = downtimeLogs.filter((entry) => inRange(entry.startAt, fromDate, toDate));

    const totals = production.reduce((sum, entry) => {
      sum.producedQty += Number(entry.producedQty) || 0;
      sum.goodQty += Number(entry.goodQty) || 0;
      sum.rejectedQty += Number(entry.rejectedQty) || 0;
      const hours = Number(entry.actualHours);
      if (Number.isFinite(hours) && hours > 0) sum.actualHours += hours;
      else sum.entriesWithoutActualHours += 1;
      return sum;
    }, { producedQty: 0, goodQty: 0, rejectedQty: 0, actualHours: 0, entriesWithoutActualHours: 0 });

    totals.actualHours = round(totals.actualHours);
    totals.productionYieldPercent = totals.producedQty > 0
      ? round(totals.goodQty / totals.producedQty * 100)
      : null;
    totals.productionRejectPercent = totals.producedQty > 0
      ? round(totals.rejectedQty / totals.producedQty * 100)
      : null;
    totals.unitsPerActualHour = totals.actualHours > 0
      ? round(totals.producedQty / totals.actualHours)
      : null;

    const qualityTotals = quality.reduce((sum, inspection) => {
      sum.inspectedQty += Number(inspection.inspectedQty) || 0;
      sum.passedQty += Number(inspection.passedQty) || 0;
      sum.failedQty += Number(inspection.failedQty) || 0;
      sum.inspections += 1;
      return sum;
    }, { inspectedQty: 0, passedQty: 0, failedQty: 0, inspections: 0 });
    qualityTotals.passRatePercent = qualityTotals.inspectedQty > 0
      ? round(qualityTotals.passedQty / qualityTotals.inspectedQty * 100)
      : null;
    qualityTotals.failRatePercent = qualityTotals.inspectedQty > 0
      ? round(qualityTotals.failedQty / qualityTotals.inspectedQty * 100)
      : null;

    const reworkTotals = rework.reduce((sum, entry) => {
      sum.reworkedQty += Number(entry.reworkedQty) || 0;
      sum.recoveredQty += Number(entry.recoveredQty) || 0;
      sum.scrappedQty += Number(entry.scrappedQty) || 0;
      sum.records += 1;
      return sum;
    }, { reworkedQty: 0, recoveredQty: 0, scrappedQty: 0, records: 0 });

    const workerMap = new Map();
    production.forEach((entry) => {
      const key = entry.workerId || entry.workerName || 'Unassigned';
      const worker = workerMap.get(key) || {
        workerId: entry.workerId || '',
        workerName: entry.workerName || 'Unassigned',
        entries: 0,
        producedQty: 0,
        goodQty: 0,
        rejectedQty: 0,
        actualHours: 0,
        entriesWithoutActualHours: 0
      };
      worker.entries += 1;
      worker.producedQty += Number(entry.producedQty) || 0;
      worker.goodQty += Number(entry.goodQty) || 0;
      worker.rejectedQty += Number(entry.rejectedQty) || 0;
      const hours = Number(entry.actualHours);
      if (Number.isFinite(hours) && hours > 0) worker.actualHours += hours;
      else worker.entriesWithoutActualHours += 1;
      workerMap.set(key, worker);
    });
    const workers = [...workerMap.values()].map((worker) => ({
      ...worker,
      actualHours: round(worker.actualHours),
      unitsPerActualHour: worker.actualHours > 0 ? round(worker.producedQty / worker.actualHours) : null,
      goodYieldPercent: worker.producedQty > 0 ? round(worker.goodQty / worker.producedQty * 100) : null,
      rejectionPercent: worker.producedQty > 0 ? round(worker.rejectedQty / worker.producedQty * 100) : null
    })).sort((a, b) => b.producedQty - a.producedQty || a.workerName.localeCompare(b.workerName));

    const trendsMap = new Map();
    production.forEach((entry) => {
      const date = dateOnly(entry.productionDate);
      if (!date) return;
      const period = groupPeriod(date, groupBy);
      const point = trendsMap.get(period) || { period, producedQty: 0, goodQty: 0, rejectedQty: 0, actualHours: 0 };
      point.producedQty += Number(entry.producedQty) || 0;
      point.goodQty += Number(entry.goodQty) || 0;
      point.rejectedQty += Number(entry.rejectedQty) || 0;
      const hours = Number(entry.actualHours);
      if (Number.isFinite(hours) && hours > 0) point.actualHours += hours;
      trendsMap.set(period, point);
    });
    const productionTrend = [...trendsMap.values()].sort((a, b) => a.period.localeCompare(b.period)).map((point) => ({
      ...point,
      actualHours: round(point.actualHours),
      unitsPerActualHour: point.actualHours > 0 ? round(point.producedQty / point.actualHours) : null
    }));

    const scheduleMap = new Map(schedules.filter((session) => inRange(session.date, fromDate, toDate)).map((session) => [session.id, session]));
    const actualBySession = new Map();
    let unlinkedProductionEntries = 0;
    production.forEach((entry) => {
      if (!entry.scheduleId || !scheduleMap.has(entry.scheduleId)) {
        unlinkedProductionEntries += 1;
        return;
      }
      const hours = Number(entry.actualHours);
      if (!Number.isFinite(hours) || hours <= 0) return;
      actualBySession.set(entry.scheduleId, (actualBySession.get(entry.scheduleId) || 0) + hours);
    });
    const plannedHours = [...scheduleMap.values()].reduce((sum, session) => sum + (Number(session.hours) || 0), 0);
    const actualHoursForLinkedSessions = [...actualBySession.values()].reduce((sum, hours) => sum + hours, 0);
    const linkedPlannedHours = [...actualBySession.keys()].reduce((sum, id) => sum + (Number(scheduleMap.get(id).hours) || 0), 0);
    const varianceHours = round(actualHoursForLinkedSessions - linkedPlannedHours);
    const planVsActual = {
      scheduledSessions: scheduleMap.size,
      linkedSessions: actualBySession.size,
      plannedHours: round(linkedPlannedHours),
      actualHours: round(actualHoursForLinkedSessions),
      varianceHours,
      variancePercent: linkedPlannedHours > 0 ? round(varianceHours / linkedPlannedHours * 100) : null,
      unlinkedProductionEntries,
      coveragePercent: scheduleMap.size > 0 ? round(actualBySession.size / scheduleMap.size * 100) : null
    };

    const downtimeTotals = downtime.reduce((sum, entry) => {
      const minutes = Number(entry.durationMinutes);
      if (Number.isFinite(minutes) && minutes > 0) sum.totalMinutes += minutes;
      sum.records += 1;
      return sum;
    }, { totalMinutes: 0, records: 0 });
    downtimeTotals.totalHours = round(downtimeTotals.totalMinutes / 60);
    const downtimeByMachine = new Map();
    const downtimeByReason = new Map();
    downtime.forEach((entry) => {
      const minutes = Number(entry.durationMinutes) || 0;
      const machine = String(entry.machineName || 'Unspecified');
      const reason = String(entry.reason || 'Unspecified');
      downtimeByMachine.set(machine, (downtimeByMachine.get(machine) || 0) + minutes);
      downtimeByReason.set(reason, (downtimeByReason.get(reason) || 0) + minutes);
    });
    const machineDowntime = [...downtimeByMachine.entries()]
      .map(([machineName, minutes]) => ({ machineName, minutes, hours: round(minutes / 60) }))
      .sort((a, b) => b.minutes - a.minutes);
    const downtimeReasons = [...downtimeByReason.entries()]
      .map(([reason, minutes]) => ({ reason, minutes, hours: round(minutes / 60) }))
      .sort((a, b) => b.minutes - a.minutes);

    const deliveries = Array.isArray(input.deliveries) ? input.deliveries : [];
    const eligibleDeliveryJobs = jobs.filter((job) => {
      if (!job || job.status !== 'Delivered' || !validDate(job.dueDate)) return false;
      const delivery = deliveries.find((item) => item.jobId === job.id);
      const deliveredDate = delivery ? dateOnly(delivery.deliveredAt) : '';
      return deliveredDate && inRange(deliveredDate, fromDate, toDate);
    });
    const onTimeDeliveries = eligibleDeliveryJobs.filter((job) => {
      const delivery = deliveries.find((item) => item.jobId === job.id);
      const deliveredDate = delivery ? dateOnly(delivery.deliveredAt) : '';
      return deliveredDate && deliveredDate <= job.dueDate;
    });
    const onTimeDelivery = {
      eligibleJobs: eligibleDeliveryJobs.length,
      onTimeJobs: onTimeDeliveries.length,
      onTimePercent: eligibleDeliveryJobs.length > 0 ? round(onTimeDeliveries.length / eligibleDeliveryJobs.length * 100) : null
    };

    const jobById = new Map(jobs.filter(Boolean).map((job) => [job.id, job]));
    const jobPerformance = [...new Set(production.map((entry) => entry.jobId))].map((jobId) => {
      const job = jobById.get(jobId);
      const entries = production.filter((entry) => entry.jobId === jobId);
      const allEntries = productionLogs.filter((entry) => entry.jobId === jobId);
      const periodProducedQty = entries.reduce((sum, entry) => sum + (Number(entry.producedQty) || 0), 0);
      const producedQty = allEntries.reduce((sum, entry) => sum + (Number(entry.producedQty) || 0), 0);
      const goodQty = allEntries.reduce((sum, entry) => sum + (Number(entry.goodQty) || 0), 0);
      const targetQty = Number(job && job.qty) || 0;
      const actualHours = allEntries.reduce((sum, entry) => sum + (Number(entry.actualHours) > 0 ? Number(entry.actualHours) : 0), 0);
      return {
        jobId,
        customer: job ? job.customer : 'Unknown',
        item: job ? job.item : 'Unknown',
        targetQty,
        periodProducedQty,
        producedQty,
        goodQty,
        completionPercent: targetQty > 0 ? Math.min(100, round(producedQty / targetQty * 100)) : null,
        unitsPerHour: actualHours > 0 ? round(producedQty / actualHours) : null
      };
    }).sort((a, b) => b.producedQty - a.producedQty);

    return {
      range: { fromDate, toDate, groupBy },
      totals,
      quality: qualityTotals,
      rework: reworkTotals,
      workers,
      productionTrend,
      planVsActual,
      downtime: { ...downtimeTotals, machineDowntime, reasons: downtimeReasons },
      onTimeDelivery,
      jobPerformance,
      recordCounts: {
        productionEntries: production.length,
        qcInspections: qualityTotals.inspections,
        reworkRecords: reworkTotals.records,
        downtimeRecords: downtimeTotals.records
      }
    };
  }

  function recordDowntime(downtimeLogs, jobs, input) {
    if (!Array.isArray(downtimeLogs)) throw new TypeError('Downtime records must be an array.');
    const machineName = String(input.machineName || '').trim();
    const reason = String(input.reason || '').trim();
    const reportedBy = String(input.reportedBy || '').trim();
    if (!machineName) throw new Error('Enter a machine or workstation name.');
    if (!reason) throw new Error('Choose a downtime reason.');
    if (!reportedBy) throw new Error('Enter the person reporting downtime.');

    const jobId = String(input.jobId || '').trim();
    if (jobId && !(Array.isArray(jobs) ? jobs : []).some((job) => job.id === jobId)) {
      throw new Error('Choose a job that exists in this workspace.');
    }

    const pattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
    const start = pattern.exec(String(input.startAt || ''));
    const end = pattern.exec(String(input.endAt || ''));
    if (!start || !end || !validDate(start[1]) || !validDate(end[1]) ||
        Number(start[2]) > 23 || Number(end[2]) > 23 || Number(start[3]) > 59 || Number(end[3]) > 59) {
      throw new Error('Enter valid downtime start and end dates/times.');
    }
    const startDate = new Date(Number(start[1].slice(0, 4)), Number(start[1].slice(5, 7)) - 1, Number(start[1].slice(8, 10)), Number(start[2]), Number(start[3]));
    const endDate = new Date(Number(end[1].slice(0, 4)), Number(end[1].slice(5, 7)) - 1, Number(end[1].slice(8, 10)), Number(end[2]), Number(end[3]));
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new Error('Downtime end must be later than its start.');
    }
    if (durationMinutes > 7 * 24 * 60) {
      throw new Error('A single downtime record cannot exceed seven days.');
    }

    const nextNumber = downtimeLogs.reduce((max, entry) => {
      const match = /^DT-(\d+)$/.exec(String(entry.id || ''));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 100) + 1;
    const record = {
      id: 'DT-' + nextNumber,
      jobId,
      machineName,
      startAt: input.startAt,
      endAt: input.endAt,
      durationMinutes,
      reason,
      reportedBy,
      notes: String(input.notes || '').trim(),
      createdAt: input.createdAt || new Date().toISOString()
    };
    downtimeLogs.push(record);
    return record;
  }

  return { validDate, inRange, buildAnalytics, recordDowntime };
});
