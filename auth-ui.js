(function attachFactoryFlowAuthUi() {
  'use strict';

  const state = {
    user: null,
    permissions: [],
    csrfToken: '',
    adminUsers: [],
    auditRecords: [],
    facilities: [],
    activeFacilityId: '',
    facilitySummaries: [],
    facilitySummariesLoaded: false
  };
  let authResolver = null;
  let initPromise = null;
  let overlay = null;

  function update(payload) {
    if (payload.user) state.user = payload.user;
    if (Array.isArray(payload.permissions)) state.permissions = payload.permissions;
    if (payload.csrfToken) state.csrfToken = payload.csrfToken;
    if (Array.isArray(payload.facilities)) state.facilities = payload.facilities;
    if (payload.user && payload.activeFacilityId) {
      state.activeFacilityId = payload.activeFacilityId;
      try { localStorage.setItem('ff-active-facility-' + payload.user.id, payload.activeFacilityId); } catch {}
    } else if (payload.user && !state.activeFacilityId) {
      try { state.activeFacilityId = localStorage.getItem('ff-active-facility-' + payload.user.id) || ''; } catch {}
    }
    document.body.classList.remove('auth-required');
    if (overlay) overlay.remove();
    overlay = null;
    return state;
  }

  function has(permission) {
    return state.permissions.includes(permission);
  }

  function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (state.activeFacilityId && !headers.has('X-Facility-ID')) headers.set('X-Facility-ID', state.activeFacilityId);
    if (options.method && options.method.toUpperCase() !== 'GET' && options.method.toUpperCase() !== 'HEAD' && state.csrfToken) {
      headers.set('X-CSRF-Token', state.csrfToken);
    }
    return fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin'
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          state.user = null;
          state.permissions = [];
          state.csrfToken = '';
          if (!authResolver) authResolver = () => window.location.reload();
          showAuth('login', 'Your session has expired. Sign in again.');
        }
        throw new Error(payload.error || 'Request failed (' + response.status + ').');
      }
      return payload;
    });
  }

  function shell() {
    if (overlay) return overlay;
    document.body.classList.add('auth-required');
    overlay = document.createElement('main');
    overlay.id = 'factoryFlowAuth';
    overlay.className = 'auth-overlay';
    overlay.setAttribute('aria-live', 'polite');
    document.body.appendChild(overlay);
    return overlay;
  }

  function safe(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function showAuth(mode, message = '') {
    const root = shell();
    const setup = mode === 'setup';
    const password = mode === 'password';
    const title = setup ? 'Set up your factory workspace' : password ? 'Change your temporary password' : 'Welcome back';
    const subtitle = setup
      ? 'Create the first administrator account. This one-time setup is available only while the workspace has no users.'
      : password
        ? 'An administrator created your account. Set a new password before accessing FactoryFlow.'
        : 'Sign in to access your factory workspace.';
    root.innerHTML = '<section class="auth-card"><div class="auth-brand"><span class="auth-brand-mark">F</span><span>Factory<span>Flow</span></span></div><p class="auth-eyebrow">' + (setup ? 'FIRST-TIME SETUP' : password ? 'ACCOUNT SECURITY' : 'WORKSPACE SIGN IN') + '</p><h1>' + title + '</h1><p class="auth-subtitle">' + subtitle + '</p>' +
      (message ? '<p class="auth-error" role="alert">' + safe(message) + '</p>' : '') +
      '<form id="factoryFlowAuthForm" class="auth-form">' +
      (setup ? '<label>Administrator name<input name="name" required maxlength="100" autocomplete="name" placeholder="Your name"></label>' : '') +
      (setup || !password ? '<label>Email address<input name="email" required type="email" autocomplete="username" placeholder="you@company.com"></label>' : '') +
      (password ? '<label>Current temporary password<input name="currentPassword" required type="password" autocomplete="current-password"></label>' : '') +
      (setup || !password ? '<label>Password<input name="password" required type="password" minlength="12" autocomplete="' + (setup ? 'new-password' : 'current-password') + '" placeholder="At least 12 characters"></label>' : '') +
      (setup ? '<label>Confirm password<input name="confirmPassword" required type="password" minlength="12" autocomplete="new-password"></label>' : '') +
      (password ? '<label>New password<input name="newPassword" required type="password" minlength="12" autocomplete="new-password" placeholder="At least 12 characters"></label><label>Confirm new password<input name="confirmPassword" required type="password" minlength="12" autocomplete="new-password"></label>' : '') +
      '<button class="auth-submit" type="submit">' + (setup ? 'Create administrator account' : password ? 'Save new password' : 'Sign in') + '</button></form>' +
      '<p class="auth-footnote">Use a unique password. Passwords are stored as salted scrypt hashes; they are never stored in plain text.</p></section>';
    const form = root.querySelector('#factoryFlowAuthForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Please wait…';
      const data = new FormData(form);
      try {
        if ((setup || password) && data.get('password') !== data.get('confirmPassword') && setup) {
          throw new Error('Passwords do not match.');
        }
        if (password && data.get('newPassword') !== data.get('confirmPassword')) {
          throw new Error('New passwords do not match.');
        }
        let payload;
        if (setup) {
          payload = await fetch('/api/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ name: data.get('name'), email: data.get('email'), password: data.get('password') })
          }).then(async (response) => {
            const value = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(value.error || 'Setup failed.');
            return value;
          });
        } else if (password) {
          payload = await request('/api/auth/password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') })
          });
          state.user = payload.user;
        } else {
          payload = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email: data.get('email'), password: data.get('password') })
          }).then(async (response) => {
            const value = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(value.error || 'Sign in failed.');
            return value;
          });
        }
        update(payload);
        if (!password && payload.user && payload.user.mustChangePassword) {
          showAuth('password');
          return;
        }
        if (authResolver) {
          const resolve = authResolver;
          authResolver = null;
          resolve(state);
        } else {
          window.location.reload();
        }
      } catch (error) {
        showAuth(mode, error.message);
      }
    });
  }

  async function initialize() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const response = await fetch('/api/auth/status', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not verify workspace sign-in.');
      if (payload.authenticated) {
        update(payload);
        try { state.activeFacilityId = localStorage.getItem('ff-active-facility-' + payload.user.id) || ''; } catch {}
        if (payload.user.mustChangePassword) {
          return new Promise((resolve) => {
            authResolver = resolve;
            showAuth('password');
          });
        }
        return state;
      }
      return new Promise((resolve) => {
        authResolver = resolve;
        showAuth(payload.setupRequired ? 'setup' : 'login');
      });
    })();
    return initPromise;
  }

  function setActiveFacility(facilityId) {
    const id = String(facilityId || '').trim();
    if (!state.facilities.some((facility) => facility.id === id && facility.active !== false)) {
      throw new Error('You are not assigned to that active facility.');
    }
    state.activeFacilityId = id;
    state.facilitySummariesLoaded = false;
    state.facilitySummaries = [];
    if (state.user) {
      try { localStorage.setItem('ff-active-facility-' + state.user.id, id); } catch {}
    }
    return id;
  }

  function clearActiveFacility() {
    state.activeFacilityId = '';
    if (state.user) {
      try { localStorage.removeItem('ff-active-facility-' + state.user.id); } catch {}
    }
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST', body: '{}' });
    } finally {
      window.location.reload();
    }
  }

  function applyNavigation() {
    const viewPermissions = {
      facilities: 'facilities.view',
      dashboard: 'dashboard.view',
      quotes: 'quotes.view',
      jobs: 'jobs.view',
      purchases: 'purchases.view',
      materials: 'materials.view',
      planning: 'planning.view',
      schedule: 'schedule.view',
      execution: 'execution.view',
      analytics: 'analytics.view',
      costing: 'costing.view',
      workers: 'workers.view',
      invoices: 'invoices.view',
      marketplace: 'marketplace.view',
      settings: 'settings.view',
      users: 'users.manage'
    };
    document.querySelectorAll('.nav-link[data-view]').forEach((button) => {
      const permission = viewPermissions[button.dataset.view];
      button.hidden = Boolean(permission && !has(permission));
    });
    const facilityWrap = document.querySelector('#facilitySwitcherWrap');
    const facilitySelect = document.querySelector('#facilitySwitcher');
    if (facilityWrap && facilitySelect) {
      const activeFacilities = state.facilities.filter((facility) => facility.active !== false);
      const canSwitch = has('facilities.view') && state.user && state.user.role !== 'worker' && activeFacilities.length > 1;
      facilityWrap.hidden = !canSwitch;
      if (canSwitch) {
        facilitySelect.innerHTML = activeFacilities.map((facility) =>
          '<option value="' + safe(facility.id) + '">' + safe(facility.name + ' · ' + facility.code) + '</option>'
        ).join('');
        if (activeFacilities.some((facility) => facility.id === state.activeFacilityId)) facilitySelect.value = state.activeFacilityId;
      }
    }
    const accountName = document.querySelector('.user-card strong');
    const accountRole = document.querySelector('.user-card small');
    if (accountName && state.user) accountName.textContent = state.user.name;
    if (accountRole && state.user) accountRole.textContent = state.user.roleLabel;
    const card = document.querySelector('.user-card');
    if (card && !document.querySelector('#logoutButton')) {
      const button = document.createElement('button');
      button.id = 'logoutButton';
      button.className = 'more-button';
      button.type = 'button';
      button.textContent = '↪';
      button.title = 'Sign out';
      button.setAttribute('aria-label', 'Sign out');
      button.addEventListener('click', logout);
      card.appendChild(button);
    }
  }

  window.FactoryFlowAuth = {
    state,
    initialize,
    update,
    has,
    request,
    setActiveFacility,
    clearActiveFacility,
    logout,
    applyNavigation
  };
})();
