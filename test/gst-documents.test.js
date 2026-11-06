const test = require('node:test');
const assert = require('node:assert/strict');
const gst = require('../gst-documents.js');

const profile = {
  facilityId: 'FAC-001',
  legalName: 'Northstar Works Private Limited',
  tradeName: 'Northstar Works',
  gstin: '29ABCDE1234F1Z5',
  pan: 'ABCDE1234F',
  address: '12 Industrial Estate',
  city: 'Bengaluru',
  state: 'Karnataka',
  stateCode: '29',
  pincode: '560001',
  email: 'accounts@example.com',
  phone: '9876543210'
};
const line = { description: 'Printed corrugated cartons', hsnSac: '48191010', quantity: 100, unit: 'pieces', unitPrice: 25, discount: 100, gstRate: 18 };

test('validates GST profiles and state/PAN consistency', () => {
  assert.equal(gst.validateProfile(profile).gstin, profile.gstin);
  assert.throws(() => gst.validateProfile({ ...profile, gstin: '27ABCDE1234F1Z5' }), /state code.*match/i);
  assert.throws(() => gst.validateProfile({ ...profile, pan: 'ABCDE1234X' }), /PAN/i);
  assert.throws(() => gst.validateGstin('not-a-gstin'), /15-character GSTIN/i);
});

test('calculates intra-state CGST and SGST with line-level rounding and invoice total', () => {
  const result = gst.calculateTax(gst.validateLineItems([line], false), true);
  assert.equal(result.taxableValue, 2400);
  assert.equal(result.cgstAmount, 216);
  assert.equal(result.sgstAmount, 216);
  assert.equal(result.igstAmount, 0);
  assert.equal(result.totalTax, 432);
  assert.equal(result.grandTotal, 2832);
});

test('calculates inter-state IGST without CGST and SGST', () => {
  const result = gst.calculateTax(gst.validateLineItems([line], false), false);
  assert.equal(result.cgstAmount, 0);
  assert.equal(result.sgstAmount, 0);
  assert.equal(result.igstAmount, 432);
  assert.equal(result.grandTotal, 2832);
});

test('creates sequential facility-specific documents within a financial year', () => {
  const documents = [];
  const profiles = [profile];
  const first = gst.createDocument(documents, profiles, {
    type: 'TAX_INVOICE', documentDate: '2026-11-06', dueDate: '2026-11-20',
    customerName: 'Kaveri Foods', customerAddress: 'Bengaluru',
    placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29',
    customerGstin: '29ABCDE1234F1Z5', lines: [line]
  }, { facilityId: 'FAC-001', userId: 'USR-1' });
  const second = gst.createDocument(documents, profiles, {
    type: 'TAX_INVOICE', documentDate: '2027-02-10', dueDate: '2027-02-20',
    customerName: 'Kaveri Foods', customerAddress: 'Bengaluru',
    placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29', lines: [line]
  }, { facilityId: 'FAC-001' });
  assert.equal(first.number, 'INV/2026-27/0001');
  assert.equal(second.number, 'INV/2026-27/0002');
  assert.equal(second.facilityId, 'FAC-001');
  const otherFacility = gst.createDocument(documents, [{ ...profile, facilityId: 'FAC-002' }], {
    type: 'TAX_INVOICE', documentDate: '2026-11-06', dueDate: '2026-11-20',
    customerName: 'Kaveri Foods', customerAddress: 'Bengaluru',
    placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29', lines: [line]
  }, { facilityId: 'FAC-002' });
  assert.equal(otherFacility.number, 'INV/2026-27/0001');
});

test('delivery challans carry declared value but no invoice tax payable', () => {
  const document = gst.createDocument([], [profile], {
    type: 'DELIVERY_CHALLAN', documentDate: '2026-11-06',
    customerName: 'Kaveri Foods', customerAddress: 'Warehouse 2',
    placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29',
    lines: [line]
  }, { facilityId: 'FAC-001' });
  assert.equal(document.number, 'DC/2026-27/0001');
  assert.equal(document.declaredValue, 2400);
  assert.equal(document.totalTax, 0);
  assert.equal(document.grandTotal, 0);
});

test('rejects invalid HSN, GST rates, supply state, dates and discounts', () => {
  assert.throws(() => gst.validateLineItems([{ ...line, hsnSac: '12A4' }], false), /HSN\/SAC/i);
  assert.throws(() => gst.validateLineItems([{ ...line, gstRate: 7 }], false), /GST rate/i);
  assert.throws(() => gst.validateLineItems([{ ...line, discount: 999999 }], false), /discount/i);
  assert.throws(() => gst.createDocument([], [profile], {
    type: 'TAX_INVOICE', documentDate: '2026-11-06', dueDate: '2026-11-05',
    customerName: 'Buyer', customerAddress: 'Address', placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29',
    lines: [line]
  }, { facilityId: 'FAC-001' }), /due date/i);
});

test('requires the profile PAN to match the PAN embedded in the business GSTIN', () => {
  assert.throws(() => gst.validateProfile({ ...profile, pan: 'ABCDE1234X' }), /PAN must match/i);
});

test('maintains independent document sequences for each document type and financial year', () => {
  const documents = [];
  const profiles = [profile];
  const create = (type, date) => gst.createDocument(documents, profiles, {
    type, documentDate: date, dueDate: type === 'TAX_INVOICE' ? date : '',
    customerName: 'Buyer', customerAddress: 'Buyer address',
    placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29', lines: [line]
  }, { facilityId: 'FAC-001' });
  assert.equal(create('QUOTATION', '2026-03-31').number, 'QUO/2025-26/0001');
  assert.equal(create('QUOTATION', '2026-04-01').number, 'QUO/2026-27/0001');
  assert.equal(create('TAX_INVOICE', '2026-04-01').number, 'INV/2026-27/0001');
});

test('rejects a buyer GSTIN whose state code differs from place of supply', () => {
  assert.throws(() => gst.createDocument([], [profile], {
    type: 'TAX_INVOICE', documentDate: '2026-11-06', dueDate: '2026-11-20',
    customerName: 'Buyer', customerAddress: 'Address',
    customerGstin: '27ABCDE1234F1Z5',
    placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29', lines: [line]
  }, { facilityId: 'FAC-001' }), /customer GSTIN state code/i);
});
