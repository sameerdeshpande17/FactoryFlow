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


  function addUtcDays(date, count) {
    const value = new Date(date + 'T00:00:00.000Z');
    value.setUTCDate(value.getUTCDate() + count);
    return value.toISOString().slice(0, 10);
  }

  function localDateTimeMs(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match || !validDate(match[1])) return null;
    const hour = Number(match[2]);
    const minute = Number(match[3]);
    const second = Number(match[4] || 0);
    if (hour > 23 || minute > 59 || second > 59) return null;
    return Date.parse(match[1] + 'T00:00:00.000Z') + hour * 3600000 + minute * 60000 + second * 1000;
  }

  function isMachineUnderMaintenance(machine, date) {
    return (Array.isArray(machine && machine.maintenanceWindows) ? machine.maintenanceWindows : []).some((window) =>
      validDate(window.startDate) && validDate(window.endDate) &&
      window.startDate <= date && date <= window.endDate
    );
  }

  function mergeIntervals(intervals) {
    const sorted = intervals.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    sorted.forEach((interval) => {
      const last = merged[merged.length - 1];
      if (!last || interval.start > last.end) merged.push({ start: interval.start, end: interval.end });
      else last.end = Math.max(last.end, interval.end);
    });
    return merged;
  }

  function buildMachineOee(input = {}) {
    const machines = Array.isArray(input.machines) ? input.machines.filter(Boolean) : [];
    const schedules = Array.isArray(input.schedules) ? input.schedules : [];
    const productionLogs = Array.isArray(input.productionLogs) ? input.productionLogs : [];
    const downtimeLogs = Array.isArray(input.downtimeLogs) ? input.downtimeLogs : [];
    const machines = Array.isArray(input.machines) ? input.machines : [];
    const fromDate = input.fromDate || '';
    const toDate = input.toDate || '';
    if ((fromDate && !validDate(fromDate)) || (toDate && !validDate(toDate))) {
      throw new Error('Machine OEE date filters must use valid YYYY-MM-DD dates.');
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new Error('Machine OEE start date must be on or before end date.');
    }

    const machineById = new Map(machines.map((machine) => [machine.id, machine]));
    const machineIdsByName = new Map();
    machines.forEach((machine) => {
      const key = String(machine.name || '').trim().toLocaleLowerCase();
      if (!key) return;
      const ids = machineIdsByName.get(key) || [];
      ids.push(machine.id);
      machineIdsByName.set(key, ids);
    });
    const scheduleById = new Map(schedules.filter(Boolean).map((session) => [session.id, session]));
    const plannedByMachineDay = new Map();
    const maintenanceConflictByMachine = new Map();

    schedules.forEach((session) => {
      if (!session || !session.machineId || !inRange(session.date, fromDate, toDate)) return;
      const machine = machineById.get(session.machineId);
      if (!machine) return;
      const hours = Number(session.hours);
      if (!Number.isFinite(hours) || hours <= 0) return;
      if (isMachineUnderMaintenance(machine, session.date)) {
        maintenanceConflictByMachine.set(machine.id, (maintenanceConflictByMachine.get(machine.id) || 0) + hours);
        return;
      }
      const key = machine.id + '|' + session.date;
      plannedByMachineDay.set(key, (plannedByMachineDay.get(key) || 0) + hours);
    });

    const outputByMachine = new Map();
    const outputByMachineDay = new Map();
    productionLogs.forEach((entry) => {
      if (!entry || !inRange(entry.productionDate, fromDate, toDate)) return;
      const session = entry.scheduleId ? scheduleById.get(entry.scheduleId) : null;
      const machineId = entry.machineId || (session && session.machineId) || '';
      if (!machineById.has(machineId)) return;
      const producedQty = Math.max(0, Number(entry.producedQty) || 0);
      const goodQty = Math.max(0, Math.min(producedQty, Number(entry.goodQty) || 0));
      const add = (target) => {
        target.producedQty += producedQty;
        target.goodQty += goodQty;
        target.entries += 1;
      };
      const total = outputByMachine.get(machineId) || { producedQty: 0, goodQty: 0, entries: 0 };
      add(total);
      outputByMachine.set(machineId, total);
      const key = machineId + '|' + entry.productionDate;
      const daily = outputByMachineDay.get(key) || { producedQty: 0, goodQty: 0, entries: 0 };
      add(daily);
      outputByMachineDay.set(key, daily);
    });

    const downtimeIntervalsByMachineDay = new Map();
    downtimeLogs.forEach((entry) => {
      if (!entry) return;
      let machineId = entry.machineId || '';
      if (!machineId) {
        const key = String(entry.machineName || '').trim().toLocaleLowerCase();
        const matches = machineIdsByName.get(key) || [];
        if (matches.length === 1) machineId = matches[0];
      }
      if (!machineById.has(machineId)) return;
      const startMs = localDateTimeMs(entry.startAt);
      const endMs = localDateTimeMs(entry.endAt);
      if (startMs === null || endMs === null || endMs <= startMs) return;
      const startDay = new Date(startMs).toISOString().slice(0, 10);
      const endDay = new Date(endMs).toISOString().slice(0, 10);
      const clippedStartDay = fromDate && startDay < fromDate ? fromDate : startDay;
      const clippedEndDay = toDate && endDay > toDate ? toDate : endDay;
      if (clippedStartDay > clippedEndDay) return;
      let day = clippedStartDay;
      let guard = 0;
      while (day <= clippedEndDay && guard < 8) {
        const dayStart = Date.parse(day + 'T00:00:00.000Z');
        const dayEnd = dayStart + 86400000;
        const overlapStart = Math.max(startMs, dayStart);
        const overlapEnd = Math.min(endMs, dayEnd);
        if (overlapEnd > overlapStart) {
          const key = machineId + '|' + day;
          const intervals = downtimeIntervalsByMachineDay.get(key) || [];
          intervals.push({ start: overlapStart, end: overlapEnd });
          downtimeIntervalsByMachineDay.set(key, intervals);
        }
        day = addUtcDays(day, 1);
        guard += 1;
      }
    });

    const downtimeMinutesByMachineDay = new Map();
    downtimeIntervalsByMachineDay.forEach((intervals, key) => {
      const minutes = mergeIntervals(intervals).reduce((sum, interval) => sum + (interval.end - interval.start) / 60000, 0);
      downtimeMinutesByMachineDay.set(key, minutes);
    });

    const dailyMachineLoads = new Map();
    plannedByMachineDay.forEach((plannedHours, key) => {
      const separator = key.lastIndexOf('|');
      const machineId = key.slice(0, separator);
      const date = key.slice(separator + 1);
      const machine = machineById.get(machineId);
      const downtimeMinutes = downtimeMinutesByMachineDay.get(key) || 0;
      const effectiveDowntimeHours = Math.min(plannedHours, downtimeMinutes / 60);
      const runHours = Math.max(0, plannedHours - effectiveDowntimeHours);
      const load = dailyMachineLoads.get(date) || {
        date, plannedHours: 0, downtimeHours: 0, runHours: 0,
        producedQty: 0, goodQty: 0, idealOutputQty: 0
      };
      load.plannedHours += plannedHours;
      load.downtimeHours += effectiveDowntimeHours;
      load.runHours += runHours;
      const output = outputByMachineDay.get(key);
      if (output) {
        load.producedQty += output.producedQty;
        load.goodQty += output.goodQty;
      }
      const idealRate = Number(machine && machine.idealUnitsPerHour);
      if (Number.isFinite(idealRate) && idealRate > 0) load.idealOutputQty += idealRate * runHours;
      dailyMachineLoads.set(date, load);
    });

    const machineRows = machines.map((machine) => {
      const dayKeys = [...plannedByMachineDay.keys()].filter((key) => key.startsWith(machine.id + '|'));
      let plannedHours = 0;
      let effectiveDowntimeHours = 0;
      let recordedDowntimeHours = 0;
      let runHours = 0;
      const scheduledDates = [];
      dayKeys.forEach((key) => {
        const date = key.slice(machine.id.length + 1);
        const planned = plannedByMachineDay.get(key) || 0;
        const recorded = (downtimeMinutesByMachineDay.get(key) || 0) / 60;
        const effective = Math.min(planned, recorded);
        plannedHours += planned;
        effectiveDowntimeHours += effective;
        recordedDowntimeHours += recorded;
        runHours += Math.max(0, planned - effective);
        scheduledDates.push(date);
      });
      const output = outputByMachine.get(machine.id) || { producedQty: 0, goodQty: 0, entries: 0 };
      const idealUnitsPerHour = Number(machine.idealUnitsPerHour) > 0 ? Number(machine.idealUnitsPerHour) : 0;
      const idealOutputQty = idealUnitsPerHour > 0 ? idealUnitsPerHour * runHours : 0;
      const availabilityPercent = plannedHours > 0 ? round(runHours / plannedHours * 100) : null;
      const rawPerformancePercent = idealOutputQty > 0 ? round(output.producedQty / idealOutputQty * 100) : null;
      const performancePercent = rawPerformancePercent === null ? null : Math.min(100, rawPerformancePercent);
      const qualityPercent = output.producedQty > 0 ? round(output.goodQty / output.producedQty * 100) : null;
      const oeePercent = availabilityPercent !== null && performancePercent !== null && qualityPercent !== null
        ? round((availabilityPercent / 100) * (performancePercent / 100) * (qualityPercent / 100) * 100)
        : null;
      const scheduledDays = new Set(scheduledDates).size;
      const capacityHours = Math.max(0, Number(machine.capacityHoursPerDay) || 0) * scheduledDays;
      const capacityUtilizationPercent = capacityHours > 0 ? round(plannedHours / capacityHours * 100) : null;
      const bottleneckSignals = [];
      if (capacityUtilizationPercent !== null && capacityUtilizationPercent >= 85) bottleneckSignals.push('High scheduled capacity utilization');
      if (availabilityPercent !== null && availabilityPercent < 80) bottleneckSignals.push('Low availability from recorded downtime');
      if (rawPerformancePercent !== null && rawPerformancePercent < 85) bottleneckSignals.push('Output below configured ideal rate');
      if (qualityPercent !== null && qualityPercent < 98) bottleneckSignals.push('Good-unit yield below 98%');
      if (maintenanceConflictByMachine.has(machine.id)) bottleneckSignals.push('Sessions overlap planned maintenance');
      return {
        machineId: machine.id,
        code: machine.code || '',
        machineName: machine.name || machine.code || 'Unnamed machine',
        active: machine.active !== false,
        idealUnitsPerHour: idealUnitsPerHour || null,
        plannedHours: round(plannedHours),
        recordedDowntimeHours: round(recordedDowntimeHours),
        effectiveDowntimeHours: round(effectiveDowntimeHours),
        runHours: round(runHours),
        producedQty: output.producedQty,
        goodQty: output.goodQty,
        productionEntries: output.entries,
        scheduledDays,
        capacityHours: round(capacityHours),
        capacityUtilizationPercent,
        availabilityPercent,
        rawPerformancePercent,
        performancePercent,
        performanceCapped: rawPerformancePercent !== null && rawPerformancePercent > 100,
        qualityPercent,
        oeePercent,
        maintenanceConflictHours: round(maintenanceConflictByMachine.get(machine.id) || 0),
        bottleneckSignals,
        bottleneck: bottleneckSignals.length > 0
      };
    }).sort((a, b) => {
      const aScore = a.bottleneckSignals.length;
      const bScore = b.bottleneckSignals.length;
      return bScore - aScore || (a.oeePercent === null ? 101 : a.oeePercent) - (b.oeePercent === null ? 101 : b.oeePercent) || a.machineName.localeCompare(b.machineName);
    });

    const totalPlannedHours = machineRows.reduce((sum, item) => sum + item.plannedHours, 0);
    const totalDowntimeHours = machineRows.reduce((sum, item) => sum + item.effectiveDowntimeHours, 0);
    const totalRunHours = machineRows.reduce((sum, item) => sum + item.runHours, 0);
    const eligible = machineRows.filter((item) => item.idealUnitsPerHour && item.plannedHours > 0);
    const eligiblePlanned = eligible.reduce((sum, item) => sum + item.plannedHours, 0);
    const eligibleDowntime = eligible.reduce((sum, item) => sum + item.effectiveDowntimeHours, 0);
    const eligibleRun = eligible.reduce((sum, item) => sum + item.runHours, 0);
    const eligibleOutput = eligible.reduce((sum, item) => sum + item.producedQty, 0);
    const eligibleGood = eligible.reduce((sum, item) => sum + item.goodQty, 0);
    const idealOutput = eligible.reduce((sum, item) => sum + item.idealUnitsPerHour * item.runHours, 0);
    const availabilityPercent = eligiblePlanned > 0 ? round(eligibleRun / eligiblePlanned * 100) : null;
    const rawPerformancePercent = idealOutput > 0 ? round(eligibleOutput / idealOutput * 100) : null;
    const performancePercent = rawPerformancePercent === null ? null : Math.min(100, rawPerformancePercent);
    const qualityPercent = eligibleOutput > 0 ? round(eligibleGood / eligibleOutput * 100) : null;
    const oeePercent = availabilityPercent !== null && performancePercent !== null && qualityPercent !== null
      ? round((availabilityPercent / 100) * (performancePercent / 100) * (qualityPercent / 100) * 100)
      : null;
    const dailyTrend = [...dailyMachineLoads.values()].sort((a, b) => a.date.localeCompare(b.date)).map((item) => ({
      ...item,
      plannedHours: round(item.plannedHours),
      downtimeHours: round(item.downtimeHours),
      runHours: round(item.runHours),
      availabilityPercent: item.plannedHours > 0 ? round(item.runHours / item.plannedHours * 100) : null,
      rawPerformancePercent: item.idealOutputQty > 0 ? round(item.producedQty / item.idealOutputQty * 100) : null,
      qualityPercent: item.producedQty > 0 ? round(item.goodQty / item.producedQty * 100) : null,
      oeePercent: item.plannedHours > 0 && item.idealOutputQty > 0 && item.producedQty > 0
        ? round((item.runHours / item.plannedHours) * Math.min(1, item.producedQty / item.idealOutputQty) * (item.goodQty / item.producedQty) * 100)
        : null
    }));
    return {
      range: { fromDate, toDate },
      machineCount: machines.length,
      machinesWithOee: machineRows.filter((item) => item.oeePercent !== null).length,
      totals: {
        plannedHours: round(totalPlannedHours),
        effectiveDowntimeHours: round(totalDowntimeHours),
        runHours: round(totalRunHours),
        producedQty: machineRows.reduce((sum, item) => sum + item.producedQty, 0),
        goodQty: machineRows.reduce((sum, item) => sum + item.goodQty, 0),
        availabilityPercent: eligiblePlanned > 0 ? availabilityPercent : null,
        performancePercent,
        rawPerformancePercent,
        qualityPercent,
        oeePercent,
        eligibleMachineCount: eligible.length,
        eligiblePlannedHours: round(eligiblePlanned),
        eligibleDowntimeHours: round(eligibleDowntime),
        eligibleRunHours: round(eligibleRun)
      },
      machines: machineRows,
      dailyTrend,
      bottlenecks: machineRows.filter((item) => item.bottleneck),
      notes: [
        'OEE requires scheduled machine sessions, recorded good/produced quantities, and an ideal units-per-hour rate for each included machine.',
        'Availability uses scheduled machine-hours. Recorded downtime intervals are merged to avoid double-counting and capped at scheduled hours per machine-day.',
        'Performance above 100% is capped at 100% for the OEE product and separately flagged as an ideal-rate calibration issue.',
        'Capacity utilization is measured against daily capacity on days with scheduled work; it is not an assumed 24/7 calendar.'
      ]
    };
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
      machineOee: buildMachineOee({ machines, schedules, productionLogs, downtimeLogs, fromDate, toDate }),
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

  return { validDate, inRange, buildAnalytics, buildMachineOee, recordDowntime };
});
