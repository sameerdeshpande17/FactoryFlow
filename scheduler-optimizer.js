(function attachFactoryFlowOptimizer(root, factory) {
  const optimizer = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = optimizer;
  if (root) root.FactoryFlowOptimizer = optimizer;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowOptimizer(root) {
  'use strict';

  const scheduling = root && root.FactoryFlowScheduling
    ? root.FactoryFlowScheduling
    : require('./scheduling.js');
  const machineModel = root && root.FactoryFlowMachines
    ? root.FactoryFlowMachines
    : require('./machines.js');



const EPSILON = 1e-9;
const DEFAULT_HORIZON_DAYS = 14;
const MAX_HORIZON_DAYS = 60;

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function addDays(dateString, count) {
  const date = new Date(dateString + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function dayDifference(start, end) {
  return Math.round((Date.parse(end + 'T00:00:00.000Z') - Date.parse(start + 'T00:00:00.000Z')) / 86400000);
}

function normalizeOptions(input = {}) {
  const startDate = input.startDate || new Date().toISOString().slice(0, 10);
  if (!scheduling.validDate(startDate)) throw new Error('Choose a valid schedule start date.');
  const horizonDays = input.horizonDays === undefined || input.horizonDays === null || input.horizonDays === ''
    ? DEFAULT_HORIZON_DAYS
    : Number(input.horizonDays);
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > MAX_HORIZON_DAYS) {
    throw new Error('Planning horizon must be a whole number between 1 and ' + MAX_HORIZON_DAYS + ' days.');
  }
  if (input.includeWeekends !== undefined && typeof input.includeWeekends !== 'boolean') {
    throw new Error('Weekend scheduling must be true or false.');
  }
  return {
    startDate,
    horizonDays,
    includeWeekends: input.includeWeekends === true
  };
}

function normalizeSkill(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function skillMatches(worker, job) {
  const required = normalizeSkill(job.requiredSkill);
  if (!required) return true;
  const skill = normalizeSkill(worker.skill);
  return Boolean(skill && (skill === required || skill.includes(required) || required.includes(skill)));
}


function machineSkillMatches(machine, job) {
  const required = normalizeSkill(job.requiredSkill);
  const supported = Array.isArray(machine.supportedSkills) ? machine.supportedSkills.map(normalizeSkill).filter(Boolean) : [];
  return !required || !supported.length || supported.some((skill) => skill === required || skill.includes(required) || required.includes(skill));
}

function downtimeDate(value) {
  const date = String(value || '').slice(0, 10);
  return scheduling.validDate(date) ? date : '';
}

function machineBlockedByDowntime(machine, day, downtimeLogs) {
  const machineName = normalizeSkill(machine.name);
  return (Array.isArray(downtimeLogs) ? downtimeLogs : []).some((record) => {
    if (!record) return false;
    const matchesMachine = record.machineId
      ? record.machineId === machine.id
      : normalizeSkill(record.machineName) === machineName;
    if (!matchesMachine) return false;
    const start = downtimeDate(record.startAt);
    const end = downtimeDate(record.endAt);
    return Boolean(start && end && start <= day && day <= end);
  });
}

function machineAvailableOn(machine, day, downtimeLogs) {
  return machineModel.isAvailableOn(machine, day) && !machineBlockedByDowntime(machine, day, downtimeLogs);
}

function getExistingMachineDayLoads(schedules, machines, startDate) {
  const machineById = new Map((Array.isArray(machines) ? machines : []).map((machine) => [machine.id, machine]));
  const loads = new Map();
  (Array.isArray(schedules) ? schedules : []).forEach((session) => {
    if (!session || !session.machineId || !scheduling.validDate(session.date) || session.date < startDate) return;
    if (!machineById.has(session.machineId)) return;
    const hours = Number(session.hours);
    if (!Number.isFinite(hours) || hours <= 0) return;
    const key = session.machineId + '|' + session.date;
    loads.set(key, (loads.get(key) || 0) + hours);
  });
  return loads;
}

function chooseMachine(candidates, day, existingLoads, allocatedLoads, downtimeLogs) {
  return candidates.map((machine) => {
    const key = machine.id + '|' + day;
    const capacity = Number(machine.capacityHoursPerDay);
    const used = (existingLoads.get(key) || 0) + (allocatedLoads.get(key) || 0);
    const available = Math.max(0, capacity - used);
    return { machine, available, loadRatio: capacity > 0 ? used / capacity : 1 };
  }).filter((item) => item.available > EPSILON && machineAvailableOn(item.machine, day, downtimeLogs))
    .sort((a, b) => a.loadRatio - b.loadRatio || b.available - a.available ||
      String(a.machine.id).localeCompare(String(b.machine.id)))[0] || null;
}

function priorityWeight(value) {
  const normalized = String(value || 'Normal').trim().toLocaleLowerCase();
  if (normalized === 'urgent' || normalized === 'critical') return 4;
  if (normalized === 'high') return 3;
  if (normalized === 'low') return 1;
  return 2;
}

function dueDateRank(job, startDate) {
  if (!job.dueDate || !scheduling.validDate(job.dueDate)) return Number.POSITIVE_INFINITY;
  return dayDifference(startDate, job.dueDate);
}

function sumActualHours(jobId, productionLogs) {
  return (Array.isArray(productionLogs) ? productionLogs : []).reduce((total, log) => {
    if (!log || log.jobId !== jobId) return total;
    const value = Number(log.actualHours);
    return Number.isFinite(value) && value > 0 ? total + value : total;
  }, 0);
}

function sumCommittedHours(jobId, schedules, startDate) {
  return (Array.isArray(schedules) ? schedules : []).reduce((total, session) => {
    if (!session || session.jobId !== jobId || !scheduling.validDate(session.date) || session.date < startDate) return total;
    const value = Number(session.hours);
    return Number.isFinite(value) && value > 0 ? total + value : total;
  }, 0);
}

function getExistingWorkerDayLoads(schedules, workers, startDate) {
  const workerById = new Map((Array.isArray(workers) ? workers : []).map((worker) => [worker.id, worker]));
  const loads = new Map();
  (Array.isArray(schedules) ? schedules : []).forEach((session) => {
    if (!session || !scheduling.validDate(session.date) || session.date < startDate) return;
    const worker = workerById.get(session.workerId);
    if (!worker) return;
    const hours = Number(session.hours);
    if (!Number.isFinite(hours) || hours <= 0) return;
    const key = worker.id + '|' + session.date;
    loads.set(key, (loads.get(key) || 0) + hours);
  });
  return loads;
}

function jobOrder(a, b, startDate) {
  const dueA = dueDateRank(a, startDate);
  const dueB = dueDateRank(b, startDate);
  if (dueA !== dueB) return dueA - dueB;
  const priority = priorityWeight(b.priority) - priorityWeight(a.priority);
  if (priority) return priority;
  const hoursA = Number(a.estimatedHours);
  const hoursB = Number(b.estimatedHours);
  return (Number.isFinite(hoursA) ? hoursA : Number.POSITIVE_INFINITY) -
    (Number.isFinite(hoursB) ? hoursB : Number.POSITIVE_INFINITY) ||
    String(a.id).localeCompare(String(b.id));
}

function chooseWorker(candidates, job, day, workerLoads, allocatedLoads) {
  return candidates.map((worker) => {
    const key = worker.id + '|' + day;
    const capacity = Number(worker.capacityHoursPerDay);
    const used = (workerLoads.get(key) || 0) + (allocatedLoads.get(key) || 0);
    const available = Math.max(0, capacity - used);
    const preferred = job.workerId === worker.id || job.worker === worker.name ? 1 : 0;
    const requestedSkill = normalizeSkill(job.requiredSkill);
    const exactSkill = requestedSkill && normalizeSkill(worker.skill) === requestedSkill ? 1 : 0;
    const loadRatio = capacity > 0 ? used / capacity : 1;
    return { worker, available, preferred, exactSkill, loadRatio };
  }).filter((item) => item.available > EPSILON)
    .sort((a, b) =>
      b.preferred - a.preferred ||
      b.exactSkill - a.exactSkill ||
      a.loadRatio - b.loadRatio ||
      b.available - a.available ||
      String(a.worker.id).localeCompare(String(b.worker.id))
    )[0] || null;
}

function optimizeSchedule(jobs, workers, schedules, productionLogs, rawOptions = {}, rawMachines = [], rawDowntimeLogs = []) {
  const options = normalizeOptions(rawOptions);
  const activeJobs = scheduling.activeJobs(jobs);
  const activeWorkers = (Array.isArray(workers) ? workers : []).filter((worker) =>
    worker && worker.active !== false &&
    Number.isFinite(Number(worker.capacityHoursPerDay)) &&
    Number(worker.capacityHoursPerDay) > 0 &&
    Number(worker.capacityHoursPerDay) <= 24
  );
  const workerById = new Map(activeWorkers.map((worker) => [worker.id, worker]));
  const machineInventory = Array.isArray(rawMachines) ? rawMachines : [];
  const machineConfigured = machineInventory.length > 0;
  const activeMachines = machineInventory.filter((machine) =>
    machine && machine.active !== false &&
    Number.isFinite(Number(machine.capacityHoursPerDay)) &&
    Number(machine.capacityHoursPerDay) > 0 &&
    Number(machine.capacityHoursPerDay) <= 24
  );
  const existingLoads = getExistingWorkerDayLoads(schedules, workers, options.startDate);
  const allocatedLoads = new Map();
  const existingMachineLoads = getExistingMachineDayLoads(schedules, machineInventory, options.startDate);
  const allocatedMachineLoads = new Map();
  const proposals = [];
  const issues = [];
  const jobPlans = [];

  const rankedJobs = activeJobs.slice().sort((a, b) => jobOrder(a, b, options.startDate));

  rankedJobs.forEach((job) => {
    const estimate = Number(job.estimatedHours);
    if (!Number.isFinite(estimate) || estimate <= 0 || estimate > 100000) {
      jobPlans.push({
        jobId: job.id,
        job: job.item || '',
        customer: job.customer || '',
        priority: job.priority || 'Normal',
        dueDate: scheduling.validDate(job.dueDate) ? job.dueDate : '',
        status: 'Needs estimate',
        estimatedHours: null,
        actualHours: round(sumActualHours(job.id, productionLogs)),
        committedHours: round(sumCommittedHours(job.id, schedules, options.startDate)),
        proposedHours: 0,
        unscheduledHours: 0,
        finishDate: null,
        deadlineRisk: false,
        reason: 'Add a positive estimated production-hour total before this job can be optimized.'
      });
      issues.push({ jobId: job.id, type: 'missing-estimate', message: job.id + ' needs an estimated production-hour total.' });
      return;
    }

    const actualHours = Math.min(estimate, sumActualHours(job.id, productionLogs));
    const committedHours = Math.min(Math.max(0, estimate - actualHours), sumCommittedHours(job.id, schedules, options.startDate));
    let remaining = Math.max(0, estimate - actualHours - committedHours);
    const startRemaining = remaining;
    const candidates = activeWorkers.filter((worker) => skillMatches(worker, job));
    const requestedMachineId = String(job.machineId || job.requiredMachineId || '').trim();
    const machineCandidates = machineConfigured
      ? activeMachines.filter((machine) =>
          (!requestedMachineId || machine.id === requestedMachineId) && machineSkillMatches(machine, job))
      : [];
    const proposedForJob = [];
    let finishDate = null;

    if (remaining > EPSILON && !candidates.length) {
      issues.push({
        jobId: job.id,
        type: 'no-compatible-worker',
        message: job.id + ' has no active worker matching required skill "' + String(job.requiredSkill || '') + '".'
      });
    }
    if (remaining > EPSILON && machineConfigured && !machineCandidates.length) {
      issues.push({
        jobId: job.id,
        type: 'no-compatible-machine',
        message: requestedMachineId
          ? job.id + ' requires machine ' + requestedMachineId + ', which is not active in this facility or does not support the required operation.'
          : job.id + ' has no active machine compatible with the required operation.'
      });
    }

    for (let offset = 0; offset < options.horizonDays && remaining > EPSILON; offset += 1) {
      const day = addDays(options.startDate, offset);
      const weekday = new Date(day + 'T00:00:00.000Z').getUTCDay();
      if (!options.includeWeekends && (weekday === 0 || weekday === 6)) continue;

      const availableCandidates = candidates.filter((worker) =>
        !(Array.isArray(worker.unavailableDates) && worker.unavailableDates.includes(day))
      );
      const selected = chooseWorker(availableCandidates, job, day, existingLoads, allocatedLoads);
      if (!selected) continue;
      const selectedMachine = machineConfigured
        ? chooseMachine(machineCandidates, day, existingMachineLoads, allocatedMachineLoads, rawDowntimeLogs)
        : null;
      if (machineConfigured && !selectedMachine) continue;

      const hours = round(Math.min(
        remaining,
        selected.available,
        machineConfigured ? selectedMachine.available : 24,
        24
      ));
      if (hours <= EPSILON) continue;
      const proposal = {
        jobId: job.id,
        workerId: selected.worker.id,
        workerName: selected.worker.name,
        machineId: selectedMachine ? selectedMachine.machine.id : '',
        machineName: selectedMachine ? selectedMachine.machine.name : '',
        date: day,
        hours,
        note: 'Optimizer suggestion · ' + (job.requiredSkill ? String(job.requiredSkill) : 'capacity-balanced allocation'),
        priority: job.priority || 'Normal',
        dueDate: scheduling.validDate(job.dueDate) ? job.dueDate : ''
      };
      proposals.push(proposal);
      proposedForJob.push(proposal);
      const key = selected.worker.id + '|' + day;
      allocatedLoads.set(key, (allocatedLoads.get(key) || 0) + hours);
      if (selectedMachine) {
        const machineKey = selectedMachine.machine.id + '|' + day;
        allocatedMachineLoads.set(machineKey, (allocatedMachineLoads.get(machineKey) || 0) + hours);
      }
      remaining = Math.max(0, remaining - hours);
      finishDate = day;
    }

    const unscheduledHours = round(remaining);
    if (unscheduledHours > EPSILON && machineConfigured && machineCandidates.length) {
      issues.push({
        jobId: job.id,
        type: 'machine-capacity-gap',
        message: job.id + ' has remaining work that does not fit available machine capacity or maintenance/downtime windows in this horizon.'
      });
    }
    const committedDates = (Array.isArray(schedules) ? schedules : [])
      .filter((session) => session && session.jobId === job.id && scheduling.validDate(session.date) && session.date >= options.startDate)
      .map((session) => session.date);
    const lastExistingDate = committedDates.sort().at(-1) || null;
    const projectedFinish = [finishDate, lastExistingDate].filter(Boolean).sort().at(-1) || null;
    const deadlineRisk = Boolean(
      job.dueDate && scheduling.validDate(job.dueDate) &&
      ((unscheduledHours > EPSILON && projectedFinish && projectedFinish > job.dueDate) ||
        (unscheduledHours <= EPSILON && projectedFinish && projectedFinish > job.dueDate) ||
        (unscheduledHours > EPSILON && (!projectedFinish || projectedFinish <= job.dueDate) && addDays(options.startDate, options.horizonDays - 1) > job.dueDate))
    );

    let reason = '';
    if (unscheduledHours > EPSILON && !candidates.length) reason = 'No active worker is compatible with the required skill.';
    else if (unscheduledHours > EPSILON) reason = 'Not enough compatible worker capacity inside the planning horizon.';
    else if (startRemaining <= EPSILON) reason = 'Already covered by recorded production and committed future sessions.';
    else reason = 'Remaining work allocated within worker capacity.';

    const status = unscheduledHours > EPSILON
      ? (proposedForJob.length ? 'Partially scheduled' : 'Capacity gap')
      : startRemaining <= EPSILON ? 'Already covered' : 'Scheduled';

    jobPlans.push({
      jobId: job.id,
      job: job.item || '',
      customer: job.customer || '',
      priority: job.priority || 'Normal',
      dueDate: scheduling.validDate(job.dueDate) ? job.dueDate : '',
      status,
      estimatedHours: round(estimate),
      actualHours: round(actualHours),
      committedHours: round(committedHours),
      proposedHours: round(startRemaining - unscheduledHours),
      unscheduledHours,
      finishDate: projectedFinish,
      deadlineRisk,
      reason
    });
  });

  const loadTotals = new Map();
  const workerMap = new Map((Array.isArray(workers) ? workers : []).map((worker) => [worker.id, worker]));
  const addLoad = (workerId, date, hours) => {
    const worker = workerMap.get(workerId);
    if (!worker || !scheduling.validDate(date)) return;
    const key = workerId + '|' + date;
    const current = loadTotals.get(key) || {
      workerId,
      workerName: worker.name,
      date,
      capacityHours: Number(worker.capacityHoursPerDay) || 0,
      committedHours: 0,
      proposedHours: 0
    };
    loadTotals.set(key, current);
    return current;
  };
  (Array.isArray(schedules) ? schedules : []).forEach((session) => {
    if (!session || !scheduling.validDate(session.date) || session.date < options.startDate) return;
    const row = addLoad(session.workerId, session.date, Number(session.hours));
    if (row && Number.isFinite(Number(session.hours)) && Number(session.hours) > 0) row.committedHours += Number(session.hours);
  });
  proposals.forEach((proposal) => {
    const row = addLoad(proposal.workerId, proposal.date, proposal.hours);
    if (row) row.proposedHours += proposal.hours;
  });
  const dailyLoads = [...loadTotals.values()].map((row) => ({
    ...row,
    totalHours: round(row.committedHours + row.proposedHours),
    remainingHours: round(Math.max(0, row.capacityHours - row.committedHours - row.proposedHours)),
    overCapacityHours: round(Math.max(0, row.committedHours + row.proposedHours - row.capacityHours))
  })).sort((a, b) => a.date.localeCompare(b.date) || a.workerName.localeCompare(b.workerName));

  const machineLoadTotals = new Map();
  const machineById = new Map(machineInventory.map((machine) => [machine.id, machine]));
  const addMachineLoad = (machineId, date, hours) => {
    const machine = machineById.get(machineId);
    if (!machine || !scheduling.validDate(date)) return null;
    const key = machineId + '|' + date;
    const row = machineLoadTotals.get(key) || {
      machineId,
      machineName: machine.name,
      date,
      capacityHours: Number(machine.capacityHoursPerDay) || 0,
      committedHours: 0,
      proposedHours: 0
    };
    machineLoadTotals.set(key, row);
    return row;
  };
  (Array.isArray(schedules) ? schedules : []).forEach((session) => {
    if (!session || !session.machineId || !scheduling.validDate(session.date) || session.date < options.startDate) return;
    const row = addMachineLoad(session.machineId, session.date, Number(session.hours));
    if (row && Number.isFinite(Number(session.hours)) && Number(session.hours) > 0) row.committedHours += Number(session.hours);
  });
  proposals.forEach((proposal) => {
    if (!proposal.machineId) return;
    const row = addMachineLoad(proposal.machineId, proposal.date, proposal.hours);
    if (row) row.proposedHours += proposal.hours;
  });
  const dailyMachineLoads = [...machineLoadTotals.values()].map((row) => ({
    ...row,
    totalHours: round(row.committedHours + row.proposedHours),
    remainingHours: round(Math.max(0, row.capacityHours - row.committedHours - row.proposedHours)),
    overCapacityHours: round(Math.max(0, row.committedHours + row.proposedHours - row.capacityHours))
  })).sort((a, b) => a.date.localeCompare(b.date) || a.machineName.localeCompare(b.machineName));

  const plannedJobs = jobPlans.filter((item) => ['Scheduled', 'Already covered'].includes(item.status));
  const deadlineTracked = jobPlans.filter((item) => item.dueDate && item.estimatedHours !== null);
  const onTime = deadlineTracked.filter((item) => !item.deadlineRisk && item.unscheduledHours <= EPSILON);
  const scheduledHours = round(proposals.reduce((sum, item) => sum + item.hours, 0));
  const unscheduledHours = round(jobPlans.reduce((sum, item) => sum + item.unscheduledHours, 0));

  return {
    generatedAt: new Date().toISOString(),
    options,
    summary: {
      activeJobCount: activeJobs.length,
      estimatedJobCount: jobPlans.filter((item) => item.estimatedHours !== null).length,
      missingEstimateCount: jobPlans.filter((item) => item.status === 'Needs estimate').length,
      scheduledJobCount: plannedJobs.length,
      partialJobCount: jobPlans.filter((item) => item.status === 'Partially scheduled').length,
      capacityGapCount: jobPlans.filter((item) => item.status === 'Capacity gap').length,
      proposedSessionCount: proposals.length,
      scheduledHours,
      unscheduledHours,
      deadlineRiskCount: jobPlans.filter((item) => item.deadlineRisk).length,
      onTimePercent: deadlineTracked.length ? round(onTime.length / deadlineTracked.length * 100) : null,
      overloadedWorkerDays: dailyLoads.filter((item) => item.overCapacityHours > EPSILON).length,
      machineCount: activeMachines.length,
      machineCapacityConflicts: dailyMachineLoads.filter((item) => item.overCapacityHours > EPSILON).length,
      machinesUsed: new Set(proposals.map((item) => item.machineId).filter(Boolean)).size
    },
    proposals,
    jobPlans,
    dailyLoads,
    dailyMachineLoads,
    issues
  };
}

return { normalizeOptions, skillMatches, optimizeSchedule };
});
