const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../auth.js');

test('enforces strong password policy before hashing', () => {
  for (const password of ['short', 'alllowercase12345', 'ALLUPPERCASE12345', 'NoDigitsPassword']) {
    assert.throws(() => auth.hashPassword(password), /Password must/);
  }
  assert.throws(() => auth.validatePassword('x'.repeat(257)), /Password must/);
});

test('stores a salted scrypt hash and verifies the original password', () => {
  const first = auth.hashPassword('FactoryFlowSecure123');
  const second = auth.hashPassword('FactoryFlowSecure123');
  assert.match(first, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(first, second);
  assert.equal(auth.verifyPassword('FactoryFlowSecure123', first), true);
  assert.equal(auth.verifyPassword('WrongPassword123', first), false);
  assert.equal(auth.verifyPassword('FactoryFlowSecure123', 'plaintext'), false);
});

test('normalizes email and rejects duplicates and invalid roles', () => {
  const users = [];
  const first = auth.createUser({
    name: 'Factory Admin',
    email: ' ADMIN@FACTORY.EXAMPLE ',
    role: 'admin',
    password: 'FactoryFlowSecure123'
  }, users);
  assert.equal(first.email, 'admin@factory.example');
  assert.throws(() => auth.createUser({
    name: 'Duplicate',
    email: 'admin@factory.example',
    role: 'manager',
    password: 'FactoryFlowSecure123'
  }, users), /already exists/i);
  assert.throws(() => auth.createUser({
    name: 'Bad Role',
    email: 'bad@factory.example',
    role: 'root',
    password: 'FactoryFlowSecure123'
  }, users), /valid user role/i);
  assert.equal(users.length, 1);
});

test('requires worker accounts to reference a worker profile identifier', () => {
  const users = [];
  assert.throws(() => auth.createUser({
    name: 'Worker One',
    email: 'worker@factory.example',
    role: 'worker',
    password: 'FactoryFlowSecure123'
  }, users), /worker profile/i);
  const user = auth.createUser({
    name: 'Worker One',
    email: 'worker@factory.example',
    role: 'worker',
    workerId: 'WRK-1',
    password: 'FactoryFlowSecure123'
  }, users);
  assert.equal(user.workerId, 'WRK-1');
});

test('sanitizes user records and never returns password hashes', () => {
  const users = [];
  const user = auth.createUser({
    name: 'Manager',
    email: 'manager@factory.example',
    role: 'manager',
    password: 'FactoryFlowSecure123'
  }, users);
  const safe = auth.sanitizeUser(user);
  assert.equal(safe.email, 'manager@factory.example');
  assert.equal(safe.roleLabel, 'Manager');
  assert.equal(Object.hasOwn(safe, 'passwordHash'), false);
});

test('assigns distinct least-privilege permissions to each role', () => {
  const admin = { role: 'admin', active: true };
  const manager = { role: 'manager', active: true };
  const supervisor = { role: 'supervisor', active: true };
  const worker = { role: 'worker', active: true };
  assert.equal(auth.hasPermission(admin, 'users.manage'), true);
  assert.equal(auth.hasPermission(manager, 'quotes.manage'), true);
  assert.equal(auth.hasPermission(manager, 'users.manage'), false);
  assert.equal(auth.hasPermission(supervisor, 'execution.qc'), true);
  assert.equal(auth.hasPermission(supervisor, 'purchases.manage'), false);
  assert.equal(auth.hasPermission(supervisor, 'settings.view'), false);
  assert.equal(auth.hasPermission(worker, 'execution.record'), true);
  assert.equal(auth.hasPermission(worker, 'execution.qc'), false);
  assert.equal(auth.hasPermission(worker, 'quotes.view'), false);
  assert.equal(auth.hasPermission({ role: 'admin', active: false }, 'users.manage'), false);
});

test('parses cookies safely and ignores malformed cookie values', () => {
  assert.deepEqual(auth.parseCookies('FF_SESSION=abc%2F123; Theme=dark; Broken=%E0%A4%A'), {
    FF_SESSION: 'abc/123',
    Theme: 'dark',
    Broken: ''
  });
});

test('creates opaque sessions with CSRF tokens and expires or revokes them', () => {
  const sessions = new auth.SessionStore({ ttlMs: 1000 });
  const created = sessions.create('USR-1', 100);
  assert.equal(typeof created.token, 'string');
  assert.equal(typeof created.csrfToken, 'string');
  assert.notEqual(created.token, created.csrfToken);
  assert.equal(sessions.get(created.token, 500).userId, 'USR-1');
  assert.equal(sessions.get(created.token, 1100), null);
  const second = sessions.create('USR-1', 2000);
  assert.equal(sessions.revoke(second.token), true);
  assert.equal(sessions.get(second.token, 2001), null);
});

test('revokes all sessions for a user except the current session when requested', () => {
  const sessions = new auth.SessionStore();
  const first = sessions.create('USR-1', 100);
  const second = sessions.create('USR-1', 200);
  const other = sessions.create('USR-2', 300);
  assert.equal(sessions.revokeUser('USR-1', first.token), 1);
  assert.ok(sessions.get(first.token, 400));
  assert.equal(sessions.get(second.token, 400), null);
  assert.ok(sessions.get(other.token, 400));
});

test('builds HttpOnly SameSite cookies and a clearing cookie', () => {
  const cookie = auth.buildCookie('opaque-token', 3600, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.match(auth.clearCookie(false), /Max-Age=0/);
});
