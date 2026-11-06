const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const auth = require('./auth.js');
const execution = require('./execution.js');
const analytics = require('./analytics.js');
const facilityModel = require('./facilities.js');
const forecasting = require('./forecasting.js');
const scheduleOptimizer = require('./scheduler-optimizer.js');
const machineModel = require('./machines.js');
const gstDocuments = require('./gst-documents.js');
const whatsapp = require('./whatsapp.js');
const inventory = require('./inventory.js');
const maintenanceWorkOrders = require('./maintenance-work-orders.js');

const root = __dirname;
const dataDirectory = path.join(root, 'data');
const dataPath = path.join(dataDirectory, 'factoryflow.json');
const seedPath = path.join(dataDirectory, 'seed.json');
const port = Number(process.env.PORT || 4173);
const SESSION_COOKIE = 'FF_SESSION';
const MAX_AUDIT_RECORDS = 2000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map();
const sessions = new auth.SessionStore({ ttlMs: 8 * 60 * 60 * 1000 });

const staticTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function list(value) {
  return Array.isArray(value) ? value : [];
}

function ensureDataStore() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  if (!fs.existsSync(dataPath)) fs.copyFileSync(seedPath, dataPath);
}

function readStore() {
  ensureDataStore();
  const stored = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const normalized = facilityModel.ensureFacilityState({
    workspace: stored.workspace || { name: 'Northstar Works', cluster: 'Packaging', locale: 'en-IN' },
    facilities: list(stored.facilities),
    quotes: list(stored.quotes),
    jobs: list(stored.jobs),
    purchases: list(stored.purchases),
    materials: list(stored.materials),
    deliveries: list(stored.deliveries),
    receipts: list(stored.receipts),
    movements: list(stored.movements),
    requirements: list(stored.requirements),
    workers: list(stored.workers),
    schedules: list(stored.schedules),
    productionLogs: list(stored.productionLogs),
    qcInspections: list(stored.qcInspections),
    reworkLogs: list(stored.reworkLogs),
    downtimeLogs: list(stored.downtimeLogs),
    machines: list(stored.machines),
    maintenanceRecords: list(stored.maintenanceRecords),
    maintenanceWorkOrders: list(stored.maintenanceWorkOrders),
    maintenanceTechnicians: list(stored.maintenanceTechnicians),
    gstProfiles: list(stored.gstProfiles),
    gstDocuments: list(stored.gstDocuments),
    whatsappContacts: list(stored.whatsappContacts),
    whatsappMessages: list(stored.whatsappMessages),
    users: list(stored.users),
    auditLogs: list(stored.auditLogs)
  });
  if (normalized.changed) writeStore(normalized.store);
  return normalized.store;
}

function writeStore(payload) {
  const tempPath = dataPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tempPath, dataPath);
  try { fs.chmodSync(dataPath, 0o600); } catch {}
}

function appendAudit(store, actor, action, targetType, targetId, details = {}, request) {
  const record = {
    id: 'AUD-' + cryptoId(),
    actorId: actor ? actor.id : '',
    actorName: actor ? actor.name : 'System',
    actorRole: actor ? actor.role : 'system',
    facilityId: request && request.factoryFlowFacilityId ? request.factoryFlowFacilityId : '',
    action,
    targetType,
    targetId: targetId || '',
    details,
    ip: request && request.socket ? request.socket.remoteAddress || '' : '',
    createdAt: new Date().toISOString()
  };
  store.auditLogs.push(record);
  if (store.auditLogs.length > MAX_AUDIT_RECORDS) store.auditLogs.splice(0, store.auditLogs.length - MAX_AUDIT_RECORDS);
  return record;
}

function cryptoId() {
  return require('node:crypto').randomUUID();
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Request body must be valid JSON.')); }
    });
    request.on('error', reject);
  });
}


function readRawBody(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function secureCookie(request) {
  return process.env.NODE_ENV === 'production' ||
    (request.socket && request.socket.encrypted === true);
}

function assertSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  let parsed;
  try { parsed = new URL(origin); }
  catch { throw new Error('Invalid request origin.'); }
  if (parsed.host !== request.headers.host) {
    throw new Error('Cross-origin requests are not allowed.');
  }
}

function currentSession(request, store) {
  const token = auth.parseCookies(request.headers.cookie)[SESSION_COOKIE];
  const session = sessions.get(token);
  if (!session) return null;
  const user = store.users.find((item) => item.id === session.userId && item.active !== false);
  const workerProfileActive = !user || user.role !== 'worker' ||
    store.workers.some((worker) => worker.id === user.workerId && worker.active !== false);
  if (!user || !workerProfileActive) {
    sessions.revoke(token);
    return null;
  }
  return { token, session, user };
}

function requireUser(request, store) {
  const current = currentSession(request, store);
  if (!current) {
    const error = new Error('Sign in to continue.');
    error.statusCode = 401;
    throw error;
  }
  return current;
}

function requirePermission(current, permission) {
  if (!auth.hasPermission(current.user, permission)) {
    const error = new Error('Your account does not have permission to perform this action.');
    error.statusCode = 403;
    throw error;
  }
}

function requireCsrf(request, current) {
  assertSameOrigin(request);
  const supplied = String(request.headers['x-csrf-token'] || '');
  const expected = String(current.session.csrfToken || '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !require('node:crypto').timingSafeEqual(a, b)) {
    const error = new Error('Your security token is missing or expired. Refresh the page and try again.');
    error.statusCode = 403;
    throw error;
  }
}

function setSession(response, request, user) {
  const session = sessions.create(user.id);
  response.setHeader('Set-Cookie', auth.buildCookie(session.token, Math.floor(sessions.ttlMs / 1000), secureCookie(request)));
  return { user: auth.sanitizeUser(user), permissions: auth.permissionsFor(user), csrfToken: session.csrfToken };
}

function clearSession(response, request) {
  response.setHeader('Set-Cookie', auth.clearCookie(secureCookie(request)));
}

function publicAuthStatus(request, response) {
  const store = readStore();
  const current = currentSession(request, store);
  if (!current) {
    return sendJson(response, 200, { setupRequired: store.users.length === 0, authenticated: false });
  }
  return sendJson(response, 200, {
    setupRequired: false,
    authenticated: true,
    user: auth.sanitizeUser(current.user),
    permissions: auth.permissionsFor(current.user),
    csrfToken: current.session.csrfToken
  });
}

function loginKey(request, email) {
  return (request.socket.remoteAddress || 'unknown') + '|' + email;
}

function checkLoginThrottle(key) {
  const state = loginAttempts.get(key);
  if (!state) return;
  if (state.blockedUntil > Date.now()) {
    const error = new Error('Too many sign-in attempts. Try again in 15 minutes.');
    error.statusCode = 429;
    throw error;
  }
  if (state.startedAt + LOGIN_WINDOW_MS <= Date.now()) loginAttempts.delete(key);
}

function failLogin(key) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  const state = !current || current.startedAt + LOGIN_WINDOW_MS <= now
    ? { count: 0, startedAt: now, blockedUntil: 0 }
    : current;
  state.count += 1;
  if (state.count >= LOGIN_MAX_ATTEMPTS) state.blockedUntil = now + LOGIN_WINDOW_MS;
  loginAttempts.set(key, state);
}

function successLogin(key) {
  loginAttempts.delete(key);
}

function customerDirectory(store) {
  const names = new Set([
    ...list(store.quotes).map((quote) => quote.customer),
    ...list(store.jobs).map((job) => job.customer)
  ].filter(Boolean));
  return [...names].sort((a, b) => a.localeCompare(b));
}

function projectStoreForUser(store, user) {
  if (user.role === 'admin' || user.role === 'manager') {
    return { ...store, users: [], auditLogs: [] };
  }
  if (user.role === 'supervisor') {
    return {
      ...store,
      quotes: [],
      purchases: [],
      deliveries: [],
      gstProfiles: [],
      gstDocuments: [],
      whatsappContacts: [],
      whatsappMessages: [],
      users: [],
      auditLogs: []
    };
  }
  const worker = store.workers.find((item) => item.id === user.workerId);
  const workerName = worker ? worker.name : '';
  const schedules = store.schedules.filter((item) => item.workerId === user.workerId);
  const jobIds = new Set([
    ...schedules.map((item) => item.jobId),
    ...store.productionLogs.filter((item) => item.workerId === user.workerId).map((item) => item.jobId)
  ]);
  return {
    ...store,
    quotes: [],
    purchases: [],
    materials: [],
    deliveries: [],
    receipts: [],
    movements: [],
    requirements: store.requirements.filter((item) => jobIds.has(item.jobId)),
    workers: worker ? [worker] : [],
    schedules,
    jobs: store.jobs.filter((item) => jobIds.has(item.id)),
    productionLogs: store.productionLogs.filter((item) => item.workerId === user.workerId),
    qcInspections: [],
    reworkLogs: [],
    downtimeLogs: [],
    machines: list(store.machines).filter((machine) => schedules.some((session) => session.machineId === machine.id)),
    maintenanceRecords: [],
    maintenanceWorkOrders: [],
    maintenanceTechnicians: [],
    gstProfiles: [],
    gstDocuments: [],
    whatsappContacts: [],
    whatsappMessages: [],
    users: [],
    auditLogs: []
  };
}

function publicAuthError(error, response) {
  return sendJson(response, error.statusCode || 400, { error: error.message });
}

async function handleApi(request, response, pathname) {

  // Meta webhook handshake and signed status callbacks are public routes.
  if (pathname === '/api/whatsapp/webhook' && request.method === 'GET') {
    const config = whatsapp.getConfiguration(process.env);
    const url = new URL(request.url, 'http://localhost');
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (!config.verifyToken || mode !== 'subscribe' || token !== config.verifyToken || !challenge) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return response.end('Webhook verification failed.');
    }
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end(challenge);
  }

  if (pathname === '/api/whatsapp/webhook' && request.method === 'POST') {
    try {
      const config = whatsapp.getConfiguration(process.env);
      if (!config.appSecret) return sendJson(response, 503, { error: 'WhatsApp webhook is not configured.' });
      const rawBody = await readRawBody(request);
      if (!whatsapp.verifyWebhookSignature(rawBody, request.headers['x-hub-signature-256'], config.appSecret)) {
        return sendJson(response, 401, { error: 'WhatsApp webhook signature is invalid.' });
      }
      const payload = JSON.parse(rawBody.toString('utf8'));
      const store = readStore();
      const updates = whatsapp.extractStatusUpdates(payload);
      const now = new Date().toISOString();
      updates.forEach((update) => {
        const message = store.whatsappMessages.find((item) => item.providerMessageId === update.providerMessageId);
        if (!message) return;
        if (message.status === 'read' || message.status === 'failed') return;
        const allowed = ['accepted', 'sent', 'delivered', 'read', 'failed'];
        if (!allowed.includes(update.status)) return;
        message.status = update.status;
        message.statusUpdatedAt = update.timestamp ? new Date(Number(update.timestamp) * 1000).toISOString() : now;
        message.lastWebhookAt = now;
        message.errors = update.errors;
      });
      // Keep a small redacted event receipt for troubleshooting; message content and secrets are never stored here.
      if (!Array.isArray(store.whatsappWebhookReceipts)) store.whatsappWebhookReceipts = [];
      store.whatsappWebhookReceipts.unshift({
        id: 'WAWH-' + cryptoId(),
        receivedAt: now,
        statusUpdateCount: updates.length,
        object: String(payload.object || '')
      });
      store.whatsappWebhookReceipts = store.whatsappWebhookReceipts.slice(0, 200);
      writeStore(store);
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return response.end('EVENT_RECEIVED');
    } catch (error) {
      return sendJson(response, 400, { error: error.message || 'Invalid webhook payload.' });
    }
  }


  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === 'GET' && pathname === '/api/auth/status') {
    return publicAuthStatus(request, response);
  }

  if (request.method === 'POST' && pathname === '/api/auth/setup') {
    try {
      assertSameOrigin(request);
      const body = await readJson(request);
      const store = readStore();
      if (store.users.length) return sendJson(response, 409, { error: 'Initial setup is already complete. Ask an administrator to create your account.' });
      const user = auth.createUser({ ...body, role: 'admin' }, store.users);
      appendAudit(store, user, 'auth.initial_setup', 'user', user.id, { role: 'admin' }, request);
      writeStore(store);
      const session = setSession(response, request, user);
      return sendJson(response, 201, { ok: true, ...session });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (request.method === 'POST' && pathname === '/api/auth/login') {
    try {
      assertSameOrigin(request);
      const body = await readJson(request);
      const email = auth.normalizeEmail(body.email);
      const key = loginKey(request, email);
      checkLoginThrottle(key);
      const store = readStore();
      const user = store.users.find((item) => auth.normalizeEmail(item.email) === email);
      const linkedWorker = user && user.role === 'worker' ? store.workers.find((item) => item.id === user.workerId && item.active !== false) : true;
      if (!user || user.active === false || !linkedWorker || !auth.verifyPassword(body.password, user.passwordHash)) {
        failLogin(key);
        return sendJson(response, 401, { error: 'Email or password is incorrect.' });
      }
      successLogin(key);
      user.lastLoginAt = new Date().toISOString();
      appendAudit(store, user, 'auth.login', 'user', user.id, {}, request);
      writeStore(store);
      const session = setSession(response, request, user);
      return sendJson(response, 200, { ok: true, ...session });
    } catch (error) { return publicAuthError(error, response); }
  }

  const store = readStore();
  let current;
  try { current = requireUser(request, store); }
  catch (error) { return publicAuthError(error, response); }
  if (current.user.mustChangePassword && !['/api/auth/password', '/api/auth/logout'].includes(pathname)) {
    return sendJson(response, 403, { error: 'Change your temporary password before accessing the workspace.' });
  }
  const activeFacility = facilityModel.resolveFacility(
    current.user,
    store.facilities,
    store,
    request.headers['x-facility-id'] || ''
  );
  if (!activeFacility) {
    return sendJson(response, 403, { error: 'Your account is not assigned to an active factory facility.' });
  }
  current.facility = activeFacility;
  current.allowedFacilityIds = facilityModel.allowedFacilityIds(current.user, store.facilities, store);
  request.factoryFlowFacilityId = activeFacility.id;

  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    try {
      requireCsrf(request, current);
      sessions.revoke(current.token);
      appendAudit(store, current.user, 'auth.logout', 'user', current.user.id, {}, request);
      writeStore(store);
      clearSession(response, request);
      return sendJson(response, 200, { ok: true });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (request.method === 'POST' && pathname === '/api/auth/password') {
    try {
      requireCsrf(request, current);
      const body = await readJson(request);
      if (!auth.verifyPassword(body.currentPassword, current.user.passwordHash)) {
        return sendJson(response, 400, { error: 'Current password is incorrect.' });
      }
      current.user.passwordHash = auth.hashPassword(body.newPassword);
      current.user.mustChangePassword = false;
      current.user.updatedAt = new Date().toISOString();
      sessions.revokeUser(current.user.id, current.token);
      appendAudit(store, current.user, 'auth.password_changed', 'user', current.user.id, {}, request);
      writeStore(store);
      return sendJson(response, 200, { ok: true, user: auth.sanitizeUser(current.user) });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/bootstrap' && request.method === 'GET') {
    const roleProjected = projectStoreForUser(store, current.user);
    const projected = facilityModel.projectStoreForFacility(roleProjected, current.facility.id);
    const visibleFacilities = store.facilities.filter((facility) => current.allowedFacilityIds.includes(facility.id) && facility.active !== false);
    projected.facilities = visibleFacilities;
    projected.whatsappContacts = store.whatsappContacts.filter((item) => item.facilityId === current.facility.id);
    projected.whatsappMessages = store.whatsappMessages.filter((item) => item.facilityId === current.facility.id);
    return sendJson(response, 200, {
      workspace: { ...store.workspace, activeFacilityId: current.facility.id },
      state: projected,
      facilities: visibleFacilities,
      activeFacilityId: current.facility.id,
      customers: customerDirectory(projected),
      integrations: { whatsapp: whatsapp.getConfiguration(process.env).publicStatus },
      auth: {
        user: auth.sanitizeUser(current.user),
        permissions: auth.permissionsFor(current.user),
        csrfToken: current.session.csrfToken
      }
    });
  }

  if (pathname === '/api/facilities' && request.method === 'GET') {
    try {
      requirePermission(current, 'facilities.view');
      const visible = store.facilities.filter((facility) => current.allowedFacilityIds.includes(facility.id) && facility.active !== false);
      return sendJson(response, 200, { facilities: visible });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/facilities/summary' && request.method === 'GET') {
    try {
      requirePermission(current, 'facilities.view');
      const visible = store.facilities.filter((facility) => current.allowedFacilityIds.includes(facility.id) && facility.active !== false);
      return sendJson(response, 200, {
        summaries: visible.map((facility) => facilityModel.summarizeFacility(store, facility)),
        facilityCount: visible.length
      });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/facilities' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'facilities.manage');
      const body = await readJson(request);
      const facility = facilityModel.createFacility(body, store.facilities);
      appendAudit(store, current.user, 'facility.created', 'facility', facility.id, { code: facility.code, name: facility.name }, request);
      writeStore(store);
      return sendJson(response, 201, { facility });
    } catch (error) { return publicAuthError(error, response); }
  }

  const facilityMatch = /^\/api\/facilities\/([^/]+)$/.exec(pathname);
  if (facilityMatch && request.method === 'PATCH') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'facilities.manage');
      const body = await readJson(request);
      const facility = facilityModel.updateFacility(facilityMatch[1], body, store.facilities, store.workspace);
      if (body.isDefault === true) facilityModel.setDefaultFacility(facility.id, store.facilities, store.workspace);
      appendAudit(store, current.user, 'facility.updated', 'facility', facility.id, { active: facility.active, isDefault: facility.isDefault }, request);
      writeStore(store);
      return sendJson(response, 200, { facility });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/users' && request.method === 'GET') {
    try {
      requirePermission(current, 'users.manage');
      return sendJson(response, 200, { users: store.users.map(auth.sanitizeUser) });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/users' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'users.manage');
      const body = await readJson(request);
      if (body.role === 'worker' && !store.workers.some((worker) => worker.id === body.workerId && worker.active !== false)) {
        return sendJson(response, 400, { error: 'Choose an active worker profile for this account.' });
      }
      const activeIds = store.facilities.filter((facility) => facility.active !== false).map((facility) => facility.id);
      const roleFacilityIds = body.role === 'admin'
        ? []
        : [...new Set(list(body.facilityIds).map((id) => String(id).trim()).filter((id) => activeIds.includes(id)))];
      if (body.role !== 'admin' && !roleFacilityIds.length) {
        return sendJson(response, 400, { error: 'Assign at least one active facility to this account.' });
      }
      if (body.role === 'worker') {
        const worker = store.workers.find((item) => item.id === body.workerId && item.active !== false);
        if (!worker || !roleFacilityIds.includes(worker.facilityId)) {
          return sendJson(response, 400, { error: 'A worker account must be assigned to the facility of its linked worker profile.' });
        }
        if (roleFacilityIds.length !== 1) return sendJson(response, 400, { error: 'Worker accounts can belong to only one facility.' });
      }
      const user = auth.createUser({ ...body, facilityIds: roleFacilityIds }, store.users, { mustChangePassword: true });
      appendAudit(store, current.user, 'users.created', 'user', user.id, { role: user.role }, request);
      writeStore(store);
      return sendJson(response, 201, { user: auth.sanitizeUser(user) });
    } catch (error) { return publicAuthError(error, response); }
  }

  const userMatch = /^\/api\/users\/([^/]+)$/.exec(pathname);
  if (userMatch && request.method === 'PATCH') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'users.manage');
      const body = await readJson(request);
      const target = store.users.find((item) => item.id === userMatch[1]);
      if (!target) return sendJson(response, 404, { error: 'User not found.' });
      if (target.id === current.user.id && body.active === false) {
        return sendJson(response, 400, { error: 'You cannot deactivate your own account.' });
      }
      const nextRole = body.role !== undefined ? auth.validateRole(body.role) : target.role;
      const nextActive = body.active !== undefined ? body.active : target.active !== false;
      if (typeof nextActive !== 'boolean') return sendJson(response, 400, { error: 'Account status must be active or inactive.' });
      const activeAdminsAfter = store.users.filter((item) => item.id === target.id
        ? nextRole === 'admin' && nextActive
        : item.role === 'admin' && item.active !== false);
      if (!activeAdminsAfter.length) return sendJson(response, 400, { error: 'At least one active administrator must remain.' });
      const nextWorkerId = body.workerId !== undefined ? String(body.workerId || '').trim() : target.workerId || '';
      const activeFacilityIds = store.facilities.filter((facility) => facility.active !== false).map((facility) => facility.id);
      const nextFacilityIds = nextRole === 'admin'
        ? []
        : body.facilityIds !== undefined
          ? [...new Set(list(body.facilityIds).map((id) => String(id).trim()).filter((id) => activeFacilityIds.includes(id)))]
          : list(target.facilityIds);
      if (nextRole !== 'admin' && !nextFacilityIds.length) return sendJson(response, 400, { error: 'Assign at least one active facility to this account.' });
      if (nextRole === 'worker') {
        const worker = store.workers.find((item) => item.id === nextWorkerId && item.active !== false);
        if (!worker || nextFacilityIds.length !== 1 || nextFacilityIds[0] !== worker.facilityId) {
          return sendJson(response, 400, { error: 'A worker account must be assigned only to the facility of its linked worker profile.' });
        }
      }
      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name || name.length > 100) return sendJson(response, 400, { error: 'Enter a valid user name.' });
      }
      const roleChanged = target.role !== nextRole;
      const facilityAssignmentChanged = JSON.stringify(list(target.facilityIds)) !== JSON.stringify(nextFacilityIds);
      if (body.name !== undefined) target.name = String(body.name).trim();
      target.role = nextRole;
      target.workerId = nextWorkerId;
      target.facilityIds = nextFacilityIds;
      target.active = nextActive;
      target.updatedAt = new Date().toISOString();
      if (target.active === false || roleChanged || facilityAssignmentChanged) sessions.revokeUser(target.id);
      appendAudit(store, current.user, 'users.updated', 'user', target.id, { role: target.role, active: target.active }, request);
      writeStore(store);
      return sendJson(response, 200, { user: auth.sanitizeUser(target) });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/audit' && request.method === 'GET') {
    try {
      requirePermission(current, 'audit.view');
      return sendJson(response, 200, { records: store.auditLogs.slice(-500).reverse() });
    } catch (error) { return publicAuthError(error, response); }
  }


  if (pathname === '/api/machines' && request.method === 'GET') {
    try {
      requirePermission(current, 'machines.view');
      const scoped = facilityModel.projectStoreForFacility(store, current.facility.id);
      return sendJson(response, 200, { facilityId: current.facility.id, machines: scoped.machines });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/machines' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'machines.manage');
      const body = await readJson(request);
      const scopedMachines = store.machines.filter((machine) => machine.facilityId === current.facility.id);
      const machine = machineModel.createMachine(scopedMachines, body);
      machine.facilityId = current.facility.id;
      store.machines.push(machine);
      appendAudit(store, current.user, 'machine.created', 'machine', machine.id, {
        code: machine.code, name: machine.name, capacityHoursPerDay: machine.capacityHoursPerDay
      }, request);
      writeStore(store);
      return sendJson(response, 201, { machine });
    } catch (error) { return publicAuthError(error, response); }
  }

  const machineMatch = /^\/api\/machines\/([^/]+)$/;
  const matchedMachine = machineMatch.exec(pathname);
  if (matchedMachine && request.method === 'PATCH') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'machines.manage');
      const body = await readJson(request);
      const scopedMachines = store.machines.filter((machine) => machine.facilityId === current.facility.id);
      const machine = machineModel.updateMachine(scopedMachines, matchedMachine[1], body);
      appendAudit(store, current.user, 'machine.updated', 'machine', machine.id, {
        code: machine.code, active: machine.active, capacityHoursPerDay: machine.capacityHoursPerDay
      }, request);
      writeStore(store);
      return sendJson(response, 200, { machine });
    } catch (error) { return publicAuthError(error, response); }
  }

  const maintenanceMatch = /^\/api\/machines\/([^/]+)\/maintenance$/;
  const matchedMaintenance = maintenanceMatch.exec(pathname);
  if (matchedMaintenance && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'machines.manage');
      const body = await readJson(request);
      const scopedMachines = store.machines.filter((machine) => machine.facilityId === current.facility.id);
      const window = machineModel.addMaintenanceWindow(scopedMachines, matchedMaintenance[1], body);
      const machine = scopedMachines.find((item) => item.id === matchedMaintenance[1]);
      appendAudit(store, current.user, 'machine.maintenance_added', 'machine', machine.id, {
        maintenanceId: window.id, startDate: window.startDate, endDate: window.endDate, reason: window.reason
      }, request);
      writeStore(store);
      return sendJson(response, 201, { machine, maintenanceWindow: window });
    } catch (error) { return publicAuthError(error, response); }
  }

  const maintenanceRemoveMatch = /^\/api\/machines\/([^/]+)\/maintenance\/([^/]+)$/;
  const matchedMaintenanceRemove = maintenanceRemoveMatch.exec(pathname);
  if (matchedMaintenanceRemove && request.method === 'DELETE') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'machines.manage');
      const scopedMachines = store.machines.filter((machine) => machine.facilityId === current.facility.id);
      const machine = machineModel.removeMaintenanceWindow(scopedMachines, matchedMaintenanceRemove[1], matchedMaintenanceRemove[2]);
      appendAudit(store, current.user, 'machine.maintenance_removed', 'machine', machine.id, {
        maintenanceId: matchedMaintenanceRemove[2]
      }, request);
      writeStore(store);
      return sendJson(response, 200, { machine });
    } catch (error) { return publicAuthError(error, response); }
  }

  const serviceMatch = /^\/api\/machines\/([^/]+)\/service$/;
  const matchedService = serviceMatch.exec(pathname);
  if (matchedService && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'machines.manage');
      const body = await readJson(request);
      const scopedMachines = store.machines.filter((machine) => machine.facilityId === current.facility.id);
      if (!scopedMachines.some((machine) => machine.id === matchedService[1])) {
        return sendJson(response, 404, { error: 'Machine not found in the selected facility.' });
      }
      const record = machineModel.recordService(store.maintenanceRecords, scopedMachines, matchedService[1], body, {
        id: current.user.id,
        name: current.user.name
      });
      record.facilityId = current.facility.id;
      appendAudit(store, current.user, 'machine.service_recorded', 'machine', record.machineId, {
        serviceRecordId: record.id,
        serviceDate: record.serviceDate,
        serviceType: record.serviceType,
        performedBy: record.performedBy
      }, request);
      writeStore(store);
      const scoped = facilityModel.projectStoreForFacility(store, current.facility.id);
      return sendJson(response, 201, { record, maintenanceRecords: scoped.maintenanceRecords });
    } catch (error) { return publicAuthError(error, response); }
  }



  if (pathname === '/api/maintenance/work-orders' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'maintenance.manage');
      const body = await readJson(request);
      const scopedMachines = store.machines.filter((machine) => machine.facilityId === current.facility.id);
      const order = maintenanceWorkOrders.createWorkOrder(store.maintenanceWorkOrders, scopedMachines, body, {
        id: current.user.id,
        name: current.user.name
      });
      order.facilityId = current.facility.id;
      appendAudit(store, current.user, 'maintenance.work_order_created', 'maintenance_work_order', order.id, {
        machineId: order.machineId, type: order.type, priority: order.priority
      }, request);
      writeStore(store);
      return sendJson(response, 201, { workOrder: order });
    } catch (error) { return publicAuthError(error, response); }
  }

  const workOrderMatch = /^\/api\/maintenance\/work-orders\/([^/]+)$/;
  const matchedWorkOrder = workOrderMatch.exec(pathname);
  if (matchedWorkOrder && request.method === 'PATCH') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'maintenance.manage');
      const body = await readJson(request);
      const scopedOrders = store.maintenanceWorkOrders.filter((order) => order.facilityId === current.facility.id);
      const order = scopedOrders.find((item) => item.id === matchedWorkOrder[1]);
      if (!order) return sendJson(response, 404, { error: 'Maintenance work order not found in the selected facility.' });
      const previousStatus = order.status;
      const updated = maintenanceWorkOrders.updateWorkOrder(scopedOrders, order.id, body, {
        id: current.user.id,
        name: current.user.name
      });
      let serviceRecord = null;
      if (previousStatus !== 'Completed' && updated.status === 'Completed') {
        const scopedMachines = store.machines.filter((machine) => machine.facilityId === current.facility.id);
        serviceRecord = machineModel.recordService(store.maintenanceRecords, scopedMachines, updated.machineId, {
          serviceDate: new Date().toISOString().slice(0, 10),
          serviceType: updated.type,
          performedBy: updated.assignedTo || current.user.name,
          notes: updated.resolutionNotes
        }, { id: current.user.id, name: current.user.name });
        serviceRecord.facilityId = current.facility.id;
        updated.serviceRecordId = serviceRecord.id;
        appendAudit(store, current.user, 'machine.service_recorded', 'machine', updated.machineId, {
          serviceRecordId: serviceRecord.id,
          workOrderId: updated.id,
          serviceDate: serviceRecord.serviceDate,
          serviceType: serviceRecord.serviceType,
          performedBy: serviceRecord.performedBy
        }, request);
      }
      appendAudit(store, current.user, 'maintenance.work_order_updated', 'maintenance_work_order', updated.id, {
        previousStatus, status: updated.status, priority: updated.priority, assignedTo: updated.assignedTo
      }, request);
      writeStore(store);
      return sendJson(response, 200, { workOrder: updated, serviceRecord });
    } catch (error) { return publicAuthError(error, response); }
  }

  const workOrderPartsMatch = /^\/api\/maintenance\/work-orders\/([^/]+)\/parts$/;
  const matchedWorkOrderParts = workOrderPartsMatch.exec(pathname);
  if (matchedWorkOrderParts && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'maintenance.manage');
      const body = await readJson(request);
      const scopedOrders = store.maintenanceWorkOrders.filter((order) => order.facilityId === current.facility.id);
      const order = scopedOrders.find((item) => item.id === matchedWorkOrderParts[1]);
      if (!order) return sendJson(response, 404, { error: 'Maintenance work order not found in the selected facility.' });
      if (['Completed', 'Cancelled'].includes(order.status)) {
        return sendJson(response, 400, { error: 'Parts cannot be issued to a completed or cancelled work order.' });
      }
      const material = store.materials.find((item) =>
        item.sku === String(body.materialSku || '') && item.facilityId === current.facility.id
      );
      if (!material || material.maintenancePart !== true) {
        return sendJson(response, 400, { error: 'Select a spare part marked for maintenance use in this facility.' });
      }
      const quantity = Number(body.quantity);
      const unit = String(body.unit || '').trim();
      if (unit.length > 24) return sendJson(response, 400, { error: 'Spare-part unit must be 24 characters or fewer.' });
      const stockUpdate = inventory.consumeFromStock([material], material.sku, quantity, unit);
      const part = maintenanceWorkOrders.recordPartUsage(store.maintenanceWorkOrders, order.id, material, quantity, unit, {
        id: current.user.id,
        name: current.user.name
      });
      const movement = {
        id: 'MV-MWO-' + cryptoId(),
        facilityId: current.facility.id,
        type: 'Maintenance issue',
        direction: 'OUT',
        materialSku: material.sku,
        material: material.item,
        quantity,
        unit,
        unitCost: part.unitCost,
        costAmount: part.costAmount,
        stockBefore: stockUpdate.previousOnHand,
        stockAfter: stockUpdate.onHand,
        jobId: '',
        workOrderId: order.id,
        reference: order.id,
        note: 'Spare part issued to ' + order.id,
        createdAt: new Date().toISOString()
      };
      store.movements.unshift(movement);
      appendAudit(store, current.user, 'maintenance.spare_part_issued', 'maintenance_work_order', order.id, {
        partId: part.id, materialSku: material.sku, quantity, unit, costAmount: part.costAmount
      }, request);
      writeStore(store);
      return sendJson(response, 201, { workOrder: order, part, material, movement });
    } catch (error) { return publicAuthError(error, response); }
  }

  const sparePartMatch = /^\/api\/materials\/([^/]+)\/spare-part$/;
  const matchedSparePart = sparePartMatch.exec(pathname);
  if (matchedSparePart && request.method === 'PATCH') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'materials.manage');
      const body = await readJson(request);
      if (typeof body.maintenancePart !== 'boolean') {
        return sendJson(response, 400, { error: 'maintenancePart must be true or false.' });
      }
      const material = store.materials.find((item) =>
        item.sku === matchedSparePart[1] && item.facilityId === current.facility.id
      );
      if (!material) return sendJson(response, 404, { error: 'Material not found in the selected facility.' });
      material.maintenancePart = body.maintenancePart;
      appendAudit(store, current.user, 'inventory.maintenance_spare_flag_updated', 'material', material.sku, {
        maintenancePart: material.maintenancePart
      }, request);
      writeStore(store);
      return sendJson(response, 200, { material });
    } catch (error) { return publicAuthError(error, response); }
  }


  if (pathname === '/api/maintenance/technicians' && request.method === 'GET') {
    try {
      requirePermission(current, 'maintenance.view');
      const scoped = facilityModel.projectStoreForFacility(store, current.facility.id);
      return sendJson(response, 200, { facilityId: current.facility.id, technicians: scoped.maintenanceTechnicians });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/maintenance/technicians' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'maintenance.manage');
      const body = await readJson(request);
      const scoped = store.maintenanceTechnicians.filter((item) => item.facilityId === current.facility.id);
      const technician = maintenanceWorkOrders.createTechnician(scoped, body, {
        id: current.user.id,
        name: current.user.name
      });
      technician.facilityId = current.facility.id;
      store.maintenanceTechnicians.push(technician);
      appendAudit(store, current.user, 'maintenance.technician_created', 'maintenance_technician', technician.id, {
        name: technician.name, capacityHoursPerDay: technician.capacityHoursPerDay
      }, request);
      writeStore(store);
      return sendJson(response, 201, { technician });
    } catch (error) { return publicAuthError(error, response); }
  }

  const technicianMatch = /^\/api\/maintenance\/technicians\/([^/]+)$/;
  const matchedTechnician = technicianMatch.exec(pathname);
  if (matchedTechnician && request.method === 'PATCH') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'maintenance.manage');
      const body = await readJson(request);
      const scoped = store.maintenanceTechnicians.filter((item) => item.facilityId === current.facility.id);
      const technician = maintenanceWorkOrders.updateTechnician(scoped, matchedTechnician[1], body);
      appendAudit(store, current.user, 'maintenance.technician_updated', 'maintenance_technician', technician.id, {
        name: technician.name, active: technician.active, capacityHoursPerDay: technician.capacityHoursPerDay
      }, request);
      writeStore(store);
      return sendJson(response, 200, { technician });
    } catch (error) { return publicAuthError(error, response); }
  }

  const scheduleWorkOrderMatch = /^\/api\/maintenance\/work-orders\/([^/]+)\/schedule$/;
  const matchedScheduleWorkOrder = scheduleWorkOrderMatch.exec(pathname);
  if (matchedScheduleWorkOrder && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'maintenance.manage');
      const body = await readJson(request);
      const scopedOrders = store.maintenanceWorkOrders.filter((item) => item.facilityId === current.facility.id);
      const scopedTechnicians = store.maintenanceTechnicians.filter((item) => item.facilityId === current.facility.id);
      const order = maintenanceWorkOrders.scheduleWorkOrder(scopedOrders, scopedTechnicians, matchedScheduleWorkOrder[1], body, {
        id: current.user.id,
        name: current.user.name
      });
      appendAudit(store, current.user, 'maintenance.work_order_scheduled', 'maintenance_work_order', order.id, {
        technicianId: order.technicianId, scheduledDate: order.scheduledDate,
        startTime: order.startTime, endTime: order.endTime, scheduledHours: order.scheduledHours
      }, request);
      writeStore(store);
      return sendJson(response, 200, { workOrder: order });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/maintenance/calendar' && request.method === 'GET') {
    try {
      requirePermission(current, 'maintenance.view');
      const scoped = facilityModel.projectStoreForFacility(store, current.facility.id);
      const url = new URL(request.url, 'http://localhost');
      const fromDate = url.searchParams.get('fromDate') || new Date().toISOString().slice(0, 10);
      const days = Number(url.searchParams.get('days') || 7);
      const calendar = maintenanceWorkOrders.buildTechnicianCalendar(
        scoped.maintenanceWorkOrders, scoped.maintenanceTechnicians, fromDate, days
      );
      return sendJson(response, 200, { facilityId: current.facility.id, calendar });
    } catch (error) { return publicAuthError(error, response); }
  }



  if (pathname === '/api/whatsapp/config' && request.method === 'GET') {
    try {
      requirePermission(current, 'whatsapp.view');
      return sendJson(response, 200, { configuration: whatsapp.getConfiguration(process.env).publicStatus });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/whatsapp/contacts' && request.method === 'GET') {
    try {
      requirePermission(current, 'whatsapp.view');
      const contacts = store.whatsappContacts.filter((item) => item.facilityId === current.facility.id)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return sendJson(response, 200, { contacts });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/whatsapp/contacts' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'whatsapp.manage');
      const body = await readJson(request);
      const contact = whatsapp.createContact(store.whatsappContacts, body, {
        facilityId: current.facility.id,
        userId: current.user.id
      });
      appendAudit(store, current.user, 'whatsapp.contact_created', 'whatsapp_contact', contact.id, {
        phone: contact.phone, optedIn: contact.optedIn
      }, request);
      writeStore(store);
      return sendJson(response, 201, { contact });
    } catch (error) { return publicAuthError(error, response); }
  }

  const whatsAppContactMatch = /^\/api\/whatsapp\/contacts\/([^/]+)$/;
  const matchedWhatsAppContact = whatsAppContactMatch.exec(pathname);
  if (matchedWhatsAppContact && request.method === 'PATCH') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'whatsapp.manage');
      const body = await readJson(request);
      const contact = whatsapp.updateContact(store.whatsappContacts, matchedWhatsAppContact[1], body, {
        facilityId: current.facility.id,
        userId: current.user.id
      });
      appendAudit(store, current.user, 'whatsapp.contact_updated', 'whatsapp_contact', contact.id, {
        phone: contact.phone, optedIn: contact.optedIn, consentAt: contact.consentAt, optedOutAt: contact.optedOutAt
      }, request);
      writeStore(store);
      return sendJson(response, 200, { contact });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/whatsapp/messages' && request.method === 'GET') {
    try {
      requirePermission(current, 'whatsapp.view');
      const messages = store.whatsappMessages.filter((item) => item.facilityId === current.facility.id)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200);
      return sendJson(response, 200, { messages });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/whatsapp/messages' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'whatsapp.manage');
      const body = await readJson(request);
      const contact = store.whatsappContacts.find((item) =>
        item.id === String(body.contactId || '') && item.facilityId === current.facility.id
      );
      if (!contact) return sendJson(response, 404, { error: 'WhatsApp contact not found in this facility.' });
      if (contact.optedIn !== true || !contact.consentAt) {
        return sendJson(response, 403, { error: 'A recorded customer WhatsApp opt-in is required before sending.' });
      }
      const config = whatsapp.getConfiguration(process.env);
      if (!config.apiConfigured) return sendJson(response, 503, { error: 'WhatsApp Cloud API is not configured. Set the server environment variables first.' });
      const messagePayload = whatsapp.buildTemplatePayload({
        to: contact.phone,
        templateName: body.templateName,
        languageCode: body.languageCode,
        bodyParameters: body.bodyParameters
      });
      const now = new Date().toISOString();
      const message = {
        id: 'WAM-' + cryptoId(),
        facilityId: current.facility.id,
        contactId: contact.id,
        recipientName: contact.name,
        recipientPhone: contact.phone,
        templateName: messagePayload.template.name,
        languageCode: messagePayload.template.language.code,
        bodyParameters: messagePayload.template.components && messagePayload.template.components[0]
          ? messagePayload.template.components[0].parameters.map((item) => item.text) : [],
        status: 'accepted',
        providerMessageId: '',
        providerStatus: '',
        errors: [],
        createdAt: now,
        createdBy: current.user.id
      };
      store.whatsappMessages.unshift(message);
      try {
        const providerResponse = await fetch('https://graph.facebook.com/' + config.apiVersion + '/' +
          encodeURIComponent(config.phoneNumberId) + '/messages', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + config.accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messagePayload),
          signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined
        });
        const providerBody = await providerResponse.json().catch(() => ({}));
        if (!providerResponse.ok) {
          message.status = 'failed';
          message.errors = [{
            code: Number(providerBody.error && providerBody.error.code) || providerResponse.status,
            title: String(providerBody.error && providerBody.error.message || 'WhatsApp provider rejected the message.').slice(0, 250)
          }];
          message.statusUpdatedAt = new Date().toISOString();
          writeStore(store);
          return sendJson(response, 502, { error: message.errors[0].title, message });
        }
        const providerMessage = Array.isArray(providerBody.messages) ? providerBody.messages[0] : null;
        message.providerMessageId = String(providerMessage && providerMessage.id || '');
        message.providerStatus = String(providerMessage && providerMessage.message_status || 'accepted');
        message.status = 'accepted';
        message.acceptedAt = new Date().toISOString();
        contact.lastMessageAt = message.acceptedAt;
        appendAudit(store, current.user, 'whatsapp.template_message_sent', 'whatsapp_message', message.id, {
          contactId: contact.id, templateName: message.templateName, providerMessageId: message.providerMessageId
        }, request);
        writeStore(store);
        return sendJson(response, 201, { message });
      } catch (error) {
        message.status = 'failed';
        message.errors = [{ code: 0, title: error.name === 'TimeoutError' ? 'WhatsApp provider request timed out.' : 'WhatsApp provider request failed.' }];
        message.statusUpdatedAt = new Date().toISOString();
        writeStore(store);
        return sendJson(response, 502, { error: message.errors[0].title, message });
      }
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/gst/profile' && request.method === 'GET') {
    try {
      requirePermission(current, 'invoices.view');
      const profile = store.gstProfiles.find((item) => item.facilityId === current.facility.id) || null;
      return sendJson(response, 200, { profile });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/gst/profile' && request.method === 'PUT') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'invoices.manage');
      const body = await readJson(request);
      const existing = store.gstProfiles.find((item) => item.facilityId === current.facility.id);
      const fields = gstDocuments.validateProfile(body, existing);
      if (existing) {
        Object.assign(existing, fields, { updatedAt: new Date().toISOString(), updatedBy: current.user.id });
      } else {
        store.gstProfiles.push({
          id: 'GSTPROFILE-' + cryptoId(),
          facilityId: current.facility.id,
          ...fields,
          createdAt: new Date().toISOString(),
          createdBy: current.user.id
        });
      }
      const profile = store.gstProfiles.find((item) => item.facilityId === current.facility.id);
      appendAudit(store, current.user, 'gst.profile_saved', 'gst_profile', profile.id, {
        gstin: profile.gstin, legalName: profile.legalName, stateCode: profile.stateCode
      }, request);
      writeStore(store);
      return sendJson(response, 200, { profile });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/gst/documents' && request.method === 'GET') {
    try {
      requirePermission(current, 'invoices.view');
      const url = new URL(request.url, 'http://localhost');
      const type = url.searchParams.get('type') || '';
      const documents = store.gstDocuments.filter((item) =>
        item.facilityId === current.facility.id && (!type || item.type === type)
      ).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return sendJson(response, 200, { documents });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/gst/documents' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'invoices.manage');
      const body = await readJson(request);
      const document = gstDocuments.createDocument(store.gstDocuments, store.gstProfiles, body, {
        facilityId: current.facility.id,
        userId: current.user.id,
        userName: current.user.name
      });
      appendAudit(store, current.user, 'gst.document_issued', 'gst_document', document.id, {
        type: document.type, number: document.number, grandTotal: document.grandTotal,
        customerName: document.customer.name, financialYear: document.financialYear
      }, request);
      writeStore(store);
      return sendJson(response, 201, { document });
    } catch (error) { return publicAuthError(error, response); }
  }

  const gstDocumentMatch = /^\/api\/gst\/documents\/([^/]+)$/;
  const matchedGstDocument = gstDocumentMatch.exec(pathname);
  if (matchedGstDocument && request.method === 'GET') {
    try {
      requirePermission(current, 'invoices.view');
      const document = store.gstDocuments.find((item) =>
        item.id === matchedGstDocument[1] && item.facilityId === current.facility.id
      );
      if (!document) return sendJson(response, 404, { error: 'GST document not found in this facility.' });
      return sendJson(response, 200, { document });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/scheduling/optimize' && request.method === 'POST') {
    try {
      requirePermission(current, 'schedule.view');
      const body = await readJson(request);
      const roleProjected = projectStoreForUser(store, current.user);
      const scoped = facilityModel.projectStoreForFacility(roleProjected, current.facility.id);
      const plan = scheduleOptimizer.optimizeSchedule(
        scoped.jobs,
        scoped.workers,
        scoped.schedules,
        scoped.productionLogs,
        body,
        scoped.machines,
        scoped.downtimeLogs
      );
      return sendJson(response, 200, { facilityId: current.facility.id, plan });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/scheduling/optimize/apply' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'schedule.manage');
      const body = await readJson(request);

      // Re-read and revalidate the user/facility before committing a preview.
      const latest = readStore();
      const latestUser = latest.users.find((item) => item.id === current.user.id && item.active !== false);
      if (!latestUser) return sendJson(response, 401, { error: 'Your account is no longer active. Sign in again.' });
      requirePermission({ user: latestUser }, 'schedule.manage');
      const latestFacility = facilityModel.resolveFacility(latestUser, latest.facilities, latest, current.facility.id);
      if (!latestFacility || latestFacility.id !== current.facility.id) {
        return sendJson(response, 403, { error: 'Your access to the selected facility has changed. Refresh the workspace.' });
      }
      const scoped = facilityModel.projectStoreForFacility(latest, latestFacility.id);
      const plan = scheduleOptimizer.optimizeSchedule(
        scoped.jobs,
        scoped.workers,
        scoped.schedules,
        scoped.productionLogs,
        body,
        scoped.machines,
        scoped.downtimeLogs
      );
      if (!plan.proposals.length) {
        return sendJson(response, 409, { error: 'There are no feasible new sessions to apply. Review missing estimates, worker capacity and the planning horizon.', plan });
      }

      const now = new Date().toISOString();
      const planId = 'OP-' + cryptoId();
      const appliedSessions = plan.proposals.map((proposal) => ({
        id: 'SC-' + cryptoId(),
        facilityId: latestFacility.id,
        optimizerPlanId: planId,
        jobId: proposal.jobId,
        workerId: proposal.workerId,
        workerName: proposal.workerName,
        machineId: proposal.machineId || '',
        machineName: proposal.machineName || '',
        date: proposal.date,
        hours: proposal.hours,
        note: proposal.note,
        createdAt: now
      }));

      latest.schedules.push(...appliedSessions);
      appendAudit(latest, latestUser, 'schedule.optimizer_applied', 'schedule', planId, {
        facilityId: latestFacility.id,
        sessionCount: appliedSessions.length,
        scheduledHours: plan.summary.scheduledHours,
        startDate: plan.options.startDate,
        horizonDays: plan.options.horizonDays,
        includeWeekends: plan.options.includeWeekends,
        deadlineRiskCount: plan.summary.deadlineRiskCount
      }, request);
      writeStore(latest);
      return sendJson(response, 201, {
        facilityId: latestFacility.id,
        planId,
        appliedSessions,
        summary: plan.summary
      });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/operations/production' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'execution.record');
      const body = await readJson(request);
      if (current.user.role === 'worker') {
        if (body.workerId !== current.user.workerId) {
          return sendJson(response, 403, { error: 'Workers can only record output against their own worker profile.' });
        }
        const worker = store.workers.find((item) => item.id === current.user.workerId && item.active !== false);
        const assignedSession = worker && store.schedules.find((session) =>
          session.id === body.scheduleId &&
          session.jobId === body.jobId &&
          session.workerId === worker.id &&
          session.date === body.productionDate
        );
        if (!assignedSession) return sendJson(response, 403, { error: 'Workers must record output against their own scheduled session and production date.' });
      }
      const targetJob = store.jobs.find((job) => job.id === body.jobId && job.facilityId === current.facility.id);
      if (!targetJob) return sendJson(response, 404, { error: 'Job not found in the selected facility.' });
      const result = execution.recordProduction(store.productionLogs, store.jobs, store.workers, body, store.schedules);
      result.record.facilityId = current.facility.id;
      appendAudit(store, current.user, 'production.output_recorded', 'production', result.record.id, {
        jobId: result.record.jobId,
        producedQty: result.record.producedQty,
        actualHours: result.record.actualHours
      }, request);
      writeStore(store);
      const roleProjected = projectStoreForUser(store, current.user);
      const projected = facilityModel.projectStoreForFacility(roleProjected, current.facility.id);
      return sendJson(response, 201, {
        record: result.record,
        job: store.jobs.find((item) => item.id === result.record.jobId && item.facilityId === current.facility.id),
        productionLogs: projected.productionLogs,
        jobs: projected.jobs
      });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/operations/qc' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'execution.qc');
      const body = await readJson(request);
      if (!store.jobs.some((job) => job.id === body.jobId && job.facilityId === current.facility.id)) return sendJson(response, 404, { error: 'Job not found in the selected facility.' });
      const result = execution.recordInspection(store.qcInspections, store.productionLogs, store.reworkLogs, store.jobs, body);
      result.record.facilityId = current.facility.id;
      appendAudit(store, current.user, 'quality.inspection_recorded', 'qc_inspection', result.record.id, {
        jobId: result.record.jobId, disposition: result.record.disposition
      }, request);
      writeStore(store);
      const scoped = facilityModel.projectStoreForFacility(store, current.facility.id);
      return sendJson(response, 201, { record: result.record, qcInspections: scoped.qcInspections });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/operations/rework' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'execution.qc');
      const body = await readJson(request);
      const sourceInspection = store.qcInspections.find((item) => item.id === body.qcInspectionId && item.facilityId === current.facility.id);
      if (!sourceInspection) return sendJson(response, 404, { error: 'QC inspection not found in the selected facility.' });
      const result = execution.recordRework(store.reworkLogs, store.qcInspections, store.jobs, body);
      result.record.facilityId = current.facility.id;
      appendAudit(store, current.user, 'quality.rework_recorded', 'rework', result.record.id, {
        jobId: result.record.jobId, recoveredQty: result.record.recoveredQty, scrappedQty: result.record.scrappedQty
      }, request);
      writeStore(store);
      const scoped = facilityModel.projectStoreForFacility(store, current.facility.id);
      return sendJson(response, 201, { record: result.record, reworkLogs: scoped.reworkLogs });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/operations/release' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'execution.qc');
      const body = await readJson(request);
      if (!store.jobs.some((job) => job.id === body.jobId && job.facilityId === current.facility.id)) return sendJson(response, 404, { error: 'Job not found in the selected facility.' });
      const result = execution.releaseForDelivery(store.jobs, store.productionLogs, store.qcInspections, store.reworkLogs, body.jobId);
      appendAudit(store, current.user, 'production.released', 'job', body.jobId, {
        acceptedQty: result.summary.acceptedQty,
        targetQty: result.summary.targetQty
      }, request);
      writeStore(store);
      return sendJson(response, 200, { job: result.job, summary: result.summary });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/operations/delivery' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'jobs.manage');
      const body = await readJson(request);
      const job = store.jobs.find((item) => item.id === body.jobId && item.facilityId === current.facility.id);
      if (!job || (!job.readyForDelivery && job.status !== 'Delivered')) {
        return sendJson(response, 400, { error: 'This job has not passed production and QC release checks.' });
      }
      const deliveredAt = String(body.deliveredAt || '');
      if (!analytics.validDate(deliveredAt)) return sendJson(response, 400, { error: 'Choose a valid delivery date.' });
      const receivedBy = String(body.receivedBy || '').trim();
      if (!receivedBy || receivedBy.length > 120) return sendJson(response, 400, { error: 'Enter a valid recipient name.' });
      const attachment = body.attachment || null;
      if (attachment) {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(attachment.type) || !Number.isSafeInteger(Number(attachment.size)) ||
            Number(attachment.size) <= 0 || Number(attachment.size) > 1000000 ||
            typeof attachment.dataUrl !== 'string' || attachment.dataUrl.length > 1400000 ||
            !attachment.dataUrl.startsWith('data:' + attachment.type + ';base64,')) {
          return sendJson(response, 400, { error: 'Delivery attachment must be a JPG, PNG, WebP or PDF up to 1 MB.' });
        }
      }
      const existingIndex = store.deliveries.findIndex((item) => item.jobId === job.id && item.facilityId === current.facility.id);
      const delivery = {
        facilityId: current.facility.id,
        id: existingIndex >= 0 ? store.deliveries[existingIndex].id : 'DP-' + cryptoId(),
        jobId: job.id,
        customer: job.customer,
        receivedBy,
        challan: String(body.challan || '').trim().slice(0, 100),
        notes: String(body.notes || '').trim().slice(0, 1000),
        deliveredAt,
        attachment,
        recordedBy: current.user.id,
        createdAt: new Date().toISOString()
      };
      if (existingIndex >= 0) store.deliveries[existingIndex] = delivery;
      else store.deliveries.unshift(delivery);
      job.status = 'Delivered';
      job.readyForDelivery = true;
      job.progress = 100;
      job.due = 'Delivered ' + new Date(deliveredAt + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      appendAudit(store, current.user, 'delivery.proof_saved', 'delivery', delivery.id, { jobId: job.id, challan: delivery.challan }, request);
      writeStore(store);
      return sendJson(response, 201, { delivery, job });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/operations/downtime' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'analytics.downtime');
      const body = await readJson(request);
      if (body.jobId && !store.jobs.some((job) => job.id === body.jobId && job.facilityId === current.facility.id)) return sendJson(response, 404, { error: 'Job not found in the selected facility.' });
      const downtimeInput = { ...body };
      let linkedMachine = null;
      if (body.machineId) {
        linkedMachine = store.machines.find((machine) => machine.id === body.machineId && machine.facilityId === current.facility.id);
        if (!linkedMachine) return sendJson(response, 404, { error: 'Machine not found in the selected facility.' });
        downtimeInput.machineName = linkedMachine.name;
      }
      const record = analytics.recordDowntime(store.downtimeLogs, store.jobs, downtimeInput);
      record.facilityId = current.facility.id;
      if (linkedMachine) record.machineId = linkedMachine.id;
      appendAudit(store, current.user, 'production.downtime_recorded', 'downtime', record.id, {
        machineName: record.machineName, durationMinutes: record.durationMinutes, reason: record.reason
      }, request);
      writeStore(store);
      const scoped = facilityModel.projectStoreForFacility(store, current.facility.id);
      return sendJson(response, 201, { record, downtimeLogs: scoped.downtimeLogs });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/inventory/forecast' && request.method === 'GET') {
    try {
      requirePermission(current, 'materials.view');
      const query = new URL(request.url, 'http://factoryflow.local').searchParams;
      const options = {};
      if (query.has('lookbackDays')) options.lookbackDays = Number(query.get('lookbackDays'));
      const scoped = facilityModel.projectStoreForFacility(store, current.facility.id);
      const forecast = forecasting.forecastInventory(scoped.materials, scoped.movements, scoped.purchases, options);
      return sendJson(response, 200, { facilityId: current.facility.id, forecast });
    } catch (error) { return publicAuthError(error, response); }
  }

  const forecastSettingsMatch = /^\/api\/materials\/([^/]+)\/forecast-settings$/.exec(pathname);
  if (forecastSettingsMatch && request.method === 'PATCH') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'materials.manage');
      const body = await readJson(request);
      const sku = decodeURIComponent(forecastSettingsMatch[1]);
      const material = store.materials.find((item) => item.sku === sku && item.facilityId === current.facility.id);
      if (!material) return sendJson(response, 404, { error: 'Material not found in the selected facility.' });
      const settings = forecasting.validateSettings(body, material);
      Object.assign(material, settings, { forecastSettingsUpdatedAt: new Date().toISOString() });
      appendAudit(store, current.user, 'inventory.forecast_settings_updated', 'material', material.sku, settings, request);
      writeStore(store);
      return sendJson(response, 200, { material });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/procurement/drafts' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'purchases.manage');
      const body = await readJson(request);
      const materialSku = String(body.materialSku || '').trim();
      if (!materialSku || materialSku.length > 120) return sendJson(response, 400, { error: 'Choose a valid material SKU.' });

      // Re-read after the request body is received so a second click cannot create a duplicate draft.
      const latest = readStore();
      const latestUser = latest.users.find((item) => item.id === current.user.id && item.active !== false);
      if (!latestUser) return sendJson(response, 401, { error: 'Your account is no longer active. Sign in again.' });
      requirePermission({ user: latestUser }, 'purchases.manage');
      const latestFacility = facilityModel.resolveFacility(latestUser, latest.facilities, latest, current.facility.id);
      if (!latestFacility || latestFacility.id !== current.facility.id) {
        return sendJson(response, 403, { error: 'Your access to the selected facility has changed. Refresh the workspace.' });
      }
      const scoped = facilityModel.projectStoreForFacility(latest, latestFacility.id);
      const material = scoped.materials.find((item) => item.sku === materialSku);
      if (!material) return sendJson(response, 404, { error: 'Material not found in the selected facility.' });

      const materialName = String(material.item || '').trim().toLocaleLowerCase();
      const existingDraft = scoped.purchases.find((purchase) =>
        purchase.status === 'Draft' &&
        (purchase.materialSku === materialSku ||
          (!purchase.materialSku && String(purchase.material || '').trim().toLocaleLowerCase() === materialName))
      );
      if (existingDraft) {
        return sendJson(response, 200, { purchase: existingDraft, existing: true, message: 'A forecast purchase draft already exists for this material.' });
      }

      const forecast = forecasting.forecastInventory(scoped.materials, scoped.movements, scoped.purchases);
      const recommendation = forecast.items.find((item) => item.materialSku === materialSku);
      if (!recommendation || !recommendation.reorderRecommended || recommendation.recommendedOrderQty <= 0) {
        return sendJson(response, 409, { error: 'This material does not currently have a purchase recommendation. Refresh the forecast and review stock or incoming orders.' });
      }

      const purchase = {
        id: 'PO-AUTO-' + cryptoId().replace(/-/g, '').slice(0, 10).toUpperCase(),
        facilityId: latestFacility.id,
        supplier: recommendation.preferredSupplier || 'Supplier to assign',
        material: recommendation.material,
        materialSku: recommendation.materialSku,
        quantity: recommendation.recommendedOrderQty,
        receivedQty: 0,
        unit: recommendation.unit,
        amount: recommendation.recommendedOrderCost,
        delivery: 'To schedule',
        status: 'Draft',
        planningGenerated: true,
        forecastGenerated: true,
        forecastSnapshot: {
          generatedAt: forecast.generatedAt,
          lookbackDays: forecast.lookbackDays,
          averageDailyDemand: recommendation.averageDailyDemand,
          leadTimeDays: recommendation.leadTimeDays,
          safetyStockDays: recommendation.safetyStockDays,
          reorderPoint: recommendation.reorderPoint,
          incomingQty: recommendation.incomingQty
        },
        createdAt: new Date().toISOString()
      };
      latest.purchases.unshift(purchase);
      appendAudit(latest, latestUser, 'procurement.forecast_draft_created', 'purchase', purchase.id, {
        materialSku: purchase.materialSku,
        quantity: purchase.quantity,
        unit: purchase.unit,
        estimatedAmount: purchase.amount
      }, request);
      writeStore(latest);
      return sendJson(response, 201, { purchase, existing: false });
    } catch (error) { return publicAuthError(error, response); }
  }

  if (pathname === '/api/sync' && request.method === 'POST') {
    try {
      requireCsrf(request, current);
      requirePermission(current, 'settings.view');
      if (current.user.role !== 'admin' && current.user.role !== 'manager') {
        return sendJson(response, 403, { error: 'This role must use its specific operational actions instead of full workspace sync.' });
      }
      const body = await readJson(request);
      const next = { ...store };
      for (const key of facilityModel.COLLECTIONS) {
        next[key] = facilityModel.mergeFacilityCollection(store[key], list(body[key]), current.facility.id, ['jobs', 'workers', 'schedules'].includes(key));
      }
      appendAudit(next, current.user, 'workspace.synced', 'workspace', '', {}, request);
      writeStore(next);
      const scoped = facilityModel.projectStoreForFacility(next, current.facility.id);
      return sendJson(response, 200, { ok: true, updatedAt: new Date().toISOString(), customers: customerDirectory(scoped) });
    } catch (error) { return publicAuthError(error, response); }
  }

  return sendJson(response, 404, { error: 'Unknown API route.' });
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try { decoded = decodeURIComponent(requested); }
  catch {
    response.writeHead(400);
    return response.end('Invalid path');
  }
  const blocked = decoded.split('/').some((part) =>
    part === '..' || part === '.git' || part === 'data' || part === 'node_modules' ||
    part.startsWith('.')
  ) || ['/server.js', '/auth.js', '/facilities.js'].includes(decoded);
  if (blocked) {
    response.writeHead(404);
    return response.end('Not found');
  }
  const fullPath = path.resolve(root, '.' + decoded);
  if (!fullPath.startsWith(root + path.sep)) {
    response.writeHead(403);
    return response.end('Forbidden');
  }
  fs.readFile(fullPath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      return response.end(error.code === 'ENOENT' ? 'Not found' : 'Could not read this file');
    }
    response.writeHead(200, {
      'Content-Type': staticTypes[path.extname(fullPath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': path.extname(fullPath) === '.html' ? 'no-store' : 'no-cache'
    });
    response.end(contents);
  });
}

const server = http.createServer((request, response) => {
  let url;
  try { url = new URL(request.url, 'http://' + request.headers.host); }
  catch { response.writeHead(400); return response.end('Bad request'); }

  if (url.pathname.startsWith('/api/')) {
    handleApi(request, response, url.pathname).catch((error) => sendJson(response, 500, { error: error.message }));
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end('Method not allowed');
  }
  serveStatic(response, url.pathname);
});

server.listen(port, () => {
  console.log('FactoryFlow is running at http://localhost:' + port);
});
