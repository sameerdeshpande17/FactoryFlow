const crypto = require('node:crypto');

const ROLES = Object.freeze({
  admin: 'Administrator',
  manager: 'Manager',
  supervisor: 'Production supervisor',
  worker: 'Worker'
});

const ROLE_PERMISSIONS = Object.freeze({
  admin: [
    'dashboard.view', 'quotes.view', 'quotes.manage', 'jobs.view', 'jobs.manage',
    'purchases.view', 'purchases.manage', 'materials.view', 'materials.manage',
    'planning.view', 'planning.manage', 'schedule.view', 'schedule.manage',
    'execution.view', 'execution.record', 'execution.qc',
    'analytics.view', 'analytics.downtime', 'costing.view', 'costing.manage',
    'workers.view', 'workers.manage', 'invoices.view', 'invoices.manage',
    'marketplace.view', 'marketplace.manage', 'settings.view', 'users.manage', 'audit.view', 'facilities.view', 'facilities.manage', 'machines.view', 'machines.manage', 'maintenance.view', 'maintenance.manage', 'whatsapp.view', 'whatsapp.manage'
  ],
  manager: [
    'dashboard.view', 'quotes.view', 'quotes.manage', 'jobs.view', 'jobs.manage',
    'purchases.view', 'purchases.manage', 'materials.view', 'materials.manage',
    'planning.view', 'planning.manage', 'schedule.view', 'schedule.manage',
    'execution.view', 'execution.record', 'execution.qc',
    'analytics.view', 'analytics.downtime', 'costing.view', 'costing.manage',
    'workers.view', 'workers.manage', 'invoices.view', 'invoices.manage',
    'marketplace.view', 'marketplace.manage', 'settings.view', 'facilities.view', 'machines.view', 'machines.manage', 'maintenance.view', 'maintenance.manage', 'whatsapp.view', 'whatsapp.manage'
  ],
  supervisor: [
    'dashboard.view', 'jobs.view', 'materials.view', 'planning.view',
    'schedule.view', 'execution.view', 'execution.record', 'execution.qc',
    'analytics.view', 'analytics.downtime', 'workers.view', 'facilities.view', 'machines.view', 'maintenance.view', 'maintenance.manage'
  ],
  worker: [
    'dashboard.view', 'jobs.view', 'schedule.view', 'execution.view', 'execution.record'
  ]
});

const PASSWORD_MIN_LENGTH = 12;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLEL = 1;
const SCRYPT_KEY_LENGTH = 64;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateEmail(value) {
  const email = normalizeEmail(value);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  return email;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH || value.length > 256) {
    throw new Error('Password must be between 12 and 256 characters.');
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    throw new Error('Password must include an uppercase letter, a lowercase letter and a number.');
  }
  return value;
}

function hashPassword(password) {
  validatePassword(password);
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLEL,
    maxmem: 64 * 1024 * 1024
  });
  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLEL,
    salt.toString('hex'),
    derived.toString('hex')
  ].join('$');
}

function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallel = Number(parts[3]);
  if (![cost, blockSize, parallel].every(Number.isSafeInteger) ||
      cost < 16384 || cost > 131072 || blockSize !== 8 || parallel !== 1 ||
      !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) {
    return false;
  }
  try {
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallel,
      maxmem: 256 * 1024 * 1024
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function validateRole(role) {
  if (!Object.prototype.hasOwnProperty.call(ROLES, role)) {
    throw new Error('Choose a valid user role.');
  }
  return role;
}

function createUser(input, users, options = {}) {
  if (!Array.isArray(users)) throw new TypeError('User records must be an array.');
  const name = String(input.name || '').trim();
  if (!name || name.length > 100) throw new Error('Enter a user name (maximum 100 characters).');
  const email = validateEmail(input.email);
  if (users.some((user) => normalizeEmail(user.email) === email)) {
    throw new Error('A user with this email address already exists.');
  }
  const role = validateRole(input.role);
  const passwordHash = hashPassword(input.password);
  const workerId = String(input.workerId || '').trim();
  if (role === 'worker' && !workerId) throw new Error('Select a worker profile for this account.');
  const user = {
    id: 'USR-' + crypto.randomUUID(),
    name,
    email,
    role,
    workerId: role === 'worker' ? workerId : '',
    facilityIds: Array.isArray(input.facilityIds) ? [...new Set(input.facilityIds.map((id) => String(id).trim()).filter(Boolean))] : [],
    passwordHash,
    active: true,
    mustChangePassword: Boolean(options.mustChangePassword),
    createdAt: options.createdAt || new Date().toISOString(),
    updatedAt: options.createdAt || new Date().toISOString()
  };
  users.push(user);
  return user;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLES[user.role] || 'Unknown',
    workerId: user.workerId || '',
    facilityIds: Array.isArray(user.facilityIds) ? [...user.facilityIds] : [],
    active: user.active !== false,
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null
  };
}

function hasPermission(user, permission) {
  return Boolean(user && user.active !== false &&
    Array.isArray(ROLE_PERMISSIONS[user.role]) &&
    ROLE_PERMISSIONS[user.role].includes(permission));
}

function permissionsFor(user) {
  return user && Array.isArray(ROLE_PERMISSIONS[user.role])
    ? [...ROLE_PERMISSIONS[user.role]]
    : [];
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function parseCookies(header) {
  const cookies = {};
  String(header || '').split(';').forEach((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) return;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = '';
    }
  });
  return cookies;
}

class SessionStore {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 8 * 60 * 60 * 1000;
    this.sessions = new Map();
  }

  create(userId, now = Date.now()) {
    this.prune(now);
    const token = crypto.randomBytes(32).toString('base64url');
    const csrfToken = crypto.randomBytes(32).toString('base64url');
    const hash = tokenHash(token);
    this.sessions.set(hash, { userId, csrfToken, createdAt: now, expiresAt: now + this.ttlMs });
    return { token, csrfToken, expiresAt: now + this.ttlMs };
  }

  get(token, now = Date.now()) {
    if (!token || typeof token !== 'string') return null;
    const hash = tokenHash(token);
    const session = this.sessions.get(hash);
    if (!session) return null;
    if (session.expiresAt <= now) {
      this.sessions.delete(hash);
      return null;
    }
    return { ...session };
  }

  revoke(token) {
    if (!token) return false;
    return this.sessions.delete(tokenHash(token));
  }

  revokeUser(userId, exceptToken = '') {
    let count = 0;
    const exceptHash = exceptToken ? tokenHash(exceptToken) : '';
    for (const [hash, session] of this.sessions.entries()) {
      if (session.userId === userId && hash !== exceptHash) {
        this.sessions.delete(hash);
        count += 1;
      }
    }
    return count;
  }

  prune(now = Date.now()) {
    for (const [hash, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) this.sessions.delete(hash);
    }
  }
}

function buildCookie(token, maxAgeSeconds, secure = false) {
  return 'FF_SESSION=' + encodeURIComponent(token) +
    '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + Math.max(0, Math.floor(maxAgeSeconds)) +
    (secure ? '; Secure' : '');
}

function clearCookie(secure = false) {
  return 'FF_SESSION=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' +
    (secure ? '; Secure' : '');
}

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  validateEmail,
  validatePassword,
  hashPassword,
  verifyPassword,
  validateRole,
  createUser,
  sanitizeUser,
  hasPermission,
  permissionsFor,
  parseCookies,
  SessionStore,
  buildCookie,
  clearCookie
};
