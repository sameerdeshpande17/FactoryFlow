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
    if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function nextId(records, prefix, field) {
    let max = 100;
    list(records).forEach((record) => {
      const match = new RegExp('^' + prefix + '-(\\\\d+)$').exec(String(field ? record && record[field] : record && record.id || ''));
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
    if (title.length < 3 || title.length > 120) throw new Error('Work-order title must be 3–120 characters.');
    if (!description || description.length > 1200) throw new Error('Describe the maintenance issue (maximum 1,200 characters).');
    if (!TYPES.includes(type)) throw new Error('Choose a supported maintenance work type.');
    if (!PRIORITIES.includes(priority)) throw new Error('Choose a supported work-order priority.');
    if (dueDate && !validDate(dueDate)) throw new Error('Due date must be a valid YYYY-MM-DD date.');
    if (assignedTo.length > 100) throw new Error('Technician name must be 100 characters or fewer.');
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

  return {
    STATUSES,
    PRIORITIES,
    TYPES,
    validDate,
    createWorkOrder,
    updateWorkOrder,
    recordPartUsage
  };
});
