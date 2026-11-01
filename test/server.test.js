const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
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
  for (const file of ['server.js', 'auth.js', 'execution.js', 'analytics.js']) {
    fs.copyFileSync(path.join(root, file), path.join(tempDir, file));
  }
  fs.mkdirSync(path.join(tempDir, 'data'));
  fs.copyFileSync(path.join(root, 'data', 'seed.json'), path.join(tempDir, 'data', 'seed.json'));
  const port = await freePort();
  baseUrl = 'http://127.0.0.1:' + port;
  server = spawn(process.execPath, ['server.js'], {
    cwd: tempDir,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
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
      { id: 'JB-OTHER', customer: 'Other Customer', item: 'Other pouch', qty: 50, worker: 'Other Worker', status: 'In production', progress: 0 }
    ],
    purchases: [{ id: 'PO-PRIVATE', supplier: 'Private Supplier', material: 'Private ink' }],
    materials: [{ sku: 'RM-TEST', item: 'Kraft paper', onHand: '100 kg', stock: 100, capacity: 100, unitCost: 10 }],
    deliveries: [],
    receipts: [],
    movements: [],
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
    downtimeLogs: []
  };
  const sync = await fetch(baseUrl + '/api/sync', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
  assert.equal(sync.status, 200);

  const createWorker = await fetch(baseUrl + '/api/users', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Worker',
      email: 'worker@factory.example',
      role: 'worker',
      workerId: 'WRK-TEST',
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

  const adminUsers = await json(await fetch(baseUrl + '/api/users', { headers: { Cookie: adminCookie } }));
  assert.equal(adminUsers.users.length, 2);
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

  const workerBootstrap = await fetch(baseUrl + '/api/bootstrap', { headers: { Cookie: workerCookie } });
  assert.equal(workerBootstrap.status, 200);
  const workerState = await json(workerBootstrap);
  assert.deepEqual(workerState.state.quotes, []);
  assert.deepEqual(workerState.state.purchases, []);
  assert.deepEqual(workerState.state.materials, []);
  assert.deepEqual(workerState.state.jobs.map((job) => job.id), ['JB-WORKER']);
  assert.deepEqual(workerState.state.schedules.map((item) => item.id), ['SC-WORKER']);
  assert.deepEqual(workerState.state.workers.map((item) => item.id), ['WRK-TEST']);

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

  const changePassword = await fetch(baseUrl + '/api/auth/password', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerCsrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'FactoryFlowWorker123', newPassword: 'FactoryFlowWorkerSecure456' })
  });
  assert.equal(changePassword.status, 200);
  const changedPasswordPayload = await json(changePassword);
  assert.equal(changedPasswordPayload.user.mustChangePassword, false);

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
  assert.ok(audit.records.some((record) => record.action === 'auth.password_changed'));
});
