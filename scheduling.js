(function attachFactoryFlowScheduling(root, factory) {
  const scheduling = factory();
  if (typeof module === 'object' && module.exports) module.exports = scheduling;
  if (root) root.FactoryFlowScheduling = scheduling;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowScheduling() {
  'use strict';

  const terminalStatuses = new Set(['Delivered', 'QC review', 'Cancelled']);

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function activeJobs(jobs) {
    return (Array.isArray(jobs) ? jobs : []).filter((job) => job && !terminalStatuses.has(job.status));
  }

  function scheduleSession(schedules, jobs, workers, input) {
    if (!Array.isArray(schedules)) throw new TypeError('Schedule records must be an array.');

    const job = (Array.isArray(jobs) ? jobs : []).find((item) => item.id === input.jobId);
    if (!job || terminalStatuses.has(job.status)) {
      throw new Error('Choose a job that is still active.');
    }

    const worker = (Array.isArray(workers) ? workers : []).find((item) => item.id === input.workerId);
    if (!worker || worker.active === false) {
      throw new Error('Choose an active job worker.');
    }

    if (!validDate(input.date)) throw new Error('Choose a valid production date.');

    const hours = Number(input.hours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      throw new Error('Planned hours must be greater than zero and no more than 24.');
    }

    const capacity = Number(worker.capacityHoursPerDay);
    if (!Number.isFinite(capacity) || capacity <= 0 || capacity > 24) {
      throw new Error('Set a valid daily capacity for this worker before scheduling.');
    }

    const unavailableDates = Array.isArray(worker.unavailableDates) ? worker.unavailableDates : [];
    if (unavailableDates.includes(input.date)) {
      throw new Error(worker.name + ' is marked unavailable on ' + input.date + '.');
    }

    const assignedHours = schedules.reduce((total, session) => {
      return session.workerId === worker.id && session.date === input.date
        ? total + Number(session.hours || 0)
        : total;
    }, 0);
    const remainingCapacity = Math.max(0, capacity - assignedHours);
    if (hours > remainingCapacity + 1e-9) {
      throw new Error(worker.name + ' has only ' + remainingCapacity + ' hours available on this date (daily capacity: ' + capacity + ' hours).');
    }

    if (input.dueDate && !validDate(input.dueDate)) {
      throw new Error('Choose a valid job deadline.');
    }
    const nextId = schedules.reduce((max, item) => {
      const match = /^SC-(\d+)$/.exec(String(item.id || ''));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 100) + 1;
    const session = {
      id: 'SC-' + nextId,
      jobId: job.id,
      workerId: worker.id,
      workerName: worker.name,
      date: input.date,
      hours,
      note: String(input.note || '').trim(),
      createdAt: input.createdAt || new Date().toISOString()
    };
    schedules.push(session);

    if (input.dueDate) job.dueDate = input.dueDate;
    job.worker = worker.name;
    return { session, worker, job, assignedHours: assignedHours + hours, remainingCapacity: Math.max(0, remainingCapacity - hours) };
  }

  function removeSession(schedules, sessionId) {
    if (!Array.isArray(schedules)) throw new TypeError('Schedule records must be an array.');
    const index = schedules.findIndex((item) => item.id === sessionId);
    if (index < 0) return null;
    return schedules.splice(index, 1)[0];
  }

  function analyzeSchedule(jobs, schedules, workers) {
    const active = activeJobs(jobs);
    const activeJobIds = new Set(active.map((job) => job.id));
    const workerById = new Map((Array.isArray(workers) ? workers : []).map((worker) => [worker.id, worker]));
    const jobById = new Map(active.map((job) => [job.id, job]));
    const dailyLoads = new Map();
    const sessions = [];
    const issues = [];
    const deadlineRisks = [];

    (Array.isArray(schedules) ? schedules : []).forEach((session) => {
      if (!activeJobIds.has(session.jobId)) return;
      const job = jobById.get(session.jobId);
      const worker = workerById.get(session.workerId);
      if (!worker) {
        issues.push({ sessionId: session.id, jobId: job.id, message: 'Assigned worker is missing.' });
        return;
      }
      if (worker.active === false) {
        issues.push({ sessionId: session.id, jobId: job.id, message: worker.name + ' is inactive but still has a scheduled session.' });
      }
      const hours = Number(session.hours);
      if (!validDate(session.date) || !Number.isFinite(hours) || hours <= 0) {
        issues.push({ sessionId: session.id, jobId: job.id, message: 'Invalid schedule date or planned hours.' });
        return;
      }

      const key = worker.id + '|' + session.date;
      const load = dailyLoads.get(key) || {
        workerId: worker.id,
        workerName: worker.name,
        date: session.date,
        assignedHours: 0,
        capacityHours: Number(worker.capacityHoursPerDay) || 0,
        sessionIds: [],
        jobIds: []
      };
      load.assignedHours += hours;
      load.sessionIds.push(session.id);
      if (!load.jobIds.includes(job.id)) load.jobIds.push(job.id);
      dailyLoads.set(key, load);

      const deadlineRisk = Boolean(job.dueDate && validDate(job.dueDate) && session.date > job.dueDate);
      const record = {
        ...session,
        job: job.item,
        customer: job.customer,
        workerName: worker.name,
        capacityHours: Number(worker.capacityHoursPerDay) || 0,
        deadlineRisk,
        workerUnavailable: Array.isArray(worker.unavailableDates) && worker.unavailableDates.includes(session.date)
      };
      sessions.push(record);

      if (deadlineRisk) {
        deadlineRisks.push({
          sessionId: session.id,
          jobId: job.id,
          scheduledDate: session.date,
          dueDate: job.dueDate,
          message: 'Scheduled production is after the job deadline.'
        });
      }
      if (record.workerUnavailable) {
        issues.push({ sessionId: session.id, jobId: job.id, message: worker.name + ' is unavailable on ' + session.date + '.' });
      }
    });

    const capacityConflicts = [...dailyLoads.values()]
      .filter((load) => load.assignedHours > load.capacityHours + 1e-9)
      .map((load) => ({
        ...load,
        overflowHours: Math.round((load.assignedHours - load.capacityHours) * 100) / 100,
        message: load.workerName + ' is over capacity on ' + load.date + '.'
      }));

    sessions.sort((a, b) => a.date.localeCompare(b.date) || a.workerName.localeCompare(b.workerName) || a.jobId.localeCompare(b.jobId));
    return {
      activeJobCount: active.length,
      sessionCount: sessions.length,
      sessions,
      dailyLoads: [...dailyLoads.values()].sort((a, b) => a.date.localeCompare(b.date) || a.workerName.localeCompare(b.workerName)),
      capacityConflicts,
      deadlineRisks,
      issues
    };
  }

  function updateWorker(workers, workerId, input) {
    if (!Array.isArray(workers)) throw new TypeError('Workers must be an array.');
    const worker = workers.find((item) => item.id === workerId);
    if (!worker) throw new Error('Worker not found.');

    const capacity = Number(input.capacityHoursPerDay);
    if (!Number.isFinite(capacity) || capacity <= 0 || capacity > 24) {
      throw new Error('Daily capacity must be between 0 and 24 hours.');
    }
    const name = String(input.name || '').trim();
    const skill = String(input.skill || '').trim();
    if (!name || !skill) throw new Error('Enter both a worker name and skill.');
    const unavailableDates = Array.isArray(input.unavailableDates) ? input.unavailableDates : [];
    if (unavailableDates.some((date) => !validDate(date))) {
      throw new Error('Unavailable dates must use YYYY-MM-DD.');
    }
    worker.name = name;
    worker.skill = skill;
    worker.capacityHoursPerDay = capacity;
    worker.active = input.active !== false;
    worker.unavailableDates = [...new Set(unavailableDates)];
    return worker;
  }

  return { validDate, activeJobs, scheduleSession, removeSession, analyzeSchedule, updateWorker };
});
