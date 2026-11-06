(function attachFactoryFlowWhatsApp(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FactoryFlowWhatsApp = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowWhatsApp() {
  'use strict';

  const MESSAGE_STATUSES = ['accepted', 'sent', 'delivered', 'read', 'failed'];
  const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;
  const LANGUAGE_CODE = /^[a-z]{2}(?:_[A-Z]{2})?$/;

  function normalizePhoneNumber(value) {
    const phone = String(value || '').replace(/[\s()+.-]/g, '');
    if (!/^\d{8,15}$/.test(phone)) throw new Error('Enter a WhatsApp phone number with country code (8–15 digits).');
    return phone;
  }

  function validateContact(input = {}, current = null) {
    const value = (key) => String(input[key] === undefined ? current && current[key] || '' : input[key] || '').trim();
    const name = value('name');
    const phone = normalizePhoneNumber(value('phone'));
    const consentSource = value('consentSource');
    const optedIn = input.optedIn === undefined ? (current ? current.optedIn === true : false) : input.optedIn;
    if (!name || name.length > 150) throw new Error('Customer/contact name is required (maximum 150 characters).');
    if (consentSource.length > 200) throw new Error('Consent source must be 200 characters or fewer.');
    if (typeof optedIn !== 'boolean') throw new Error('WhatsApp opt-in status must be true or false.');
    if (optedIn && !consentSource) throw new Error('Record how the customer gave WhatsApp consent before opting in.');
    if (input.optedIn === true && current && current.optedIn !== true && !input.consentAt) {
      throw new Error('Record a new consent date when re-enabling WhatsApp opt-in.');
    }
    const now = new Date().toISOString();
    const consentAt = optedIn
      ? String(input.consentAt || current && current.consentAt || now)
      : '';
    if (optedIn && (!Number.isFinite(Date.parse(consentAt)) || consentAt.length > 40)) {
      throw new Error('Consent date must be a valid ISO date/time.');
    }
    return {
      name,
      phone,
      optedIn,
      consentSource,
      consentAt,
      optedOutAt: optedIn ? '' : (current && current.optedIn ? now : current && current.optedOutAt || ''),
      updatedAt: now
    };
  }

  function createContact(contacts, input = {}, context = {}) {
    if (!Array.isArray(contacts)) throw new TypeError('WhatsApp contacts must be an array.');
    const fields = validateContact(input);
    if (contacts.some((item) => item && item.facilityId === context.facilityId && item.phone === fields.phone)) {
      throw new Error('A WhatsApp contact with this phone number already exists in this facility.');
    }
    const contact = {
      id: 'WAC-' + String(contacts.filter((item) => item && item.facilityId === context.facilityId).length + 1).padStart(5, '0'),
      facilityId: context.facilityId || '',
      ...fields,
      createdAt: new Date().toISOString(),
      createdBy: context.userId || '',
      updatedBy: context.userId || ''
    };
    contacts.push(contact);
    return contact;
  }

  function updateContact(contacts, contactId, input = {}, context = {}) {
    const contact = (Array.isArray(contacts) ? contacts : []).find((item) =>
      item && item.id === contactId && item.facilityId === context.facilityId
    );
    if (!contact) throw new Error('WhatsApp contact not found in this facility.');
    const fields = validateContact(input, contact);
    if (contacts.some((item) => item.id !== contactId && item.facilityId === context.facilityId && item.phone === fields.phone)) {
      throw new Error('A WhatsApp contact with this phone number already exists in this facility.');
    }
    Object.assign(contact, fields, { updatedBy: context.userId || '' });
    return contact;
  }

  function buildTemplatePayload(input = {}) {
    const to = normalizePhoneNumber(input.to);
    const templateName = String(input.templateName || '').trim();
    const languageCode = String(input.languageCode || 'en').trim();
    if (!TEMPLATE_NAME.test(templateName)) throw new Error('Template name must use lowercase letters, numbers and underscores.');
    if (!LANGUAGE_CODE.test(languageCode)) throw new Error('Enter a valid WhatsApp template language code such as en or en_US.');
    const rawParameters = Array.isArray(input.bodyParameters) ? input.bodyParameters : [];
    if (rawParameters.length > 20) throw new Error('A template can contain at most 20 body parameters.');
    const bodyParameters = rawParameters.map((value, index) => {
      const text = String(value === null || value === undefined ? '' : value);
      if (text.length > 1024) throw new Error('Template parameter ' + (index + 1) + ' exceeds 1,024 characters.');
      return { type: 'text', text };
    });
    const components = bodyParameters.length ? [{
      type: 'body',
      parameters: bodyParameters
    }] : [];
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode }
      }
    };
    if (components.length) payload.template.components = components;
    return payload;
  }

  function verifyWebhookSignature(rawBody, signature, appSecret) {
    if (!Buffer.isBuffer(rawBody)) rawBody = Buffer.from(String(rawBody || ''), 'utf8');
    const supplied = String(signature || '');
    const secret = String(appSecret || '');
    if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(supplied)) return false;
    const expected = 'sha256=' + require('node:crypto').createHmac('sha256', secret).update(rawBody).digest('hex');
    const left = Buffer.from(supplied.toLowerCase());
    const right = Buffer.from(expected);
    return left.length === right.length && require('node:crypto').timingSafeEqual(left, right);
  }

  function extractStatusUpdates(payload) {
    const updates = [];
    (Array.isArray(payload && payload.entry) ? payload.entry : []).forEach((entry) => {
      (Array.isArray(entry && entry.changes) ? entry.changes : []).forEach((change) => {
        const value = change && change.value || {};
        (Array.isArray(value.statuses) ? value.statuses : []).forEach((status) => {
          const providerMessageId = String(status && status.id || '');
          const state = String(status && status.status || '').toLowerCase();
          if (!providerMessageId || !MESSAGE_STATUSES.includes(state === 'queued' ? 'accepted' : state)) return;
          const errors = Array.isArray(status.errors) ? status.errors.slice(0, 3).map((error) => ({
            code: Number(error.code) || 0,
            title: String(error.title || error.message || 'WhatsApp delivery error').slice(0, 250)
          })) : [];
          updates.push({
            providerMessageId,
            status: state === 'queued' ? 'accepted' : state,
            recipient: String(status.recipient_id || ''),
            timestamp: String(status.timestamp || ''),
            errors
          });
        });
      });
    });
    return updates;
  }

  function getConfiguration(env = process.env) {
    const apiVersion = String(env.WHATSAPP_GRAPH_API_VERSION || 'v26.0').trim();
    const phoneNumberId = String(env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    const accessToken = String(env.WHATSAPP_ACCESS_TOKEN || '').trim();
    const appSecret = String(env.WHATSAPP_APP_SECRET || '').trim();
    const verifyToken = String(env.WHATSAPP_VERIFY_TOKEN || '').trim();
    const versionValid = /^v\d+\.\d+$/.test(apiVersion);
    return {
      apiVersion,
      phoneNumberId,
      accessToken,
      appSecret,
      verifyToken,
      apiConfigured: Boolean(versionValid && phoneNumberId && accessToken),
      webhookConfigured: Boolean(appSecret && verifyToken),
      publicStatus: {
        apiConfigured: Boolean(versionValid && phoneNumberId && accessToken),
        webhookConfigured: Boolean(appSecret && verifyToken),
        phoneNumberId: phoneNumberId || '',
        apiVersion: versionValid ? apiVersion : ''
      }
    };
  }

  return {
    MESSAGE_STATUSES,
    normalizePhoneNumber,
    validateContact,
    createContact,
    updateContact,
    buildTemplatePayload,
    verifyWebhookSignature,
    extractStatusUpdates,
    getConfiguration
  };
});
