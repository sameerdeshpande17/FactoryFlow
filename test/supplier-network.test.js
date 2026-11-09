const test = require('node:test');
const assert = require('node:assert/strict');
const supplierNetwork = require('../supplier-network.js');

test('validates supplier identity, contact methods, GSTIN and PAN consistency', () => {
  assert.throws(() => supplierNetwork.validateSupplier({ businessName: 'Kaveri' }), /contact method/i);
  assert.throws(() => supplierNetwork.validateSupplier({
    businessName: 'Kaveri Materials', phone: '98765'
  }), /country code/i);
  assert.throws(() => supplierNetwork.validateSupplier({
    businessName: 'Kaveri Materials', email: 'sales@example.test', gstin: 'INVALID'
  }), /GSTIN/i);
  assert.throws(() => supplierNetwork.validateSupplier({
    businessName: 'Kaveri Materials', email: 'sales@example.test',
    gstin: '29ABCDE1234F1Z5', pan: 'ABCDE1234G'
  }), /PAN must match/i);
  const fields = supplierNetwork.validateSupplier({
    businessName: ' Kaveri   Materials ',
    phone: '+91 98765 43210',
    email: 'SALES@EXAMPLE.TEST',
    gstin: '29abcde1234f1z5',
    pan: 'ABCDE1234F',
    categories: 'Kraft paper, Corrugated board, Kraft paper'
  });
  assert.equal(fields.businessName, 'Kaveri   Materials');
  assert.equal(fields.phone, '919876543210');
  assert.equal(fields.email, 'sales@example.test');
  assert.deepEqual(fields.categories, ['Kraft paper', 'Corrugated board']);
});

test('creates facility-scoped suppliers and prevents duplicate business names', () => {
  const suppliers = [];
  const supplier = supplierNetwork.createSupplier(suppliers, {
    businessName: 'Kaveri Materials', email: 'sales@example.test', categories: ['Paper']
  }, { facilityId: 'FAC-001', userId: 'USR-1' });
  assert.equal(supplier.facilityId, 'FAC-001');
  assert.equal(supplier.verification.status, 'unverified');
  assert.throws(() => supplierNetwork.createSupplier(suppliers, {
    businessName: '  KAVERI  MATERIALS ', email: 'other@example.test'
  }, { facilityId: 'FAC-001' }), /already exists/i);
  const otherFacility = supplierNetwork.createSupplier(suppliers, {
    businessName: 'Kaveri Materials', email: 'sales@example.test'
  }, { facilityId: 'FAC-002' });
  assert.equal(otherFacility.facilityId, 'FAC-002');
});

test('requires method and traceable evidence before internal verification', () => {
  const suppliers = [];
  const supplier = supplierNetwork.createSupplier(suppliers, {
    businessName: 'Kaveri Materials', phone: '+91 98765 43210'
  }, { facilityId: 'FAC-001', userId: 'USR-1' });
  assert.throws(() => supplierNetwork.reviewSupplier(suppliers, supplier.id, {
    status: 'verified', method: 'business_documents'
  }, { facilityId: 'FAC-001', userId: 'USR-2' }), /evidence reference/i);
  assert.throws(() => supplierNetwork.reviewSupplier(suppliers, supplier.id, {
    status: 'verified', method: 'unknown', evidenceReference: 'DOC-2026-01'
  }, { facilityId: 'FAC-001', userId: 'USR-2' }), /how the supplier was internally verified/i);
  const reviewed = supplierNetwork.reviewSupplier(suppliers, supplier.id, {
    status: 'verified', method: 'business_documents',
    evidenceReference: 'GST certificate ref DOC-2026-01',
    notes: 'Business documents reviewed.'
  }, { facilityId: 'FAC-001', userId: 'USR-2', userName: 'Factory Admin' });
  assert.equal(reviewed.verification.status, 'verified');
  assert.equal(reviewed.verification.checkedBy, 'USR-2');
  assert.ok(reviewed.verification.checkedAt);
  assert.equal(reviewed.verificationHistory.length, 0);
  supplierNetwork.reviewSupplier(suppliers, supplier.id, {
    status: 'suspended', notes: 'Recheck requested.'
  }, { facilityId: 'FAC-001', userId: 'USR-3' });
  assert.equal(reviewed.verification.status, 'suspended');
  assert.equal(reviewed.verificationHistory.length, 1);
  assert.equal(reviewed.verificationHistory[0].status, 'verified');
});

test('trust indicator is transparent, ignores open orders and requires closed-order history', () => {
  const suppliers = [];
  const supplier = supplierNetwork.createSupplier(suppliers, {
    businessName: 'Kaveri Materials',
    phone: '+91 98765 43210',
    gstin: '29ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    address: 'Peenya Industrial Area',
    categories: ['Kraft paper']
  }, { facilityId: 'FAC-001' });
  supplierNetwork.reviewSupplier(suppliers, supplier.id, {
    status: 'verified', method: 'gst_record_review',
    evidenceReference: 'GST portal note GST-CHK-2026-11'
  }, { facilityId: 'FAC-001' });
  const purchases = [
    { id: 'PO-1', facilityId: 'FAC-001', supplier: 'Kaveri Materials', status: 'Received' },
    { id: 'PO-2', facilityId: 'FAC-001', supplier: ' KAVERI  MATERIALS ', status: 'Received' },
    { id: 'PO-3', facilityId: 'FAC-001', supplier: 'Kaveri Materials', status: 'Cancelled' },
    { id: 'PO-4', facilityId: 'FAC-001', supplier: 'Kaveri Materials', status: 'In transit' },
    { id: 'PO-5', facilityId: 'FAC-002', supplier: 'Kaveri Materials', status: 'Received' }
  ];
  const metrics = supplierNetwork.supplierTrustMetrics(supplier, purchases);
  assert.equal(metrics.orderHistory.total, 4);
  assert.equal(metrics.orderHistory.received, 2);
  assert.equal(metrics.orderHistory.cancelled, 1);
  assert.equal(metrics.orderHistory.open, 1);
  assert.equal(metrics.fulfilmentRate, 67);
  assert.equal(metrics.profilePoints, 25);
  assert.equal(metrics.verificationPoints, 40);
  assert.equal(metrics.fulfilmentPoints, 23);
  assert.equal(metrics.score, 88);
  const noHistory = supplierNetwork.supplierTrustMetrics(supplier, []);
  assert.equal(noHistory.score, null);
  assert.equal(noHistory.scoreLabel, 'Insufficient closed-order history');
});
