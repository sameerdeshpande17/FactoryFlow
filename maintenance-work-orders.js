(function attachFactoryFlowMaintenanceWorkOrders(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FactoryFlowMaintenanceWorkOrders = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createMaintenanceWorkOrders() {
  'use strict';

  const STATUSES = ['Open', 'Assigned', 'In progress', 'Waiting for parts', 'Completed', 'Cancelled'];
  const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
  const TYPES = ['Breakdown repair', 'Preventive maintenance', 'Inspection', 'Calibration', 'Lubrication', 'Parts replacement', 'Other'];
  const TRANSITIONS = {
    Open: ['Assigned', 'In progress', 'Cancelled'],
    Assigned: ['Open', 'In progress', 'Waiting for parts', 'Cancelled'],
    'In progress': ['Assigned', 'Waiting for parts', 'Completed', 'Cancelled'],
    'Waiting for parts': ['Assigned', 'In progress', 'Cancelled'],
    Completed: [],
    Cancelled: []
  };

  function list(value) { return Array.isArray(value) ? value : []; }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function nextId(records, prefix, field) {
    let max = 100;
    list(records).forEach((record) => {
      const value = field ? record && record[field] : record && record.id;
      const match = new RegExp('^' + prefix + '-(\\d+)$').exec(String(value || ''));
      if (match) max = Math.max(max, Number(match[1]));
    });
    return prefix + '-' + (max + 1);
  }

  function createWorkOrder(workOrders, machines, input = {}, actor = {}) {
    if (!Array.isArray(workOrders)) throw new TypeError('Maintenance work orders must be an array.');
    const machine = list(machines).find((item) => item && item.id === String(input.machineId || ''));
    if (!machine) throw new Error('Select a machine from the active facility.');
    const title = String(input.title || '').trim();
    const description = String(input.description || '').trim();
    const type = String(input.type || 'Breakdown repair').trim();
    const priority = String(input.priority || 'Normal').trim();
    const dueDate = String(input.dueDate || '').trim();
    const assignedTo = String(input.assignedTo || '').trim();
    const laborHours = Number(input.laborHours || 0);
    const laborRate = Number(input.laborRate || 0);
    if (title.length < 3 || title.length > 120) throw new Error('Work-order title must be 3–120 characters.');
    if (!description || description.length > 1200) throw new Error('Describe the maintenance issue (maximum 1,200 characters).');
    if (!TYPES.includes(type)) throw new Error('Choose a supported maintenance work type.');
    if (!PRIORITIES.includes(priority)) throw new Error('Choose a supported work-order priority.');
    if (dueDate && !validDate(dueDate)) throw new Error('Due date must be a valid YYYY-MM-DD date.');
    if (assignedTo.length > 100) throw new Error('Technician name must be 100 characters or fewer.');
    if (![laborHours, laborRate].every(Number.isFinite) || laborHours < 0 || laborHours > 10000 || laborRate < 0 || laborRate > 1000000) {
      throw new Error('Labour hours and hourly rate must be valid non-negative values within supported limits.');
    }
    const now = new Date().toISOString();
    const order = {
      id: nextId(workOrders, 'MWO'),
      facilityId: machine.facilityId || '',
      machineId: machine.id,
      machineCode: machine.code || '',
      machineName: machine.name || '',
      title,
      description,
      type,
      priority,
      dueDate,
      assignedTo,
      laborHours,
      laborRate,
      laborCost: Math.round(laborHours * laborRate * 100) / 100,
      status: assignedTo ? 'Assigned' : 'Open',
      partsUsed: [],
      createdBy: actor.id || '',
      createdByName: actor.name || '',
      createdAt: now,
      updatedAt: now,
      resolutionNotes: '',
      completedAt: '',
      completedBy: '',
      serviceRecordId: ''
    };
    workOrders.push(order);
    return order;
  }

  function updateWorkOrder(workOrders, workOrderId, input = {}, actor = {}) {
    const order = list(workOrders).find((item) => item && item.id === workOrderId);
    if (!order) throw new Error('Maintenance work order not found in this facility.');
    if (['Completed', 'Cancelled'].includes(order.status)) throw new Error('Completed or cancelled work orders cannot be changed.');
    if (input.priority !== undefined) {
      const priority = String(input.priority || '').trim();
      if (!PRIORITIES.includes(priority)) throw new Error('Choose a supported work-order priority.');
      order.priority = priority;
    }
    if (input.dueDate !== undefined) {
      const dueDate = String(input.dueDate || '').trim();
      if (dueDate && !validDate(dueDate)) throw new Error('Due date must be a valid YYYY-MM-DD date.');
      order.dueDate = dueDate;
    }
    if (input.assignedTo !== undefined) {
      const assignedTo = String(input.assignedTo || '').trim();
      if (assignedTo.length > 100) throw new Error('Technician name must be 100 characters or fewer.');
      order.assignedTo = assignedTo;
    }
    if (input.laborHours !== undefined || input.laborRate !== undefined) {
      const laborHours = input.laborHours === undefined ? Number(order.laborHours) || 0 : Number(input.laborHours);
      const laborRate = input.laborRate === undefined ? Number(order.laborRate) || 0 : Number(input.laborRate);
      if (![laborHours, laborRate].every(Number.isFinite) || laborHours < 0 || laborHours > 10000 || laborRate < 0 || laborRate > 1000000) {
        throw new Error('Labour hours and hourly rate must be valid non-negative values within supported limits.');
      }
      order.laborHours = laborHours;
      order.laborRate = laborRate;
      order.laborCost = Math.round(laborHours * laborRate * 100) / 100;
    }
    if (input.resolutionNotes !== undefined) {
      const notes = String(input.resolutionNotes || '').trim();
      if (notes.length > 1200) throw new Error('Completion notes must be 1,200 characters or fewer.');
      order.resolutionNotes = notes;
    }
    if (input.status !== undefined) {
      const nextStatus = String(input.status || '').trim();
      if (!STATUSES.includes(nextStatus)) throw new Error('Choose a supported work-order status.');
      if (nextStatus !== order.status && !TRANSITIONS[order.status].includes(nextStatus)) {
        throw new Error('Work order cannot move from ' + order.status + ' to ' + nextStatus + '.');
      }
      if (nextStatus === 'Assigned' && !order.assignedTo) throw new Error('Assign a technician before moving the work order to Assigned.');
      if (nextStatus === 'Completed' && !order.resolutionNotes) {
        throw new Error('Add completion notes before closing this work order.');
      }
      if (nextStatus === 'In progress' && !order.startedAt) order.startedAt = new Date().toISOString();
      if (nextStatus === 'Completed') {
        order.completedAt = new Date().toISOString();
        order.completedBy = actor.id || '';
      }
      order.status = nextStatus;
    }
    order.updatedAt = new Date().toISOString();
    order.updatedBy = actor.id || '';
    return order;
  }

  function recordPartUsage(workOrders, workOrderId, material, rawQuantity, rawUnit, actor = {}) {
    const order = list(workOrders).find((item) => item && item.id === workOrderId);
    if (!order) throw new Error('Maintenance work order not found in this facility.');
    if (['Completed', 'Cancelled'].includes(order.status)) throw new Error('Parts cannot be issued to a completed or cancelled work order.');
    if (!material || material.maintenancePart !== true) throw new Error('Select an inventory item marked as a maintenance spare part.');
    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Part quantity must be greater than zero.');
    const unit = String(rawUnit || '').trim();
    if (!unit || unit.length > 24) throw new Error('Enter a valid unit for the spare part.');
    const cost = material.unitCost === null || material.unitCost === undefined || material.unitCost === '' ||
      !Number.isFinite(Number(material.unitCost)) ? null : Number(material.unitCost);
    const part = {
      id: nextId(order.partsUsed, 'WOP'),
      materialSku: String(material.sku || ''),
      material: String(material.item || ''),
      quantity,
      unit,
      unitCost: cost,
      costAmount: cost === null ? null : Math.round(cost * quantity * 100) / 100,
      issuedBy: actor.id || '',
      issuedByName: actor.name || '',
      issuedAt: new Date().toISOString()
    };
    order.partsUsed = list(order.partsUsed);
    order.partsUsed.push(part);
    order.updatedAt = new Date().toISOString();
    return part;
  }


  function validateTechnician(input = {}, current = null) {
    const name = String(input.name === undefined ? current && current.name || '' : input.name || '').trim();
    const specialty = String(input.specialty === undefined ? current && current.specialty || '' : input.specialty || '').trim();
    const capacityHoursPerDay = Number(input.capacityHoursPerDay === undefined
      ? current && current.capacityHoursPerDay !== undefined ? current.capacityHoursPerDay : 8
      : input.capacityHoursPerDay);
    const hourlyRate = Number(input.hourlyRate === undefined
      ? current && current.hourlyRate !== undefined ? current.hourlyRate : 0
      : input.hourlyRate);
    const workingDays = input.workingDays === undefined
      ? list(current && current.workingDays).length ? current.workingDays : [1, 2, 3, 4, 5, 6]
      : input.workingDays;
    const unavailableDates = input.unavailableDates === undefined
      ? list(current && current.unavailableDates)
      : input.unavailableDates;
    const active = input.active === undefined ? (current ? current.active !== false : true) : input.active;
    if (!name || name.length > 100) throw new Error('Technician name is required and must be 100 characters or fewer.');
    if (specialty.length > 100) throw new Error('Technician specialty must be 100 characters or fewer.');
    if (!Number.isFinite(capacityHoursPerDay) || capacityHoursPerDay < 0.25 || capacityHoursPerDay > 24) {
      throw new Error('Technician daily capacity must be between 0.25 and 24 hours.');
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 1000000) {
      throw new Error('Technician hourly rate must be between 0 and 1,000,000.');
    }
    if (!Array.isArray(workingDays) || !workingDays.length || workingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error('Select at least one valid working day (Sunday = 0 through Saturday = 6).');
    }
    const normalizedDays = [...new Set(workingDays)].sort((a, b) => a - b);
    if (!Array.isArray(unavailableDates) || unavailableDates.length > 366 ||
        unavailableDates.some((date) => !validDate(date))) {
      throw new Error('Technician unavailable dates must be valid YYYY-MM-DD dates (maximum 366).');
    }
    if (typeof active !== 'boolean') throw new Error('Technician status must be active or inactive.');
    return {
      name,
      specialty,
      capacityHoursPerDay,
      hourlyRate,
      workingDays: normalizedDays,
      unavailableDates: [...new Set(unavailableDates)].sort(),
      active
    };
  }

  function createTechnician(technicians, input = {}, actor = {}) {
    if (!Array.isArray(technicians)) throw new TypeError('Technicians must be an array.');
    const fields = validateTechnician(input);
    if (technicians.some((item) => String(item.name || '').trim().toLowerCase() === fields.name.toLowerCase() && item.active !== false)) {
      throw new Error('An active technician with this name already exists in this facility.');
    }
    const now = new Date().toISOString();
    const technician = {
      id: nextId(technicians, 'TECH'),
      ...fields,
      createdBy: actor.id || '',
      createdAt: now,
      updatedAt: now
    };
    technicians.push(technician);
    return technician;
  }

  function updateTechnician(technicians, technicianId, input = {}) {
    const technician = list(technicians).find((item) => item && item.id === technicianId);
    if (!technician) throw new Error('Technician not found in this facility.');
    const fields = validateTechnician(input, technician);
    if (list(technicians).some((item) => item.id !== technicianId && item.active !== false &&
      String(item.name || '').trim().toLowerCase() === fields.name.toLowerCase())) {
      throw new Error('An active technician with this name already exists in this facility.');
    }
    Object.assign(technician, fields, { updatedAt: new Date().toISOString() });
    return technician;
  }

  function validTime(value) {
    return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function scheduleWorkOrder(workOrders, technicians, workOrderId, input = {}, actor = {}) {
    const order = list(workOrders).find((item) => item && item.id === workOrderId);
    if (!order) throw new Error('Maintenance work order not found in this facility.');
    if (['Completed', 'Cancelled'].includes(order.status)) throw new Error('Completed or cancelled work orders cannot be scheduled.');
    const technician = list(technicians).find((item) => item && item.id === String(input.technicianId || ''));
    if (!technician || technician.active === false) throw new Error('Select an active technician from this facility.');
    const date = String(input.scheduledDate || '').trim();
    const startTime = String(input.startTime || '').trim();
    const endTime = String(input.endTime || '').trim();
    if (!validDate(date)) throw new Error('Choose a valid scheduled date.');
    if (!validTime(startTime) || !validTime(endTime) || endTime <= startTime) {
      throw new Error('Choose a valid time range with the end after the start.');
    }
    const day = new Date(date + 'T00:00:00.000Z').getUTCDay();
    if (!list(technician.workingDays).includes(day)) throw new Error('Technician is not scheduled to work on this weekday.');
    if (list(technician.unavailableDates).includes(date)) throw new Error('Technician is unavailable on the selected date.');
    const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    const hours = (endMinutes - startMinutes) / 60;
    if (hours > Number(technician.capacityHoursPerDay)) throw new Error('This time slot exceeds the technician daily capacity.');
    const otherOrders = list(workOrders).filter((item) => item.id !== order.id &&
      item.technicianId === technician.id && item.scheduledDate === date &&
      !['Completed', 'Cancelled'].includes(item.status) && validTime(item.startTime) && validTime(item.endTime));
    const committedHours = otherOrders.reduce((sum, item) => sum +
      Math.max(0, (toMinutes(item.endTime) - toMinutes(item.startTime)) / 60), 0);
    if (committedHours + hours > Number(technician.capacityHoursPerDay) + 1e-9) {
      throw new Error('Technician daily capacity would be exceeded. Available: ' +
        Math.max(0, Number(technician.capacityHoursPerDay) - committedHours).toFixed(2) + ' hours.');
    }
    const overlapping = otherOrders.find((item) =>
      startTime < item.endTime && endTime > item.startTime
    );
    if (overlapping) throw new Error('Time slot overlaps work order ' + overlapping.id + '.');
    order.technicianId = technician.id;
    order.assignedTo = technician.name;
    order.scheduledDate = date;
    order.startTime = startTime;
    order.endTime = endTime;
    order.scheduledHours = Math.round(hours * 100) / 100;
    order.technicianCapacityHoursPerDay = Number(technician.capacityHoursPerDay);
    order.laborRate = Number(technician.hourlyRate) || 0;
    if (!Number(order.laborHours)) order.laborHours = order.scheduledHours;
    order.laborCost = Math.round(Number(order.laborHours) * Number(order.laborRate) * 100) / 100;
    if (order.status === 'Open') order.status = 'Assigned';
    order.updatedAt = new Date().toISOString();
    order.updatedBy = actor.id || '';
    return order;
  }

  function buildTechnicianCalendar(workOrders, technicians, fromDate, dayCount = 7) {
    if (!validDate(fromDate)) throw new Error('Calendar start date must be a valid YYYY-MM-DD date.');
    const days = Math.min(31, Math.max(1, Number(dayCount) || 7));
    const dates = [];
    const start = new Date(fromDate + 'T00:00:00.000Z');
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      dates.push(date.toISOString().slice(0, 10));
    }
    const events = list(workOrders).filter((order) =>
      order && order.scheduledDate && dates.includes(order.scheduledDate) &&
      !['Completed', 'Cancelled'].includes(order.status)
    ).map((order) => ({
      workOrderId: order.id,
      title: order.title,
      machineName: order.machineName,
      technicianId: order.technicianId || '',
      technicianName: order.assignedTo || 'Unassigned',
      date: order.scheduledDate,
      startTime: order.startTime,
      endTime: order.endTime,
      hours: Number(order.scheduledHours) || 0,
      priority: order.priority,
      status: order.status
    })).sort((a, b) => a.date.localeCompare(b.date) || String(a.startTime).localeCompare(String(b.startTime)));
    const capacity = list(technicians).filter((item) => item && item.active !== false).map((technician) => ({
      technicianId: technician.id,
      technicianName: technician.name,
      capacityHoursPerDay: Number(technician.capacityHoursPerDay) || 0,
      days: dates.map((date) => {
        const day = new Date(date + 'T00:00:00.000Z').getUTCDay();
        const available = list(technician.workingDays).includes(day) && !list(technician.unavailableDates).includes(date);
        const used = events.filter((event) => event.technicianId === technician.id && event.date === date)
          .reduce((sum, event) => sum + event.hours, 0);
        return {
          date,
          available,
          scheduledHours: Math.round(used * 100) / 100,
          remainingHours: Math.round(Math.max(0, Number(technician.capacityHoursPerDay) - used) * 100) / 100
        };
      })
    }));
    return { fromDate, toDate: dates[dates.length - 1], dates, events, capacity };
  }

  return {
    STATUSES,
    PRIORITIES,
    TYPES,
    validDate,
    createWorkOrder,
    updateWorkOrder,
    recordPartUsage,
    validateTechnician,
    createTechnician,
    updateTechnician,
    scheduleWorkOrder,
    buildTechnicianCalendar
  };
});
