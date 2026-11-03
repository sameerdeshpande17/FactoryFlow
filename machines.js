(function attachFactoryFlowMachines(root, factory) {
  const machines = factory();
  if (typeof module === 'object' && module.exports) module.exports = machines;
  if (root) root.FactoryFlowMachines = machines;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowMachines() {
  'use strict';

  function list(value) { return Array.isArray(value) ? value : []; }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function nextId(records, prefix) {
    const pattern = prefix === 'MCH' ? /^MCH-(\d+)$/ : /^MW-(\d+)$/;
    const max = list(records).reduce((value, record) => {
      const match = pattern.exec(String(record && record.id || ''));
      return match ? Math.max(value, Number(match[1])) : value;
    }, 100);
    return prefix + '-' + (max + 1);
  }

  function normalizeSkills(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const normalized = [];
    const seen = new Set();
    source.forEach((entry) => {
      const skill = String(entry || '').trim().replace(/\s+/g, ' ');
      if (!skill) return;
      const key = skill.toLocaleLowerCase();
      if (skill.length > 60) throw new Error('Each supported operation must be 60 characters or fewer.');
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(skill);
      }
    });
    if (normalized.length > 20) throw new Error('A machine can list at most 20 supported operations.');
    return normalized;
  }

  function validateMaintenanceWindow(input, existing = []) {
    const startDate = String(input.startDate || '').trim();
    const endDate = String(input.endDate || '').trim();
    const reason = String(input.reason || '').trim();
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
      throw new Error('Choose a valid maintenance start and end date, with the end on or after the start.');
    }
    if (!reason || reason.length > 120) throw new Error('Enter a maintenance reason (maximum 120 characters).');
    const notes = String(input.notes || '').trim();
    if (notes.length > 500) throw new Error('Maintenance notes must be 500 characters or fewer.');
    const id = String(input.id || '').trim() || nextId(existing, 'MW');
    if (list(existing).some((window) => window.id === id)) throw new Error('This maintenance window already exists.');
    return { id, startDate, endDate, reason, notes, createdAt: input.createdAt || new Date().toISOString() };
  }

  function validateMachine(input, machines, current = null) {
    const code = String(input.code === undefined ? current && current.code || '' : input.code || '').trim().toUpperCase();
    const name = String(input.name === undefined ? current && current.name || '' : input.name || '').trim();
    const type = String(input.type === undefined ? current && current.type || '' : input.type || '').trim();
    const location = String(input.location === undefined ? current && current.location || '' : input.location || '').trim();
    const capacityHoursPerDay = Number(input.capacityHoursPerDay === undefined
      ? current && current.capacityHoursPerDay
      : input.capacityHoursPerDay);
    const idealUnitsPerHour = input.idealUnitsPerHour === undefined || input.idealUnitsPerHour === null || input.idealUnitsPerHour === ''
      ? Number(current && current.idealUnitsPerHour) || 0
      : Number(input.idealUnitsPerHour);
    const serviceIntervalHours = Number(input.serviceIntervalHours === undefined ? current && current.serviceIntervalHours || 0 : input.serviceIntervalHours || 0);
    const serviceIntervalDays = Number(input.serviceIntervalDays === undefined ? current && current.serviceIntervalDays || 0 : input.serviceIntervalDays || 0);
    const serviceAlertLeadHours = Number(input.serviceAlertLeadHours === undefined ? current && current.serviceAlertLeadHours !== undefined ? current.serviceAlertLeadHours : 10 : input.serviceAlertLeadHours);
    const serviceAlertLeadDays = Number(input.serviceAlertLeadDays === undefined ? current && current.serviceAlertLeadDays !== undefined ? current.serviceAlertLeadDays : 7 : input.serviceAlertLeadDays);
    const active = input.active === undefined ? (current ? current.active !== false : true) : input.active;
    const supportedSkills = input.supportedSkills === undefined
      ? list(current && current.supportedSkills)
      : normalizeSkills(input.supportedSkills);

    if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(code)) throw new Error('Machine code must be 2–20 letters, numbers or hyphens.');
    if (!name || name.length > 100) throw new Error('Enter a machine name (maximum 100 characters).');
    if (type.length > 80 || location.length > 100) throw new Error('Machine type or location is too long.');
    if (!Number.isFinite(capacityHoursPerDay) || capacityHoursPerDay < 0.25 || capacityHoursPerDay > 24) {
      throw new Error('Daily machine capacity must be between 0.25 and 24 hours.');
    }
    if (typeof active !== 'boolean') throw new Error('Machine status must be active or inactive.');
    if (!Number.isFinite(idealUnitsPerHour) || idealUnitsPerHour < 0 || (idealUnitsPerHour > 0 && idealUnitsPerHour < 0.01) || idealUnitsPerHour > 1000000) {
      throw new Error('Ideal output rate must be zero (not configured) or between 0.01 and 1,000,000 units per hour.');
    }
    if (![serviceIntervalHours, serviceIntervalDays, serviceAlertLeadHours, serviceAlertLeadDays].every(Number.isFinite) ||
        serviceIntervalHours < 0 || serviceIntervalHours > 100000 ||
        serviceIntervalDays < 0 || serviceIntervalDays > 3650 ||
        serviceAlertLeadHours < 0 || serviceAlertLeadHours > 500 ||
        serviceAlertLeadDays < 0 || serviceAlertLeadDays > 365) {
      throw new Error('Maintenance intervals and reminder lead times must be within their supported ranges.');
    }
    if (list(machines).some((machine) => machine.id !== (current && current.id) && String(machine.code || '').toUpperCase() === code)) {
      throw new Error('A machine with this code already exists in this facility.');
    }
    const maintenanceWindows = list(input.maintenanceWindows === undefined
      ? current && current.maintenanceWindows
      : input.maintenanceWindows).map((window) => {
      if (!window || typeof window !== 'object') throw new Error('Maintenance windows must be valid records.');
      const startDate = String(window.startDate || '');
      const endDate = String(window.endDate || '');
      const reason = String(window.reason || '').trim();
      if (!validDate(startDate) || !validDate(endDate) || startDate > endDate || !reason || reason.length > 120) {
        throw new Error('A machine has an invalid maintenance window.');
      }
      return {
        id: String(window.id || '').trim() || nextId([], 'MW'),
        startDate,
        endDate,
        reason,
        notes: String(window.notes || '').trim().slice(0, 500),
        createdAt: window.createdAt || new Date().toISOString()
      };
    });
    const windowIds = new Set();
    maintenanceWindows.forEach((window) => {
      if (windowIds.has(window.id)) throw new Error('Duplicate maintenance window ID.');
      windowIds.add(window.id);
    });

    return {
      code,
      name,
      type,
      location,
      capacityHoursPerDay,
      idealUnitsPerHour,
      serviceIntervalHours,
      serviceIntervalDays,
      serviceAlertLeadHours,
      serviceAlertLeadDays,
      supportedSkills,
      active,
      maintenanceWindows
    };
  }

  function createMachine(machines, input) {
    if (!Array.isArray(machines)) throw new TypeError('Machines must be an array.');
    const fields = validateMachine(input || {}, machines);
    const machine = {
      id: nextId(machines, 'MCH'),
      ...fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    machines.push(machine);
    return machine;
  }

  function updateMachine(machines, machineId, input) {
    if (!Array.isArray(machines)) throw new TypeError('Machines must be an array.');
    const machine = machines.find((item) => item && item.id === machineId);
    if (!machine) throw new Error('Machine not found in this facility.');
    const fields = validateMachine(input || {}, machines, machine);
    Object.assign(machine, fields, { updatedAt: new Date().toISOString() });
    return machine;
  }

  function addMaintenanceWindow(machines, machineId, input) {
    const machine = list(machines).find((item) => item && item.id === machineId);
    if (!machine) throw new Error('Machine not found in this facility.');
    const windows = list(machine.maintenanceWindows);
    const window = validateMaintenanceWindow(input || {}, windows);
    machine.maintenanceWindows = [...windows, window].sort((a, b) => a.startDate.localeCompare(b.startDate));
    machine.updatedAt = new Date().toISOString();
    return window;
  }

  function removeMaintenanceWindow(machines, machineId, windowId) {
    const machine = list(machines).find((item) => item && item.id === machineId);
    if (!machine) throw new Error('Machine not found in this facility.');
    const windows = list(machine.maintenanceWindows);
    const next = windows.filter((window) => window.id !== windowId);
    if (next.length === windows.length) throw new Error('Maintenance window not found.');
    machine.maintenanceWindows = next;
    machine.updatedAt = new Date().toISOString();
    return machine;
  }


  function addDays(date, count) {
    const value = new Date(date + 'T00:00:00.000Z');
    value.setUTCDate(value.getUTCDate() + count);
    return value.toISOString().slice(0, 10);
  }

  function daysBetween(fromDate, toDate) {
    return Math.round((Date.parse(toDate + 'T00:00:00.000Z') - Date.parse(fromDate + 'T00:00:00.000Z')) / 86400000);
  }

  function recordService(records, machines, machineId, input = {}, actor = {}) {
    if (!Array.isArray(records)) throw new TypeError('Maintenance records must be an array.');
    const machine = list(machines).find((item) => item && item.id === machineId);
    if (!machine) throw new Error('Machine not found in this facility.');
    const serviceDate = String(input.serviceDate || '').trim();
    const serviceType = String(input.serviceType || '').trim();
    const performedBy = String(input.performedBy || actor.name || '').trim();
    const notes = String(input.notes || '').trim();
    const today = new Date().toISOString().slice(0, 10);
    if (!validDate(serviceDate) || serviceDate > today) throw new Error('Choose a valid service date that is not in the future.');
    if (!serviceType || serviceType.length > 100) throw new Error('Enter a service type (maximum 100 characters).');
    if (!performedBy || performedBy.length > 100) throw new Error('Enter who performed the service (maximum 100 characters).');
    if (notes.length > 500) throw new Error('Service notes must be 500 characters or fewer.');
    const sequence = list(records).reduce((max, item) => {
      const match = /^SRV-(\d+)$/.exec(String(item && item.id || ''));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 100) + 1;
    const record = {
      id: 'SRV-' + sequence,
      machineId: machine.id,
      machineCode: machine.code,
      machineName: machine.name,
      facilityId: machine.facilityId || '',
      serviceDate,
      serviceType,
      performedBy,
      notes,
      createdBy: actor.id || '',
      createdAt: input.createdAt || new Date().toISOString()
    };
    records.push(record);
    return record;
  }

  function buildMachineHealth(input = {}) {
    const machines = list(input.machines).filter(Boolean);
    const schedules = list(input.schedules);
    const productionLogs = list(input.productionLogs);
    const downtimeLogs = list(input.downtimeLogs);
    const maintenanceRecords = list(input.maintenanceRecords);
    const asOfDate = input.asOfDate || new Date().toISOString().slice(0, 10);
    const lookbackDays = Math.min(365, Math.max(1, Number(input.lookbackDays) || 90));
    if (!validDate(asOfDate)) throw new Error('Machine health date must be a valid YYYY-MM-DD date.');
    const fromDate = addDays(asOfDate, -lookbackDays + 1);
    const schedulesByMachine = new Map();
    const schedulesById = new Map(schedules.filter(Boolean).map((item) => [item.id, item]));
    schedules.forEach((session) => {
      if (!session || !session.machineId || !validDate(session.date) || session.date > asOfDate) return;
      const rows = schedulesByMachine.get(session.machineId) || [];
      rows.push(session);
      schedulesByMachine.set(session.machineId, rows);
    });
    const actualBySession = new Map();
    productionLogs.forEach((entry) => {
      if (!entry || !entry.scheduleId) return;
      const session = schedulesById.get(entry.scheduleId);
      const hours = Number(entry.actualHours);
      if (!session || !Number.isFinite(hours) || hours <= 0) return;
      actualBySession.set(session.id, (actualBySession.get(session.id) || 0) + hours);
    });
    const machineIdsByName = new Map();
    machines.forEach((machine) => {
      const key = String(machine.name || '').trim().toLowerCase();
      const ids = machineIdsByName.get(key) || [];
      if (key) ids.push(machine.id);
      machineIdsByName.set(key, ids);
    });
    const healthRows = machines.map((machine) => {
      const serviceHistory = maintenanceRecords.filter((record) => record && record.machineId === machine.id)
        .sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')) ||
          String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      const latestService = serviceHistory[0] || null;
      const serviceDate = latestService ? latestService.serviceDate :
        validDate(String(machine.createdAt || '').slice(0, 10)) ? String(machine.createdAt).slice(0, 10) : '';
      const usageHoursSinceService = (schedulesByMachine.get(machine.id) || [])
        .filter((session) => !serviceDate || session.date > serviceDate || (session.date === serviceDate && !latestService))
        .filter((session) => !serviceDate || session.date <= asOfDate)
        .reduce((sum, session) => sum + (actualBySession.get(session.id) || Number(session.hours) || 0), 0);
      const serviceIntervalHours = Number(machine.serviceIntervalHours) || 0;
      const serviceIntervalDays = Number(machine.serviceIntervalDays) || 0;
      const serviceAlertLeadHours = Number(machine.serviceAlertLeadHours === undefined ? 10 : machine.serviceAlertLeadHours);
      const serviceAlertLeadDays = Number(machine.serviceAlertLeadDays === undefined ? 7 : machine.serviceAlertLeadDays);
      const hoursUntilDue = serviceIntervalHours > 0 ? serviceIntervalHours - usageHoursSinceService : null;
      const nextDueDate = serviceDate && serviceIntervalDays > 0 ? addDays(serviceDate, serviceIntervalDays) : '';
      const daysUntilDue = nextDueDate ? daysBetween(asOfDate, nextDueDate) : null;
      const hourDue = hoursUntilDue !== null && hoursUntilDue <= 0;
      const dayDue = daysUntilDue !== null && daysUntilDue <= 0;
      const hourSoon = hoursUntilDue !== null && hoursUntilDue > 0 && hoursUntilDue <= serviceAlertLeadHours;
      const daySoon = daysUntilDue !== null && daysUntilDue > 0 && daysUntilDue <= serviceAlertLeadDays;
      const serviceConfigured = serviceIntervalHours > 0 || serviceIntervalDays > 0;
      const serviceOverdue = hourDue || dayDue;
      const serviceDueSoon = !serviceOverdue && (hourSoon || daySoon);

      const downtime = downtimeLogs.filter((record) => {
        if (!record) return false;
        let machineId = record.machineId || '';
        if (!machineId) {
          const ids = machineIdsByName.get(String(record.machineName || '').trim().toLowerCase()) || [];
          if (ids.length === 1) machineId = ids[0];
        }
        const date = String(record.startAt || '').slice(0, 10);
        return machineId === machine.id && validDate(date) && date >= fromDate && date <= asOfDate;
      });
      const downtimeMinutes = downtime.reduce((sum, record) => sum + Math.max(0, Number(record.durationMinutes) || 0), 0);
      const downtimeHours = downtimeMinutes / 60;
      const breakdowns = downtime.filter((record) => /breakdown|fault|failure|repair|mechanical|electrical/i.test(String(record.reason || '')));
      const signals = [];
      if (!serviceConfigured) signals.push('Maintenance interval not configured');
      if (serviceOverdue) signals.push('Preventive service overdue');
      else if (serviceDueSoon) signals.push('Preventive service due soon');
      if (downtime.length >= 3) signals.push('Repeated downtime events in the last ' + lookbackDays + ' days');
      if (downtimeHours >= 4) signals.push('High downtime duration in the last ' + lookbackDays + ' days');
      if (breakdowns.length >= 2) signals.push('Repeated breakdown / repair reasons');
      let riskScore = 0;
      if (serviceOverdue) riskScore += 35;
      else if (serviceDueSoon) riskScore += 18;
      riskScore += Math.min(24, downtime.length * 6);
      riskScore += Math.min(20, downtimeHours * 4);
      riskScore += Math.min(21, breakdowns.length * 7);
      riskScore = Math.min(100, Math.round(riskScore));
      const riskLevel = riskScore >= 75 ? 'Critical' : riskScore >= 50 ? 'High' : riskScore >= 25 ? 'Moderate' : 'Low';
      const serviceStatus = !serviceConfigured ? 'Not configured' :
        serviceOverdue ? 'Overdue' : serviceDueSoon ? 'Due soon' : 'On track';
      return {
        machineId: machine.id,
        machineCode: machine.code || '',
        machineName: machine.name || machine.code || 'Unnamed machine',
        serviceConfigured,
        serviceIntervalHours,
        serviceIntervalDays,
        lastServiceDate: latestService ? latestService.serviceDate : (serviceDate || null),
        lastServiceType: latestService ? latestService.serviceType : 'Initial setup',
        usageHoursSinceService: Math.round(usageHoursSinceService * 100) / 100,
        hoursUntilDue: hoursUntilDue === null ? null : Math.round(hoursUntilDue * 100) / 100,
        nextDueDate: nextDueDate || null,
        daysUntilDue,
        serviceStatus,
        serviceOverdue,
        serviceDueSoon,
        downtimeEvents: downtime.length,
        downtimeMinutes: Math.round(downtimeMinutes),
        downtimeHours: Math.round(downtimeHours * 100) / 100,
        breakdownEvents: breakdowns.length,
        riskScore,
        riskLevel,
        signals,
        serviceHistory: serviceHistory.slice(0, 8)
      };
    }).sort((a, b) => b.riskScore - a.riskScore || a.machineName.localeCompare(b.machineName));

    const trendMap = new Map();
    downtimeLogs.forEach((record) => {
      if (!record) return;
      const date = String(record.startAt || '').slice(0, 10);
      if (!validDate(date) || date < fromDate || date > asOfDate) return;
      let machineId = record.machineId || '';
      if (!machineId) {
        const ids = machineIdsByName.get(String(record.machineName || '').trim().toLowerCase()) || [];
        if (ids.length === 1) machineId = ids[0];
      }
      if (!machines.some((machine) => machine.id === machineId)) return;
      const point = trendMap.get(date) || { date, events: 0, downtimeMinutes: 0, breakdowns: 0 };
      point.events += 1;
      point.downtimeMinutes += Math.max(0, Number(record.durationMinutes) || 0);
      if (/breakdown|fault|failure|repair|mechanical|electrical/i.test(String(record.reason || ''))) point.breakdowns += 1;
      trendMap.set(date, point);
    });
    const downtimeTrend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((point) => ({
      ...point,
      downtimeHours: Math.round(point.downtimeMinutes / 60 * 100) / 100
    }));
    const summary = {
      machineCount: healthRows.length,
      configuredCount: healthRows.filter((item) => item.serviceConfigured).length,
      overdueCount: healthRows.filter((item) => item.serviceOverdue).length,
      dueSoonCount: healthRows.filter((item) => item.serviceDueSoon).length,
      highRiskCount: healthRows.filter((item) => ['High', 'Critical'].includes(item.riskLevel)).length,
      downtimeHours: Math.round(healthRows.reduce((sum, item) => sum + item.downtimeHours, 0) * 100) / 100
    };
    return { asOfDate, lookbackDays, summary, machines: healthRows, downtimeTrend };
  }

  function isAvailableOn(machine, date) {
    if (!machine || machine.active === false || !validDate(date)) return false;
    return !list(machine.maintenanceWindows).some((window) =>
      validDate(window.startDate) && validDate(window.endDate) &&
      window.startDate <= date && date <= window.endDate
    );
  }

  return {
    validDate,
    validateMachine,
    validateMaintenanceWindow,
    createMachine,
    updateMachine,
    addMaintenanceWindow,
    removeMaintenanceWindow,
    recordService,
    buildMachineHealth,
    isAvailableOn
  };
});
