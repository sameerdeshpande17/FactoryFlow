const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

let server;
let baseUrl;
let tempDir;

async function freePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

before(async () => {
  const root = path.join(__dirname, '..');
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'factoryflow-test-'));
  for (const file of ['server.js', 'auth.js', 'facilities.js', 'forecasting.js', 'inventory.js', 'scheduling.js', 'scheduler-optimizer.js', 'execution.js', 'analytics.js', 'machines.js', 'maintenance-work-orders.js', 'gst-documents.js', 'whatsapp.js', 'supplier-network.js']) {
    fs.copyFileSync(path.join(root, file), path.join(tempDir, file));
  }
  fs.mkdirSync(path.join(tempDir, 'data'));
  fs.copyFileSync(path.join(root, 'data', 'seed.json'), path.join(tempDir, 'data', 'seed.json'));
  const port = await freePort();
  baseUrl = 'http://127.0.0.1:' + port;
  server = spawn(process.execPath, ['server.js'], {
    cwd: tempDir,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', WHATSAPP_APP_SECRET: 'test-app-secret', WHATSAPP_VERIFY_TOKEN: 'test-verify-token' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error('FactoryFlow server exited during startup.');
    try {
      const response = await fetch(baseUrl + '/api/health');
      if (response.ok) return;
      lastError = new Error('Health endpoint returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error('FactoryFlow server did not become ready.');
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 2000))]);
  }
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

async function json(response) {
  return response.json();
}

test('authenticates users, enforces role access, persists operations and protects server files', async () => {
  const health = await fetch(baseUrl + '/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await json(health), { ok: true });

  const statusBeforeSetup = await json(await fetch(baseUrl + '/api/auth/status'));
  assert.equal(statusBeforeSetup.setupRequired, true);
  assert.equal(statusBeforeSetup.authenticated, false);
  assert.equal((await fetch(baseUrl + '/api/bootstrap')).status, 401);

  const blockedData = await fetch(baseUrl + '/data/factoryflow.json');
  assert.equal(blockedData.status, 404);
  assert.equal((await fetch(baseUrl + '/server.js')).status, 404);
  assert.equal((await fetch(baseUrl + '/auth.js')).status, 404);

  const setup = await fetch(baseUrl + '/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Factory Admin',
      email: 'ADMIN@FACTORY.EXAMPLE',
      password: 'FactoryFlowAdmin123'
    })
  });
  assert.equal(setup.status, 201);
  const setupPayload = await json(setup);
  assert.equal(setupPayload.user.role, 'admin');
  assert.equal(setupPayload.permissions.includes('users.manage'), true);
  assert.equal(setupPayload.user.mustChangePassword, false);
  const adminCookie = setup.headers.get('set-cookie').split(';')[0];
  const adminCsrf = setupPayload.csrfToken;
  assert.ok(adminCookie.startsWith('FF_SESSION='));
  assert.ok(adminCsrf.length >= 32);

  const secondSetup = await fetch(baseUrl + '/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Intruder', email: 'intruder@example.test', password: 'FactoryFlowAdmin123' })
  });
  assert.equal(secondSetup.status, 409);

  const adminBootstrap = await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: adminCookie } });
  assert.equal(adminBootstrap.status, 200);
  const emptyState = await json(adminBootstrap);
  assert.equal(emptyState.auth.user.role, 'admin');
  assert.ok(Array.isArray(emptyState.state.workers));
  assert.ok(Array.isArray(emptyState.state.downtimeLogs));
  assert.deepEqual(emptyState.state.users, []);
  assert.deepEqual(emptyState.state.auditLogs, []);
  assert.equal(emptyState.activeFacilityId, 'FAC-001');
  assert.equal(emptyState.facilities.length, 1);
  assert.equal(emptyState.facilities[0].id, 'FAC-001');

  const createFacility = await fetch(baseUrl + '/api/facilities', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Pune Plant', code: 'PUNE-01', city: 'Pune', address: 'Industrial Area', timezone: 'Asia/Kolkata' })
  });
  assert.equal(createFacility.status, 201);
  const puneFacility = (await json(createFacility)).facility;
  assert.equal(puneFacility.code, 'PUNE-01');
  assert.notEqual(puneFacility.id, 'FAC-001');

  const emptySupplierRegister = await json(await fetch(baseUrl + '/api/suppliers', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  }));
  assert.deepEqual(emptySupplierRegister.suppliers, []);

  const createSupplierResponse = await fetch(baseUrl + '/api/suppliers', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Kaveri Packaging Materials',
      contactName: 'Arun Kumar',
      phone: '+91 98765 43210',
      email: 'sales@kaveri.example',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: 'Peenya Industrial Area',
      city: 'Bengaluru',
      state: 'Karnataka',
      categories: ['Kraft paper', 'Corrugated board']
    })
  });
  assert.equal(createSupplierResponse.status, 201);
  const createdSupplier = (await json(createSupplierResponse)).supplier;
  assert.equal(createdSupplier.verification.status, 'unverified');
  assert.equal(createdSupplier.trust.score, null);

  const missingSupplierEvidence = await fetch(baseUrl + '/api/suppliers/' + encodeURIComponent(createdSupplier.id) + '/verification', {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'verified', method: 'business_documents' })
  });
  assert.equal(missingSupplierEvidence.status, 400);

  const verifySupplierResponse = await fetch(baseUrl + '/api/suppliers/' + encodeURIComponent(createdSupplier.id) + '/verification', {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'verified',
      method: 'business_documents',
      evidenceReference: 'GST certificate reviewed: DOC-2026-01',
      notes: 'Internal document review completed.'
    })
  });
  assert.equal(verifySupplierResponse.status, 200);
  const verifiedSupplier = (await json(verifySupplierResponse)).supplier;
  assert.equal(verifiedSupplier.verification.status, 'verified');
  assert.ok(verifiedSupplier.verification.checkedBy);
  assert.ok(verifiedSupplier.verification.checkedAt);
  assert.equal(verifiedSupplier.trust.score, null);

  const foreignSupplierRegister = await json(await fetch(baseUrl + '/api/suppliers', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id }
  }));
  assert.deepEqual(foreignSupplierRegister.suppliers, []);

  const whatsappConfigResponse = await json(await fetch(baseUrl + '/api/whatsapp/config', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  }));
  assert.equal(whatsappConfigResponse.configuration.apiConfigured, false);
  assert.equal(whatsappConfigResponse.configuration.webhookConfigured, true);
  assert.equal(Object.hasOwn(whatsappConfigResponse.configuration, 'accessToken'), false);

  const invalidWebhookHandshake = await fetch(baseUrl + '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc');
  assert.equal(invalidWebhookHandshake.status, 403);
  const validWebhookHandshake = await fetch(baseUrl + '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge-123');
  assert.equal(validWebhookHandshake.status, 200);
  assert.equal(await validWebhookHandshake.text(), 'challenge-123');

  const invalidWebhookSignature = await fetch(baseUrl + '/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64) },
    body: JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
  });
  assert.equal(invalidWebhookSignature.status, 401);

  const webhookBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const webhookSignature = 'sha256=' + crypto.createHmac('sha256', 'test-app-secret').update(webhookBody).digest('hex');
  const validWebhook = await fetch(baseUrl + '/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': webhookSignature },
    body: webhookBody
  });
  assert.equal(validWebhook.status, 200);
  assert.equal(await validWebhook.text(), 'EVENT_RECEIVED');

  const createWhatsAppContact = await fetch(baseUrl + '/api/whatsapp/contacts', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Kaveri Foods', phone: '+91 98765 43210', optedIn: false })
  });
  assert.equal(createWhatsAppContact.status, 201);
  const whatsappContact = (await json(createWhatsAppContact)).contact;
  assert.equal(whatsappContact.phone, '919876543210');
  assert.equal(whatsappContact.optedIn, false);

  const unconsentedSend = await fetch(baseUrl + '/api/whatsapp/messages', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactId: whatsappContact.id, templateName: 'factoryflow_invoice_issued', languageCode: 'en', bodyParameters: [] })
  });
  assert.equal(unconsentedSend.status, 403);

  const recordWhatsAppConsent = await fetch(baseUrl + '/api/whatsapp/contacts/' + encodeURIComponent(whatsappContact.id), {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: whatsappContact.name, phone: whatsappContact.phone,
      optedIn: true, consentSource: 'Signed customer opt-in form',
      consentAt: '2026-11-06T05:00:00.000Z'
    })
  });
  assert.equal(recordWhatsAppConsent.status, 200);
  const consentedContact = (await json(recordWhatsAppConsent)).contact;
  assert.equal(consentedContact.optedIn, true);

  const sendWithoutCloudCredentials = await fetch(baseUrl + '/api/whatsapp/messages', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactId: consentedContact.id,
      templateName: 'factoryflow_invoice_issued',
      languageCode: 'en',
      bodyParameters: ['Kaveri Foods', 'INV-1', '100', '2026-11-06']
    })
  });
  assert.equal(sendWithoutCloudCredentials.status, 503);

  const foreignWhatsAppContacts = await json(await fetch(baseUrl + '/api/whatsapp/contacts', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id }
  }));
  assert.deepEqual(foreignWhatsAppContacts.contacts, []);

  const initialFacilitySummary = await json(await fetch(baseUrl + '/api/facilities/summary', { headers: { Cookie: adminCookie } }));
  assert.equal(initialFacilitySummary.facilityCount, 2);
  assert.deepEqual(initialFacilitySummary.summaries.map((item) => item.facilityId).sort(), ['FAC-001', puneFacility.id].sort());

  const invalidCsrf = await fetch(baseUrl + '/api/sync', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(invalidCsrf.status, 403);

  const state = {
    quotes: [{ id: 'QT-PRIVATE', customer: 'Private Customer' }],
    jobs: [
      { id: 'JB-WORKER', customer: 'Worker Customer', item: 'Assigned carton', qty: 20, worker: 'Test Worker', status: 'In production', progress: 0 },
      { id: 'JB-OTHER', customer: 'Other Customer', item: 'Other pouch', qty: 50, worker: 'Other Worker', status: 'In production', progress: 0, estimatedHours: 12, priority: 'High', requiredSkill: 'Finishing', dueDate: '2026-11-05' }
    ],
    purchases: [
      { id: 'PO-PRIVATE', supplier: 'Private Supplier', material: 'Private ink' },
      { id: 'PO-INCOMING', supplier: 'Pioneer Inks', material: 'Water-based ink', materialSku: 'RM-TEST', quantity: 10, receivedQty: 0, unit: 'kg', status: 'Confirmed' },
    ],
    materials: [
      { sku: 'RM-TEST', item: 'Water-based ink', onHand: '20 kg', stock: 20, capacity: 100, unitCost: 12, reorderLevel: 30, leadTimeDays: 5, safetyStockDays: 2, reviewPeriodDays: 7, minimumOrderQty: 25, orderMultiple: 10, preferredSupplier: 'Pioneer Inks' },
      { sku: 'RM-NOHISTORY', item: 'Kraft paper with no usage history', onHand: '40 kg', stock: 40, capacity: 100, reorderLevel: 30, unitCost: 5 }
    ],
    deliveries: [],
    receipts: [],
    movements: Array.from({ length: 14 }, (_, index) => ({
      id: 'MV-FORECAST-' + index,
      type: 'Consumption',
      direction: 'OUT',
      materialSku: 'RM-TEST',
      quantity: 10,
      unit: 'kg',
      createdAt: new Date(Date.now() - (index + 0.5) * 24 * 60 * 60 * 1000).toISOString()
    })),
    requirements: [],
    workers: [
      { id: 'WRK-TEST', name: 'Test Worker', skill: 'Printing', capacityHoursPerDay: 8, active: true, unavailableDates: [] },
      { id: 'WRK-OTHER', name: 'Other Worker', skill: 'Finishing', capacityHoursPerDay: 8, active: true, unavailableDates: [] }
    ],
    schedules: [
      { id: 'SC-WORKER', jobId: 'JB-WORKER', workerId: 'WRK-TEST', workerName: 'Test Worker', date: '2026-11-01', hours: 6, note: 'Day shift' },
      { id: 'SC-OTHER', jobId: 'JB-OTHER', workerId: 'WRK-OTHER', workerName: 'Other Worker', date: '2026-11-01', hours: 6, note: 'Day shift' }
    ],
    productionLogs: [],
    qcInspections: [],
    reworkLogs: [],
    downtimeLogs: [],
    maintenanceWorkOrders: [],
    maintenanceTechnicians: [],
    suppliers: [{ id: 'SUP-FORGED', facilityId: 'FAC-001', businessName: 'Forged supplier', verification: { status: 'verified', evidenceReference: 'forged' } }],
    whatsappContacts: [{ id: 'WAC-FORGED', name: 'Forged opt-in', phone: '919999999999', optedIn: true, consentAt: '2026-11-06T05:00:00.000Z' }],
    whatsappMessages: [{ id: 'WAM-FORGED', recipientPhone: '919999999999', status: 'delivered' }]
  };
  const sync = await fetch(baseUrl + '/api/sync', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
  assert.equal(sync.status, 200);

  const createMachine = await fetch(baseUrl + '/api/machines', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'FINISH-01',
      name: 'Finishing line 01',
      type: 'Finishing line',
      location: 'Shop floor A',
      capacityHoursPerDay: 8,
      supportedSkills: ['Finishing']
    })
  });
  assert.equal(createMachine.status, 201);
  const createdMachine = (await json(createMachine)).machine;
  assert.equal(createdMachine.facilityId, 'FAC-001');
  assert.equal(createdMachine.code, 'FINISH-01');

  const duplicateMachine = await fetch(baseUrl + '/api/machines', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'finish-01', name: 'Duplicate line', capacityHoursPerDay: 8 })
  });
  assert.equal(duplicateMachine.status, 400);

  const maintenanceWindow = await fetch(baseUrl + '/api/machines/' + encodeURIComponent(createdMachine.id) + '/maintenance', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', endDate: '2026-11-02', reason: 'Preventive maintenance' })
  });
  assert.equal(maintenanceWindow.status, 201);
  assert.equal((await json(maintenanceWindow)).machine.maintenanceWindows.length, 1);

  const machineService = await fetch(baseUrl + '/api/machines/' + encodeURIComponent(createdMachine.id) + '/service', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceDate: '2026-11-02',
      serviceType: 'Preventive service',
      performedBy: 'Maintenance technician',
      notes: 'Lubricated rollers'
    })
  });
  assert.equal(machineService.status, 201);
  const machineServicePayload = await json(machineService);
  assert.equal(machineServicePayload.record.machineId, createdMachine.id);
  assert.equal(machineServicePayload.record.facilityId, 'FAC-001');
  assert.equal(machineServicePayload.maintenanceRecords.length, 1);

  const flagSparePart = await fetch(baseUrl + '/api/materials/RM-TEST/spare-part', {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ maintenancePart: true })
  });
  assert.equal(flagSparePart.status, 200);
  assert.equal((await json(flagSparePart)).material.maintenancePart, true);

  const createWorkOrder = await fetch(baseUrl + '/api/maintenance/work-orders', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      machineId: createdMachine.id,
      title: 'Replace worn finishing roller',
      description: 'Roller surface has visible wear and causes uneven finishing.',
      type: 'Breakdown repair',
      priority: 'Urgent',
      dueDate: '2026-11-08',
      assignedTo: 'Maintenance technician'
    })
  });
  assert.equal(createWorkOrder.status, 201);
  const createdWorkOrder = (await json(createWorkOrder)).workOrder;
  assert.equal(createdWorkOrder.facilityId, 'FAC-001');
  assert.equal(createdWorkOrder.status, 'Assigned');

  const createTechnician = await fetch(baseUrl + '/api/maintenance/technicians', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ravi Maintenance',
      specialty: 'Mechanical',
      capacityHoursPerDay: 4,
      hourlyRate: 450,
      workingDays: [1, 2, 3, 4, 5],
      unavailableDates: ['2026-11-09']
    })
  });
  assert.equal(createTechnician.status, 201);
  const technician = (await json(createTechnician)).technician;
  assert.equal(technician.facilityId, 'FAC-001');
  assert.deepEqual(technician.workingDays, [1, 2, 3, 4, 5]);

  const foreignTechnicianList = await json(await fetch(baseUrl + '/api/maintenance/technicians', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id }
  }));
  assert.deepEqual(foreignTechnicianList.technicians, []);

  const scheduleWorkOrder = await fetch(baseUrl + '/api/maintenance/work-orders/' + encodeURIComponent(createdWorkOrder.id) + '/schedule', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      technicianId: technician.id,
      scheduledDate: '2026-11-06',
      startTime: '09:00',
      endTime: '11:00'
    })
  });
  assert.equal(scheduleWorkOrder.status, 200);
  const scheduledPayload = await json(scheduleWorkOrder);
  assert.equal(scheduledPayload.workOrder.technicianId, technician.id);
  assert.equal(scheduledPayload.workOrder.scheduledHours, 2);
  assert.equal(scheduledPayload.workOrder.laborCost, 900);

  const overlappingOrderResponse = await fetch(baseUrl + '/api/maintenance/work-orders', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      machineId: createdMachine.id, title: 'Inspect drive motor', description: 'Inspect motor mounting bolts.',
      priority: 'High'
    })
  });
  assert.equal(overlappingOrderResponse.status, 201);
  const overlappingOrder = (await json(overlappingOrderResponse)).workOrder;

  const overlapDenied = await fetch(baseUrl + '/api/maintenance/work-orders/' + encodeURIComponent(overlappingOrder.id) + '/schedule', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ technicianId: technician.id, scheduledDate: '2026-11-06', startTime: '10:00', endTime: '12:00' })
  });
  assert.equal(overlapDenied.status, 400);
  assert.match((await json(overlapDenied)).error, /overlaps work order/i);

  const capacityDenied = await fetch(baseUrl + '/api/maintenance/work-orders/' + encodeURIComponent(overlappingOrder.id) + '/schedule', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ technicianId: technician.id, scheduledDate: '2026-11-06', startTime: '11:00', endTime: '14:00' })
  });
  assert.equal(capacityDenied.status, 400);
  assert.match((await json(capacityDenied)).error, /capacity/i);

  const unavailableDenied = await fetch(baseUrl + '/api/maintenance/work-orders/' + encodeURIComponent(overlappingOrder.id) + '/schedule', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ technicianId: technician.id, scheduledDate: '2026-11-09', startTime: '09:00', endTime: '10:00' })
  });
  assert.equal(unavailableDenied.status, 400);
  assert.match((await json(unavailableDenied)).error, /unavailable/i);

  const calendarResponse = await fetch(baseUrl + '/api/maintenance/calendar?fromDate=2026-11-06&days=7', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  });
  assert.equal(calendarResponse.status, 200);
  const calendarPayload = await json(calendarResponse);
  assert.equal(calendarPayload.calendar.events.length, 1);
  assert.equal(calendarPayload.calendar.capacity[0].days[0].scheduledHours, 2);

  const issueSparePart = await fetch(baseUrl + '/api/maintenance/work-orders/' + encodeURIComponent(createdWorkOrder.id) + '/parts', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ materialSku: 'RM-TEST', quantity: 2, unit: 'kg' })
  });
  assert.equal(issueSparePart.status, 201);
  const issuedPayload = await json(issueSparePart);
  assert.equal(issuedPayload.part.costAmount, 24);
  assert.equal(issuedPayload.material.onHand, '18 kg');
  assert.equal(issuedPayload.movement.workOrderId, createdWorkOrder.id);

  const startWorkOrder = await fetch(baseUrl + '/api/maintenance/work-orders/' + encodeURIComponent(createdWorkOrder.id), {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'In progress' })
  });
  assert.equal(startWorkOrder.status, 200);

  const completeWorkOrder = await fetch(baseUrl + '/api/maintenance/work-orders/' + encodeURIComponent(createdWorkOrder.id), {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Completed', resolutionNotes: 'Replaced roller and checked alignment.' })
  });
  assert.equal(completeWorkOrder.status, 200);
  const completedPayload = await json(completeWorkOrder);
  assert.equal(completedPayload.workOrder.status, 'Completed');
  assert.ok(completedPayload.workOrder.serviceRecordId);
  assert.equal(completedPayload.serviceRecord.machineId, createdMachine.id);

  const foreignWorkOrder = await fetch(baseUrl + '/api/maintenance/work-orders/' + encodeURIComponent(createdWorkOrder.id), {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': puneFacility.id, 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority: 'Low' })
  });
  assert.equal(foreignWorkOrder.status, 404);

  const foreignMachineService = await fetch(baseUrl + '/api/machines/' + encodeURIComponent(createdMachine.id) + '/service', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': puneFacility.id, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceDate: '2026-11-02',
      serviceType: 'Inspection',
      performedBy: 'Other site technician'
    })
  });
  assert.equal(foreignMachineService.status, 404);

  const mainMachineList = await json(await fetch(baseUrl + '/api/machines', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  }));
  assert.deepEqual(mainMachineList.machines.map((item) => item.id), [createdMachine.id]);

  const schedulePreview = await fetch(baseUrl + '/api/scheduling/optimize', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', horizonDays: 5, includeWeekends: false })
  });
  assert.equal(schedulePreview.status, 200);
  const schedulePreviewPayload = await json(schedulePreview);
  assert.equal(schedulePreviewPayload.facilityId, 'FAC-001');
  assert.ok(schedulePreviewPayload.plan.proposals.length > 0);
  assert.ok(schedulePreviewPayload.plan.proposals.every((item) => item.jobId === 'JB-OTHER' && item.workerId === 'WRK-OTHER' && item.machineId === createdMachine.id));
  assert.ok(schedulePreviewPayload.plan.proposals.every((item) => item.date !== '2026-11-02'));
  assert.ok(schedulePreviewPayload.plan.dailyMachineLoads.length > 0);
  assert.ok(schedulePreviewPayload.plan.jobPlans.some((item) => item.status === 'Needs estimate' && item.jobId === 'JB-WORKER'));

  const scheduleApply = await fetch(baseUrl + '/api/scheduling/optimize/apply', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', horizonDays: 5, includeWeekends: false })
  });
  assert.equal(scheduleApply.status, 201);
  const scheduleApplyPayload = await json(scheduleApply);
  assert.ok(scheduleApplyPayload.appliedSessions.length > 0);
  assert.ok(scheduleApplyPayload.appliedSessions.every((item) => item.facilityId === 'FAC-001' && item.optimizerPlanId === scheduleApplyPayload.planId && item.machineId === createdMachine.id));

  const duplicateScheduleApply = await fetch(baseUrl + '/api/scheduling/optimize/apply', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', horizonDays: 5, includeWeekends: false })
  });
  assert.equal(duplicateScheduleApply.status, 409);

  const scheduleBootstrap = await json(await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' } }));
  assert.ok(scheduleBootstrap.state.schedules.some((session) => session.optimizerPlanId === scheduleApplyPayload.planId));
  
  const mainForecastResponse = await fetch(baseUrl + '/api/inventory/forecast', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  });
  assert.equal(mainForecastResponse.status, 200);
  const mainForecastPayload = await json(mainForecastResponse);
  const inkForecast = mainForecastPayload.forecast.items.find((item) => item.materialSku === 'RM-TEST');
  assert.ok(inkForecast);
  assert.equal(inkForecast.incomingQty, 10);
  assert.equal(inkForecast.averageDailyDemand, 6.8);
  assert.equal(inkForecast.recommendedOrderQty, 70);
  assert.equal(inkForecast.preferredSupplier, 'Pioneer Inks');
  assert.equal(mainForecastPayload.forecast.items.find((item) => item.materialSku === 'RM-NOHISTORY').dataQuality, 'No history');

  const forecastSettings = await fetch(baseUrl + '/api/materials/RM-TEST/forecast-settings', {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadTimeDays: 8,
      safetyStockDays: 2,
      reviewPeriodDays: 7,
      minimumOrderQty: 20,
      orderMultiple: 20,
      preferredSupplier: 'Pioneer Inks'
    })
  });
  assert.equal(forecastSettings.status, 200);
  assert.equal((await json(forecastSettings)).material.leadTimeDays, 8);

  const refreshedForecast = await json(await fetch(baseUrl + '/api/inventory/forecast', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  }));
  const updatedInkForecast = refreshedForecast.forecast.items.find((item) => item.materialSku === 'RM-TEST');
  assert.equal(updatedInkForecast.recommendedOrderQty, 100);

  const forecastDraft = await fetch(baseUrl + '/api/procurement/drafts', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ materialSku: 'RM-TEST' })
  });
  assert.equal(forecastDraft.status, 201);
  const forecastDraftPayload = await json(forecastDraft);
  assert.equal(forecastDraftPayload.purchase.quantity, 100);
  assert.equal(forecastDraftPayload.purchase.status, 'Draft');
  assert.equal(forecastDraftPayload.purchase.forecastGenerated, true);
  assert.equal(forecastDraftPayload.purchase.supplier, 'Pioneer Inks');
  assert.equal(forecastDraftPayload.purchase.facilityId, 'FAC-001');

  const duplicateForecastDraft = await fetch(baseUrl + '/api/procurement/drafts', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ materialSku: 'RM-TEST' })
  });
  assert.equal(duplicateForecastDraft.status, 200);
  assert.equal((await json(duplicateForecastDraft)).purchase.id, forecastDraftPayload.purchase.id);

  const noShortageDraft = await fetch(baseUrl + '/api/procurement/drafts', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ materialSku: 'RM-NOHISTORY' })
  });
  assert.equal(noShortageDraft.status, 409);

  const puneState = {
    quotes: [],
    jobs: [{ id: 'JB-PUNE', customer: 'Pune Foods', item: 'Pune carton run', qty: 100, status: 'In production', progress: 0, estimatedHours: 10, requiredSkill: 'Printing', priority: 'Urgent', dueDate: '2026-11-06' }],
    purchases: [],
    materials: [{ sku: 'RM-PUNE', item: 'Pune kraft paper', onHand: '50 kg', stock: 50, capacity: 50, status: 'Critical' }],
    deliveries: [],
    receipts: [],
    movements: [],
    requirements: [],
    workers: [{ id: 'WRK-PUNE', name: 'Pune Worker', skill: 'Printing', capacityHoursPerDay: 8, active: true, unavailableDates: [] }],
    schedules: [],
    productionLogs: [{ id: 'PR-PUNE', jobId: 'JB-PUNE', workerId: 'WRK-PUNE', producedQty: 60, goodQty: 58, rejectedQty: 2, actualHours: 5 }],
    qcInspections: [],
    reworkLogs: [],
    downtimeLogs: [{ id: 'DT-PUNE', machineName: 'Pune Press', durationMinutes: 90, reason: 'Breakdown', startAt: '2026-11-01T08:00', endAt: '2026-11-01T09:30' }]
  };
  const puneSync = await fetch(baseUrl + '/api/sync', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': puneFacility.id, 'Content-Type': 'application/json' },
    body: JSON.stringify(puneState)
  });
  assert.equal(puneSync.status, 200);

  const mainForecastAfterPune = await json(await fetch(baseUrl + '/api/inventory/forecast', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  }));
  assert.equal(mainForecastAfterPune.forecast.items.some((item) => item.materialSku === 'RM-PUNE'), false);
  const puneForecast = await json(await fetch(baseUrl + '/api/inventory/forecast', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id }
  }));
  assert.deepEqual(puneForecast.forecast.items.map((item) => item.materialSku), ['RM-PUNE']);

  const puneSchedulePreview = await fetch(baseUrl + '/api/scheduling/optimize', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', horizonDays: 5, includeWeekends: false })
  });
  assert.equal(puneSchedulePreview.status, 200);
  const puneSchedulePayload = await json(puneSchedulePreview);
  assert.ok(puneSchedulePayload.plan.proposals.length > 0);
  assert.ok(puneSchedulePayload.plan.proposals.every((item) => item.jobId === 'JB-PUNE' && item.workerId === 'WRK-PUNE'));

  const mainFacilityProduction = await fetch(baseUrl + '/api/operations/production', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: 'JB-OTHER',
      workerId: 'WRK-OTHER',
      productionDate: '2026-11-01',
      shift: 'Day',
      producedQty: 5,
      goodQty: 5,
      rejectedQty: 0,
      actualHours: 1
    })
  });
  assert.equal(mainFacilityProduction.status, 201);
  const mainFacilityProductionPayload = await json(mainFacilityProduction);
  assert.equal(mainFacilityProductionPayload.productionLogs.some((entry) => entry.id === 'PR-PUNE'), false);

  const mainBootstrap = await json(await fetch(baseUrl + '/api/bootstrap', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  }));
  assert.deepEqual(mainBootstrap.state.jobs.map((job) => job.id).sort(), ['JB-OTHER', 'JB-WORKER']);
  assert.equal(mainBootstrap.state.materials.some((item) => item.sku === 'RM-PUNE'), false);

  const puneBootstrap = await json(await fetch(baseUrl + '/api/bootstrap', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id }
  }));
  assert.deepEqual(puneBootstrap.state.jobs.map((job) => job.id), ['JB-PUNE']);
  assert.deepEqual(puneBootstrap.state.materials.map((item) => item.sku), ['RM-PUNE']);
  assert.deepEqual(puneBootstrap.state.workers.map((item) => item.id), ['WRK-PUNE']);

  const allFacilitySummaries = await json(await fetch(baseUrl + '/api/facilities/summary', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  }));
  const puneSummary = allFacilitySummaries.summaries.find((item) => item.facilityId === puneFacility.id);
  assert.equal(puneSummary.activeJobs, 1);
  assert.equal(puneSummary.producedQty, 60);
  assert.equal(puneSummary.activeWorkers, 1);
  assert.equal(puneSummary.stockAlerts, 1);
  assert.equal(puneSummary.downtimeHours, 1.5);

  const crossFacilityWrite = await fetch(baseUrl + '/api/sync', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...state, jobs: [{ id: 'JB-PUNE', facilityId: puneFacility.id, customer: 'Tamper' }] })
  });
  assert.equal(crossFacilityWrite.status, 400);
  const puneStillIntact = await json(await fetch(baseUrl + '/api/bootstrap', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id }
  }));
  assert.equal(puneStillIntact.state.jobs[0].customer, 'Pune Foods');

  const createManager = await fetch(baseUrl + '/api/users', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Factory Manager',
      email: 'manager@factory.example',
      role: 'manager',
      facilityIds: ['FAC-001'],
      password: 'FactoryFlowManager123'
    })
  });
  assert.equal(createManager.status, 201);

  const managerLogin = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@factory.example', password: 'FactoryFlowManager123' })
  });
  assert.equal(managerLogin.status, 200);
  const managerLoginPayload = await json(managerLogin);
  assert.equal(managerLoginPayload.permissions.includes('users.manage'), false);
  const managerCookie = managerLogin.headers.get('set-cookie').split(';')[0];
  const managerCsrf = managerLoginPayload.csrfToken;
  const managerTempBootstrap = await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: managerCookie } });
  assert.equal(managerTempBootstrap.status, 403);
  const managerPasswordChange = await fetch(baseUrl + '/api/auth/password', {
    method: 'POST',
    headers: { Cookie: managerCookie, 'X-CSRF-Token': managerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'FactoryFlowManager123', newPassword: 'FactoryFlowManagerSecure456' })
  });
  assert.equal(managerPasswordChange.status, 200);
  const managerBootstrap = await json(await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: managerCookie } }));
  assert.deepEqual(managerBootstrap.state.users, []);
  assert.deepEqual(managerBootstrap.state.auditLogs, []);
  assert.equal(managerBootstrap.facilities.length, 1);
  assert.equal(managerBootstrap.facilities[0].id, 'FAC-001');
  const managerWrongFacilityPreview = await fetch(baseUrl + '/api/scheduling/optimize', {
    method: 'POST',
    headers: { Cookie: managerCookie, 'X-Facility-ID': puneFacility.id, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', horizonDays: 5 })
  });
  assert.equal(managerWrongFacilityPreview.status, 403);
  const managerWrongFacilityApply = await fetch(baseUrl + '/api/scheduling/optimize/apply', {
    method: 'POST',
    headers: { Cookie: managerCookie, 'X-CSRF-Token': managerCsrf, 'X-Facility-ID': puneFacility.id, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', horizonDays: 5 })
  });
  assert.equal(managerWrongFacilityApply.status, 403);
  const managerFacilitySummary = await json(await fetch(baseUrl + '/api/facilities/summary', { headers: { Cookie: managerCookie } }));
  assert.equal(managerFacilitySummary.facilityCount, 1);
  assert.deepEqual(managerFacilitySummary.summaries.map((item) => item.facilityId), ['FAC-001']);
  assert.equal((await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: managerCookie, 'X-Facility-ID': puneFacility.id } })).status, 403);
  assert.equal((await fetch(baseUrl + '/api/facilities', {
    method: 'POST',
    headers: { Cookie: managerCookie, 'X-CSRF-Token': managerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauthorized Site', code: 'NOPE' })
  })).status, 403);
  assert.equal((await fetch(baseUrl + '/api/users', { headers: { Cookie: managerCookie } })).status, 403);

  const createWorker = await fetch(baseUrl + '/api/users', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Worker',
      email: 'worker@factory.example',
      role: 'worker',
      workerId: 'WRK-TEST',
      facilityIds: ['FAC-001'],
      password: 'FactoryFlowWorker123'
    })
  });
  assert.equal(createWorker.status, 201);
  const createdWorker = await json(createWorker);
  assert.equal(createdWorker.user.mustChangePassword, true);
  assert.equal(createdWorker.user.role, 'worker');

  const badWorkerLink = await fetch(baseUrl + '/api/users', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bad Link',
      email: 'badlink@factory.example',
      role: 'worker',
      workerId: 'WRK-NOT-FOUND',
      password: 'FactoryFlowWorker123'
    })
  });
  assert.equal(badWorkerLink.status, 400);

  const lastAdminDemotion = await fetch(baseUrl + '/api/users/' + encodeURIComponent(setupPayload.user.id), {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'manager', active: true })
  });
  assert.equal(lastAdminDemotion.status, 400);
  assert.match((await json(lastAdminDemotion)).error, /at least one active administrator/i);
  const adminStillAuthenticated = await json(await fetch(baseUrl + '/api/auth/status', { headers: { Cookie: adminCookie } }));
  assert.equal(adminStillAuthenticated.authenticated, true);

  const emptyGstProfile = await json(await fetch(baseUrl + '/api/gst/profile', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': 'FAC-001' }
  }));
  assert.equal(emptyGstProfile.profile, null);

  const saveGstProfile = await fetch(baseUrl + '/api/gst/profile', {
    method: 'PUT',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    })
  });
  assert.equal(saveGstProfile.status, 200);
  assert.equal((await json(saveGstProfile)).profile.facilityId, 'FAC-001');

  const taxInvoicePayload = {
    type: 'TAX_INVOICE',
    documentDate: '2026-11-06',
    dueDate: '2026-11-20',
    customerName: 'Kaveri Foods',
    customerGstin: '29ABCDE1234F1Z5',
    customerAddress: '22 Market Road, Bengaluru',
    placeOfSupplyState: 'Karnataka',
    placeOfSupplyStateCode: '29',
    reference: 'PO-2026-014',
    lines: [{ description: 'Printed corrugated cartons', hsnSac: '48191010', quantity: 100, unit: 'pieces', unitPrice: 25, discount: 100, gstRate: 18 }]
  };
  const issueIntraStateInvoice = await fetch(baseUrl + '/api/gst/documents', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify(taxInvoicePayload)
  });
  assert.equal(issueIntraStateInvoice.status, 201);
  const intraInvoice = (await json(issueIntraStateInvoice)).document;
  assert.equal(intraInvoice.number, 'INV/2026-27/0001');
  assert.equal(intraInvoice.cgstAmount, 216);
  assert.equal(intraInvoice.sgstAmount, 216);
  assert.equal(intraInvoice.igstAmount, 0);
  assert.equal(intraInvoice.grandTotal, 2832);

  const issueInterStateInvoice = await fetch(baseUrl + '/api/gst/documents', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...taxInvoicePayload,
      customerName: 'Mumbai Retail',
      customerGstin: '27ABCDE1234F1Z5',
      placeOfSupplyState: 'Maharashtra',
      placeOfSupplyStateCode: '27'
    })
  });
  assert.equal(issueInterStateInvoice.status, 201);
  const interInvoice = (await json(issueInterStateInvoice)).document;
  assert.equal(interInvoice.number, 'INV/2026-27/0002');
  assert.equal(interInvoice.cgstAmount, 0);
  assert.equal(interInvoice.sgstAmount, 0);
  assert.equal(interInvoice.igstAmount, 432);

  const issueChallan = await fetch(baseUrl + '/api/gst/documents', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...taxInvoicePayload,
      type: 'DELIVERY_CHALLAN',
      dueDate: '',
      customerName: 'Kaveri Foods Warehouse',
      customerGstin: '',
      reference: 'Dispatch DC',
      lines: taxInvoicePayload.lines
    })
  });
  assert.equal(issueChallan.status, 201);
  const challan = (await json(issueChallan)).document;
  assert.equal(challan.number, 'DC/2026-27/0001');
  assert.equal(challan.declaredValue, 2400);
  assert.equal(challan.grandTotal, 0);
  assert.equal(challan.totalTax, 0);

  const invalidGstRate = await fetch(baseUrl + '/api/gst/documents', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...taxInvoicePayload, lines: [{ ...taxInvoicePayload.lines[0], gstRate: 7 }] })
  });
  assert.equal(invalidGstRate.status, 400);

  const foreignGstList = await json(await fetch(baseUrl + '/api/gst/documents', {
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id }
  }));
  assert.deepEqual(foreignGstList.documents, []);
  const foreignGstDocument = await fetch(baseUrl + '/api/gst/documents/' + encodeURIComponent(intraInvoice.id), {
    headers: { Cookie: adminCookie, 'X-Facility-ID': puneFacility.id }
  });
  assert.equal(foreignGstDocument.status, 404);


  const adminBootstrapAfterUsers = await json(await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: adminCookie } }));
  assert.deepEqual(adminBootstrapAfterUsers.state.users, []);
  assert.deepEqual(adminBootstrapAfterUsers.state.auditLogs, []);
  assert.equal(adminBootstrapAfterUsers.state.maintenanceRecords.length, 2);
  assert.ok(adminBootstrapAfterUsers.state.maintenanceRecords.every((record) => record.machineId === createdMachine.id));
  assert.equal(adminBootstrapAfterUsers.state.maintenanceWorkOrders.length, 2);
  assert.equal(adminBootstrapAfterUsers.state.maintenanceTechnicians.length, 1);
  assert.equal(adminBootstrapAfterUsers.state.whatsappContacts.length, 1);
  assert.equal(adminBootstrapAfterUsers.state.whatsappContacts[0].id, whatsappContact.id);
  assert.equal(adminBootstrapAfterUsers.state.whatsappContacts[0].optedIn, true);
  assert.equal(adminBootstrapAfterUsers.state.whatsappMessages.length, 0);
  assert.equal(adminBootstrapAfterUsers.state.suppliers.length, 1);
  assert.equal(adminBootstrapAfterUsers.state.suppliers[0].id, createdSupplier.id);
  assert.equal(adminBootstrapAfterUsers.state.suppliers[0].verification.status, 'verified');
  assert.equal(adminBootstrapAfterUsers.state.gstProfiles.length, 1);
  assert.equal(adminBootstrapAfterUsers.state.gstDocuments.length, 3);
  assert.ok(adminBootstrapAfterUsers.state.maintenanceWorkOrders.some((item) => item.status === 'Completed'));
  assert.equal(adminBootstrapAfterUsers.state.maintenanceWorkOrders.find((item) => item.id === createdWorkOrder.id).scheduledDate, '2026-11-06');

  const adminUsers = await json(await fetch(baseUrl + '/api/users', { headers: { Cookie: adminCookie } }));
  assert.equal(adminUsers.users.length, 3);
  assert.equal(Object.hasOwn(adminUsers.users[1], 'passwordHash'), false);

  const workerLogin = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'WORKER@FACTORY.EXAMPLE', password: 'FactoryFlowWorker123' })
  });
  assert.equal(workerLogin.status, 200);
  const workerLoginPayload = await json(workerLogin);
  assert.equal(workerLoginPayload.user.mustChangePassword, true);
  assert.equal(workerLoginPayload.permissions.includes('execution.record'), true);
  assert.equal(workerLoginPayload.permissions.includes('execution.qc'), false);
  const workerCookie = workerLogin.headers.get('set-cookie').split(';')[0];
  const workerCsrf = workerLoginPayload.csrfToken;

  const tempPasswordBootstrap = await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: workerCookie } });
  assert.equal(tempPasswordBootstrap.status, 403);
  assert.match((await json(tempPasswordBootstrap)).error, /change your temporary password/i);

  const changePassword = await fetch(baseUrl + '/api/auth/password', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'FactoryFlowWorker123', newPassword: 'FactoryFlowWorkerSecure456' })
  });
  assert.equal(changePassword.status, 200);
  const changedPasswordPayload = await json(changePassword);
  assert.equal(changedPasswordPayload.user.mustChangePassword, false);

  const workerBootstrap = await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: workerCookie } });
  assert.equal(workerBootstrap.status, 200);
  const workerBootstrapPayload = await json(workerBootstrap);
  assert.deepEqual(workerBootstrapPayload.state.gstProfiles, []);
  assert.deepEqual(workerBootstrapPayload.state.gstDocuments, []);
  assert.deepEqual(workerBootstrapPayload.state.whatsappContacts, []);
  assert.deepEqual(workerBootstrapPayload.state.whatsappMessages, []);
  assert.deepEqual(workerBootstrapPayload.state.suppliers, []);
  const workerSupplierDenied = await fetch(baseUrl + '/api/suppliers', { headers: { Cookie: workerCookie, 'X-Facility-ID': 'FAC-001' } });
  assert.equal(workerSupplierDenied.status, 403);
  const workerSchedulePreview = await fetch(baseUrl + '/api/scheduling/optimize', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', horizonDays: 5 })
  });
  assert.equal(workerSchedulePreview.status, 200);
  const workerScheduleApply = await fetch(baseUrl + '/api/scheduling/optimize/apply', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-11-02', horizonDays: 5 })
  });
  assert.equal(workerScheduleApply.status, 403);

  const workerForecastDenied = await fetch(baseUrl + '/api/inventory/forecast', {
    headers: { Cookie: workerCookie, 'X-Facility-ID': 'FAC-001' }
  });
  assert.equal(workerForecastDenied.status, 403);
  const workerServiceDenied = await fetch(baseUrl + '/api/machines/' + encodeURIComponent(createdMachine.id) + '/service', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceDate: '2026-11-02', serviceType: 'Inspection', performedBy: 'Worker' })
  });
  assert.equal(workerServiceDenied.status, 403);
  const workerWhatsAppDenied = await fetch(baseUrl + '/api/whatsapp/contacts', { headers: { Cookie: workerCookie, 'X-Facility-ID': 'FAC-001' } });
  assert.equal(workerWhatsAppDenied.status, 403);
  const workerTechnicianDenied = await fetch(baseUrl + '/api/maintenance/technicians', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauthorized technician' })
  });
  assert.equal(workerTechnicianDenied.status, 403);

  const workerWorkOrderDenied = await fetch(baseUrl + '/api/maintenance/work-orders', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'X-Facility-ID': 'FAC-001', 'Content-Type': 'application/json' },
    body: JSON.stringify({ machineId: createdMachine.id, title: 'Unauthorized repair', description: 'This should be denied.' })
  });
  assert.equal(workerWorkOrderDenied.status, 403);
  const workerState = workerBootstrapPayload;
  assert.deepEqual(workerState.state.quotes, []);
  assert.deepEqual(workerState.state.purchases, []);
  assert.deepEqual(workerState.state.materials, []);
  assert.deepEqual(workerState.state.jobs.map((job) => job.id), ['JB-WORKER']);
  assert.deepEqual(workerState.state.schedules.map((item) => item.id), ['SC-WORKER']);
  assert.deepEqual(workerState.state.workers.map((item) => item.id), ['WRK-TEST']);
  assert.deepEqual(workerState.state.users, []);
  assert.deepEqual(workerState.state.auditLogs, []);

  const workerUsers = await fetch(baseUrl + '/api/users', { headers: { Cookie: workerCookie } });
  assert.equal(workerUsers.status, 403);
  const workerSync = await fetch(baseUrl + '/api/sync', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
  assert.equal(workerSync.status, 403);

  const unrelatedJobOutput = await fetch(baseUrl + '/api/operations/production', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: 'JB-OTHER',
      workerId: 'WRK-TEST',
      productionDate: '2026-11-01',
      shift: 'Day',
      producedQty: 2,
      goodQty: 2,
      rejectedQty: 0,
      actualHours: 1
    })
  });
  assert.equal(unrelatedJobOutput.status, 403);

  const unscheduledWorkerOutput = await fetch(baseUrl + '/api/operations/production', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: 'JB-WORKER',
      workerId: 'WRK-TEST',
      productionDate: '2026-11-01',
      shift: 'Day',
      producedQty: 2,
      goodQty: 2,
      rejectedQty: 0,
      actualHours: 1
    })
  });
  assert.equal(unscheduledWorkerOutput.status, 403);

  const ownJobOutput = await fetch(baseUrl + '/api/operations/production', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: 'JB-WORKER',
      workerId: 'WRK-TEST',
      scheduleId: 'SC-WORKER',
      productionDate: '2026-11-01',
      shift: 'Day',
      producedQty: 6,
      goodQty: 5,
      rejectedQty: 1,
      actualHours: 4,
      notes: 'Worker shift output'
    })
  });
  assert.equal(ownJobOutput.status, 201);
  const outputPayload = await json(ownJobOutput);
  assert.equal(outputPayload.record.producedQty, 6);
  assert.equal(outputPayload.record.actualHours, 4);
  assert.equal(outputPayload.job.progress, 30);

  const workerQc = await fetch(baseUrl + '/api/operations/qc', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: 'JB-WORKER', inspectedQty: 1, passedQty: 1, failedQty: 0, inspector: 'Worker' })
  });
  assert.equal(workerQc.status, 403);

  const statusAfterPassword = await json(await fetch(baseUrl + '/api/auth/status', { headers: { Cookie: workerCookie } }));
  assert.equal(statusAfterPassword.authenticated, true);
  assert.equal(statusAfterPassword.user.mustChangePassword, false);

  const logout = await fetch(baseUrl + '/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(logout.status, 200);
  assert.equal((await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: workerCookie } })).status, 401);

  const audit = await json(await fetch(baseUrl + '/api/audit', { headers: { Cookie: adminCookie } }));
  assert.ok(audit.records.some((record) => record.action === 'auth.initial_setup'));
  assert.ok(audit.records.some((record) => record.action === 'production.output_recorded'));
  assert.ok(audit.records.some((record) => record.action === 'machine.service_recorded'));
  assert.ok(audit.records.some((record) => record.action === 'maintenance.work_order_created'));
  assert.ok(audit.records.some((record) => record.action === 'maintenance.work_order_updated'));
  assert.ok(audit.records.some((record) => record.action === 'maintenance.spare_part_issued'));
  assert.ok(audit.records.some((record) => record.action === 'maintenance.technician_created'));
  assert.ok(audit.records.some((record) => record.action === 'maintenance.work_order_scheduled'));
  assert.ok(audit.records.some((record) => record.action === 'auth.password_changed'));
});
