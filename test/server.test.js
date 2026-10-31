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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'factoryflow-test-'));
  fs.copyFileSync(path.join(__dirname, '..', 'server.js'), path.join(tempDir, 'server.js'));
  fs.mkdirSync(path.join(tempDir, 'data'));
  fs.copyFileSync(path.join(__dirname, '..', 'data', 'seed.json'), path.join(tempDir, 'data', 'seed.json'));
  const port = await freePort();
  baseUrl = 'http://127.0.0.1:' + port;
  server = spawn(process.execPath, ['server.js'], {
    cwd: tempDir,
    env: { ...process.env, PORT: String(port) },
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

test('health and bootstrap endpoints return the workspace schema', async () => {
  const health = await fetch(baseUrl + '/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const bootstrap = await fetch(baseUrl + '/api/bootstrap');
  assert.equal(bootstrap.status, 200);
  const payload = await bootstrap.json();
  assert.ok(Array.isArray(payload.state.quotes));
  assert.ok(Array.isArray(payload.state.jobs));
  assert.ok(Array.isArray(payload.state.receipts));
  assert.ok(Array.isArray(payload.state.movements));
  assert.ok(Array.isArray(payload.state.requirements));
  assert.ok(Array.isArray(payload.state.workers));
  assert.ok(Array.isArray(payload.state.schedules));
  assert.ok(Array.isArray(payload.state.productionLogs));
  assert.ok(Array.isArray(payload.state.qcInspections));
  assert.ok(Array.isArray(payload.state.reworkLogs));
});

test('sync persists quotes and material receipt records', async () => {
  const state = {
    quotes: [{ id: 'QT-TEST', customer: 'Example Customer' }],
    jobs: [],
    purchases: [],
    materials: [],
    deliveries: [],
    receipts: [{
      id: 'MR-TEST',
      purchaseId: 'PO-TEST',
      supplier: 'Example Supplier',
      material: 'Kraft paper',
      quantity: 250,
      unit: 'kg',
      reference: 'DC-42',
      receivedAt: '2026-10-29T08:00:00.000Z'
    }],
    movements: [{
      id: 'MV-TEST',
      type: 'Consumption',
      direction: 'OUT',
      materialSku: 'RM-TEST',
      material: 'Kraft paper',
      quantity: 20,
      unit: 'kg',
      stockBefore: '250 kg',
      stockAfter: '230 kg',
      jobId: 'JB-TEST',
      reference: '',
      note: 'Production usage',
      createdAt: '2026-10-29T09:00:00.000Z'
    }],
    requirements: [{
      id: 'RQ-TEST',
      jobId: 'JB-TEST',
      materialSku: 'RM-TEST',
      material: 'Kraft paper',
      quantity: 120,
      unit: 'kg'
    }],
    workers: [{
      id: 'WRK-TEST',
      name: 'Test Worker',
      skill: 'Printing',
      capacityHoursPerDay: 8,
      active: true,
      unavailableDates: []
    }],
    schedules: [{
      id: 'SC-TEST',
      jobId: 'JB-TEST',
      workerId: 'WRK-TEST',
      workerName: 'Test Worker',
      date: '2026-10-31',
      hours: 4,
      note: 'Printing shift'
    }],
    productionLogs: [{
      id: 'PR-TEST',
      jobId: 'JB-TEST',
      workerId: 'WRK-TEST',
      workerName: 'Test Worker',
      productionDate: '2026-10-31',
      shift: 'Day',
      producedQty: 100,
      goodQty: 98,
      rejectedQty: 2
    }],
    qcInspections: [{
      id: 'QC-TEST',
      jobId: 'JB-TEST',
      inspectionType: 'Initial',
      inspectedQty: 100,
      passedQty: 98,
      failedQty: 2,
      disposition: 'Rework',
      inspector: 'Test Inspector'
    }],
    reworkLogs: [{
      id: 'RW-TEST',
      jobId: 'JB-TEST',
      qcInspectionId: 'QC-TEST',
      reworkedQty: 2,
      recoveredQty: 2,
      scrappedQty: 0
    }]
  };
  const sync = await fetch(baseUrl + '/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
  assert.equal(sync.status, 200);
  assert.equal((await sync.json()).ok, true);

  const bootstrap = await fetch(baseUrl + '/api/bootstrap');
  const stored = await bootstrap.json();
  assert.deepEqual(stored.state.quotes, state.quotes);
  assert.deepEqual(stored.state.receipts, state.receipts);
  assert.deepEqual(stored.state.movements, state.movements);
  assert.deepEqual(stored.state.requirements, state.requirements);
  assert.deepEqual(stored.state.workers, state.workers);
  assert.deepEqual(stored.state.schedules, state.schedules);
  assert.deepEqual(stored.state.productionLogs, state.productionLogs);
  assert.deepEqual(stored.state.qcInspections, state.qcInspections);
  assert.deepEqual(stored.state.reworkLogs, state.reworkLogs);
  assert.deepEqual(stored.customers, ['Example Customer']);
});

test('sync rejects malformed JSON', async () => {
  const response = await fetch(baseUrl + '/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"quotes":'
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /valid JSON/i);
});
