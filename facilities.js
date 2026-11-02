const crypto = require('node:crypto');

const DEFAULT_FACILITY_ID = 'FAC-001';
const COLLECTIONS = Object.freeze([
  'quotes', 'jobs', 'purchases', 'materials', 'deliveries', 'receipts',
  'movements', 'requirements', 'workers', 'schedules', 'productionLogs',
  'qcInspections', 'reworkLogs', 'downtimeLogs'
]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '-');
}

function ensureFacilityState(store) {
  if (!store || typeof store !== 'object') throw new TypeError('Workspace data is required.');
  if (!store.workspace || typeof store.workspace !== 'object') store.workspace = {};
  let changed = false;
  if (!Array.isArray(store.facilities)) {
    store.facilities = [];
    changed = true;
  }
  let primary = store.facilities.find((item) => item && item.id === DEFAULT_FACILITY_ID);
  if (!primary && store.facilities.length === 0) {
    primary = {
      id: DEFAULT_FACILITY_ID,
      code: 'MAIN',
      name: String(store.workspace.name || 'Main factory').trim() || 'Main factory',
      address: '',
      city: '',
      timezone: 'Asia/Kolkata',
      active: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.facilities.push(primary);
    changed = true;
  }
  if (!primary) primary = store.facilities.find((item) => item && item.active !== false) || store.facilities[0];
  if (!primary) throw new Error('At least one factory facility must exist.');

  let activeFacilities = store.facilities.filter((item) => item && item.active !== false);
  if (!activeFacilities.length) {
    primary.active = true;
    changed = true;
    activeFacilities = [primary];
  }
  const defaultFacility = store.facilities.find((item) => item && item.isDefault && item.active !== false) ||
    activeFacilities.find((item) => item.id === DEFAULT_FACILITY_ID) ||
    activeFacilities[0];
  for (const facility of store.facilities) {
    const shouldBeDefault = facility.id === defaultFacility.id;
    if (facility.isDefault !== shouldBeDefault) {
      facility.isDefault = shouldBeDefault;
      changed = true;
    }
  }
  if (store.workspace.defaultFacilityId !== defaultFacility.id) {
    store.workspace.defaultFacilityId = defaultFacility.id;
    changed = true;
  }

  for (const key of COLLECTIONS) {
    const rows = list(store[key]);
    if (!Array.isArray(store[key])) {
      store[key] = rows;
      changed = true;
    }
    for (const row of rows) {
      if (row && !row.facilityId) {
        row.facilityId = defaultFacility.id;
        changed = true;
      }
    }
  }

  const workerById = new Map(list(store.workers).map((worker) => [worker.id, worker]));
  for (const user of list(store.users)) {
    if (!user || Array.isArray(user.facilityIds)) continue;
    if (user.role === 'admin') user.facilityIds = [];
    else if (user.role === 'worker') {
      const worker = workerById.get(user.workerId);
      user.facilityIds = [worker && worker.facilityId ? worker.facilityId : defaultFacility.id];
    } else if (user.role === 'manager') {
      user.facilityIds = activeFacilities.map((item) => item.id);
    } else {
      user.facilityIds = [defaultFacility.id];
    }
    changed = true;
  }

  for (const facility of store.facilities) {
    if (!facility.code) {
      facility.code = facility.id === DEFAULT_FACILITY_ID ? 'MAIN' : normalizeCode(facility.name).slice(0, 12);
      changed = true;
    }
    if (!facility.timezone) {
      facility.timezone = 'Asia/Kolkata';
      changed = true;
    }
    if (facility.active === undefined) {
      facility.active = true;
      changed = true;
    }
    facility.isDefault = facility.id === defaultFacility.id;
  }
  return { store, changed, defaultFacility };
}

function validateFacility(input, facilities, current = null) {
  const name = String(input.name === undefined ? current && current.name : input.name || '').trim();
  if (!name || name.length > 100) throw new Error('Enter a facility name (maximum 100 characters).');
  const code = normalizeCode(input.code === undefined ? current && current.code : input.code);
  if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(code)) {
    throw new Error('Facility code must be 2–12 letters, numbers or hyphens.');
  }
  if (facilities.some((item) => item.id !== (current && current.id) && normalizeCode(item.code) === code)) {
    throw new Error('A facility with this code already exists.');
  }
  const address = String(input.address === undefined ? current && current.address || '' : input.address || '').trim();
  const city = String(input.city === undefined ? current && current.city || '' : input.city || '').trim();
  const timezone = String(input.timezone === undefined ? current && current.timezone || 'Asia/Kolkata' : input.timezone || 'Asia/Kolkata').trim();
  if (address.length > 250 || city.length > 100 || timezone.length > 80) {
    throw new Error('Facility address, city or timezone is too long.');
  }
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    throw new Error('Facility active status must be true or false.');
  }
  return { name, code, address, city, timezone, active: input.active === undefined ? current ? current.active !== false : true : input.active };
}

function createFacility(input, facilities, now = new Date().toISOString()) {
  if (!Array.isArray(facilities)) throw new TypeError('Facility collection must be an array.');
  const fields = validateFacility(input, facilities);
  const facility = {
    id: 'FAC-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase(),
    ...fields,
    isDefault: false,
    createdAt: now,
    updatedAt: now
  };
  facilities.push(facility);
  return facility;
}

function updateFacility(facilityId, input, facilities, workspace = {}, now = new Date().toISOString()) {
  const facility = facilities.find((item) => item.id === facilityId);
  if (!facility) throw new Error('Facility not found.');
  const fields = validateFacility(input, facilities, facility);
  if (fields.active === false && facilities.filter((item) => item.active !== false).length <= 1) {
    throw new Error('At least one active facility must remain.');
  }
  if (facility.isDefault && !fields.active) throw new Error('The default facility cannot be deactivated. Set another default facility first.');
  if (facility.isDefault && input.isDefault === false) throw new Error('Choose another active facility as default before removing the current default.');
  Object.assign(facility, fields, { updatedAt: now });
  if (input.isDefault === true) {
    for (const item of facilities) item.isDefault = item.id === facility.id;
    workspace.defaultFacilityId = facility.id;
  }
  return facility;
}

function setDefaultFacility(facilityId, facilities, workspace = {}) {
  const facility = facilities.find((item) => item.id === facilityId && item.active !== false);
  if (!facility) throw new Error('Choose an active facility to make the default.');
  for (const item of facilities) item.isDefault = item.id === facility.id;
  workspace.defaultFacilityId = facility.id;
  facility.updatedAt = new Date().toISOString();
  return facility;
}

function allowedFacilityIds(user, facilities, store = {}) {
  const activeIds = list(facilities).filter((facility) => facility.active !== false).map((facility) => facility.id);
  if (!user) return [];
  if (user.role === 'admin') return activeIds;
  let assigned = list(user.facilityIds).filter((id) => activeIds.includes(id));
  if (user.role === 'worker') {
    const worker = list(store.workers).find((item) => item.id === user.workerId && item.active !== false);
    if (!worker) return [];
    assigned = assigned.filter((id) => id === worker.facilityId);
    if (!assigned.includes(worker.facilityId)) return [];
  }
  return [...new Set(assigned)];
}

function resolveFacility(user, facilities, store, requestedId = '') {
  const allowed = allowedFacilityIds(user, facilities, store);
  if (!allowed.length) return null;
  const defaultId = store && store.workspace ? store.workspace.defaultFacilityId : '';
  const selectedId = String(requestedId || '').trim();
  const targetId = selectedId || (allowed.includes(defaultId) ? defaultId : allowed[0]);
  if (!allowed.includes(targetId)) return null;
  return list(facilities).find((facility) => facility.id === targetId && facility.active !== false) || null;
}

function projectStoreForFacility(store, facilityId) {
  const projected = { ...store };
  for (const key of COLLECTIONS) {
    projected[key] = list(store[key]).filter((row) => row && row.facilityId === facilityId);
  }
  projected.facilities = list(store.facilities).filter((facility) => facility.active !== false);
  return projected;
}

function mergeFacilityCollection(existing, incoming, facilityId, enforceGlobalIds = true) {
  if (!Array.isArray(incoming)) throw new Error('Workspace collection must be an array.');
  const seen = new Set();
  const normalized = incoming.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Workspace records must be objects.');
    const id = String(row.id || row.sku || row.code || '').trim();
    if (!id || id.length > 120) throw new Error('Every workspace record must have a valid ID or SKU.');
    if (seen.has(id)) throw new Error('Duplicate record ID: ' + id);
    seen.add(id);
    if (row.facilityId && row.facilityId !== facilityId) {
      throw new Error('A workspace update cannot move records across facilities. Use a facility transfer.');
    }
    return { ...row, facilityId };
  });
  const otherFacilities = list(existing).filter((row) => row.facilityId !== facilityId);
  if (enforceGlobalIds) {
    const otherIds = new Set(otherFacilities.map((row) => String(row.id || row.code || '')).filter(Boolean));
    for (const row of normalized) {
      const rowKey = String(row.id || row.code || '');
      if (rowKey && otherIds.has(rowKey)) throw new Error('Record ID already belongs to another facility: ' + rowKey);
    }
  }
  return [...otherFacilities, ...normalized];
}

function summarizeFacility(store, facility) {
  const inFacility = (key) => list(store[key]).filter((row) => row.facilityId === facility.id);
  const jobs = inFacility('jobs');
  const production = inFacility('productionLogs');
  const materials = inFacility('materials');
  const workers = inFacility('workers');
  const downtime = inFacility('downtimeLogs');
  const deliveries = inFacility('deliveries');
  const deliveredJobs = jobs.filter((job) => job.status === 'Delivered' && job.dueDate);
  const onTime = deliveredJobs.filter((job) => {
    const proof = deliveries.find((delivery) => delivery.jobId === job.id);
    const deliveredDate = proof && String(proof.deliveredAt || '').slice(0, 10);
    return deliveredDate && deliveredDate <= job.dueDate;
  });
  const producedQty = production.reduce((sum, row) => sum + (Number(row.producedQty) || 0), 0);
  const actualHours = production.reduce((sum, row) => sum + (Number(row.actualHours) || 0), 0);
  const stockAlerts = materials.filter((item) => {
    if (item.status === 'Critical' || item.status === 'Low stock') return true;
    const onHand = Number(item.stock);
    const reorder = Number(item.reorderPoint);
    return Number.isFinite(onHand) && Number.isFinite(reorder) && onHand <= reorder;
  }).length;
  return {
    facilityId: facility.id,
    facilityName: facility.name,
    code: facility.code,
    city: facility.city || '',
    active: facility.active !== false,
    activeJobs: jobs.filter((job) => !['Delivered', 'Cancelled'].includes(job.status)).length,
    deliveredJobs: deliveredJobs.length,
    productionEntries: production.length,
    producedQty,
    actualHours,
    unitsPerActualHour: actualHours > 0 ? Math.round(producedQty / actualHours * 100) / 100 : null,
    activeWorkers: workers.filter((worker) => worker.active !== false).length,
    stockItems: materials.length,
    stockAlerts,
    downtimeHours: Math.round(downtime.reduce((sum, row) => sum + (Number(row.durationMinutes) || 0), 0) / 60 * 100) / 100,
    onTimeDeliveryPercent: deliveredJobs.length ? Math.round(onTime.length / deliveredJobs.length * 10000) / 100 : null
  };
}

module.exports = {
  DEFAULT_FACILITY_ID,
  COLLECTIONS,
  ensureFacilityState,
  createFacility,
  updateFacility,
  setDefaultFacility,
  allowedFacilityIds,
  resolveFacility,
  projectStoreForFacility,
  mergeFacilityCollection,
  summarizeFacility
};
