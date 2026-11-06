const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const whatsapp = require('../whatsapp.js');

test('normalizes international WhatsApp numbers and rejects local/incomplete values', () => {
  assert.equal(whatsapp.normalizePhoneNumber('+91 98765-43210'), '919876543210');
  assert.throws(() => whatsapp.normalizePhoneNumber('98765'), /country code/i);
  assert.throws(() => whatsapp.normalizePhoneNumber('abc'), /country code/i);
});

test('requires recorded consent before a contact can be opted in', () => {
  const contacts = [];
  assert.throws(() => whatsapp.createContact(contacts, {
    name: 'Kaveri Foods', phone: '919876543210', optedIn: true
  }, { facilityId: 'FAC-001' }), /consent source/i);
  const contact = whatsapp.createContact(contacts, {
    name: 'Kaveri Foods', phone: '919876543210', optedIn: false
  }, { facilityId: 'FAC-001', userId: 'USR-1' });
  assert.equal(contact.optedIn, false);
  assert.equal(contact.consentAt, '');
  assert.throws(() => whatsapp.updateContact(contacts, contact.id, {
    optedIn: true, name: contact.name, phone: contact.phone, consentSource: 'Signed form'
  }, { facilityId: 'FAC-001' }), /fresh consent date/i);
  const updated = whatsapp.updateContact(contacts, contact.id, {
    optedIn: true,
    name: contact.name,
    phone: contact.phone,
    consentSource: 'Signed opt-in form',
    consentAt: '2026-11-06T05:00:00.000Z'
  }, { facilityId: 'FAC-001', userId: 'USR-2' });
  assert.equal(updated.optedIn, true);
  assert.equal(updated.consentSource, 'Signed opt-in form');
  assert.equal(updated.updatedBy, 'USR-2');
});

test('enforces unique phone numbers within facility while allowing another facility', () => {
  const contacts = [];
  whatsapp.createContact(contacts, { name: 'Buyer 1', phone: '919876543210' }, { facilityId: 'FAC-001' });
  assert.throws(() => whatsapp.createContact(contacts, {
    name: 'Buyer duplicate', phone: '919876543210'
  }, { facilityId: 'FAC-001' }), /already exists/i);
  const otherFacility = whatsapp.createContact(contacts, {
    name: 'Buyer 2', phone: '919876543210'
  }, { facilityId: 'FAC-002' });
  assert.equal(otherFacility.facilityId, 'FAC-002');
});

test('builds approved template payloads with bounded parameters', () => {
  const payload = whatsapp.buildTemplatePayload({
    to: '+91 98765 43210',
    templateName: 'factoryflow_invoice_issued',
    languageCode: 'en',
    bodyParameters: ['Kaveri Foods', 'INV/2026-27/0001', '₹2,832.00']
  });
  assert.equal(payload.messaging_product, 'whatsapp');
  assert.equal(payload.to, '919876543210');
  assert.equal(payload.type, 'template');
  assert.equal(payload.template.name, 'factoryflow_invoice_issued');
  assert.deepEqual(payload.template.components[0].parameters.map((item) => item.text),
    ['Kaveri Foods', 'INV/2026-27/0001', '₹2,832.00']);
  assert.throws(() => whatsapp.buildTemplatePayload({
    to: '919876543210', templateName: 'NOT APPROVED!', languageCode: 'en'
  }), /template name/i);
  assert.throws(() => whatsapp.buildTemplatePayload({
    to: '919876543210', templateName: 'approved_template', languageCode: 'en',
    bodyParameters: ['x'.repeat(1025)]
  }), /1,024 characters/i);
});

test('verifies Meta webhook signatures with constant-time comparison', () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const secret = 'test-app-secret';
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(whatsapp.verifyWebhookSignature(body, signature, secret), true);
  assert.equal(whatsapp.verifyWebhookSignature(body, signature, 'wrong-secret'), false);
  assert.equal(whatsapp.verifyWebhookSignature(body, 'sha256=bad', secret), false);
});

test('extracts delivery and read status updates from webhook payloads', () => {
  const payload = {
    entry: [{
      changes: [{
        value: {
          statuses: [
            { id: 'wamid.1', status: 'delivered', recipient_id: '919876543210', timestamp: '1793941200' },
            { id: 'wamid.2', status: 'read', recipient_id: '919876543210', timestamp: '1793941300' },
            { id: 'wamid.3', status: 'failed', errors: [{ code: 131000, title: 'Temporary error' }] }
          ]
        }
      }]
    }]
  };
  const updates = whatsapp.extractStatusUpdates(payload);
  assert.equal(updates.length, 3);
  assert.equal(updates[0].status, 'delivered');
  assert.equal(updates[1].status, 'read');
  assert.equal(updates[2].errors[0].code, 131000);
});

test('exposes only non-secret WhatsApp configuration status', () => {
  const status = whatsapp.getConfiguration({
    WHATSAPP_GRAPH_API_VERSION: 'v26.0',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_ACCESS_TOKEN: 'top-secret-token',
    WHATSAPP_APP_SECRET: 'top-secret-app-secret',
    WHATSAPP_VERIFY_TOKEN: 'top-secret-verify'
  });
  assert.equal(status.apiConfigured, true);
  assert.equal(status.webhookConfigured, true);
  assert.equal(status.publicStatus.phoneNumberId, '123456789');
  assert.equal(Object.hasOwn(status.publicStatus, 'accessToken'), false);
  assert.equal(JSON.stringify(status.publicStatus).includes('top-secret'), false);
});
