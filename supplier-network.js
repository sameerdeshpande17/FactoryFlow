const crypto = require('node:crypto');

const VERIFICATION_STATUSES = Object.freeze(['unverified', 'pending', 'verified', 'rejected', 'suspended']);
const VERIFICATION_METHODS = Object.freeze([
  'business_documents',
  'gst_record_review',
  'in_person_visit',
  'reference_call',
  'other'
]);
const GSTIN_PATTERN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function asText(value, maximum, field, required = false) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (required && !text) throw new Error(field + ' is required.');
  if (text.length > maximum) throw new Error(field + ' must be ' + maximum + ' characters or fewer.');
  return text;
}

function normalizeBusinessName(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function normalizePhoneNumber(value) {
  const phone = String(value || '').replace(/[\s()+.-]/g, '');
  if (!/^\d{8,15}$/.test(phone)) throw new Error('Enter a supplier phone number with country code (8–15 digits).');
  return phone;
}

function normalizeCategories(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const categories = [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))];
  if (categories.length > 12) throw new Error('A supplier can have at most 12 product categories.');
  if (categories.some((item) => item.length > 60)) throw new Error('Each product category must be 60 characters or fewer.');
  return categories;
}

function validateSupplier(input = {}) {
  const businessName = asText(input.businessName, 160, 'Business name', true);
  if (businessName.length < 2) throw new Error('Business name must contain at least 2 characters.');
  const contactName = asText(input.contactName, 120, 'Contact name');
  const rawPhone = asText(input.phone, 40, 'Phone number');
  const phone = rawPhone ? normalizePhoneNumber(rawPhone) : '';
  const email = asText(input.email, 254, 'Email').toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid supplier email address.');
  if (!phone && !email) throw new Error('Provide at least one supplier contact method: phone or email.');

  const gstin = asText(input.gstin, 15, 'GSTIN').toUpperCase();
  if (gstin && !GSTIN_PATTERN.test(gstin)) throw new Error('Enter a GSTIN in the expected 15-character format.');
  const pan = asText(input.pan, 10, 'PAN').toUpperCase();
  if (pan && !PAN_PATTERN.test(pan)) throw new Error('Enter a PAN in the expected 10-character format.');
  if (gstin && pan && gstin.slice(2, 12) !== pan) throw new Error('The PAN must match the PAN embedded in the GSTIN.');

  return {
    businessName,
    contactName,
    phone,
    email,
    gstin,
    pan,
    address: asText(input.address, 300, 'Address'),
    city: asText(input.city, 100, 'City'),
    state: asText(input.state, 100, 'State'),
    categories: normalizeCategories(input.categories),
    notes: asText(input.notes, 1200, 'Notes')
  };
}

function createSupplier(suppliers, input = {}, context = {}) {
  if (!Array.isArray(suppliers)) throw new TypeError('Supplier collection must be an array.');
  const fields = validateSupplier(input);
  const facilityId = String(context.facilityId || '').trim();
  if (!facilityId) throw new Error('A facility is required to create a supplier.');
  if (suppliers.some((item) => item && item.facilityId === facilityId &&
    normalizeBusinessName(item.businessName) === normalizeBusinessName(fields.businessName))) {
    throw new Error('A supplier with this business name already exists in the selected facility.');
  }
  const now = new Date().toISOString();
  const supplier = {
    id: 'SUP-' + crypto.randomUUID(),
    facilityId,
    ...fields,
    verification: {
      status: 'unverified',
      method: '',
      evidenceReference: '',
      notes: '',
      checkedAt: '',
      checkedBy: '',
      checkedByName: ''
    },
    verificationHistory: [],
    createdAt: now,
    createdBy: String(context.userId || ''),
    updatedAt: now,
    updatedBy: String(context.userId || '')
  };
  suppliers.push(supplier);
  return supplier;
}

function updateSupplier(suppliers, supplierId, input = {}, context = {}) {
  if (!Array.isArray(suppliers)) throw new TypeError('Supplier collection must be an array.');
  const supplier = suppliers.find((item) => item && item.id === supplierId && item.facilityId === context.facilityId);
  if (!supplier) throw new Error('Supplier not found in the selected facility.');
  const fields = validateSupplier(input);
  if (suppliers.some((item) => item && item.id !== supplierId && item.facilityId === context.facilityId &&
    normalizeBusinessName(item.businessName) === normalizeBusinessName(fields.businessName))) {
    throw new Error('A supplier with this business name already exists in the selected facility.');
  }
  Object.assign(supplier, fields, {
    updatedAt: new Date().toISOString(),
    updatedBy: String(context.userId || '')
  });
  return supplier;
}

function reviewSupplier(suppliers, supplierId, input = {}, context = {}) {
  if (!Array.isArray(suppliers)) throw new TypeError('Supplier collection must be an array.');
  const supplier = suppliers.find((item) => item && item.id === supplierId && item.facilityId === context.facilityId);
  if (!supplier) throw new Error('Supplier not found in the selected facility.');
  const status = String(input.status || '').trim().toLowerCase();
  if (!VERIFICATION_STATUSES.includes(status)) throw new Error('Choose a valid supplier verification status.');
  const method = String(input.method || '').trim();
  if (status === 'verified' && !VERIFICATION_METHODS.includes(method)) {
    throw new Error('Choose how the supplier was internally verified.');
  }
  const evidenceReference = asText(input.evidenceReference, 300, 'Evidence reference', status === 'verified');
  if (status === 'verified' && evidenceReference.length < 4) {
    throw new Error('Provide a useful document reference or verification evidence reference.');
  }
  const notes = asText(input.notes, 800, 'Verification notes');
  const now = new Date().toISOString();
  const previous = supplier.verification && typeof supplier.verification === 'object'
    ? { ...supplier.verification }
    : null;
  if (!Array.isArray(supplier.verificationHistory)) supplier.verificationHistory = [];
  if (previous && previous.status && previous.status !== 'unverified') {
    supplier.verificationHistory.unshift(previous);
    supplier.verificationHistory = supplier.verificationHistory.slice(0, 20);
  }
  supplier.verification = {
    status,
    method,
    evidenceReference,
    notes,
    checkedAt: now,
    checkedBy: String(context.userId || ''),
    checkedByName: String(context.userName || '')
  };
  supplier.updatedAt = now;
  supplier.updatedBy = String(context.userId || '');
  return supplier;
}

function supplierTrustMetrics(supplier, purchases = []) {
  const supplierName = normalizeBusinessName(supplier.businessName);
  const matching = (Array.isArray(purchases) ? purchases : []).filter((purchase) =>
    purchase && purchase.facilityId === supplier.facilityId &&
    normalizeBusinessName(purchase.supplier) === supplierName
  );
  const received = matching.filter((purchase) => String(purchase.status || '').toLowerCase() === 'received').length;
  const cancelled = matching.filter((purchase) => String(purchase.status || '').toLowerCase() === 'cancelled').length;
  const closedOrders = received + cancelled;
  const openOrders = Math.max(0, matching.length - closedOrders);
  const profilePoints =
    (GSTIN_PATTERN.test(String(supplier.gstin || '')) ? 10 : 0) +
    (String(supplier.address || '').trim() ? 5 : 0) +
    (String(supplier.phone || '').trim() || String(supplier.email || '').trim() ? 5 : 0) +
    (Array.isArray(supplier.categories) && supplier.categories.length ? 5 : 0);
  const verificationStatus = supplier.verification && supplier.verification.status || 'unverified';
  const verificationPoints = verificationStatus === 'verified' ? 40 : verificationStatus === 'pending' ? 15 : 0;
  const fulfilmentRate = closedOrders ? received / closedOrders : null;
  const fulfilmentPoints = fulfilmentRate === null ? null : Math.round(35 * fulfilmentRate);
  const score = fulfilmentPoints === null ? null : Math.max(0, Math.min(100, profilePoints + verificationPoints + fulfilmentPoints));
  return {
    score,
    scoreLabel: score === null ? 'Insufficient closed-order history' : 'Internal supplier indicator',
    profilePoints,
    verificationPoints,
    fulfilmentPoints,
    fulfilmentRate: fulfilmentRate === null ? null : Math.round(fulfilmentRate * 100),
    orderHistory: {
      total: matching.length,
      open: openOrders,
      received,
      cancelled,
      closed: closedOrders
    }
  };
}

function enrichSupplier(supplier, purchases = []) {
  return { ...supplier, trust: supplierTrustMetrics(supplier, purchases) };
}

module.exports = {
  VERIFICATION_STATUSES,
  VERIFICATION_METHODS,
  GSTIN_PATTERN,
  PAN_PATTERN,
  normalizeBusinessName,
  normalizePhoneNumber,
  validateSupplier,
  createSupplier,
  updateSupplier,
  reviewSupplier,
  supplierTrustMetrics,
  enrichSupplier
};
