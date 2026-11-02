(function attachFactoryFlowMachines(root, factory) {
  const machines = factory();
  if (typeof module === 'object' && module.exports) module.exports = machines;
  if (root) root.FactoryFlowMachines = machines;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowMachines() {
  'use strict';

  function list(value) { return Array.isArray(value) ? value : []; }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function nextId(records, prefix) {
    const max = list(records).reduce((value, record) => {
      const match = new RegExp('^' + prefix + '-(\\\\d+)$').exec(String(record && record.id || ''));
      return match ? Math.max(value, Number(match[1])) : value;
    }, 100);
    return prefix + '-' + (max + 1);
  }

  function normalizeSkills(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const normalized = [];
    const seen = new Set();
    source.forEach((entry) => {
      const skill = String(entry || '').trim().replace(/\\s+/g, ' ');
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
    isAvailableOn
  };
});
