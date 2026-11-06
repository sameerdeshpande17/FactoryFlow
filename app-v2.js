const quotes = JSON.parse(localStorage.getItem('ff-quotes') || 'null') || [
  { id: 'QT-2084', customer: 'Shree Packaging', scope: 'Corrugated carton · 5-ply', qty: 12000, value: 186000, phone: '919876543210', valid: '30 Oct', status: 'Sent' },
  { id: 'QT-2083', customer: 'Narmada Foods', scope: 'Printed pouch · 500g', qty: 8000, value: 128000, phone: '919812345678', valid: '31 Oct', status: 'Viewed' },
  { id: 'QT-2082', customer: 'Aarna Retail', scope: 'Mono carton · premium', qty: 2400, value: 96400, phone: '919700112233', valid: '29 Oct', status: 'Follow up' },
  { id: 'QT-2080', customer: 'Kaleva Naturals', scope: 'Label roll · matte', qty: 30000, value: 72000, phone: '919845678901', valid: '28 Oct', status: 'Accepted' }
];

const jobs = JSON.parse(localStorage.getItem('ff-jobs') || 'null') || [
  { id: 'JB-841', customer: 'Shree Packaging', item: 'Corrugated carton · 5-ply', qty: 12000, worker: 'Ravi Cartons', due: 'Today, 18:00', status: 'In production', progress: 68, owner: 'RK' },
  { id: 'JB-838', customer: 'Narmada Foods', item: 'Printed pouch · 500g', qty: 8000, worker: 'Aman Printworks', due: 'Tomorrow', status: 'With worker', progress: 42, owner: 'AP' },
  { id: 'JB-835', customer: 'Aarna Retail', item: 'Mono carton · premium', qty: 2400, worker: 'Ravi Cartons', due: 'Oct 30', status: 'Material pending', progress: 15, owner: 'RK' },
  { id: 'JB-831', customer: 'Kaleva Naturals', item: 'Label roll · matte', qty: 30000, worker: 'Aman Printworks', due: 'Delivered', status: 'QC review', progress: 100, owner: 'AP' }
];

const purchases = [
  { id: 'PO-491', supplier: 'Kraftline Papers', material: 'Kraft paper · 180 GSM', amount: 94500, delivery: 'Today', status: 'In transit' },
  { id: 'PO-490', supplier: 'Pioneer Inks', material: 'Water-based ink · black', amount: 28200, delivery: 'Oct 30', status: 'Confirmed' },
  { id: 'PO-488', supplier: 'WestPack Films', material: 'BOPP film · 25 micron', amount: 63800, delivery: 'Nov 01', status: 'Part received' }
];

const gstDocuments = JSON.parse(localStorage.getItem('ff-gst-documents') || 'null') || [];
const gstProfiles = JSON.parse(localStorage.getItem('ff-gst-profiles') || 'null') || [];
let gstDocumentFilter = 'ALL';

const deliveries = JSON.parse(localStorage.getItem('ff-deliveries') || 'null') || [];

const receipts = JSON.parse(localStorage.getItem('ff-receipts') || 'null') || [];

const movements = JSON.parse(localStorage.getItem('ff-movements') || 'null') || [];

const requirements = JSON.parse(localStorage.getItem('ff-requirements') || 'null') || [];

const defaultWorkers = [
  { id: 'WRK-001', name: 'Ravi Cartons', skill: 'Carton conversion', capacityHoursPerDay: 8, active: true, unavailableDates: [] },
  { id: 'WRK-002', name: 'Aman Printworks', skill: 'Flexo printing', capacityHoursPerDay: 8, active: true, unavailableDates: [] },
  { id: 'WRK-003', name: 'Sanket Lamination', skill: 'Film lamination', capacityHoursPerDay: 8, active: true, unavailableDates: [] },
  { id: 'WRK-004', name: 'Disha Finishing', skill: 'Spot UV & finishing', capacityHoursPerDay: 8, active: true, unavailableDates: [] }
];
const workers = JSON.parse(localStorage.getItem('ff-workers') || 'null') || defaultWorkers;
const schedules = JSON.parse(localStorage.getItem('ff-schedules') || 'null') || [];

const productionLogs = JSON.parse(localStorage.getItem('ff-production-logs') || 'null') || [];
const qcInspections = JSON.parse(localStorage.getItem('ff-qc-inspections') || 'null') || [];
const reworkLogs = JSON.parse(localStorage.getItem('ff-rework-logs') || 'null') || [];
const downtimeLogs = JSON.parse(localStorage.getItem('ff-downtime-logs') || 'null') || [];
const machines = JSON.parse(localStorage.getItem('ff-machines') || 'null') || [];
const maintenanceRecords = JSON.parse(localStorage.getItem('ff-maintenance-records') || 'null') || [];
const maintenanceWorkOrders = JSON.parse(localStorage.getItem('ff-maintenance-work-orders') || 'null') || [];
let maintenanceWorkOrderFilter = 'All';
const maintenanceTechnicians = JSON.parse(localStorage.getItem('ff-maintenance-technicians') || 'null') || [];
let maintenanceCalendarDate = localDateISO();
const analyticsFilters = JSON.parse(localStorage.getItem('ff-analytics-filters') || 'null') || { fromDate: '', toDate: '', groupBy: 'day' };

const materials = [
  { sku: 'RM-0142', item: 'Kraft paper · 180 GSM', category: 'Paper', location: 'A-12', onHand: '3,840 kg', stock: 82, status: 'In stock' },
  { sku: 'RM-0251', item: 'BOPP film · 25 micron', category: 'Film', location: 'B-04', onHand: '1,260 kg', stock: 56, status: 'In stock' },
  { sku: 'RM-0089', item: 'Water-based ink · black', category: 'Ink', location: 'C-18', onHand: '32 kg', stock: 24, status: 'Low stock' },
  { sku: 'RM-0324', item: 'Packaging adhesive', category: 'Adhesive', location: 'D-09', onHand: '42 kg', stock: 13, status: 'Critical' },
  { sku: 'RM-0197', item: 'Mono-carton board', category: 'Board', location: 'B-22', onHand: '640 sheets', stock: 68, status: 'In stock' }
];
window.FactoryFlowInventory.ensureStockMetadata(materials);

const app = { view: 'dashboard', filter: 'All', language: localStorage.getItem('ff-language') || 'en' };
let workspaceReady = false;
let syncInFlight = false;
let inventoryForecast = null;
let forecastLoading = false;
let forecastRequestId = 0;
let scheduleOptimization = null;
let scheduleOptimizationLoading = false;
let scheduleOptimizationRequestId = 0;
const ui = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const stClass = (value) => ({ Sent: 'setup', Viewed: 'on-track', 'Follow up': 'delayed', Accepted: 'running', 'In production': 'running', 'With worker': 'on-track', 'Material pending': 'delayed', 'QC review': 'setup', 'In transit': 'on-track', Confirmed: 'running', 'Part received': 'setup', Received: 'in-stock', Draft: 'setup', Cancelled: 'critical', 'In stock': 'in-stock', 'Low stock': 'low', Critical: 'critical', 'Needs estimate': 'setup', 'Capacity gap': 'critical', 'Partially scheduled': 'low', 'Scheduled': 'on-track', 'Already covered': 'in-stock', Paid: 'in-stock', Overdue: 'critical', 'Due soon': 'low', 'Critical': 'critical', 'Reorder': 'low', 'Watch': 'low', 'Healthy': 'on-track', 'No history': 'setup', 'Needs data': 'critical' }[value] || 'setup');

const titles = {
  dashboard: ['JOB-WORK OS', 'Overview'], quotes: ['SALES', 'Quotes'], jobs: ['JOB CONTROL', 'Jobs'],
  purchases: ['PURCHASING', 'Purchase orders'], materials: ['RAW MATERIAL', 'Materials'],
  workers: ['PARTNERS', 'Job workers'], invoices: ['FINANCE', 'GST invoices'],
  marketplace: ['B2B NETWORK', 'Marketplace'], facilities: ['ORGANIZATION', 'Factory facilities'], forecast: ['INVENTORY INTELLIGENCE', 'Demand forecast & reorder'], users: ['ADMINISTRATION', 'User management'], machines: ['EQUIPMENT', 'Machines & equipment'], maintenance: ['EQUIPMENT HEALTH', 'Predictive maintenance'], 'work-orders': ['EQUIPMENT', 'Maintenance work orders'], 'maintenance-calendar': ['EQUIPMENT', 'Maintenance calendar'], planning: ['PRODUCTION', 'Material planning'], schedule: ['PRODUCTION', 'Production schedule'], execution: ['PRODUCTION', 'Production execution & QC'], analytics: ['MANAGEMENT', 'Production analytics'], costing: ['FINANCE', 'Job costing'], settings: ['WORKSPACE', 'Settings']
};

function save(shouldSync = true) {
  inventoryForecast = null;
  scheduleOptimization = null;
  scheduleOptimizationLoading = false;
  scheduleOptimizationRequestId += 1;
  forecastLoading = false;
  forecastRequestId += 1;
  localStorage.setItem('ff-quotes', JSON.stringify(quotes));
  localStorage.setItem('ff-jobs', JSON.stringify(jobs));
  localStorage.setItem('ff-deliveries', JSON.stringify(deliveries));
  localStorage.setItem('ff-receipts', JSON.stringify(receipts));
  localStorage.setItem('ff-movements', JSON.stringify(movements));
  localStorage.setItem('ff-requirements', JSON.stringify(requirements));
  localStorage.setItem('ff-workers', JSON.stringify(workers));
  localStorage.setItem('ff-schedules', JSON.stringify(schedules));
  localStorage.setItem('ff-production-logs', JSON.stringify(productionLogs));
  localStorage.setItem('ff-qc-inspections', JSON.stringify(qcInspections));
  localStorage.setItem('ff-rework-logs', JSON.stringify(reworkLogs));
  localStorage.setItem('ff-downtime-logs', JSON.stringify(downtimeLogs));
  localStorage.setItem('ff-machines', JSON.stringify(machines));
  localStorage.setItem('ff-maintenance-records', JSON.stringify(maintenanceRecords));
  localStorage.setItem('ff-maintenance-work-orders', JSON.stringify(maintenanceWorkOrders));
  localStorage.setItem('ff-maintenance-technicians', JSON.stringify(maintenanceTechnicians));
  localStorage.setItem('ff-gst-documents', JSON.stringify(gstDocuments));
  localStorage.setItem('ff-gst-profiles', JSON.stringify(gstProfiles));
  localStorage.setItem('ff-analytics-filters', JSON.stringify(analyticsFilters));
  localStorage.setItem('ff-language', app.language);
  ui('#quoteBadge').textContent = quotes.filter((quote) => quote.status === 'Follow up').length || '0';
  if (shouldSync && workspaceReady) syncWorkspace();
}

function setDataStatus(label, state) {
  const indicator = ui('#dataStatus');
  if (!indicator) return;
  indicator.textContent = label;
  indicator.dataset.state = state;
}

async function syncWorkspace() {
  const role = window.FactoryFlowAuth.state.user && window.FactoryFlowAuth.state.user.role;
  if (syncInFlight || location.protocol === 'file:' || !['admin', 'manager'].includes(role)) return;
  syncInFlight = true;
  setDataStatus('Saving…', 'pending');
  try {
    await window.FactoryFlowAuth.request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ quotes, jobs, purchases, materials, deliveries, receipts, movements, requirements, workers, schedules, productionLogs, qcInspections, reworkLogs, downtimeLogs, machines, maintenanceRecords, maintenanceWorkOrders, maintenanceTechnicians, gstDocuments, gstProfiles })
    });
    setDataStatus('Synced', 'online');
  } catch {
    setDataStatus('Sync error', 'offline');
  } finally {
    syncInFlight = false;
  }
}

async function hydrateWorkspace() {
  scheduleOptimization = null;
  scheduleOptimizationLoading = false;
  scheduleOptimizationRequestId += 1;
  if (location.protocol === 'file:') {
    setDataStatus('Authenticated server required', 'offline');
    workspaceReady = false;
    return;
  }
  setDataStatus('Connecting…', 'pending');
  try {
    let payload;
    try {
      payload = await window.FactoryFlowAuth.request('/api/bootstrap', {
        headers: { Accept: 'application/json' }
      });
    } catch (error) {
      if (!/not assigned to an active factory facility/i.test(error.message)) throw error;
      window.FactoryFlowAuth.clearActiveFacility();
      payload = await window.FactoryFlowAuth.request('/api/bootstrap', {
        headers: { Accept: 'application/json' }
      });
    }
    if (payload.auth) window.FactoryFlowAuth.update({
      ...payload.auth,
      facilities: payload.facilities || [],
      activeFacilityId: payload.activeFacilityId || ''
    });
    const remote = payload.state || {};
    const replace = (target, key) => target.splice(0, target.length, ...(Array.isArray(remote[key]) ? remote[key] : []));
    replace(quotes, 'quotes');
    replace(jobs, 'jobs');
    replace(purchases, 'purchases');
    replace(materials, 'materials');
    replace(deliveries, 'deliveries');
    replace(receipts, 'receipts');
    replace(movements, 'movements');
    replace(requirements, 'requirements');
    replace(workers, 'workers');
    replace(schedules, 'schedules');
    replace(productionLogs, 'productionLogs');
    replace(qcInspections, 'qcInspections');
    replace(reworkLogs, 'reworkLogs');
    replace(downtimeLogs, 'downtimeLogs');
    replace(machines, 'machines');
    replace(maintenanceRecords, 'maintenanceRecords');
    replace(maintenanceWorkOrders, 'maintenanceWorkOrders');
    replace(maintenanceTechnicians, 'maintenanceTechnicians');
    replace(gstDocuments, 'gstDocuments');
    replace(gstProfiles, 'gstProfiles');
    window.FactoryFlowInventory.ensureStockMetadata(materials);
    inventoryForecast = null;
    scheduleOptimization = null;
    scheduleOptimizationLoading = false;
    forecastLoading = false;
    forecastRequestId += 1;
    workspaceReady = true;
    save(false);
    setDataStatus('Synced', 'online');
  } catch {
    workspaceReady = false;
    setDataStatus('Sign-in required', 'offline');
  }
}

function head(eyebrow, title, description, action) {
  return '<div class="view-heading"><div><p class="eyebrow">' + eyebrow + '</p><h1>' + title + '</h1><p>' + description + '</p></div>' + (action || '') + '</div>';
}
function metric(label, value, sub, alert) {
  return '<article class="metric-card"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '</div><div class="metric-note ' + (alert ? 'down' : '') + '">' + (alert ? '!' : '↑') + ' ' + sub + '</div></article>';
}
function status(text) { return '<span class="status ' + stClass(text) + '">' + text + '</span>'; }
function schedule(time, name, detail, percent, warn) {
  return '<div class="schedule-item"><div class="schedule-time">' + time + '</div><div><div class="schedule-name">' + name + '</div><div class="schedule-detail">' + detail + '</div></div><div class="progress ' + (warn ? 'amber' : '') + '"><i style="width:' + percent + '%"></i></div></div>';
}

function workerDashboard() {
  const user = window.FactoryFlowAuth.state.user;
  const ownJobs = jobs.filter((job) => !['Delivered', 'Cancelled'].includes(job.status));
  const sessions = schedules.slice().sort((a, b) => a.date.localeCompare(b.date));
  const cards = ownJobs.map((job) => jobCard(job, job.due || job.status)).join('');
  return head('MY WORKSPACE', 'Welcome, ' + safe(user.name), 'Your assigned production work and schedule. Record actual output when your shift is complete.', '') +
    '<div class="inventory-grid"><article class="inventory-stat"><span>ASSIGNED JOBS</span><strong>' + ownJobs.length + '</strong><small>Active jobs visible to your account</small></article><article class="inventory-stat"><span>SCHEDULED SESSIONS</span><strong>' + sessions.length + '</strong><small>Your assigned production sessions</small></article><article class="inventory-stat"><span>OUTPUT ENTRIES</span><strong>' + productionLogs.length + '</strong><small>Your recorded output</small></article></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>My production jobs</strong></div>' +
    (cards ? '<div class="worker-capacity-grid">' + cards + '</div>' : '<div class="empty-state"><h2>No assigned jobs</h2><p>Ask your production supervisor to assign a job and schedule your shift.</p></div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>My scheduled sessions</strong></div>' +
    (sessions.length ? '<div class="schedule-list">' + sessions.map((session) => '<div class="schedule-item"><div class="schedule-time">' + safe(session.date) + '</div><div class="schedule-copy"><strong>' + safe(session.jobId) + '</strong><small>' + Number(session.hours).toFixed(1) + ' planned hours · ' + safe(session.note || 'Production') + '</small></div></div>').join('') + '</div>' : '<div class="empty-state">No production sessions scheduled yet.</div>') + '</section>';
}

function supervisorDashboard() {
  const activeJobs = jobs.filter((job) => !['Delivered', 'Cancelled'].includes(job.status));
  const produced = productionLogs.reduce((sum, entry) => sum + Number(entry.producedQty || 0), 0);
  const qcPending = activeJobs.filter((job) => job.status === 'QC review' || job.readyForDelivery).length;
  const scheduleCount = schedules.filter((session) => session.date >= localDateISO()).length;
  return head('PRODUCTION CONTROL', 'Factory operations', 'Monitor active work, production output, QC queues and today’s scheduled sessions.', '') +
    '<div class="inventory-grid"><article class="inventory-stat"><span>ACTIVE JOBS</span><strong>' + activeJobs.length + '</strong><small>Open production work</small></article><article class="inventory-stat"><span>OUTPUT RECORDED</span><strong>' + produced.toLocaleString('en-IN') + '</strong><small>Units across production logs</small></article><article class="inventory-stat"><span>QC QUEUE</span><strong>' + qcPending + '</strong><small>Jobs awaiting quality / release</small></article><article class="inventory-stat"><span>UPCOMING SESSIONS</span><strong>' + scheduleCount + '</strong><small>Today and future assignments</small></article></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Active production jobs</strong><button class="text-button" data-go="jobs">View jobs →</button></div>' +
    (activeJobs.length ? '<div class="worker-capacity-grid">' + activeJobs.slice(0, 8).map((job) => jobCard(job, job.due || job.status)).join('') + '</div>' : '<div class="empty-state">No active production jobs.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Production controls</strong></div><div class="user-admin-actions"><button class="secondary-button" data-go="schedule">Production schedule</button><button class="secondary-button" data-go="execution">Production & QC</button><button class="secondary-button" data-go="analytics">Performance analytics</button></div></section>';
}

function dashboard() {
  const hello = app.language === 'hi' ? 'नमस्ते, Sameer' : 'Namaste, Sameer';
  return head(new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase(), hello, app.language === 'hi' ? 'आज आपका काम, पैसा और माल एक जगह पर है।' : 'Your factory’s work, money, and material—at a glance.', '<button class="primary-button" data-new="quote">＋ New quote</button>') +
  '<section class="overview-grid"><div><div class="summary-cards">' +
  metric('QUOTE PIPELINE', '₹4.82L', '3 customer decisions pending') +
  metric('LIVE JOBS', '11', '2 due today') +
  metric('MATERIAL ALERTS', '2', 'reorder before afternoon shift', true) +
  metric('PAYMENTS DUE', '₹1.26L', '4 invoices need follow-up', true) +
  '</div><section class="panel"><header class="panel-header"><h2>From enquiry to payment</h2><button class="text-button" data-go="quotes">Open quotes →</button></header>' +
  '<div class="business-flow"><div><i>1</i><strong>Enquiry</strong><small>8 this week</small></div><b></b><div><i>2</i><strong>Quote</strong><small>3 pending</small></div><b></b><div><i>3</i><strong>Job</strong><small>11 live</small></div><b></b><div><i>4</i><strong>Delivery</strong><small>2 today</small></div><b></b><div><i>5</i><strong>Payment</strong><small>₹1.26L due</small></div></div></section>' +
  '<section class="panel" style="margin-top:20px"><header class="panel-header"><h2>Today’s job board</h2><button class="text-button" data-go="jobs">View all jobs →</button></header><div class="schedule-list">' +
  schedule('09:00', 'JB-841 · Corrugated carton run', 'Ravi Cartons · 12,000 units', 68) +
  schedule('12:30', 'JB-838 · Printed pouches', 'Aman Printworks · 8,000 units', 42) +
  schedule('15:00', 'JB-835 · Mono carton', 'Waiting for black ink receipt', 15, true) +
  '</div></section></div><div><section class="panel whatsapp-panel"><header class="panel-header"><h2>WhatsApp inbox</h2><span class="whatsapp-mark">◔</span></header><p>Share quotes, job updates, delivery proof, and payment reminders in the channel your buyers already use.</p><div class="message-preview"><span class="small-avatar">NF</span><div><strong>Narmada Foods</strong><small>“Please share the final pouch quote.”</small></div><time>10:42</time></div><button class="whatsapp-button" data-action="reply">◔ Reply on WhatsApp</button></section><section class="panel callout" style="margin-top:20px"><header class="panel-header"><h2>Buy together, save more</h2><span>◇</span></header><p>Join a verified group buy for kraft paper. Estimated saving: 7.5%.</p><button class="secondary-button" data-go="marketplace">See group buy</button></section></div></section>';
}

function quoteRows() {
  const query = (ui('#globalSearch').value || '').toLowerCase();
  const rows = quotes.filter((quote) => (app.filter === 'All' || quote.status === app.filter) && JSON.stringify(quote).toLowerCase().includes(query));
  if (!rows.length) return '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⌕</div><h2>No quotes found</h2><p>Try another search or create a fresh quote.</p></div></td></tr>';
  return rows.map((quote) => '<tr><td class="order-code">' + quote.id + '</td><td><div class="item-name">' + quote.customer + '</div><div class="subtle">' + quote.scope + '</div></td><td>' + quote.qty.toLocaleString() + ' units</td><td>' + currency(quote.value) + '</td><td>' + quote.valid + '</td><td>' + status(quote.status) + '</td><td class="table-actions"><button class="table-button" data-document="' + quote.id + '">View</button><button class="table-button" data-share="' + quote.id + '">WhatsApp</button><button class="row-menu" data-convert="' + quote.id + '" title="Convert to job">→</button></td></tr>').join('');
}
function quotesPage() {
  const tabs = ['All', 'Sent', 'Viewed', 'Follow up', 'Accepted'].map((label) => '<button class="filter-tab ' + (app.filter === label ? 'active' : '') + '" data-filter="' + label + '">' + label + (label === 'All' ? ' (' + quotes.length + ')' : '') + '</button>').join('');
  return head('SALES', 'Quotes that close work', 'Create a GST-ready quote, share it on WhatsApp, and turn acceptance into a job.', '<button class="primary-button" data-new="quote">＋ New quote</button>') +
  '<section class="content-card"><div class="toolbar"><div class="filter-tabs">' + tabs + '</div><button class="secondary-button" data-action="export">⇩ Export</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>QUOTE</th><th>CUSTOMER / SCOPE</th><th>QUANTITY</th><th>VALUE</th><th>VALID UNTIL</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody id="quotesBody">' + quoteRows() + '</tbody></table></div></section>';
}

function jobCard(job, note, warning) {
  const can = (permission) => window.FactoryFlowAuth.has(permission);
  if (!job) {
    return '<article class="work-card"><strong>No jobs in this stage</strong><p>Jobs will appear here as they move through production.</p>' + (can('jobs.manage') ? '<footer><button class="text-button" data-new="job">＋ Create job →</button></footer>' : '') + '</article>';
  }
  const proof = deliveries.find((delivery) => delivery.jobId === job.id);
  const consumeAction = can('materials.manage') && ['In production', 'With worker'].includes(job.status)
    ? '<button class="text-button" data-consume-job="' + safe(job.id) + '">Record material use →</button>' : '';
  const costAction = can('costing.view') ? '<button class="text-button" data-cost-job="' + safe(job.id) + '">View costing →</button>' : '';
  const planningAction = can('planning.manage') && !['Delivered', 'QC review', 'Cancelled'].includes(job.status) ? '<button class="text-button" data-plan-job="' + safe(job.id) + '">Plan materials →</button>' : '';
  const scheduleAction = can('schedule.manage') && !['Delivered', 'QC review', 'Cancelled'].includes(job.status) ? '<button class="text-button" data-schedule-job="' + safe(job.id) + '">Schedule production →</button>' : '';
  const executionAction = can('execution.record') && !['Delivered', 'Cancelled'].includes(job.status) && !job.readyForDelivery ? '<button class="text-button" data-execution-job="' + safe(job.id) + '">Record production output →</button>' : '';
  const deliveryAction = can('jobs.manage') && job.readyForDelivery
    ? (proof ? '<button class="text-button" data-view-proof="' + safe(job.id) + '">View delivery proof →</button>' : '<button class="text-button" data-proof-job="' + safe(job.id) + '">Add delivery proof →</button>') : '';
  const plannedSessions = schedules.filter((session) => session.jobId === job.id).length;
  const scheduleLabel = plannedSessions ? '<div class="subtle">' + plannedSessions + ' production session(s) scheduled</div>' : '';
  const actions = [consumeAction, planningAction, scheduleAction, executionAction, deliveryAction, costAction].filter(Boolean);
  return '<article class="work-card"><strong>' + safe(job.id) + ' · ' + safe(job.item) + '</strong><p>' + Number(job.qty || 0).toLocaleString('en-IN') + ' units · ' + safe(job.customer) + '</p>' + scheduleLabel + '<footer><span class="small-avatar">' + safe(job.owner || '') + '</span><span class="due ' + (warning ? 'warn' : '') + '">' + (proof ? '✓ Proof saved' : '◷ ') + safe(note || job.due || job.status) + '</span></footer>' + actions.map((action) => '<footer>' + action + '</footer>').join('') + '</article>';
}

function jobsPage() {
  const pendingJobs = jobs.filter((job) => !['In production', 'With worker', 'QC review', 'Delivered', 'Cancelled'].includes(job.status));
  const activeJobs = jobs.filter((job) => ['In production', 'With worker'].includes(job.status));
  const qcJobs = jobs.filter((job) => (job.status === 'QC review' || job.readyForDelivery) && !['Delivered', 'Cancelled'].includes(job.status));
  const pendingCards = pendingJobs.length ? pendingJobs.map((job) => jobCard(job, job.status, true)).join('') : jobCard(null);
  const activeCards = activeJobs.length ? activeJobs.map((job) => jobCard(job, job.due)).join('') : jobCard(null);
  const qcCards = qcJobs.length ? qcJobs.map((job) => jobCard(job, job.readyForDelivery ? 'QC cleared' : 'QC review')).join('') : jobCard(null);
  return head('JOB CONTROL', 'Jobs in motion', 'Assign job workers, track progress, and capture proof before delivery.', window.FactoryFlowAuth.has('jobs.manage') ? '<button class="primary-button" data-new="job">＋ Create job</button>' : '') +
    '<section class="kanban"><div class="kanban-column"><div class="kanban-title">READY TO ASSIGN <span class="kanban-count">' + pendingJobs.length + '</span></div>' + pendingCards + (window.FactoryFlowAuth.has('workers.view') ? '<article class="work-card"><strong>Assign a verified worker</strong><p>Match capacity, rate, and delivery promise in one place.</p><footer><button class="text-button" data-go="workers">Find workers →</button></footer></article>' : '') + '</div><div class="kanban-column"><div class="kanban-title">WITH JOB WORKER <span class="kanban-count">' + activeJobs.length + '</span></div>' + activeCards + '</div><div class="kanban-column"><div class="kanban-title">DELIVERY & QC <span class="kanban-count">' + qcJobs.length + '</span></div>' + qcCards + '</div></section>';
}

function purchasesPage() {
  const rows = purchases.map((po) => '<tr><td class="order-code">' + po.id + (po.planningGenerated ? '<div class="subtle">Shortage plan</div>' : '') + '</td><td class="item-name">' + safe(po.supplier) + '</td><td>' + safe(po.material) + (po.quantity ? '<div class="subtle">Ordered ' + Number(po.quantity).toLocaleString('en-IN') + ' ' + safe(po.unit) + ' · received ' + Number(po.receivedQty || 0).toLocaleString('en-IN') + ' ' + safe(po.unit) + ' · open ' + Math.max(0, Number(po.quantity) - Number(po.receivedQty || 0)).toLocaleString('en-IN') + ' ' + safe(po.unit) + '</div>' : '') + '</td><td>' + (po.amount === null || po.amount === undefined ? 'Not estimated' : currency(po.amount)) + '</td><td>' + safe(po.delivery) + '</td><td>' + status(po.status) + '</td><td><button class="table-button" data-action="po-update" data-purchase-id="' + safe(po.id) + '">Update</button></td></tr>').join('');
  return head('PURCHASING', 'Purchase orders', 'Keep every raw-material commitment and delivery date visible.', '<button class="primary-button" data-new="purchase">＋ New purchase order</button>') + '<section class="content-card"><div class="toolbar"><strong style="font-size:12px">Open purchase orders</strong><button class="secondary-button" data-go="marketplace">◇ Find suppliers</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>PO</th><th>SUPPLIER</th><th>MATERIAL</th><th>AMOUNT</th><th>DELIVERY</th><th>STATUS</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}

function loadInventoryForecast(force = false) {
  if (forecastLoading || (inventoryForecast && !force)) return;
  forecastLoading = true;
  const requestId = ++forecastRequestId;
  const facilityId = window.FactoryFlowAuth.state.activeFacilityId;
  window.FactoryFlowAuth.request('/api/inventory/forecast').then((payload) => {
    if (requestId !== forecastRequestId || facilityId !== window.FactoryFlowAuth.state.activeFacilityId) return;
    inventoryForecast = payload.forecast;
    forecastLoading = false;
    if (app.view === 'forecast') render();
  }).catch((error) => {
    if (requestId !== forecastRequestId || facilityId !== window.FactoryFlowAuth.state.activeFacilityId) return;
    forecastLoading = false;
    if (app.view === 'forecast') {
      ui('#view').innerHTML = head('INVENTORY INTELLIGENCE', 'Demand forecast & reorder', 'Forecast material demand and prepare controlled purchase drafts.', '<button class="secondary-button" data-refresh-forecast>↻ Retry</button>') +
        '<section class="content-card"><div class="empty-state"><h2>Forecast unavailable</h2><p>' + safe(error.message) + '</p></div></section>';
      bind();
    }
  });
}

function refreshInventoryForecast() {
  inventoryForecast = null;
  loadInventoryForecast(true);
  render();
}

function forecastPage() {
  if (!inventoryForecast && !forecastLoading) loadInventoryForecast();
  if (!inventoryForecast) {
    return head('INVENTORY INTELLIGENCE', 'Demand forecast & reorder', 'Use recent material consumption, supplier lead times and open purchase commitments to plan replenishment.', '') +
      '<section class="content-card"><div class="empty-state"><h2>' + (forecastLoading ? 'Calculating inventory forecast…' : 'Loading inventory forecast…') + '</h2><p>Demand estimates are based on recorded consumption history and current open purchase orders.</p></div></section>';
  }
  const report = inventoryForecast;
  const spendLabel = report.estimatedSpend === null ? 'Unit costs needed' : currency(report.estimatedSpend);
  const rows = report.items.map((item) => {
    const demand = item.averageDailyDemand > 0
      ? Number(item.averageDailyDemand).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '/day'
      : 'No usage history';
    const coverage = item.coverageDays === null ? '—' : Number(item.coverageDays).toFixed(1) + ' days';
    const order = Number(item.recommendedOrderQty || 0) > 0
      ? Number(item.recommendedOrderQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit)
      : '—';
    const cost = item.recommendedOrderCost === null || item.recommendedOrderCost === undefined
      ? (item.recommendedOrderQty > 0 ? 'Not estimated' : '—')
      : currency(item.recommendedOrderCost);
    const configure = window.FactoryFlowAuth.has('materials.manage')
      ? '<button class="table-button" data-forecast-settings="' + safe(item.materialSku) + '">Configure</button>'
      : '';
    const draft = item.reorderRecommended && item.recommendedOrderQty > 0 && window.FactoryFlowAuth.has('purchases.manage')
      ? '<button class="table-button" data-draft-forecast="' + safe(item.materialSku) + '">Create draft PO</button>'
      : item.reorderRecommended ? '<span class="status low">Reorder</span>' : '';
    const issueNote = item.issues && item.issues.length
      ? '<div class="subtle">' + safe(item.issues.length + ' data issue(s)') + '</div>'
      : '';
    return '<tr><td><div class="item-name">' + safe(item.material) + '</div><div class="subtle">' + safe(item.materialSku) + ' · ' + safe(item.dataQuality) + '</div>' + issueNote + '</td>' +
      '<td>' + safe(item.onHandQty === null ? 'Invalid stock' : Number(item.onHandQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + item.unit) + '</td>' +
      '<td>' + demand + (item.recentDailyDemand > 0 ? '<div class="subtle">Recent ' + Number(item.recentDailyDemand).toFixed(2) + '/day</div>' : '') + '</td>' +
      '<td>' + Number(item.leadTimeDays || 0) + ' days<div class="subtle">Safety ' + Number(item.safetyStockDays || 0) + ' days</div></td>' +
      '<td>' + (item.incomingQty > 0 ? Number(item.incomingQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) : '—') + '</td>' +
      '<td>' + coverage + '</td><td>' + status(item.status) + '</td><td><strong>' + order + '</strong></td><td>' + cost + '</td>' +
      '<td><div class="forecast-actions">' + configure + draft + '</div></td></tr>';
  }).join('');
  const historyText = report.lookbackDays + '-day consumption window · weighted recent 7-day usage · updated ' + new Date(report.generatedAt).toLocaleString('en-IN');
  return head('INVENTORY INTELLIGENCE', 'Demand forecast & reorder', 'Estimate when materials may run short and create controlled procurement drafts before production is interrupted.', '<button class="secondary-button" data-refresh-forecast>↻ Refresh forecast</button>') +
    '<div class="inventory-grid"><article class="inventory-stat"><span>TRACKED MATERIALS</span><strong>' + report.materialCount + '</strong><small>In the selected facility</small></article>' +
    '<article class="inventory-stat"><span>REORDER RECOMMENDATIONS</span><strong>' + report.reorderCount + '</strong><small>After open purchase commitments</small></article>' +
    '<article class="inventory-stat"><span>CRITICAL STOCK RISK</span><strong>' + report.criticalCount + '</strong><small>Projected to run out before supplier lead time</small></article>' +
    '<article class="inventory-stat"><span>ESTIMATED REORDER VALUE</span><strong>' + spendLabel + '</strong><small>Based on configured unit costs</small></article></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Material demand and replenishment</strong><span class="subtle">' + safe(historyText) + '</span></div>' +
    (rows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>MATERIAL</th><th>ON HAND</th><th>DAILY DEMAND</th><th>LEAD / SAFETY</th><th>INCOMING</th><th>COVERAGE</th><th>RISK</th><th>RECOMMENDED ORDER</th><th>EST. COST</th><th>ACTIONS</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state"><h2>No tracked materials</h2><p>Add materials before generating a demand forecast.</p></div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">How recommendations are calculated</strong></div><p class="subtle">Demand is estimated from recorded material consumption in the selected lookback window, weighted toward recent usage. Reorder points cover supplier lead time plus safety stock; the recommended order also covers the review period. Confirmed, in-transit and partially received purchase orders reduce the recommendation. Draft orders are excluded until confirmed.</p><p class="subtle">Materials without recorded consumption use their existing reorder level and are clearly marked “No history”. Forecasts are advisory estimates, not demand commitments.</p></section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Data quality</strong><span class="subtle">' + report.noHistoryCount + ' material(s) without history · ' + report.watchCount + ' watch item(s)</span></div><p class="subtle">Check incomplete movement history, unusual unit mismatches and missing unit costs before converting a forecast recommendation into a purchase order.</p></section>';
}

function configureForecastSettings(materialSku) {
  const material = materials.find((item) => item.sku === materialSku);
  if (!material) return;
  const lead = Number.isInteger(Number(material.leadTimeDays)) ? Number(material.leadTimeDays) : 7;
  const safety = Number.isInteger(Number(material.safetyStockDays)) ? Number(material.safetyStockDays) : 7;
  const review = Number.isInteger(Number(material.reviewPeriodDays)) ? Number(material.reviewPeriodDays) : 7;
  const minimum = Number.isFinite(Number(material.minimumOrderQty)) ? Number(material.minimumOrderQty) : 0;
  const multiple = Number.isFinite(Number(material.orderMultiple)) && Number(material.orderMultiple) > 0 ? Number(material.orderMultiple) : 1;
  openModal('<h2 id="modalTitle">Forecast settings · ' + safe(material.sku) + '</h2><p>' + safe(material.item) + '</p><form id="forecastSettingsForm" class="form-grid"><div class="form-row"><label>Supplier lead time (days)<input required name="leadTimeDays" type="number" min="0" max="365" step="1" value="' + lead + '"></label><label>Safety stock (days)<input required name="safetyStockDays" type="number" min="0" max="365" step="1" value="' + safety + '"></label></div><label>Review period (days)<input required name="reviewPeriodDays" type="number" min="1" max="90" step="1" value="' + review + '"></label><div class="form-row"><label>Minimum order quantity<input required name="minimumOrderQty" type="number" min="0" step="0.01" value="' + minimum + '"></label><label>Order multiple / pack size<input required name="orderMultiple" type="number" min="0.001" step="0.01" value="' + multiple + '"></label></div><label>Preferred supplier<input name="preferredSupplier" maxlength="120" value="' + safe(material.preferredSupplier || '') + '" placeholder="Supplier name"></label><p class="subtle">Order quantities are rounded up to the supplier’s minimum and pack multiple. These settings affect recommendations, not purchase orders already placed.</p><p id="forecastSettingsError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save forecast settings</button></div></form>');
  ui('#forecastSettingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      leadTimeDays: Number(data.get('leadTimeDays')),
      safetyStockDays: Number(data.get('safetyStockDays')),
      reviewPeriodDays: Number(data.get('reviewPeriodDays')),
      minimumOrderQty: Number(data.get('minimumOrderQty')),
      orderMultiple: Number(data.get('orderMultiple')),
      preferredSupplier: data.get('preferredSupplier').trim()
    };
    try {
      const result = await window.FactoryFlowAuth.request('/api/materials/' + encodeURIComponent(material.sku) + '/forecast-settings', {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      Object.assign(material, result.material);
      inventoryForecast = null;
      closeModal();
      render();
      notify('Forecast settings saved for ' + material.item + '.');
    } catch (error) {
      const node = ui('#forecastSettingsError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

async function createForecastDraft(materialSku) {
  try {
    const result = await window.FactoryFlowAuth.request('/api/procurement/drafts', {
      method: 'POST',
      body: JSON.stringify({ materialSku })
    });
    if (!purchases.some((purchase) => purchase.id === result.purchase.id)) purchases.unshift(result.purchase);
    inventoryForecast = null;
    save(false);
    goto('purchases');
    notify(result.existing ? 'Forecast draft already exists: ' + result.purchase.id : 'Draft ' + result.purchase.id + ' created. Review supplier and delivery date before confirming.');
  } catch (error) {
    notify(error.message);
    refreshInventoryForecast();
  }
}

function materialsPage() {
  const low = materials.filter((item) => item.status !== 'In stock').length;
  const rows = materials.map((item) => {
    const parsed = window.FactoryFlowInventory.parseQuantity(item.onHand);
    const cost = item.unitCost !== null && item.unitCost !== undefined && item.unitCost !== '' && Number.isFinite(Number(item.unitCost))
      ? currency(Number(item.unitCost)) + ' / ' + (parsed ? parsed.unitLabel : 'unit')
      : 'Not set';
    return '<tr><td class="order-code">' + safe(item.sku) + '</td><td class="item-name">' + safe(item.item) + (item.maintenancePart ? '<div class="mwo-spare-badge">Maintenance spare</div>' : '') + '</td><td>' + safe(item.category) + '</td><td>' + safe(item.location) + '</td><td>' + safe(item.onHand) + '</td><td><div class="stock-bar ' + (item.status === 'Critical' ? 'critical' : item.status === 'Low stock' ? 'warn' : '') + '"><i style="width:' + item.stock + '%"></i></div></td><td>' + status(item.status) + '</td><td>' + cost + '' + (window.FactoryFlowAuth.has('materials.manage') ? '<div class="material-actions"><button class="table-button" data-unit-cost="' + safe(item.sku) + '">Set cost</button><button class="table-button" data-toggle-spare="' + safe(item.sku) + '">' + (item.maintenancePart ? 'Remove spare flag' : 'Mark spare part') + '</button></div>' : '') + '</td></tr>';
  }).join('');
  const actions = '<button class="secondary-button" data-go="forecast">Demand forecast →</button>' + (window.FactoryFlowAuth.has('purchases.manage') ? '<button class="primary-button" data-new="purchase">＋ Purchase material</button>' : '');
  return head('RAW MATERIAL', 'Material you can trust', 'See stock health early, before a job worker or customer has to wait.', actions) + '<div class="inventory-grid"><article class="inventory-stat"><span>TRACKED MATERIALS</span><strong>' + materials.length + '</strong><small>Inventory records</small></article><article class="inventory-stat"><span>REORDER ALERTS</span><strong>' + low + '</strong><small>Needs a purchase order today</small></article><article class="inventory-stat"><span>STOCK MOVEMENTS</span><strong>' + movements.length + '</strong><small>Receipts and production usage</small></article></div><section class="content-card"><div class="toolbar"><strong style="font-size:12px">Stock by material</strong>' + (window.FactoryFlowAuth.has('materials.manage') ? '<button class="secondary-button" data-action="receive">＋ Receive material</button>' : '') + '</div><div class="table-scroll"><table class="data-table"><thead><tr><th>SKU</th><th>MATERIAL</th><th>CATEGORY</th><th>LOCATION</th><th>ON HAND</th><th>STOCK LEVEL</th><th>STATUS</th><th>UNIT COST</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
  '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Recent material receipts</strong><span class="subtle">' + receipts.length + ' recorded</span></div>' +
  (receipts.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>RECEIPT</th><th>PURCHASE ORDER</th><th>SUPPLIER / MATERIAL</th><th>QUANTITY</th><th>STOCK AFTER</th><th>REFERENCE</th><th>DATE</th></tr></thead><tbody>' + receipts.slice(0, 10).map((receipt) => '<tr><td class="order-code">' + safe(receipt.id) + '</td><td>' + safe(receipt.purchaseId) + '</td><td><div class="item-name">' + safe(receipt.supplier) + '</div><div class="subtle">' + safe(receipt.material) + '</div></td><td>' + receipt.quantity + ' ' + safe(receipt.unit) + '</td><td>' + safe(receipt.stockAfter || '—') + '</td><td>' + safe(receipt.reference || '—') + '</td><td>' + new Date(receipt.receivedAt).toLocaleDateString('en-IN') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty-state"><h2>No receipts recorded</h2><p>Use “Receive material” to record the next supplier delivery.</p></div>') + '</section>' +
  '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Stock movement history</strong><span class="subtle">' + movements.length + ' movements</span></div>' +
  (movements.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>MOVEMENT</th><th>TYPE</th><th>MATERIAL</th><th>QUANTITY</th><th>COST</th><th>JOB / REFERENCE</th><th>STOCK BEFORE</th><th>STOCK AFTER</th><th>DATE</th></tr></thead><tbody>' + movements.slice(0, 20).map((movement) => '<tr><td class="order-code">' + safe(movement.id) + '</td><td>' + safe(movement.type) + '</td><td><div class="item-name">' + safe(movement.material) + '</div><div class="subtle">' + safe(movement.materialSku || '') + '</div></td><td><span class="' + (movement.direction === 'OUT' ? 'down' : 'up') + '">' + (movement.direction === 'OUT' ? '−' : '+') + Number(movement.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(movement.unit) + '</span></td><td>' + (movement.costAmount !== null && movement.costAmount !== undefined && Number.isFinite(Number(movement.costAmount)) ? currency(Number(movement.costAmount)) : (movement.type === 'Consumption' ? 'Unpriced' : '—')) + '</td><td>' + safe(movement.jobId || movement.reference || '—') + '</td><td>' + safe(movement.stockBefore || '—') + '</td><td>' + safe(movement.stockAfter || '—') + '</td><td>' + new Date(movement.createdAt).toLocaleDateString('en-IN') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty-state"><h2>No stock movements recorded</h2><p>Receiving material and recording production usage will create an audit trail here.</p></div>') + '</section>';
}

function planJobMaterials(jobId, materialSku) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || ['Delivered', 'QC review', 'Cancelled'].includes(job.status)) {
    notify('Material requirements can only be planned for active jobs.');
    return;
  }
  if (!materials.length) {
    notify('Add inventory materials before planning requirements.');
    return;
  }
  const existing = requirements.filter((item) => item.jobId === job.id);
  const currentRequirement = existing.find((item) => !materialSku || item.materialSku === materialSku);
  const options = materials.map((material) => '<option value="' + safe(material.sku) + '"' + (currentRequirement && currentRequirement.materialSku === material.sku ? ' selected' : '') + '>' + safe(material.sku + ' · ' + material.item + ' · ' + material.onHand) + '</option>').join('');
  const form = '<h2 id="modalTitle">Plan job materials · ' + safe(job.id) + '</h2><p>' + safe(job.customer + ' · ' + job.item) + '</p><form id="requirementForm" class="form-grid"><label>Material<select required name="materialSku">' + options + '</select></label><label>Required quantity<input required name="quantity" type="number" min="0.01" step="0.01" value="' + (currentRequirement ? safe(currentRequirement.quantity) : '') + '" placeholder="e.g. 250"></label><label>Unit<input required name="unit" value="' + (currentRequirement ? safe(currentRequirement.unit) : '') + '" placeholder="kg, sheets, rolls…"></label><p class="subtle">One material requirement is stored per job and material. Saving the same material again updates that job’s requirement; it does not create a duplicate.</p><p id="requirementError" class="form-error" hidden></p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save requirement</button></div></form>';
  openModal(form, true);
  ui('#requirementForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = window.FactoryFlowPlanning.upsertRequirement(requirements, jobs, materials, {
        jobId: job.id,
        materialSku: data.get('materialSku'),
        quantity: Number(data.get('quantity')),
        unit: data.get('unit')
      });
      save();
      closeModal();
      goto('planning');
      notify((result.updated ? 'Requirement updated for ' : 'Requirement saved for ') + job.id + '.');
    } catch (error) {
      const element = ui('#requirementError');
      element.textContent = error.message;
      element.hidden = false;
    }
  });
}

function createShortagePurchaseOrder(materialSku) {
  const plan = window.FactoryFlowPlanning.calculatePlan(jobs, requirements, materials, purchases, movements);
  const shortage = plan.shortages.find((item) => item.materialSku === materialSku);
  if (!shortage || shortage.shortageQty <= 0) {
    notify('There is no outstanding shortage for this material.');
    return;
  }
  const material = materials.find((item) => item.sku === materialSku);
  if (!material) return;
  const existingDraft = purchases.find((purchase) => purchase.planningGenerated && purchase.materialSku === materialSku && purchase.status === 'Draft');
  if (existingDraft) {
    notify('A draft shortage purchase order already exists: ' + existingDraft.id + '. Confirm it or update its supplier before creating another.');
    return;
  }
  const amount = shortage.unitCost === null ? null : Math.round(shortage.shortageQty * shortage.unitCost * 100) / 100;
  const po = {
    id: 'PO-' + (492 + purchases.length),
    supplier: 'Supplier to assign',
    material: material.item,
    materialSku: material.sku,
    quantity: shortage.shortageQty,
    receivedQty: 0,
    unit: shortage.unit,
    amount,
    delivery: 'To confirm',
    status: 'Draft',
    planningGenerated: true,
    createdAt: new Date().toISOString()
  };
  purchases.unshift(po);
  save();
  goto('purchases');
  notify('Draft ' + po.id + ' created for ' + shortage.shortageQty + ' ' + shortage.unit + ' of ' + material.item + '.');
}

function planningPage() {
  const plan = window.FactoryFlowPlanning.calculatePlan(jobs, requirements, materials, purchases, movements);
  const shortageRows = plan.byMaterial.map((item) => {
    const costLabel = item.estimatedShortageCost === null ? 'Set unit cost for estimate' : currency(item.estimatedShortageCost);
    const hasDraft = purchases.some((purchase) => purchase.planningGenerated && purchase.materialSku === item.materialSku && purchase.status === 'Draft');
    const action = item.shortageQty > 0
      ? (hasDraft ? '<span class="status setup">Draft PO · confirm to count</span>' : (window.FactoryFlowAuth.has('planning.manage') ? '<button class="table-button" data-shortage-po="' + safe(item.materialSku) + '">Create draft PO</button>' : '<span class="status critical">Shortage</span>'))
      : '<span class="status on-track">Covered</span>';
    return '<tr><td><div class="item-name">' + safe(item.material) + '</div><div class="subtle">' + safe(item.materialSku) + '</div></td><td>' + Number(item.plannedQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</td><td>' + Number(item.consumedQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</td><td><strong>' + Number(item.requiredQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</strong></td><td>' + Number(item.availableQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</td><td>' + Number(item.incomingQty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</td><td><strong>' + Number(item.shortageQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</strong></td><td>' + item.coveragePercent.toFixed(1) + '%</td><td>' + costLabel + '</td><td>' + action + '</td></tr>';
  }).join('');
  const requirementRows = plan.jobRequirements.map((item) =>
    '<tr><td class="order-code">' + safe(item.jobId) + '</td><td>' + safe(item.customer) + '<div class="subtle">' + safe(item.job) + '</div></td><td>' + safe(item.material) + '<div class="subtle">' + safe(item.materialSku) + '</div></td><td>' + Number(item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</td><td>' + Number(item.consumedQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</td><td>' + Number(item.remainingQty).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + safe(item.unit) + '</td><td>' + (window.FactoryFlowAuth.has('planning.manage') ? '<button class="table-button" data-plan-job="' + safe(item.jobId) + '" data-plan-sku="' + safe(item.materialSku) + '">Edit plan</button>' : '') + '</td></tr>'
  ).join('');
  const issueRows = plan.issues.map((issue) => '<li>' + safe(issue.jobId + ': ' + issue.message) + '</li>').join('');
  return head('PRODUCTION', 'Material planning', 'Plan material requirements by job, subtract material already consumed, and check remaining demand against stock and committed purchase orders.', window.FactoryFlowAuth.has('planning.manage') ? '<button class="primary-button" data-plan-create>Select job to plan</button>' : '') +
    '<div class="inventory-grid"><article class="inventory-stat"><span>ACTIVE JOBS</span><strong>' + plan.activeJobCount + '</strong><small>Included in material demand</small></article><article class="inventory-stat"><span>REQUIREMENTS</span><strong>' + plan.requirementCount + '</strong><small>Job material lines</small></article><article class="inventory-stat"><span>MATERIAL SHORTAGES</span><strong>' + plan.shortages.length + '</strong><small>After available stock and open POs</small></article></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Combined material requirements</strong><span class="subtle">Shared stock is counted once; recorded job consumption reduces remaining demand</span></div>' +
    (plan.byMaterial.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>MATERIAL</th><th>PLANNED</th><th>USED</th><th>REMAINING</th><th>ON HAND</th><th>ON ORDER</th><th>SHORTAGE</th><th>COVERAGE</th><th>EST. SHORTAGE COST</th><th></th></tr></thead><tbody>' + shortageRows + '</tbody></table></div>' : '<div class="empty-state"><h2>No material requirements yet</h2><p>Add requirements from a job card or use the button above.</p></div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Requirements by job</strong><span class="subtle">' + plan.jobRequirements.length + ' active lines</span></div>' +
    (requirementRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>JOB</th><th>CUSTOMER / WORK</th><th>MATERIAL</th><th>PLANNED</th><th>USED</th><th>REMAINING</th><th></th></tr></thead><tbody>' + requirementRows + '</tbody></table></div>' : '<div class="empty-state"><h2>No active job requirements</h2><p>Open a job and select “Plan materials” to add the bill of materials.</p></div>') + '</section>' +
    (plan.issues.length ? '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Planning issues</strong></div><ul>' + issueRows + '</ul></section>' : '') +
    '';
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function executionSummary(job) {
  return window.FactoryFlowExecution.summarizeJob(job, productionLogs, qcInspections, reworkLogs);
}

function recordProductionOutput(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || ['Delivered', 'Cancelled'].includes(job.status)) {
    notify('Production output can only be recorded for an open job.');
    return;
  }
  const activeWorkers = workers.filter((worker) => worker.active !== false);
  if (!activeWorkers.length) {
    notify('No active worker profile is linked to your account or job.');
    return;
  }
  const preferred = activeWorkers.find((worker) => worker.name === job.worker) || activeWorkers[0];
  const workerOptions = activeWorkers.map((worker) => '<option value="' + safe(worker.id) + '"' + (preferred.id === worker.id ? ' selected' : '') + '>' + safe(worker.name + ' · ' + worker.skill) + '</option>').join('');
  const scheduledSessions = schedules.filter((session) => session.jobId === job.id && activeWorkers.some((worker) => worker.id === session.workerId));
  const workerAccount = window.FactoryFlowAuth.state.user.role === 'worker';
  const sessionOptions = (workerAccount ? '' : '<option value="">Not linked to a scheduled session</option>') + scheduledSessions.map((session) => {
    const worker = workers.find((item) => item.id === session.workerId);
    return '<option value="' + safe(session.id) + '">' + safe(session.date + ' · ' + (worker ? worker.name : session.workerName) + ' · ' + Number(session.hours).toFixed(1) + ' planned hrs') + '</option>';
  }).join('');
  const date = localDateISO();
  openModal('<h2 id="modalTitle">Record production output · ' + safe(job.id) + '</h2><p>' + safe(job.customer + ' · ' + job.item + ' · target ' + Number(job.qty).toLocaleString('en-IN')) + '</p><form id="productionEntryForm" class="form-grid"><label>Worker<select name="workerId" required>' + workerOptions + '</select></label><label>Scheduled session' + (workerAccount ? ' (required)' : ' (optional)') + '<select name="scheduleId"' + (workerAccount ? ' required' : '') + '>' + sessionOptions + '</select></label><div class="form-row"><label>Production date<input required type="date" name="productionDate" value="' + date + '"></label><label>Shift<select name="shift"><option>Day</option><option>Evening</option><option>Night</option></select></label></div><div class="form-row"><label>Total produced units<input required type="number" min="1" step="1" name="producedQty" placeholder="e.g. 2500"></label><label>Actual hours worked<input required type="number" min="0.25" max="24" step="0.25" name="actualHours" placeholder="e.g. 7.5"></label></div><div class="form-row"><label>Good units<input required type="number" min="0" step="1" name="goodQty" value="0"></label><label>Rejected units<input required type="number" min="0" step="1" name="rejectedQty" value="0"></label></div><label>Production notes<input name="notes" placeholder="Machine, batch or shift notes"></label><p class="subtle">Good + rejected units must equal total produced. The server checks your role, worker assignment and linked session.</p><p id="productionError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save production entry</button></div></form>');
  ui('#productionEntryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/operations/production', {
        method: 'POST',
        body: JSON.stringify({
          jobId: job.id,
          workerId: data.get('workerId'),
          scheduleId: data.get('scheduleId'),
          productionDate: data.get('productionDate'),
          shift: data.get('shift'),
          producedQty: Number(data.get('producedQty')),
          actualHours: Number(data.get('actualHours')),
          goodQty: Number(data.get('goodQty')),
          rejectedQty: Number(data.get('rejectedQty')),
          notes: data.get('notes')
        })
      });
      const index = jobs.findIndex((item) => item.id === result.job.id);
      if (index >= 0) jobs.splice(index, 1, result.job);
      else jobs.unshift(result.job);
      productionLogs.splice(0, productionLogs.length, ...(result.productionLogs || []));
      save(false);
      closeModal();
      goto('execution');
      notify(result.record.id + ' saved. ' + result.record.producedQty.toLocaleString('en-IN') + ' units recorded.');
    } catch (error) {
      const element = ui('#productionError');
      element.textContent = error.message;
      element.hidden = false;
    }
  });
}

function inspectProduction(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || ['Delivered', 'Cancelled'].includes(job.status)) {
    notify('QC can only be recorded for an open job.');
    return;
  }
  const totals = window.FactoryFlowExecution.productionTotals(productionLogs, job.id);
  if (!totals.producedQty) {
    notify('Record production output before performing QC.');
    return;
  }
  const reworkSources = qcInspections.filter((inspection) => inspection.jobId === job.id && inspection.disposition === 'Rework');
  const sourceOptions = reworkSources.map((inspection) => {
    const worked = reworkLogs.filter((record) => record.qcInspectionId === inspection.id).reduce((sum, record) => sum + Number(record.recoveredQty || 0), 0);
    const inspected = qcInspections.filter((item) => item.inspectionType === 'Reinspection' && item.sourceInspectionId === inspection.id).reduce((sum, item) => sum + Number(item.inspectedQty || 0), 0);
    return '<option value="' + safe(inspection.id) + '">' + safe(inspection.id + ' · ' + Math.max(0, worked - inspected) + ' recovered unit(s) pending') + '</option>';
  }).join('');
  openModal('<h2 id="modalTitle">Quality inspection · ' + safe(job.id) + '</h2><p>' + safe(job.customer + ' · ' + job.item) + ' · produced ' + totals.producedQty.toLocaleString('en-IN') + ' units</p><form id="qcInspectionForm" class="form-grid"><label>Inspection type<select name="inspectionType"><option value="Initial">Initial inspection</option>' + (sourceOptions ? '<option value="Reinspection">Reinspect recovered units</option>' : '') + '</select></label><label id="reinspectionSourceLabel" hidden>Source rework inspection<select name="sourceInspectionId">' + sourceOptions + '</select></label><label>Inspector<input required name="inspector" placeholder="Inspector name"></label><div class="form-row"><label>Inspected quantity<input required name="inspectedQty" type="number" min="1" step="1" placeholder="e.g. 500"></label><label>Passed quantity<input required name="passedQty" type="number" min="0" step="1" value="0"></label></div><label>Failed quantity<input required name="failedQty" type="number" min="0" step="1" value="0"></label><label>Failed-unit disposition<select name="disposition"><option value="Rework">Send for rework</option><option value="Reject">Reject / scrap</option></select></label><label>Defect category<select name="defectCategory"><option>Print defect</option><option>Dimension / size</option><option>Lamination / adhesion</option><option>Material damage</option><option>Finishing defect</option><option>Other</option></select></label><label>Inspection notes<input name="notes" placeholder="Sampling method, defect details or observations"></label><p class="subtle">Passed + failed must equal inspected quantity. The server validates inspection coverage and disposition.</p><p id="qcError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save inspection</button></div></form>');
  const typeSelect = ui('#qcInspectionForm [name="inspectionType"]');
  const sourceLabel = ui('#reinspectionSourceLabel');
  const sourceSelect = ui('#qcInspectionForm [name="sourceInspectionId"]');
  const updateSourceVisibility = () => {
    const reinspection = typeSelect.value === 'Reinspection';
    sourceLabel.hidden = !reinspection;
    sourceSelect.required = reinspection;
  };
  typeSelect.addEventListener('change', updateSourceVisibility);
  updateSourceVisibility();
  ui('#qcInspectionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/operations/qc', {
        method: 'POST',
        body: JSON.stringify({
          jobId: job.id,
          inspectionType: data.get('inspectionType'),
          sourceInspectionId: data.get('sourceInspectionId'),
          inspectedQty: Number(data.get('inspectedQty')),
          passedQty: Number(data.get('passedQty')),
          failedQty: Number(data.get('failedQty')),
          disposition: data.get('disposition'),
          defectCategory: data.get('defectCategory'),
          inspector: data.get('inspector'),
          notes: data.get('notes')
        })
      });
      qcInspections.splice(0, qcInspections.length, ...(result.qcInspections || []));
      save(false);
      closeModal();
      goto('execution');
      notify(result.record.id + ' saved. QC disposition: ' + result.record.disposition + '.');
    } catch (error) {
      const element = ui('#qcError');
      element.textContent = error.message;
      element.hidden = false;
    }
  });
}

function recordRework(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || ['Delivered', 'Cancelled'].includes(job.status)) return notify('Choose an open production job.');
  const options = qcInspections.filter((inspection) => inspection.jobId === job.id && inspection.disposition === 'Rework').map((inspection) => {
    const totals = reworkLogs.filter((record) => record.qcInspectionId === inspection.id).reduce((sum, record) => {
      sum.reworked += Number(record.reworkedQty || 0);
      sum.recovered += Number(record.recoveredQty || 0);
      sum.scrapped += Number(record.scrappedQty || 0);
      return sum;
    }, { reworked: 0, recovered: 0, scrapped: 0 });
    const pending = Math.max(0, Number(inspection.failedQty) - totals.reworked);
    return pending > 0 ? '<option value="' + safe(inspection.id) + '">' + safe(inspection.id + ' · ' + pending + ' pending defect unit(s)') + '</option>' : '';
  }).filter(Boolean).join('');
  if (!options) return notify('There are no pending rework units for this job.');
  openModal('<h2 id="modalTitle">Record rework · ' + safe(job.id) + '</h2><p>Record reworked units and separate recovered units from scrapped units.</p><form id="reworkForm" class="form-grid"><label>QC inspection<select required name="qcInspectionId">' + options + '</select></label><label>Total units reworked<input required name="reworkedQty" type="number" min="1" step="1" placeholder="e.g. 40"></label><div class="form-row"><label>Recovered units<input required name="recoveredQty" type="number" min="0" step="1" value="0"></label><label>Scrapped units<input required name="scrappedQty" type="number" min="0" step="1" value="0"></label></div><label>Rework notes<input name="notes" placeholder="Corrective action or machine adjustment"></label><p class="subtle">Recovered + scrapped must equal total reworked. Recovered units must be reinspected before the job can be released.</p><p id="reworkError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save rework result</button></div></form>');
  ui('#reworkForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/operations/rework', {
        method: 'POST',
        body: JSON.stringify({
          qcInspectionId: data.get('qcInspectionId'),
          reworkedQty: Number(data.get('reworkedQty')),
          recoveredQty: Number(data.get('recoveredQty')),
          scrappedQty: Number(data.get('scrappedQty')),
          notes: data.get('notes')
        })
      });
      reworkLogs.splice(0, reworkLogs.length, ...(result.reworkLogs || []));
      save(false);
      closeModal();
      goto('execution');
      notify(result.record.id + ' saved. ' + result.record.recoveredQty + ' recovered unit(s) await reinspection.');
    } catch (error) {
      const element = ui('#reworkError');
      element.textContent = error.message;
      element.hidden = false;
    }
  });
}

async function releaseJobForDelivery(jobId) {
  try {
    const result = await window.FactoryFlowAuth.request('/api/operations/release', {
      method: 'POST',
      body: JSON.stringify({ jobId })
    });
    const index = jobs.findIndex((item) => item.id === result.job.id);
    if (index >= 0) jobs.splice(index, 1, result.job);
    save(false);
    render();
    notify(jobId + ' passed production/QC release checks. Delivery proof can now be recorded.');
    return result;
  } catch (error) {
    notify(error.message);
    return null;
  }
}

function executionPage() {
  const openJobs = window.FactoryFlowExecution.activeJobs(jobs);
  const summaries = openJobs.map((job) => ({ job, summary: executionSummary(job) }));
  const totalProduced = summaries.reduce((sum, item) => sum + item.summary.producedQty, 0);
  const totalGood = summaries.reduce((sum, item) => sum + item.summary.goodQty, 0);
  const totalRejected = summaries.reduce((sum, item) => sum + item.summary.rejectedQty, 0);
  const pendingRework = summaries.reduce((sum, item) => sum + item.summary.pendingReworkQty, 0);
  const rows = summaries.map(({ job, summary }) => {
    const releaseAction = window.FactoryFlowAuth.has('jobs.manage') && job.readyForDelivery
      ? '<button class="table-button" data-delivery-proof="' + safe(job.id) + '">Add delivery proof</button>'
      : window.FactoryFlowAuth.has('execution.qc') && !job.readyForDelivery
        ? '<button class="table-button" data-release-job="' + safe(job.id) + '">Release check</button>'
        : '';
    return '<tr><td class="order-code">' + safe(job.id) + '<div class="subtle">' + safe(job.customer) + '</div></td><td><div class="item-name">' + safe(job.item) + '</div><div class="subtle">Target ' + summary.targetQty.toLocaleString('en-IN') + '</div></td><td>' + summary.producedQty.toLocaleString('en-IN') + '<div class="subtle">' + summary.productionProgress + '% produced</div></td><td>' + summary.goodQty.toLocaleString('en-IN') + '</td><td>' + summary.rejectedQty.toLocaleString('en-IN') + '</td><td>' + summary.acceptedQty.toLocaleString('en-IN') + '</td><td>' + summary.pendingReworkQty.toLocaleString('en-IN') + '</td><td><div class="execution-actions">' + (window.FactoryFlowAuth.has('execution.record') ? '<button class="table-button" data-production-job="' + safe(job.id) + '">Record output</button>' : '') + (window.FactoryFlowAuth.has('execution.qc') ? '<button class="table-button" data-qc-job="' + safe(job.id) + '">Inspect</button>' : '') + (window.FactoryFlowAuth.has('execution.qc') && summary.pendingReworkQty > 0 ? '<button class="table-button" data-rework-job="' + safe(job.id) + '">Rework</button>' : '') + releaseAction + '</div></td></tr>';
  }).join('');
  const productionRows = productionLogs.slice().reverse().slice(0, 12).map((entry) =>
    '<tr><td class="order-code">' + safe(entry.id) + '</td><td>' + safe(entry.jobId) + '</td><td>' + safe(entry.workerName) + '</td><td>' + safe(entry.productionDate) + ' · ' + safe(entry.shift) + '</td><td>' + Number(entry.producedQty).toLocaleString('en-IN') + '</td><td>' + Number(entry.goodQty).toLocaleString('en-IN') + '</td><td>' + Number(entry.rejectedQty).toLocaleString('en-IN') + '</td></tr>'
  ).join('');
  const qcRows = qcInspections.slice().reverse().slice(0, 12).map((inspection) =>
    '<tr><td class="order-code">' + safe(inspection.id) + '</td><td>' + safe(inspection.jobId) + '</td><td>' + safe(inspection.inspectionType) + '</td><td>' + Number(inspection.inspectedQty).toLocaleString('en-IN') + '</td><td>' + Number(inspection.passedQty).toLocaleString('en-IN') + '</td><td>' + Number(inspection.failedQty).toLocaleString('en-IN') + '</td><td>' + safe(inspection.disposition) + '<div class="subtle">' + safe(inspection.defectCategory || '—') + '</div></td><td>' + safe(inspection.inspector) + '</td></tr>'
  ).join('');
  const reworkRows = reworkLogs.slice().reverse().slice(0, 12).map((record) =>
    '<tr><td class="order-code">' + safe(record.id) + '</td><td>' + safe(record.jobId) + '</td><td>' + safe(record.qcInspectionId) + '</td><td>' + Number(record.reworkedQty).toLocaleString('en-IN') + '</td><td>' + Number(record.recoveredQty).toLocaleString('en-IN') + '</td><td>' + Number(record.scrappedQty).toLocaleString('en-IN') + '</td><td>' + safe(record.notes || '—') + '</td></tr>'
  ).join('');
  return head('PRODUCTION', 'Production execution & QC', 'Record actual output, inspect finished units, resolve defects and release only jobs that meet production and quality requirements.', '') +
    '<div class="inventory-grid"><article class="inventory-stat"><span>OPEN JOBS</span><strong>' + openJobs.length + '</strong><small>Active production jobs</small></article><article class="inventory-stat"><span>UNITS PRODUCED</span><strong>' + totalProduced.toLocaleString('en-IN') + '</strong><small>Across open jobs</small></article><article class="inventory-stat"><span>GOOD UNITS REPORTED</span><strong>' + totalGood.toLocaleString('en-IN') + '</strong><small>Worker-reported output</small></article><article class="inventory-stat"><span>REJECTED AT PRODUCTION</span><strong>' + totalRejected.toLocaleString('en-IN') + '</strong><small>Worker-reported rejects</small></article><article class="inventory-stat"><span>PENDING REWORK</span><strong>' + pendingRework.toLocaleString('en-IN') + '</strong><small>Units awaiting corrective work</small></article></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Job execution status</strong><span class="subtle">QC accepted quantity is counted separately from worker-reported good output</span></div>' +
    (rows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>JOB</th><th>WORK</th><th>PRODUCED</th><th>GOOD REPORTED</th><th>REJECTED</th><th>QC PASSED</th><th>REWORK PENDING</th><th>ACTIONS</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state"><h2>No open production jobs</h2><p>Create a job to start recording output and inspections.</p></div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Production output history</strong><span class="subtle">' + productionLogs.length + ' entries</span></div>' +
    (productionRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>ENTRY</th><th>JOB</th><th>WORKER</th><th>DATE / SHIFT</th><th>PRODUCED</th><th>GOOD</th><th>REJECTED</th></tr></thead><tbody>' + productionRows + '</tbody></table></div>' : '<div class="empty-state">No production output recorded yet.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Quality inspection history</strong><span class="subtle">' + qcInspections.length + ' inspections</span></div>' +
    (qcRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>QC ID</th><th>JOB</th><th>TYPE</th><th>INSPECTED</th><th>PASSED</th><th>FAILED</th><th>DISPOSITION / DEFECT</th><th>INSPECTOR</th></tr></thead><tbody>' + qcRows + '</tbody></table></div>' : '<div class="empty-state">No QC inspections recorded yet.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Rework history</strong><span class="subtle">' + reworkLogs.length + ' records</span></div>' +
    (reworkRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>REWORK ID</th><th>JOB</th><th>QC SOURCE</th><th>REWORKED</th><th>RECOVERED</th><th>SCRAPPED</th><th>CORRECTIVE ACTION</th></tr></thead><tbody>' + reworkRows + '</tbody></table></div>' : '<div class="empty-state">No rework records recorded yet.</div>') + '</section>';
}

function scheduleProduction(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || ['Delivered', 'QC review', 'Cancelled'].includes(job.status)) return notify('Only active jobs can be scheduled.');
  const activeWorkers = workers.filter((worker) => worker.active !== false);
  if (!activeWorkers.length) return notify('Activate a worker before scheduling production.');
  const activeMachines = machines.filter((machine) => machine.active !== false);
  const preferred = activeWorkers.find((worker) => worker.name === job.worker) || activeWorkers[0];
  const workerOptions = activeWorkers.map((worker) => '<option value="' + safe(worker.id) + '"' + (preferred.id === worker.id ? ' selected' : '') + '>' + safe(worker.name + ' · ' + worker.skill + ' · ' + worker.capacityHoursPerDay + ' hrs/day') + '</option>').join('');
  const machineOptions = '<option value="">Choose a machine</option>' + activeMachines.map((machine) =>
    '<option value="' + safe(machine.id) + '"' + (job.machineId === machine.id ? ' selected' : '') + '>' + safe(machine.code + ' · ' + machine.name + ' · ' + machine.capacityHoursPerDay + ' hrs/day') + '</option>'
  ).join('');
  const today = localDateISO();
  openModal('<h2 id="modalTitle">Schedule production · ' + safe(job.id) + '</h2><p>' + safe(job.customer + ' · ' + job.item) + '</p><form id="scheduleForm" class="form-grid"><label>Job worker<select required name="workerId">' + workerOptions + '</select></label>' +
    (activeMachines.length ? '<label>Machine / equipment<select required name="machineId">' + machineOptions + '</select></label>' : '') +
    '<div class="form-row"><label>Production date<input required name="date" type="date" value="' + today + '"></label><label>Planned hours<input required name="hours" type="number" min="0.25" max="24" step="0.25" value="4"></label></div><label>Target completion date<input name="dueDate" type="date" value="' + safe(job.dueDate || '') + '"></label><label>Operation / notes<input name="note" placeholder="e.g. Printing shift, carton cutting"></label><p class="subtle">Daily worker and machine capacity are checked before saving. Maintenance and machine downtime block new assignments.</p><p id="scheduleError" class="form-error" hidden></p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save production session</button></div></form>');
  ui('#scheduleForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const date = data.get('date');
      const hours = Number(data.get('hours'));
      const machineId = data.get('machineId') || '';
      let selectedMachine = null;
      if (activeMachines.length) {
        selectedMachine = activeMachines.find((machine) => machine.id === machineId);
        if (!selectedMachine) throw new Error('Choose an active machine for this production session.');
        if (!window.FactoryFlowMachines.isAvailableOn(selectedMachine, date)) {
          throw new Error(selectedMachine.name + ' is inactive or under maintenance on ' + date + '.');
        }
        const nameKey = String(selectedMachine.name || '').trim().toLocaleLowerCase();
        const down = downtimeLogs.some((record) => {
          const matches = record.machineId ? record.machineId === selectedMachine.id : String(record.machineName || '').trim().toLocaleLowerCase() === nameKey;
          return matches && String(record.startAt || '').slice(0, 10) <= date && String(record.endAt || '').slice(0, 10) >= date;
        });
        if (down) throw new Error(selectedMachine.name + ' has a recorded downtime window on ' + date + '.');
        const used = schedules.filter((session) => session.machineId === selectedMachine.id && session.date === date)
          .reduce((sum, session) => sum + (Number(session.hours) || 0), 0);
        if (used + hours > Number(selectedMachine.capacityHoursPerDay) + 1e-9) {
          throw new Error(selectedMachine.name + ' would exceed its daily capacity (' + used.toFixed(1) + ' / ' + selectedMachine.capacityHoursPerDay + ' hrs already assigned).');
        }
      }
      const result = window.FactoryFlowScheduling.scheduleSession(schedules, jobs, workers, {
        jobId: job.id, workerId: data.get('workerId'), date, hours,
        dueDate: data.get('dueDate'), note: data.get('note')
      });
      if (selectedMachine) {
        result.session.machineId = selectedMachine.id;
        result.session.machineName = selectedMachine.name;
      }
      save();
      closeModal();
      goto('schedule');
      notify(result.session.id + ' scheduled with ' + result.worker.name + (selectedMachine ? ' on ' + selectedMachine.name : '') + '. ' + result.remainingCapacity.toFixed(1) + ' worker hours remain for that day.');
    } catch (error) {
      const element = ui('#scheduleError');
      element.textContent = error.message;
      element.hidden = false;
    }
  });
}

function editWorkerProfile(workerId) {
  const worker = workers.find((item) => item.id === workerId);
  if (!worker) return;
  const unavailable = (worker.unavailableDates || []).join(', ');
  openModal('<h2 id="modalTitle">Worker capacity & availability</h2><p>' + safe(worker.name) + ' · ' + safe(worker.skill) + '</p><form id="workerProfileForm" class="form-grid"><label>Worker name<input required name="name" value="' + safe(worker.name) + '"></label><label>Skill / operation<input required name="skill" value="' + safe(worker.skill || '') + '"></label><div class="form-row"><label>Daily capacity (hours)<input required name="capacity" type="number" min="0.25" max="24" step="0.25" value="' + Number(worker.capacityHoursPerDay || 8) + '"></label><label>Worker status<select name="active"><option value="active"' + (worker.active !== false ? ' selected' : '') + '>Active</option><option value="inactive"' + (worker.active === false ? ' selected' : '') + '>Inactive</option></select></label></div><label>Unavailable dates<input name="unavailableDates" value="' + safe(unavailable) + '" placeholder="YYYY-MM-DD, YYYY-MM-DD"></label><p class="subtle">Enter dates separated by commas. A scheduled session on an unavailable date will be flagged and new sessions will be blocked.</p><p id="workerProfileError" class="form-error" hidden></p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save worker profile</button></div></form>');
  ui('#workerProfileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const unavailableDates = data.get('unavailableDates').split(',').map((value) => value.trim()).filter(Boolean);
    const previousName = worker.name;
    try {
      window.FactoryFlowScheduling.updateWorker(workers, worker.id, {
        name: data.get('name'),
        skill: data.get('skill'),
        capacityHoursPerDay: Number(data.get('capacity')),
        active: data.get('active') === 'active',
        unavailableDates
      });
      jobs.forEach((job) => { if (job.worker === previousName) job.worker = worker.name; });
      schedules.forEach((session) => {
        if (session.workerId === worker.id) session.workerName = worker.name;
      });
      save();
      closeModal();
      goto('workers');
      notify('Worker profile updated for ' + worker.name + '.');
    } catch (error) {
      const element = ui('#workerProfileError');
      element.textContent = error.message;
      element.hidden = false;
    }
  });
}

function removeProductionSession(sessionId) {
  const session = window.FactoryFlowScheduling.removeSession(schedules, sessionId);
  if (!session) return notify('This production session no longer exists.');
  save();
  render();
  notify(session.id + ' removed from the production schedule.');
}

async function runScheduleOptimization() {
  if (scheduleOptimizationLoading) return;
  const form = ui('#optimizerOptionsForm');
  if (!form) return;
  const data = new FormData(form);
  const options = {
    startDate: localDateISO(),
    horizonDays: Number(data.get('horizonDays')),
    includeWeekends: data.get('includeWeekends') === 'on'
  };
  scheduleOptimizationLoading = true;
  scheduleOptimization = null;
  const requestId = ++scheduleOptimizationRequestId;
  const facilityId = window.FactoryFlowAuth.state.activeFacilityId;
  render();
  try {
    const payload = await window.FactoryFlowAuth.request('/api/scheduling/optimize', {
      method: 'POST',
      body: JSON.stringify(options)
    });
    if (requestId === scheduleOptimizationRequestId && facilityId === window.FactoryFlowAuth.state.activeFacilityId) {
      scheduleOptimization = { facilityId: payload.facilityId, plan: payload.plan };
    }
  } catch (error) {
    if (requestId === scheduleOptimizationRequestId && facilityId === window.FactoryFlowAuth.state.activeFacilityId) notify(error.message);
  } finally {
    if (requestId === scheduleOptimizationRequestId && facilityId === window.FactoryFlowAuth.state.activeFacilityId) {
      scheduleOptimizationLoading = false;
      if (app.view === 'schedule') render();
    }
  }
}

function confirmScheduleOptimization() {
  if (!scheduleOptimization || !scheduleOptimization.plan.proposals.length) return;
  if (!window.FactoryFlowAuth.has('schedule.manage')) return notify('You do not have permission to apply a production schedule.');
  const plan = scheduleOptimization.plan;
  const proposalRows = plan.proposals.slice(0, 8).map((item) =>
    '<li>' + safe(item.date + ' · ' + item.jobId + ' · ' + item.workerName + ' · ' + Number(item.hours).toFixed(1) + ' hrs') + '</li>'
  ).join('');
  openModal('<h2 id="modalTitle">Apply optimized production schedule?</h2><p>This will create ' + plan.proposals.length + ' production sessions totalling ' + Number(plan.summary.scheduledHours).toFixed(1) + ' worker hours in the currently selected facility.</p><p>The server will recalculate the plan against the latest jobs, workers and committed sessions before saving. Existing sessions will be preserved.</p>' +
    (proposalRows ? '<ul>' + proposalRows + '</ul>' : '') +
    (plan.proposals.length > 8 ? '<p class="subtle">And ' + (plan.proposals.length - 8) + ' additional proposed session(s).</p>' : '') +
    '<p id="optimizerApplyError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="button" class="primary-button" data-confirm-optimizer-apply>Apply sessions</button></div>');
  const applyButton = ui('[data-confirm-optimizer-apply]');
  if (applyButton) applyButton.addEventListener('click', applyScheduleOptimization);
}

async function applyScheduleOptimization() {
  if (!scheduleOptimization || !window.FactoryFlowAuth.has('schedule.manage')) return;
  const options = scheduleOptimization.plan.options;
  const button = ui('[data-confirm-optimizer-apply]');
  if (button) { button.disabled = true; button.textContent = 'Rechecking capacity…'; }
  try {
    const result = await window.FactoryFlowAuth.request('/api/scheduling/optimize/apply', {
      method: 'POST',
      body: JSON.stringify(options)
    });
    schedules.push(...result.appliedSessions.filter((session) => !schedules.some((item) => item.id === session.id)));
    scheduleOptimization = null;
    closeModal();
    save(false);
    goto('schedule');
    notify(result.appliedSessions.length + ' optimized production session(s) applied. Existing schedules were preserved.');
  } catch (error) {
    const node = ui('#optimizerApplyError');
    if (node) {
      node.textContent = error.message;
      node.hidden = false;
      if (button) { button.disabled = false; button.textContent = 'Apply sessions'; }
    } else {
      notify(error.message);
    }
  }
}

function configureJobSchedule(jobId) {
  if (!window.FactoryFlowAuth.has('schedule.manage')) return;
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return;
  const dueDate = job.dueDate && window.FactoryFlowScheduling.validDate(job.dueDate) ? job.dueDate : '';
  openModal('<h2 id="modalTitle">Scheduling inputs · ' + safe(job.id) + '</h2><p>' + safe(job.customer + ' · ' + job.item) + '</p><form id="jobSchedulingForm" class="form-grid">' +
    '<label>Estimated total production hours<input required name="estimatedHours" type="number" min="0.25" max="100000" step="0.25" value="' + (Number(job.estimatedHours) > 0 ? Number(job.estimatedHours) : '') + '" placeholder="e.g. 24"></label>' +
    '<div class="form-row"><label>Job priority<select name="priority">' + ['Low', 'Normal', 'High', 'Urgent'].map((value) => '<option value="' + value + '"' + ((job.priority || 'Normal') === value ? ' selected' : '') + '>' + value + '</option>').join('') + '</select></label><label>Required operation / skill<input name="requiredSkill" maxlength="100" value="' + safe(job.requiredSkill || '') + '" placeholder="e.g. Printing"></label></div>' +
    '<label>Preferred machine (optional)<select name="machineId"><option value="">Any compatible machine</option>' + machines.filter((machine) => machine.active !== false).map((machine) => '<option value="' + safe(machine.id) + '"' + (job.machineId === machine.id ? ' selected' : '') + '>' + safe(machine.code + ' · ' + machine.name) + '</option>').join('') + '</select></label>' +
    '<label>Target completion date<input name="dueDate" type="date" value="' + safe(dueDate) + '"></label>' +
    '<p class="subtle">The estimate represents total production hours. Actual hours and committed sessions are subtracted. With machines registered, the optimizer also checks supported operations, daily machine capacity, maintenance, downtime and any preferred machine.</p>' +
    '<p id="jobSchedulingError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save planning inputs</button></div></form>');
  ui('#jobSchedulingForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const estimatedHours = Number(data.get('estimatedHours'));
    const due = data.get('dueDate');
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0 || estimatedHours > 100000) {
      const node = ui('#jobSchedulingError');
      node.textContent = 'Estimated hours must be greater than zero and no more than 100,000.';
      node.hidden = false;
      return;
    }
    if (due && !window.FactoryFlowScheduling.validDate(due)) {
      const node = ui('#jobSchedulingError');
      node.textContent = 'Choose a valid target completion date.';
      node.hidden = false;
      return;
    }
    job.estimatedHours = estimatedHours;
    job.priority = data.get('priority');
    job.requiredSkill = data.get('requiredSkill').trim();
    job.machineId = data.get('machineId') || '';
    job.dueDate = due;
    if (due) job.due = new Date(due + 'T00:00:00').toLocaleDateString('en-IN');
    save(false);
    closeModal();
    if (workspaceReady) await syncWorkspace();
    goto('schedule');
    notify('Scheduling inputs saved for ' + job.id + '.');
  });
}

function scheduleOptimizerPanel() {
  const canApply = window.FactoryFlowAuth.has('schedule.manage');
  const optionsForm = '<form id="optimizerOptionsForm" class="optimizer-controls"><label>Planning horizon<select name="horizonDays"><option value="7">7 days</option><option value="14" selected>14 days</option><option value="30">30 days</option></select></label>' +
    '<label class="optimizer-weekend"><input type="checkbox" name="includeWeekends"> Include weekends</label>' +
    '<button class="primary-button" type="submit"' + (scheduleOptimizationLoading ? ' disabled' : '') + '>' + (scheduleOptimizationLoading ? 'Optimizing…' : '✦ Optimize workload') + '</button></form>';
  let resultMarkup = '<div class="empty-state"><h2>Build an optimized schedule</h2><p>The optimizer ranks active jobs by due date and priority, then allocates work to compatible workers within their remaining daily capacity. Preview first; existing schedules are not changed until you apply the suggestions.</p></div>';
  if (scheduleOptimization) {
    const plan = scheduleOptimization.plan;
    const summary = plan.summary;
    const proposalRows = plan.proposals.map((item) =>
      '<tr><td>' + safe(item.date) + '</td><td class="order-code">' + safe(item.jobId) + '</td><td>' + safe(item.workerName) + '</td><td>' + safe(item.machineName || '—') + '</td><td>' + Number(item.hours).toFixed(1) + ' hrs</td><td>' + safe(item.priority) + '</td></tr>'
    ).join('');
    const jobRows = plan.jobPlans.map((item) => {
      const estimateAction = item.status === 'Needs estimate' && canApply
        ? '<button class="table-button" data-configure-job-optimizer="' + safe(item.jobId) + '">Add estimate</button>'
        : '';
      return '<tr><td class="order-code">' + safe(item.jobId) + '<div class="subtle">' + safe(item.customer + ' · ' + item.job) + '</div></td><td>' + safe(item.priority) + '</td><td>' + (item.estimatedHours === null ? '—' : Number(item.estimatedHours).toFixed(1) + ' hrs') + '</td><td>' + Number(item.actualHours || 0).toFixed(1) + ' hrs</td><td>' + Number(item.committedHours || 0).toFixed(1) + ' hrs</td><td>' + Number(item.proposedHours || 0).toFixed(1) + ' hrs</td><td>' + (item.unscheduledHours > 0 ? '<strong>' + Number(item.unscheduledHours).toFixed(1) + ' hrs</strong>' : '—') + '</td><td>' + status(item.deadlineRisk ? 'Critical' : item.status) + '</td><td>' + estimateAction + '</td></tr>';
    }).join('');
    const dailyRows = plan.dailyLoads.filter((item) => item.proposedHours > 0).map((item) =>
      '<tr><td>' + safe(item.date) + '</td><td>' + safe(item.workerName) + '</td><td>' + Number(item.committedHours).toFixed(1) + ' hrs</td><td>' + Number(item.proposedHours).toFixed(1) + ' hrs</td><td>' + Number(item.totalHours).toFixed(1) + ' / ' + Number(item.capacityHours).toFixed(1) + ' hrs</td></tr>'
    ).join('');
    const issues = plan.issues.map((item) => '<li>' + safe(item.message) + '</li>').join('');
    resultMarkup = '<div class="inventory-grid optimizer-summary">' +
      '<article class="inventory-stat"><span>PROPOSED SESSIONS</span><strong>' + summary.proposedSessionCount + '</strong><small>' + Number(summary.scheduledHours).toFixed(1) + ' worker hours</small></article>' +
      '<article class="inventory-stat"><span>FULLY SCHEDULED JOBS</span><strong>' + summary.scheduledJobCount + '</strong><small>' + summary.partialJobCount + ' partially scheduled</small></article>' +
      '<article class="inventory-stat"><span>UNSCHEDULED HOURS</span><strong>' + Number(summary.unscheduledHours).toFixed(1) + '</strong><small>' + summary.capacityGapCount + ' jobs with capacity gaps</small></article>' +
      '<article class="inventory-stat"><span>DEADLINE RISKS</span><strong>' + summary.deadlineRiskCount + '</strong><small>' + (summary.onTimePercent === null ? 'No dated jobs to score' : summary.onTimePercent.toFixed(1) + '% dated jobs projected on time') + '</small></article>' +
      '<article class="inventory-stat"><span>MACHINES USED</span><strong>' + (summary.machinesUsed || 0) + '</strong><small>' + (summary.machineCapacityConflicts || 0) + ' machine-day capacity conflicts</small></article></div>' +
      ((plan.dailyMachineLoads || []).some((item) => item.proposedHours > 0) ? '<section class="optimizer-result-block"><div class="toolbar"><strong>Machine capacity after proposals</strong><span class="subtle">Committed + proposed machine-hours</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>DATE</th><th>MACHINE</th><th>COMMITTED</th><th>PROPOSED</th><th>TOTAL / CAPACITY</th></tr></thead><tbody>' + plan.dailyMachineLoads.filter((item) => item.proposedHours > 0).map((item) => '<tr><td>' + safe(item.date) + '</td><td>' + safe(item.machineName) + '</td><td>' + Number(item.committedHours).toFixed(1) + ' hrs</td><td>' + Number(item.proposedHours).toFixed(1) + ' hrs</td><td>' + Number(item.totalHours).toFixed(1) + ' / ' + Number(item.capacityHours).toFixed(1) + ' hrs</td></tr>').join('') + '</tbody></table></div></section>' : '') +
      '<section class="optimizer-result-block"><div class="toolbar"><strong>Suggested production sessions</strong><span class="subtle">Preview only · ' + plan.options.startDate + ' · ' + plan.options.horizonDays + ' days</span></div>' +
      (proposalRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>DATE</th><th>JOB</th><th>WORKER</th><th>MACHINE</th><th>HOURS</th><th>PRIORITY</th></tr></thead><tbody>' + proposalRows + '</tbody></table></div>' : '<div class="empty-state"><p>No new sessions can be proposed. Add job estimates or review worker capacity and availability.</p></div>') + '</section>' +
      '<section class="optimizer-result-block"><div class="toolbar"><strong>Job-level schedule assessment</strong><span class="subtle">Actual hours and committed future sessions reduce the estimate</span></div>' +
      (jobRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>JOB</th><th>PRIORITY</th><th>ESTIMATE</th><th>ACTUAL</th><th>COMMITTED</th><th>PROPOSED</th><th>UNSCHEDULED</th><th>ASSESSMENT</th><th></th></tr></thead><tbody>' + jobRows + '</tbody></table></div>' : '<div class="empty-state">No active jobs found.</div>') + '</section>' +
      '<section class="optimizer-result-block"><div class="toolbar"><strong>Daily worker capacity after proposals</strong><span class="subtle">Committed + proposed hours</span></div>' +
      (dailyRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>DATE</th><th>WORKER</th><th>COMMITTED</th><th>PROPOSED</th><th>TOTAL / CAPACITY</th></tr></thead><tbody>' + dailyRows + '</tbody></table></div>' : '<div class="empty-state">No worker capacity has been allocated.</div>') + '</section>' +
      (issues ? '<section class="optimizer-result-block"><div class="toolbar"><strong>Optimizer notes</strong></div><ul>' + issues + '</ul></section>' : '') +
      (canApply && plan.proposals.length ? '<div class="optimizer-apply-row"><span class="subtle">Applying will recalculate on the server and add new sessions without deleting existing ones.</span><button class="primary-button" data-apply-optimizer>Apply ' + plan.proposals.length + ' suggested sessions</button></div>' : '');
  }
  return '<section class="content-card optimizer-panel"><div class="toolbar"><div><strong style="font-size:13px">✦ AI-assisted schedule optimizer</strong><p class="subtle">A transparent, rules-based optimizer. No live assignments are changed during preview.</p></div></div>' + optionsForm + resultMarkup + '</section>';
}

function schedulePage() {
  const analysis = window.FactoryFlowScheduling.analyzeSchedule(jobs, schedules, workers);
  const upcoming = analysis.sessions.filter((session) => session.date >= localDateISO());
  const capacityRows = analysis.dailyLoads.map((load) => {
    const capacity = Math.max(0, Number(load.capacityHours) || 0);
    const percent = capacity > 0 ? Math.min(100, Math.round(load.assignedHours / capacity * 100)) : 100;
    const over = load.assignedHours > capacity + 1e-9;
    return '<tr><td><div class="item-name">' + safe(load.workerName) + '</div><div class="subtle">' + safe(load.date) + '</div></td><td>' + load.assignedHours.toFixed(1) + ' hrs</td><td>' + capacity.toFixed(1) + ' hrs</td><td><div class="capacity-track ' + (over ? 'over' : '') + '"><i style="width:' + percent + '%"></i></div>' + (over ? '<small class="risk-text">' + (load.assignedHours - capacity).toFixed(1) + ' hrs over capacity</small>' : '<small class="subtle">' + Math.max(0, capacity - load.assignedHours).toFixed(1) + ' hrs available</small>') + '</td></tr>';
  }).join('');
  const sessionRows = analysis.sessions.map((session) => {
    const dueRisk = session.deadlineRisk ? '<span class="status critical">After deadline</span>' : '<span class="status on-track">On plan</span>';
    const unavailable = session.workerUnavailable ? '<div class="risk-text">Worker marked unavailable</div>' : '';
    return '<tr><td><strong>' + safe(session.date) + '</strong>' + (session.note ? '<div class="subtle">' + safe(session.note) + '</div>' : '') + '</td><td class="order-code">' + safe(session.jobId) + '<div class="subtle">' + safe(session.customer) + ' · ' + safe(session.job) + '</div></td><td>' + safe(session.workerName) + '</td><td>' + safe(session.machineName || '—') + '</td><td>' + Number(session.hours).toFixed(1) + ' hrs</td><td>' + dueRisk + unavailable + '</td><td>' + (window.FactoryFlowAuth.has('schedule.manage') ? '<button class="table-button" data-remove-session="' + safe(session.id) + '">Remove</button>' : '') + '</td></tr>';
  }).join('');
  const conflictItems = analysis.capacityConflicts.map((item) => '<li>' + safe(item.message + ' Assigned ' + item.assignedHours.toFixed(1) + ' / ' + item.capacityHours.toFixed(1) + ' hrs.') + '</li>');
  const riskItems = analysis.deadlineRisks.map((item) => '<li>' + safe(item.jobId + ': scheduled ' + item.scheduledDate + ' after deadline ' + item.dueDate + '.') + '</li>');
  const issueItems = analysis.issues.map((item) => '<li>' + safe(item.message) + '</li>');
  return head('PRODUCTION', 'Production schedule', 'Schedule work by day and worker, validate daily capacity, and flag sessions that threaten job deadlines.', window.FactoryFlowAuth.has('schedule.manage') ? '<button class="primary-button" data-schedule-create>＋ Schedule a job</button>' : '') +
    '<div class="inventory-grid"><article class="inventory-stat"><span>ACTIVE JOBS</span><strong>' + analysis.activeJobCount + '</strong><small>Eligible for production scheduling</small></article><article class="inventory-stat"><span>UPCOMING SESSIONS</span><strong>' + upcoming.length + '</strong><small>Today and future sessions</small></article><article class="inventory-stat"><span>CAPACITY CONFLICTS</span><strong>' + analysis.capacityConflicts.length + '</strong><small>Worker days over allocated hours</small></article><article class="inventory-stat"><span>DEADLINE RISKS</span><strong>' + analysis.deadlineRisks.length + '</strong><small>Sessions after target completion</small></article></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Production sessions</strong><span class="subtle">' + analysis.sessionCount + ' active session(s)</span></div>' +
    (sessionRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>DATE / OPERATION</th><th>JOB</th><th>WORKER</th><th>MACHINE</th><th>PLANNED</th><th>DEADLINE</th><th></th></tr></thead><tbody>' + sessionRows + '</tbody></table></div>' : '<div class="empty-state"><h2>No production sessions scheduled</h2><p>Schedule an active job to start building the production queue.</p></div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Worker capacity by day</strong><span class="subtle">Hours assigned vs daily capacity</span></div>' +
    (capacityRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>WORKER / DATE</th><th>ASSIGNED</th><th>CAPACITY</th><th>UTILISATION</th></tr></thead><tbody>' + capacityRows + '</tbody></table></div>' : '<div class="empty-state"><p>Capacity utilisation will appear when sessions are scheduled.</p></div>') + '</section>' +
    ((analysis.capacityConflicts.length || analysis.deadlineRisks.length || analysis.issues.length) ? '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Scheduling alerts</strong></div><ul>' + conflictItems.concat(riskItems, issueItems).join('') + '</ul></section>' : '') + scheduleOptimizerPanel();
}

function currentAnalytics() {
  return window.FactoryFlowAnalytics.buildAnalytics({
    productionLogs,
    qcInspections,
    reworkLogs,
    schedules,
    jobs,
    deliveries,
    downtimeLogs,
    machines,
    fromDate: analyticsFilters.fromDate,
    toDate: analyticsFilters.toDate,
    groupBy: analyticsFilters.groupBy
  });
}

function formatHours(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' hrs';
}

function analyticsPage() {
  const data = currentAnalytics();
  const trendMax = Math.max(1, ...data.productionTrend.map((point) => point.producedQty));
  const trendRows = data.productionTrend.map((point) => {
    const width = Math.max(1, Math.round(point.producedQty / trendMax * 100));
    return '<tr><td class="order-code">' + safe(point.period) + '</td><td><strong>' + Number(point.producedQty).toLocaleString('en-IN') + '</strong><div class="analytics-bar"><i style="width:' + width + '%"></i></div></td><td>' + Number(point.goodQty).toLocaleString('en-IN') + '</td><td>' + Number(point.rejectedQty).toLocaleString('en-IN') + '</td><td>' + formatHours(point.actualHours) + '</td><td>' + (point.unitsPerActualHour === null ? 'Not available' : Number(point.unitsPerActualHour).toLocaleString('en-IN') + ' units/hr') + '</td></tr>';
  }).join('');
  const workerRows = data.workers.map((worker) =>
    '<tr><td><div class="item-name">' + safe(worker.workerName) + '</div><div class="subtle">' + safe(worker.workerId || 'No worker ID') + '</div></td><td>' + Number(worker.producedQty).toLocaleString('en-IN') + '</td><td>' + Number(worker.goodQty).toLocaleString('en-IN') + '</td><td>' + Number(worker.rejectedQty).toLocaleString('en-IN') + '</td><td>' + formatHours(worker.actualHours) + '</td><td>' + (worker.unitsPerActualHour === null ? 'Not available' : Number(worker.unitsPerActualHour).toLocaleString('en-IN')) + '</td><td>' + (worker.goodYieldPercent === null ? '—' : worker.goodYieldPercent.toFixed(2) + '%') + '</td><td>' + worker.entriesWithoutActualHours + ' legacy / unreported</td></tr>'
  ).join('');
  const jobRows = data.jobPerformance.map((job) =>
    '<tr><td class="order-code">' + safe(job.jobId) + '</td><td>' + safe(job.customer) + '<div class="subtle">' + safe(job.item) + '</div></td><td>' + Number(job.periodProducedQty).toLocaleString('en-IN') + '</td><td>' + Number(job.producedQty).toLocaleString('en-IN') + ' / ' + Number(job.targetQty).toLocaleString('en-IN') + '</td><td>' + (job.completionPercent === null ? '—' : job.completionPercent.toFixed(1) + '%') + '</td><td>' + (job.unitsPerHour === null ? 'Not available' : Number(job.unitsPerHour).toLocaleString('en-IN') + ' units/hr') + '</td></tr>'
  ).join('');
  const machineRows = data.downtime.machineDowntime.map((item) =>
    '<tr><td>' + safe(item.machineName) + '</td><td>' + Number(item.minutes).toLocaleString('en-IN') + ' min</td><td>' + formatHours(item.hours) + '</td></tr>'
  ).join('');
  const reasonRows = data.downtime.reasons.map((item) =>
    '<tr><td>' + safe(item.reason) + '</td><td>' + Number(item.minutes).toLocaleString('en-IN') + ' min</td><td>' + formatHours(item.hours) + '</td></tr>'
  ).join('');
  const downtimeRows = downtimeLogs.slice().sort((a, b) => String(b.startAt).localeCompare(String(a.startAt))).slice(0, 12).map((item) =>
    '<tr><td class="order-code">' + safe(item.id) + '</td><td>' + safe(item.machineName) + '</td><td>' + safe(item.startAt.replace('T', ' ')) + '</td><td>' + safe(item.endAt.replace('T', ' ')) + '</td><td>' + formatHours(Number(item.durationMinutes) / 60) + '</td><td>' + safe(item.reason) + '</td><td>' + safe(item.jobId || '—') + '</td><td>' + safe(item.reportedBy) + '</td></tr>'
  ).join('');
  const onTimeLabel = data.onTimeDelivery.onTimePercent === null ? 'Not enough dated deliveries' : data.onTimeDelivery.onTimePercent.toFixed(1) + '%';
  const actualHoursNote = data.totals.entriesWithoutActualHours + ' production entries have no actual hours recorded';
  const planVariance = data.planVsActual.linkedSessions
    ? (data.planVsActual.varianceHours > 0 ? '+' : '') + data.planVsActual.varianceHours.toFixed(2) + ' hrs (' + (data.planVsActual.variancePercent > 0 ? '+' : '') + data.planVsActual.variancePercent.toFixed(1) + '%)'
    : 'No linked actuals yet';

  const machineOee = data.machineOee;
  const machinePercent = (value) => value === null || value === undefined ? '—' : Number(value).toFixed(1) + '%';
  const machineOeeRows = machineOee.machines.map((item) =>
    '<tr><td><strong>' + safe(item.machineName) + '</strong><div class="subtle">' + safe(item.code) + '</div>' +
      (item.bottleneckSignals.length ? '<div class="machine-alert-copy">' + safe(item.bottleneckSignals.join(' · ')) + '</div>' : '') +
      (item.performanceCapped ? '<div class="machine-alert-copy">Performance exceeded ideal rate; OEE calculation capped it at 100%.</div>' : '') + '</td>' +
    '<td><strong>' + machinePercent(item.oeePercent) + '</strong></td>' +
    '<td>' + (item.idealUnitsPerHour === null ? 'Not configured' : Number(item.idealUnitsPerHour).toLocaleString('en-IN') + ' units/hr') + '</td>' +
    '<td>' + machinePercent(item.availabilityPercent) + '</td>' +
    '<td>' + (item.rawPerformancePercent === null ? '—' : Number(item.rawPerformancePercent).toFixed(1) + '%') + '</td>' +
    '<td>' + machinePercent(item.qualityPercent) + '</td>' +
    '<td>' + machinePercent(item.capacityUtilizationPercent) + '</td>' +
    '<td>' + formatHours(item.effectiveDowntimeHours) + '</td>' +
    '<td>' + Number(item.producedQty).toLocaleString('en-IN') + '</td></tr>'
  ).join('');
  const machineTrendRows = machineOee.dailyTrend.map((item) =>
    '<tr><td class="order-code">' + safe(item.date) + '</td><td>' + formatHours(item.plannedHours) + '</td>' +
    '<td>' + formatHours(item.downtimeHours) + '</td><td>' + formatHours(item.runHours) + '</td>' +
    '<td>' + Number(item.producedQty).toLocaleString('en-IN') + '</td><td>' + machinePercent(item.oeePercent) + '</td></tr>'
  ).join('');
  const machineOeeMarkup = '<section class="content-card machine-oee-section" style="margin-top:18px">' +
    '<div class="toolbar"><div><strong style="font-size:13px">Machine effectiveness · OEE</strong><p class="subtle">Overall Equipment Effectiveness combines availability × performance × quality.</p></div>' +
    '<span class="subtle">' + machineOee.machinesWithOee + ' / ' + machineOee.machineCount + ' machine(s) with a complete OEE result</span></div>' +
    (machineOee.machineCount ? '<div class="machine-oee-kpis">' +
      '<article><span>OVERALL OEE</span><strong>' + machinePercent(machineOee.totals.oeePercent) + '</strong><small>Rated machines only</small></article>' +
      '<article><span>AVAILABILITY</span><strong>' + machinePercent(machineOee.totals.availabilityPercent) + '</strong><small>Run hours / planned hours</small></article>' +
      '<article><span>PERFORMANCE</span><strong>' + machinePercent(machineOee.totals.rawPerformancePercent) + '</strong><small>Actual output / ideal output</small></article>' +
      '<article><span>QUALITY</span><strong>' + machinePercent(machineOee.totals.qualityPercent) + '</strong><small>Good units / produced units</small></article></div>' +
      '<div class="machine-oee-definition subtle">OEE uses ' + formatHours(machineOee.totals.eligiblePlannedHours) + ' of planned time for machines with an ideal rate. Logged downtime intervals are merged and capped to each machine’s scheduled hours for that day. Performance above 100% is capped in OEE and flagged for rate review.</div>' +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>MACHINE / BOTTLENECK SIGNALS</th><th>OEE</th><th>IDEAL RATE</th><th>AVAILABILITY</th><th>PERFORMANCE</th><th>QUALITY</th><th>CAPACITY UTILIZATION</th><th>DOWNTIME</th><th>PRODUCED</th></tr></thead><tbody>' + machineOeeRows + '</tbody></table></div>' +
      '<div class="machine-oee-subgrid"><section><div class="toolbar"><strong>Daily machine effectiveness</strong></div>' +
        (machineTrendRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>DATE</th><th>PLANNED</th><th>DOWNTIME</th><th>RUN</th><th>PRODUCED</th><th>OEE</th></tr></thead><tbody>' + machineTrendRows + '</tbody></table></div>' : '<div class="empty-state">No scheduled machine days in this date range.</div>') +
      '</section><section><div class="toolbar"><strong>Bottleneck watchlist</strong><span class="subtle">' + machineOee.bottlenecks.length + ' machine(s) with signals</span></div>' +
        (machineOee.bottlenecks.length ? '<div class="machine-bottleneck-list">' + machineOee.bottlenecks.map((item) => '<article><strong>' + safe(item.machineName) + '</strong><small>' + safe(item.bottleneckSignals.join(' · ')) + '</small></article>').join('') + '</div>' : '<div class="empty-state">No configured bottleneck thresholds were triggered.</div>') +
      '</section></div>' +
      '<div class="machine-oee-notes">' + machineOee.notes.map((note) => '<p>• ' + safe(note) + '</p>').join('') + '</div>' +
    '</div>' : '<div class="empty-state"><h2>No machines registered</h2><p>Register equipment first, then schedule sessions and record production to calculate OEE.</p><button class="secondary-button" data-go="machines">Open machines & equipment</button></div>') +
    '</section>';
  return head('MANAGEMENT', 'Production analytics', 'Measure recorded output, quality, worker productivity, schedule variance and machine downtime. Filters apply to dated operational records.', '<button class="secondary-button" data-export-analytics>↓ Export CSV</button> <button class="primary-button" data-new-downtime>＋ Log downtime</button>') +
    '<form id="analyticsFilterForm" class="analytics-filter content-card"><label>From date<input type="date" name="fromDate" value="' + safe(analyticsFilters.fromDate) + '"></label><label>To date<input type="date" name="toDate" value="' + safe(analyticsFilters.toDate) + '"></label><label>Trend interval<select name="groupBy"><option value="day"' + (analyticsFilters.groupBy === 'day' ? ' selected' : '') + '>Daily</option><option value="week"' + (analyticsFilters.groupBy === 'week' ? ' selected' : '') + '>Weekly</option><option value="month"' + (analyticsFilters.groupBy === 'month' ? ' selected' : '') + '>Monthly</option></select></label><div class="analytics-filter-actions"><button class="primary-button" type="submit">Apply filters</button><button class="secondary-button" type="button" data-reset-analytics>Reset</button></div></form>' +
    '<div class="analytics-kpis"><article class="analytics-kpi"><span>UNITS PRODUCED</span><strong>' + data.totals.producedQty.toLocaleString('en-IN') + '</strong><small>' + data.recordCounts.productionEntries + ' production entries</small></article><article class="analytics-kpi"><span>GOOD YIELD</span><strong>' + (data.totals.productionYieldPercent === null ? '—' : data.totals.productionYieldPercent.toFixed(1) + '%') + '</strong><small>Good units / produced units</small></article><article class="analytics-kpi"><span>QC PASS RATE</span><strong>' + (data.quality.passRatePercent === null ? '—' : data.quality.passRatePercent.toFixed(1) + '%') + '</strong><small>' + data.quality.inspectedQty.toLocaleString('en-IN') + ' units inspected</small></article><article class="analytics-kpi"><span>ACTUAL HOURS</span><strong>' + formatHours(data.totals.actualHours) + '</strong><small>' + data.totals.entriesWithoutActualHours + ' entries missing actual hours</small></article><article class="analytics-kpi"><span>MACHINE DOWNTIME</span><strong>' + formatHours(data.downtime.totalHours) + '</strong><small>' + data.downtime.records + ' downtime records</small></article><article class="analytics-kpi"><span>ON-TIME DELIVERY</span><strong>' + onTimeLabel + '</strong><small>' + data.onTimeDelivery.onTimeJobs + ' / ' + data.onTimeDelivery.eligibleJobs + ' eligible delivered jobs</small></article></div>' + machineOeeMarkup +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Production trend</strong><span class="subtle">' + safe(data.range.groupBy) + ' totals</span></div>' +
    (trendRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>PERIOD</th><th>PRODUCED</th><th>GOOD</th><th>REJECTED</th><th>ACTUAL HOURS</th><th>THROUGHPUT</th></tr></thead><tbody>' + trendRows + '</tbody></table></div>' : '<div class="empty-state">No production records in this date range.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Worker productivity</strong><span class="subtle">Output per recorded actual hour; not inferred from scheduled hours</span></div>' +
    (workerRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>WORKER</th><th>PRODUCED</th><th>GOOD</th><th>REJECTED</th><th>ACTUAL HOURS</th><th>UNITS / HR</th><th>GOOD YIELD</th><th>DATA GAPS</th></tr></thead><tbody>' + workerRows + '</tbody></table></div>' : '<div class="empty-state">No worker production entries in this date range.</div>') + '</section>' +
    '<div class="analytics-two-col"><section class="content-card"><div class="toolbar"><strong style="font-size:12px">Planned vs actual hours</strong></div><div class="analytics-plan-grid"><div><small>LINKED SESSIONS</small><strong>' + data.planVsActual.linkedSessions + ' / ' + data.planVsActual.scheduledSessions + '</strong></div><div><small>PLANNED HOURS</small><strong>' + formatHours(data.planVsActual.plannedHours) + '</strong></div><div><small>ACTUAL HOURS</small><strong>' + formatHours(data.planVsActual.actualHours) + '</strong></div><div><small>VARIANCE</small><strong>' + planVariance + '</strong></div></div><p class="subtle">Only production records explicitly linked to a scheduled session are compared. ' + data.planVsActual.unlinkedProductionEntries + ' production entries have no matching scheduled session in this report.</p></section><section class="content-card"><div class="toolbar"><strong style="font-size:12px">Quality & rework</strong></div><div class="analytics-plan-grid"><div><small>QC FAIL RATE</small><strong>' + (data.quality.failRatePercent === null ? '—' : data.quality.failRatePercent.toFixed(1) + '%') + '</strong></div><div><small>REWORKED</small><strong>' + data.rework.reworkedQty.toLocaleString('en-IN') + '</strong></div><div><small>RECOVERED</small><strong>' + data.rework.recoveredQty.toLocaleString('en-IN') + '</strong></div><div><small>SCRAPPED</small><strong>' + data.rework.scrappedQty.toLocaleString('en-IN') + '</strong></div></div><p class="subtle">' + actualHoursNote + '.</p></section></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Job performance</strong><span class="subtle">Lifetime completion with period output</span></div>' +
    (jobRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>JOB</th><th>CUSTOMER / WORK</th><th>PERIOD OUTPUT</th><th>LIFETIME OUTPUT / TARGET</th><th>COMPLETION</th><th>UNITS / HR</th></tr></thead><tbody>' + jobRows + '</tbody></table></div>' : '<div class="empty-state">No job production in this date range.</div>') + '</section>' +
    '<div class="analytics-two-col"><section class="content-card"><div class="toolbar"><strong style="font-size:12px">Downtime by machine</strong></div>' +
    (machineRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>MACHINE / WORKSTATION</th><th>DOWNTIME</th><th>TOTAL</th></tr></thead><tbody>' + machineRows + '</tbody></table></div>' : '<div class="empty-state">No downtime entries in this date range.</div>') + '</section><section class="content-card"><div class="toolbar"><strong style="font-size:12px">Downtime by reason</strong></div>' +
    (reasonRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>REASON</th><th>DOWNTIME</th><th>TOTAL</th></tr></thead><tbody>' + reasonRows + '</tbody></table></div>' : '<div class="empty-state">No downtime reasons recorded.</div>') + '</section></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Downtime log</strong><button class="table-button" data-new-downtime>＋ Add record</button></div>' +
    (downtimeRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>RECORD</th><th>MACHINE</th><th>START</th><th>END</th><th>DURATION</th><th>REASON</th><th>JOB</th><th>REPORTED BY</th></tr></thead><tbody>' + downtimeRows + '</tbody></table></div>' : '<div class="empty-state">No downtime records yet. Log machine or workstation stops to measure lost time.</div>') + '</section>';
}

function localDateTimeValue(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function createDowntimeRecord() {
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  const jobOptions = '<option value="">Not linked to a job</option>' + jobs.map((job) => '<option value="' + safe(job.id) + '">' + safe(job.id + ' · ' + job.customer + ' · ' + job.item) + '</option>').join('');
  const machineOptions = '<option value="">Enter machine name manually</option>' + machines.map((machine) => '<option value="' + safe(machine.id) + '">' + safe(machine.code + ' · ' + machine.name) + '</option>').join('');
  openModal('<h2 id="modalTitle">Log machine downtime</h2><p>Record an actual machine or workstation stop. Duration is calculated from the start and end time.</p><form id="downtimeForm" class="form-grid"><label>Registered machine (optional)<select name="machineId">' + machineOptions + '</select></label><label>Machine / workstation<input required name="machineName" placeholder="e.g. Flexo press 1"></label><div class="form-row"><label>Start time<input required type="datetime-local" name="startAt" value="' + localDateTimeValue(now) + '"></label><label>End time<input required type="datetime-local" name="endAt" value="' + localDateTimeValue(end) + '"></label></div><label>Reason<select required name="reason"><option value="">Select reason</option><option>Breakdown</option><option>Planned maintenance</option><option>Material shortage</option><option>Power outage</option><option>Changeover / setup</option><option>Quality issue</option><option>Operator unavailable</option><option>Other</option></select></label><label>Related job (optional)<select name="jobId">' + jobOptions + '</select></label><label>Reported by<input required name="reportedBy" placeholder="Name of operator / supervisor"></label><label>Notes<input name="notes" placeholder="Cause, action taken or maintenance reference"></label><p id="downtimeError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save downtime record</button></div></form>');
  ui('#downtimeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/operations/downtime', {
        method: 'POST',
        body: JSON.stringify({
          machineName: data.get('machineName'),
          machineId: data.get('machineId'),
          startAt: data.get('startAt'),
          endAt: data.get('endAt'),
          reason: data.get('reason'),
          jobId: data.get('jobId'),
          reportedBy: data.get('reportedBy'),
          notes: data.get('notes')
        })
      });
      downtimeLogs.splice(0, downtimeLogs.length, ...(result.downtimeLogs || []));
      save(false);
      closeModal();
      goto('analytics');
      notify(result.record.id + ' saved · ' + result.record.durationMinutes + ' minutes of downtime.');
    } catch (error) {
      const element = ui('#downtimeError');
      element.textContent = error.message;
      element.hidden = false;
    }
  });
}

function exportAnalyticsCsv() {
  const data = currentAnalytics();
  const rows = [
    ['Section', 'Metric', 'Period / Entity', 'Value', 'Unit', 'Notes'],
    ['Production', 'Produced quantity', '', data.totals.producedQty, 'units', 'Filtered by production date'],
    ['Production', 'Good quantity', '', data.totals.goodQty, 'units', 'Worker reported'],
    ['Production', 'Rejected quantity', '', data.totals.rejectedQty, 'units', 'Worker reported'],
    ['Production', 'Actual hours', '', data.totals.actualHours, 'hours', data.totals.entriesWithoutActualHours + ' entries missing actual hours'],
    ['Quality', 'QC pass rate', '', data.quality.passRatePercent === null ? '' : data.quality.passRatePercent, '%', data.quality.inspectedQty + ' units inspected'],
    ['Quality', 'QC fail rate', '', data.quality.failRatePercent === null ? '' : data.quality.failRatePercent, '%', 'Inspection-level rate'],
    ['Rework', 'Reworked quantity', '', data.rework.reworkedQty, 'units', 'Filtered by rework completion date'],
    ['Downtime', 'Total duration', '', data.downtime.totalHours, 'hours', data.downtime.records + ' records'],
    ['Machine OEE', 'Overall OEE', '', data.machineOee.totals.oeePercent === null ? '' : data.machineOee.totals.oeePercent, '%', data.machineOee.machinesWithOee + ' / ' + data.machineOee.machineCount + ' machines have complete OEE data']
  ];
  data.machineOee.machines.forEach((machine) => rows.push(['Machine OEE', machine.machineName, '', machine.oeePercent === null ? '' : machine.oeePercent, '%', 'Availability: ' + (machine.availabilityPercent === null ? 'n/a' : machine.availabilityPercent) + '; performance: ' + (machine.rawPerformancePercent === null ? 'n/a' : machine.rawPerformancePercent) + '; quality: ' + (machine.qualityPercent === null ? 'n/a' : machine.qualityPercent) + '; downtime: ' + machine.effectiveDowntimeHours + ' hrs; utilization: ' + machine.capacityUtilizationPercent]));
  data.productionTrend.forEach((point) => rows.push(['Trend', 'Produced quantity', point.period, point.producedQty, 'units', 'Good: ' + point.goodQty + '; rejected: ' + point.rejectedQty + '; actual hours: ' + point.actualHours]));
  data.workers.forEach((worker) => rows.push(['Worker', worker.workerName, '', worker.producedQty, 'units', 'Actual hours: ' + worker.actualHours + '; units/hour: ' + (worker.unitsPerActualHour === null ? 'not available' : worker.unitsPerActualHour)]));
  data.downtime.machineDowntime.forEach((item) => rows.push(['Machine downtime', item.machineName, '', item.minutes, 'minutes', item.hours + ' hours']));
  data.downtime.reasons.forEach((item) => rows.push(['Downtime reason', item.reason, '', item.minutes, 'minutes', item.hours + ' hours']));
  data.jobPerformance.forEach((job) => rows.push(['Job', job.jobId, job.customer, job.producedQty, 'units', 'Target: ' + job.targetQty + '; completion: ' + (job.completionPercent === null ? 'not available' : job.completionPercent + '%')]));
  downloadCsv('factoryflow-production-analytics.csv', rows);
}

function facilitiesPage() {
  const state = window.FactoryFlowAuth.state;
  if (!state.facilitySummariesLoaded) {
    state.facilitySummariesLoaded = true;
    window.FactoryFlowAuth.request('/api/facilities/summary').then((result) => {
      state.facilitySummaries = result.summaries || [];
      if (app.view === 'facilities') render();
    }).catch((error) => {
      state.facilitySummariesLoaded = false;
      notify(error.message);
    });
  }
  const rows = (state.facilitySummaries || []).map((item) => {
    const selected = item.facilityId === state.activeFacilityId;
    return '<tr><td><strong>' + safe(item.facilityName) + '</strong><div class="subtle">' + safe(item.code + (item.city ? ' · ' + item.city : '')) + '</div></td>' +
      '<td>' + item.activeJobs.toLocaleString('en-IN') + '</td>' +
      '<td>' + item.activeWorkers.toLocaleString('en-IN') + '</td>' +
      '<td>' + item.producedQty.toLocaleString('en-IN') + '</td>' +
      '<td>' + (item.unitsPerActualHour === null ? '—' : item.unitsPerActualHour.toLocaleString('en-IN')) + '</td>' +
      '<td>' + item.stockAlerts + '</td><td>' + item.downtimeHours.toFixed(2) + ' hrs</td>' +
      '<td>' + (item.onTimeDeliveryPercent === null ? '—' : item.onTimeDeliveryPercent.toFixed(1) + '%') + '</td>' +
      '<td><div class="facility-row-actions">' + (selected ? '<span class="status on-track">Selected</span>' : '<button class="table-button" data-use-facility="' + safe(item.facilityId) + '">Open facility</button>') +
      (window.FactoryFlowAuth.has('facilities.manage') ? '<button class="table-button" data-edit-facility="' + safe(item.facilityId) + '">Manage</button>' : '') + '</div></td></tr>';
  }).join('');
  const summaries = state.facilitySummaries || [];
  const activeJobs = summaries.reduce((sum, item) => sum + item.activeJobs, 0);
  const produced = summaries.reduce((sum, item) => sum + item.producedQty, 0);
  const alerts = summaries.reduce((sum, item) => sum + item.stockAlerts, 0);
  const downtime = summaries.reduce((sum, item) => sum + item.downtimeHours, 0);
  return head('ORGANIZATION', 'Factory facilities', 'Manage separate factory sites and compare output, staffing, inventory alerts and downtime across your assigned facilities.',
    window.FactoryFlowAuth.has('facilities.manage') ? '<button class="primary-button" data-add-facility>＋ Add facility</button>' : '') +
    '<div class="facility-overview-grid">' +
      '<article class="facility-overview-stat"><span>FACILITIES</span><strong>' + summaries.length + '</strong><small>Active sites in your access scope</small></article>' +
      '<article class="facility-overview-stat"><span>ACTIVE JOBS</span><strong>' + activeJobs.toLocaleString('en-IN') + '</strong><small>Across assigned factories</small></article>' +
      '<article class="facility-overview-stat"><span>PRODUCTION OUTPUT</span><strong>' + produced.toLocaleString('en-IN') + '</strong><small>Recorded units across all sites</small></article>' +
      '<article class="facility-overview-stat"><span>STOCK ALERTS</span><strong>' + alerts + '</strong><small>Critical and low-stock materials</small></article>' +
      '<article class="facility-overview-stat"><span>DOWNTIME</span><strong>' + downtime.toFixed(2) + ' hrs</strong><small>Recorded facility downtime</small></article>' +
    '</div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Facility comparison</strong><span class="subtle">Summary only; detailed records remain facility-scoped</span></div>' +
    (rows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>FACILITY</th><th>ACTIVE JOBS</th><th>ACTIVE WORKERS</th><th>PRODUCED</th><th>UNITS / HR</th><th>STOCK ALERTS</th><th>DOWNTIME</th><th>ON-TIME DELIVERY</th><th>ACTIONS</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state">No facilities are assigned to your account.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>How facility isolation works</strong></div><p class="subtle">Jobs, workers, schedules, materials, purchases, production logs, QC records, deliveries and downtime are stored with a facility ID. Switching facilities reloads the workspace from the server. A user can only switch to facilities assigned to their account.</p></section>';
}

function facilityCheckboxOptions(selectedIds = []) {
  const selected = new Set(selectedIds);
  return (window.FactoryFlowAuth.state.facilities || []).map((facility) =>
    '<label class="facility-check"><input type="checkbox" name="facilityIds" value="' + safe(facility.id) + '"' + (selected.has(facility.id) ? ' checked' : '') + '><span><strong>' + safe(facility.name) + '</strong><small>' + safe(facility.code + (facility.city ? ' · ' + facility.city : '')) + '</small></span></label>'
  ).join('');
}

function addFacility() {
  openModal('<h2 id="modalTitle">Add factory facility</h2><p>Create a separate site for its own jobs, stock, teams, schedules and production history.</p><form id="facilityForm" class="form-grid"><label>Facility name<input required name="name" maxlength="100" placeholder="e.g. Pune Plant"></label><label>Facility code<input required name="code" maxlength="12" placeholder="e.g. PUNE-01"></label><label>City<input name="city" maxlength="100" placeholder="Pune"></label><label>Address<input name="address" maxlength="250" placeholder="Industrial estate / address"></label><label>Time zone<input name="timezone" maxlength="80" value="Asia/Kolkata"></label><p class="subtle">A new facility starts with empty operational collections. Existing records stay in the Main facility unless explicitly transferred in a future workflow.</p><p id="facilityError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Create facility</button></div></form>');
  ui('#facilityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/facilities', {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          code: data.get('code'),
          city: data.get('city'),
          address: data.get('address'),
          timezone: data.get('timezone')
        })
      });
      window.FactoryFlowAuth.state.facilities.push(result.facility);
      window.FactoryFlowAuth.state.facilitySummariesLoaded = false;
      window.FactoryFlowAuth.applyNavigation();
      closeModal();
      render();
      notify(result.facility.name + ' created. Assign users to this facility from User management.');
    } catch (error) {
      const node = ui('#facilityError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function manageFacility(facilityId) {
  const facility = (window.FactoryFlowAuth.state.facilities || []).find((item) => item.id === facilityId);
  if (!facility) return;
  openModal('<h2 id="modalTitle">Manage facility</h2><p>' + safe(facility.code) + ' · Facility data is retained when a site is deactivated.</p><form id="editFacilityForm" class="form-grid"><label>Facility name<input required name="name" maxlength="100" value="' + safe(facility.name) + '"></label><label>Facility code<input required name="code" maxlength="12" value="' + safe(facility.code) + '"></label><label>City<input name="city" maxlength="100" value="' + safe(facility.city || '') + '"></label><label>Address<input name="address" maxlength="250" value="' + safe(facility.address || '') + '"></label><label>Time zone<input name="timezone" maxlength="80" value="' + safe(facility.timezone || 'Asia/Kolkata') + '"></label><label class="facility-inline-check"><input type="checkbox" name="active"' + (facility.active !== false ? ' checked' : '') + '> Facility is active</label><label class="facility-inline-check"><input type="checkbox" name="isDefault"' + (facility.isDefault ? ' checked' : '') + '> Make this the default facility</label><p class="subtle">The default facility cannot be deactivated. Deactivated facilities are hidden from switching and new assignments; their records are retained.</p><p id="facilityError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save facility</button></div></form>');
  ui('#editFacilityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/facilities/' + encodeURIComponent(facility.id), {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.get('name'),
          code: data.get('code'),
          city: data.get('city'),
          address: data.get('address'),
          timezone: data.get('timezone'),
          active: data.get('active') === 'on',
          isDefault: data.get('isDefault') === 'on'
        })
      });
      const facilityState = window.FactoryFlowAuth.state;
      const index = facilityState.facilities.findIndex((item) => item.id === facility.id);
      if (index >= 0) facilityState.facilities.splice(index, 1, result.facility);
      facilityState.facilities.forEach((item) => { item.isDefault = item.id === result.facility.id ? result.facility.isDefault : result.facility.isDefault ? false : item.isDefault; });
      facilityState.facilitySummariesLoaded = false;
      window.FactoryFlowAuth.applyNavigation();
      closeModal();
      if (!result.facility.active && facilityState.activeFacilityId === facility.id) {
        const nextFacility = facilityState.facilities.find((item) => item.isDefault && item.active !== false) || facilityState.facilities.find((item) => item.active !== false);
        if (nextFacility) return switchActiveFacility(nextFacility.id);
      }
      render();
      notify('Facility settings saved.');
    } catch (error) {
      const node = ui('#facilityError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

async function switchActiveFacility(facilityId) {
  try {
    window.FactoryFlowAuth.setActiveFacility(facilityId);
    workspaceReady = false;
    await hydrateWorkspace();
    if (!workspaceReady) throw new Error('Could not load this facility. Check your facility access.');
    window.FactoryFlowAuth.applyNavigation();
    render();
    notify('Switched to ' + ((window.FactoryFlowAuth.state.facilities || []).find((item) => item.id === facilityId)?.name || 'selected facility') + '.');
  } catch (error) {
    notify(error.message);
    window.FactoryFlowAuth.applyNavigation();
  }
}

function usersPage() {
  const authState = window.FactoryFlowAuth.state;
  if (!authState.usersLoaded) {
    authState.usersLoaded = true;
    Promise.all([
      window.FactoryFlowAuth.request('/api/users'),
      window.FactoryFlowAuth.request('/api/audit')
    ]).then(([usersResult, auditResult]) => {
      authState.adminUsers = usersResult.users || [];
      authState.auditRecords = auditResult.records || [];
      if (app.view === 'users') render();
    }).catch((error) => notify(error.message));
  }
  const users = authState.adminUsers || [];
  const rows = users.map((user) => '<tr><td><strong>' + safe(user.name) + '</strong><div class="subtle">' + safe(user.email) + '</div></td><td><span class="user-role">' + safe(user.roleLabel) + '</span>' + (user.workerId ? '<div class="subtle">' + safe(user.workerId) + '</div>' : '') + '</td><td><span class="status ' + (user.active ? 'on-track' : 'critical') + '">' + (user.active ? 'Active' : 'Inactive') + '</span>' + (user.mustChangePassword ? '<div class="subtle">Password change required</div>' : '') + '</td><td>' + safe(user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : 'Never') + '</td><td><button class="table-button" data-edit-user="' + safe(user.id) + '">Manage</button></td></tr>').join('');
  const auditRows = (authState.auditRecords || []).slice(0, 12).map((record) => '<tr><td>' + safe(new Date(record.createdAt).toLocaleString('en-IN')) + '</td><td><strong>' + safe(record.actorName) + '</strong><div class="subtle">' + safe(record.actorRole) + '</div></td><td>' + safe(record.action) + '</td><td>' + safe(record.targetType + (record.targetId ? ' · ' + record.targetId : '')) + '</td></tr>').join('');
  const active = users.filter((user) => user.active).length;
  return head('ADMINISTRATION', 'User management', 'Create accounts, assign roles, link workers to production profiles and review recent security-sensitive actions.', '<button class="primary-button" data-add-user>＋ Add user</button>') +
    '<div class="user-admin-grid"><article class="user-admin-stat"><span>ACCOUNTS</span><strong>' + users.length + '</strong></article><article class="user-admin-stat"><span>ACTIVE USERS</span><strong>' + active + '</strong></article><article class="user-admin-stat"><span>INACTIVE USERS</span><strong>' + (users.length - active) + '</strong></article></div>' +
    '<section class="content-card"><div class="toolbar"><strong>User accounts</strong><span class="subtle">New users must change their temporary password at first sign-in</span></div>' +
    (rows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>USER</th><th>ROLE / WORKER</th><th>STATUS</th><th>LAST SIGN-IN</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state">No user accounts found.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Recent audit activity</strong><span class="subtle">Latest 12 recorded events</span></div>' +
    (auditRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>TIME</th><th>ACTOR</th><th>ACTION</th><th>RECORD</th></tr></thead><tbody>' + auditRows + '</tbody></table></div>' : '<div class="empty-state">No audit activity recorded yet.</div>') + '</section>';
}

function authStateReloadUsers() {
  const state = window.FactoryFlowAuth.state;
  state.usersLoaded = false;
  state.adminUsers = [];
  state.auditRecords = [];
  if (app.view === 'users') render();
}

function addWorkspaceUser() {
  const workerOptions = '<option value="">Not linked to a worker</option>' + workers.map((worker) => '<option value="' + safe(worker.id) + '">' + safe(worker.name + ' · ' + worker.skill + ' · ' + (worker.facilityId || 'Main')) + '</option>').join('');
  const facilityChoices = facilityCheckboxOptions([window.FactoryFlowAuth.state.activeFacilityId]);
  openModal('<h2 id="modalTitle">Create user account</h2><p>Assign the least-privileged role needed. Worker accounts must be linked to an active worker profile.</p><form id="addUserForm" class="form-grid"><label>Full name<input required name="name" maxlength="100"></label><label>Email address<input required name="email" type="email"></label><label>Role<select required name="role"><option value="manager">Manager</option><option value="supervisor">Production supervisor</option><option value="worker">Worker</option><option value="admin">Administrator</option></select></label><label id="newUserWorkerLabel" hidden>Worker profile<select name="workerId">' + workerOptions + '</select></label><div id="newUserFacilityLabel" class="facility-assignment"><strong>Facility access</strong><p class="subtle">Select the factories this account is allowed to access. Administrators have organization-wide access.</p><div id="newUserFacilityChoices" class="facility-check-list">' + facilityChoices + '</div></div><label>Temporary password<input required name="password" type="password" minlength="12" autocomplete="new-password" placeholder="12+ characters, uppercase, lowercase and number"></label><p class="subtle">The new user must change this password at first sign-in. Share temporary credentials through a separate secure channel.</p><p id="addUserError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Create account</button></div></form>');
  const roleSelect = ui('#addUserForm [name="role"]');
  const workerLabel = ui('#newUserWorkerLabel');
  const facilityLabel = ui('#newUserFacilityLabel');
  const workerSelect = ui('#addUserForm [name="workerId"]');
  const updateFacilitySelection = () => {
    const workerAccount = roleSelect.value === 'worker';
    const adminAccount = roleSelect.value === 'admin';
    workerLabel.hidden = !workerAccount;
    workerSelect.required = workerAccount;
    facilityLabel.hidden = adminAccount;
    const selectedWorker = workers.find((item) => item.id === workerSelect.value);
    ui('#newUserFacilityChoices').querySelectorAll('input[name="facilityIds"]').forEach((input) => {
      input.disabled = false;
      if (workerAccount) input.checked = Boolean(selectedWorker && input.value === selectedWorker.facilityId);
    });
  };
  roleSelect.addEventListener('change', updateFacilitySelection);
  workerSelect.addEventListener('change', updateFacilitySelection);
  updateFacilitySelection();
  ui('#addUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await window.FactoryFlowAuth.request('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          role: data.get('role'),
          workerId: data.get('workerId'),
          facilityIds: data.getAll('facilityIds'),
          password: data.get('password')
        })
      });
      closeModal();
      authStateReloadUsers();
      notify('Account created. The new user must change their password at first sign-in.');
    } catch (error) {
      const node = ui('#addUserError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function manageWorkspaceUser(userId) {
  const user = (window.FactoryFlowAuth.state.adminUsers || []).find((item) => item.id === userId);
  if (!user) return;
  const workerOptions = '<option value="">Not linked</option>' + workers.map((worker) => '<option value="' + safe(worker.id) + '"' + (worker.id === user.workerId ? ' selected' : '') + '>' + safe(worker.name + ' · ' + worker.skill + ' · ' + (worker.facilityId || 'Main')) + '</option>').join('');
  const facilityChoices = facilityCheckboxOptions(user.facilityIds || []);
  openModal('<h2 id="modalTitle">Manage user</h2><p>' + safe(user.email) + '</p><form id="editUserForm" class="form-grid"><label>Full name<input required name="name" maxlength="100" value="' + safe(user.name) + '"></label><label>Role<select name="role"><option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>Administrator</option><option value="manager"' + (user.role === 'manager' ? ' selected' : '') + '>Manager</option><option value="supervisor"' + (user.role === 'supervisor' ? ' selected' : '') + '>Production supervisor</option><option value="worker"' + (user.role === 'worker' ? ' selected' : '') + '>Worker</option></select></label><label id="editUserWorkerLabel">Worker profile<select name="workerId">' + workerOptions + '</select></label><div id="editUserFacilityLabel" class="facility-assignment"><strong>Facility access</strong><p class="subtle">An account can only access facilities selected here. Administrator accounts have global access.</p><div id="editUserFacilityChoices" class="facility-check-list">' + facilityChoices + '</div></div><label>Account status<select name="active"><option value="active"' + (user.active ? ' selected' : '') + '>Active</option><option value="inactive"' + (!user.active ? ' selected' : '') + '>Inactive</option></select></label><p class="subtle">Changing a role, facility assignment or account status revokes existing sessions. You cannot deactivate your own administrator account.</p><p id="editUserError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save user</button></div></form>');
  const roleSelect = ui('#editUserForm [name="role"]');
  const workerLabel = ui('#editUserWorkerLabel');
  const workerSelect = ui('#editUserForm [name="workerId"]');
  const facilityLabel = ui('#editUserFacilityLabel');
  const updateFacilitySelection = () => {
    const workerAccount = roleSelect.value === 'worker';
    const adminAccount = roleSelect.value === 'admin';
    workerLabel.hidden = !workerAccount;
    workerSelect.required = workerAccount;
    facilityLabel.hidden = adminAccount;
    const selectedWorker = workers.find((item) => item.id === workerSelect.value);
    ui('#editUserFacilityChoices').querySelectorAll('input[name="facilityIds"]').forEach((input) => {
      input.disabled = false;
      if (workerAccount) input.checked = Boolean(selectedWorker && input.value === selectedWorker.facilityId);
    });
  };
  roleSelect.addEventListener('change', updateFacilitySelection);
  workerSelect.addEventListener('change', updateFacilitySelection);
  updateFacilitySelection();
  ui('#editUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await window.FactoryFlowAuth.request('/api/users/' + encodeURIComponent(user.id), {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.get('name'),
          role: data.get('role'),
          workerId: data.get('workerId'),
          facilityIds: data.getAll('facilityIds'),
          active: data.get('active') === 'active'
        })
      });
      closeModal();
      authStateReloadUsers();
      notify('User account updated.');
    } catch (error) {
      const node = ui('#editUserError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function costingPage() {
  const rows = jobs.map((job) => ({ job, cost: window.FactoryFlowCosting.calculateJobCost(job, movements) }));
  const quotedRevenue = rows.reduce((total, row) => total + (row.cost.revenueConfigured ? row.cost.revenue : 0), 0);
  const knownCosts = rows.reduce((total, row) => total + row.cost.knownCost, 0);
  const incomplete = rows.filter((row) => !row.cost.complete).length;
  const body = rows.map(({ job, cost }) => {
    const materialLabel = currency(cost.materialCost) + (cost.unpricedMovements ? '<div class="subtle">' + cost.unpricedMovements + ' unpriced usage record(s)</div>' : '');
    const profitLabel = cost.profit === null ? 'Incomplete' : currency(cost.profit);
    const marginLabel = cost.marginPercent === null ? '—' : cost.marginPercent.toFixed(2) + '%';
    const statusLabel = cost.complete ? 'Complete' : 'Needs pricing';
    return '<tr><td class="order-code">' + safe(job.id) + '</td><td><div class="item-name">' + safe(job.item) + '</div><div class="subtle">' + safe(job.customer) + '</div></td><td>' + (cost.revenueConfigured ? currency(cost.revenue) : 'Not set') + '</td><td>' + materialLabel + '</td><td>' + currency(cost.workerCost) + '</td><td>' + currency(cost.otherCost) + '</td><td>' + currency(cost.knownCost) + '<div class="subtle">Known cost</div></td><td><strong>' + profitLabel + '</strong></td><td>' + marginLabel + '<div class="subtle">' + statusLabel + '</div></td><td><button class="table-button" data-cost-job="' + safe(job.id) + '">Edit costs</button></td></tr>';
  }).join('');
  return head('FINANCE', 'Job costing & profitability', 'Compare selling value against material consumed, job-worker charges and other direct costs. Incomplete records are flagged instead of guessed.', '') +
    '<div class="summary-cards">' +
    metric('JOBS TRACKED', rows.length, 'Jobs in the workspace') +
    metric('SELLING VALUE', currency(quotedRevenue), 'Revenue entered before GST') +
    metric('KNOWN COSTS', currency(knownCosts), 'Material, worker and other costs') +
    metric('INCOMPLETE COSTINGS', incomplete, 'Missing revenue or unpriced usage', incomplete > 0) +
    '</div><section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Profitability by job</strong><span class="subtle">Material usage is costed using the unit price captured when consumed</span></div>' +
    (rows.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>JOB</th><th>WORK</th><th>SELLING VALUE</th><th>MATERIAL COST</th><th>WORKER CHARGE</th><th>OTHER COST</th><th>KNOWN TOTAL COST</th><th>GROSS PROFIT</th><th>MARGIN</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' : '<div class="empty-state"><h2>No jobs available</h2><p>Create a job or convert a quote into a job to begin costing.</p></div>') + '</section>' +
    '<p class="subtle" style="margin-top:12px">Known total cost includes priced material usage only. A job’s profit and margin remain incomplete if any consumption record has no captured unit cost or if selling value has not been entered. Set unit costs under Materials before recording future usage.</p>';
}

function workersPage() {
  const analysis = window.FactoryFlowScheduling.analyzeSchedule(jobs, schedules, workers);
  const today = localDateISO();
  const todayLoads = new Map(analysis.dailyLoads.filter((load) => load.date === today).map((load) => [load.workerId, load]));
  const workerCards = workers.map((worker) => {
    const load = todayLoads.get(worker.id);
    const assigned = load ? load.assignedHours : 0;
    const capacity = Number(worker.capacityHoursPerDay) || 0;
    const percent = capacity > 0 ? Math.min(100, Math.round(assigned / capacity * 100)) : 0;
    const unavailable = (worker.unavailableDates || []).length;
    return '<article class="worker-capacity-card"><div class="worker-card-head"><span class="person-avatar">' + safe(worker.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()) + '</span><div class="person-info"><strong>' + safe(worker.name) + '</strong><small>' + safe(worker.skill || 'General production') + '</small></div><span class="status ' + (worker.active === false ? 'critical' : 'on-track') + '">' + (worker.active === false ? 'Inactive' : 'Active') + '</span></div><div class="capacity-meta"><span>Today’s assigned load</span><strong>' + assigned.toFixed(1) + ' / ' + capacity.toFixed(1) + ' hrs</strong></div><div class="capacity-track"><i style="width:' + percent + '%"></i></div><div class="worker-card-foot"><span>' + unavailable + ' unavailable date(s)</span>' + (window.FactoryFlowAuth.has('workers.manage') ? '<button class="table-button" data-edit-worker="' + safe(worker.id) + '">Edit profile</button>' : '') + '</div></article>';
  }).join('');
  const recentSessions = analysis.sessions.filter((session) => session.date >= today).slice(0, 6).map((session) => '<div class="schedule-item"><div class="schedule-time">' + safe(session.date) + '</div><div class="schedule-copy"><strong>' + safe(session.jobId) + ' · ' + safe(session.workerName) + '</strong><small>' + safe(session.job) + ' · ' + Number(session.hours).toFixed(1) + ' hours</small></div><span class="status ' + (session.deadlineRisk || session.workerUnavailable ? 'critical' : 'on-track') + '">' + (session.deadlineRisk ? 'Deadline risk' : session.workerUnavailable ? 'Unavailable' : 'Planned') + '</span></div>').join('');
  return head('PARTNERS', 'Job-worker capacity', 'Manage worker skills, daily capacity, availability and live production assignments.', '<button class="secondary-button" data-go="schedule">Open production schedule →</button>') +
    '<section class="worker-capacity-grid">' + (workerCards.length ? workerCards.join('') : '<div class="empty-state">No workers configured.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Upcoming scheduled work</strong><span class="subtle">' + analysis.sessionCount + ' active session(s)</span></div>' +
    (recentSessions.length ? '<div class="schedule-list">' + recentSessions + '</div>' : '<div class="empty-state"><h2>No scheduled sessions</h2><p>Schedule a job to start tracking worker capacity.</p></div>') + '</section>';
}


function currentMachineHealth() {
  return window.FactoryFlowMachines.buildMachineHealth({
    machines,
    schedules,
    productionLogs,
    downtimeLogs,
    maintenanceRecords,
    asOfDate: localDateISO(),
    lookbackDays: 90
  });
}

function maintenancePage() {
  const health = currentMachineHealth();
  const canManage = window.FactoryFlowAuth.has('machines.manage');
  const levelClass = (level) => level === 'Critical' ? 'critical' : level === 'High' ? 'delayed' : level === 'Moderate' ? 'low' : 'on-track';
  const serviceClass = (state) => state === 'Overdue' ? 'critical' : state === 'Due soon' ? 'low' : state === 'On track' ? 'on-track' : 'setup';
  const rows = health.machines.map((item) => {
    const due = item.serviceStatus === 'Not configured' ? 'Configure interval' :
      item.serviceStatus === 'Overdue' ? 'Service overdue' :
      item.serviceStatus === 'Due soon' ? 'Due soon' : 'On track';
    const dueDetail = item.serviceIntervalHours > 0
      ? (item.hoursUntilDue <= 0 ? Math.abs(item.hoursUntilDue).toFixed(1) + ' hrs overdue' : item.hoursUntilDue.toFixed(1) + ' hrs remaining')
      : 'No hour interval';
    const dateDetail = item.nextDueDate
      ? (item.daysUntilDue <= 0 ? Math.abs(item.daysUntilDue) + ' days overdue' : item.daysUntilDue + ' days remaining')
      : 'No calendar interval';
    return '<tr><td><strong>' + safe(item.machineName) + '</strong><div class="subtle">' + safe(item.machineCode) + '</div></td>' +
      '<td><span class="status ' + serviceClass(item.serviceStatus) + '">' + safe(due) + '</span><div class="subtle">' + safe(dueDetail) + ' · ' + safe(dateDetail) + '</div></td>' +
      '<td>' + Number(item.usageHoursSinceService).toFixed(1) + ' hrs<div class="subtle">Since ' + safe(item.lastServiceDate || 'machine setup') + '</div></td>' +
      '<td><span class="status ' + levelClass(item.riskLevel) + '">' + safe(item.riskLevel) + ' · ' + item.riskScore + '/100</span><div class="subtle">' + item.downtimeEvents + ' event(s) · ' + item.downtimeHours.toFixed(1) + ' hrs / 90 days</div></td>' +
      '<td>' + (item.signals.length ? '<div class="maintenance-signal-list">' + item.signals.map((signal) => '<small>' + safe(signal) + '</small>').join('') + '</div>' : '<span class="subtle">No current review signal</span>') + '</td>' +
      '<td><div class="machine-actions">' + (canManage ? '<button class="table-button" data-edit-machine="' + safe(item.machineId) + '">Service plan</button><button class="table-button" data-service-machine="' + safe(item.machineId) + '">Record service</button>' : '—') + '</div></td></tr>';
  }).join('');
  const history = maintenanceRecords.slice().sort((a, b) =>
    String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  ).slice(0, 12).map((record) =>
    '<tr><td>' + safe(record.serviceDate) + '</td><td><strong>' + safe(record.machineName || record.machineCode) + '</strong><div class="subtle">' + safe(record.machineCode || '') + '</div></td>' +
    '<td>' + safe(record.serviceType) + '</td><td>' + safe(record.performedBy) + '</td><td>' + safe(record.notes || '—') + '</td></tr>'
  ).join('');
  const trend = health.downtimeTrend.slice(-14).map((item) =>
    '<tr><td>' + safe(item.date) + '</td><td>' + item.events + '</td><td>' + item.breakdowns + '</td><td>' + item.downtimeHours.toFixed(2) + ' hrs</td></tr>'
  ).join('');
  return head('EQUIPMENT HEALTH', 'Predictive maintenance', 'Review preventive service due dates, recent breakdown patterns and transparent machine risk indicators.', '<button class="secondary-button" data-go="machines">Manage equipment</button>') +
    '<div class="inventory-grid">' +
      '<article class="inventory-stat"><span>REGISTERED MACHINES</span><strong>' + health.summary.machineCount + '</strong><small>' + health.summary.configuredCount + ' with service intervals configured</small></article>' +
      '<article class="inventory-stat"><span>SERVICE OVERDUE</span><strong>' + health.summary.overdueCount + '</strong><small>Hour-based or calendar interval reached</small></article>' +
      '<article class="inventory-stat"><span>DUE SOON</span><strong>' + health.summary.dueSoonCount + '</strong><small>Inside configured reminder lead time</small></article>' +
      '<article class="inventory-stat"><span>HIGH / CRITICAL RISK</span><strong>' + health.summary.highRiskCount + '</strong><small>Rules-based review score</small></article>' +
      '<article class="inventory-stat"><span>DOWNTIME · 90 DAYS</span><strong>' + health.summary.downtimeHours.toFixed(1) + ' hrs</strong><small>Recorded across registered machines</small></article>' +
    '</div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><div><strong>Equipment health & service status</strong><p class="subtle">As of ' + safe(health.asOfDate) + ' · ' + health.lookbackDays + '-day downtime lookback</p></div><span class="subtle">' + health.machines.length + ' machine(s)</span></div>' +
    (rows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>MACHINE</th><th>PREVENTIVE SERVICE</th><th>USAGE SINCE SERVICE</th><th>BREAKDOWN RISK</th><th>WHY IT IS FLAGGED</th><th>ACTIONS</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
      '<div class="empty-state"><h2>No machines registered</h2><p>Register equipment before setting service intervals or reviewing health signals.</p><button class="primary-button" data-go="machines">Open machines & equipment</button></div>') +
    '</section>' +
    '<div class="analytics-two-col"><section class="content-card"><div class="toolbar"><strong>Recent downtime trend</strong><span class="subtle">90-day window</span></div>' +
      (trend ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>DATE</th><th>EVENTS</th><th>BREAKDOWNS</th><th>DOWNTIME</th></tr></thead><tbody>' + trend + '</tbody></table></div>' : '<div class="empty-state">No machine downtime recorded in the lookback window.</div>') +
    '</section><section class="content-card"><div class="toolbar"><strong>Service history</strong><span class="subtle">Latest 12 records</span></div>' +
      (history ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>DATE</th><th>MACHINE</th><th>SERVICE</th><th>PERFORMED BY</th><th>NOTES</th></tr></thead><tbody>' + history + '</tbody></table></div>' : '<div class="empty-state">No service records yet. Record a completed service to start a machine history.</div>') +
    '</section></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>How the risk indicator works</strong></div><div class="maintenance-method">' +
      '<p>Scores are a review aid, not a probability of failure. The rules combine overdue preventive service, downtime frequency, recorded downtime hours, and repeated breakdown / repair reasons in the last 90 days.</p>' +
      '<p>Service usage is estimated from machine-linked scheduled hours, using recorded actual hours when available. Calendar due dates use the latest service date. Set either an hour interval, a calendar interval, or both on the machine service plan.</p>' +
      '<p>No IoT sensors, vibration readings or live condition data are assumed. A missing service plan is shown as not configured rather than being assigned an invented due date.</p>' +
    '</div></section>';
}


function maintenanceWorkOrdersPage() {
  const canManage = window.FactoryFlowAuth.has('maintenance.manage');
  const orders = maintenanceWorkOrders.slice().sort((a, b) =>
    String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
  );
  const visible = maintenanceWorkOrderFilter === 'All' ? orders : orders.filter((order) => order.status === maintenanceWorkOrderFilter);
  const openCount = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status)).length;
  const urgentCount = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status) && order.priority === 'Urgent').length;
  const overdueCount = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status) && order.dueDate && order.dueDate < localDateISO()).length;
  const partsCost = (order) => (order.partsUsed || []).reduce((sum, part) => sum + (Number(part.costAmount) || 0), 0);
  const rows = visible.map((order) => {
    const overdue = !['Completed', 'Cancelled'].includes(order.status) && order.dueDate && order.dueDate < localDateISO();
    const parts = order.partsUsed || [];
    const totalCost = partsCost(order) + (Number(order.laborCost) || 0);
    return '<tr><td><strong class="order-code">' + safe(order.id) + '</strong><div class="subtle">' + safe(order.type) + '</div></td>' +
      '<td><strong>' + safe(order.machineName) + '</strong><div class="subtle">' + safe(order.machineCode) + '</div></td>' +
      '<td><strong>' + safe(order.title) + '</strong><div class="subtle">' + safe(order.description) + '</div></td>' +
      '<td>' + status(order.priority) + '</td>' +
      '<td>' + safe(order.assignedTo || 'Unassigned') + '</td>' +
      '<td>' + (order.dueDate ? safe(order.dueDate) : '—') + (overdue ? '<div class="mwo-overdue">Overdue</div>' : '') + '</td>' +
      '<td>' + status(order.status) + (order.scheduledDate ? '<div class="subtle">' + safe(order.scheduledDate + ' · ' + order.startTime + '–' + order.endTime) + '</div>' : '') + '</td>' +
      '<td>' + parts.length + ' part(s)<div class="subtle">' + (totalCost ? currency(totalCost) : 'Cost n/a') + '</div></td>' +
      '<td><div class="machine-actions">' + (canManage && !['Completed', 'Cancelled'].includes(order.status) ? '<button class="table-button" data-edit-work-order="' + safe(order.id) + '">Update</button><button class="table-button" data-schedule-work-order="' + safe(order.id) + '">Schedule</button><button class="table-button" data-issue-work-order-parts="' + safe(order.id) + '">Issue parts</button>' : '<button class="table-button" data-edit-work-order="' + safe(order.id) + '">View</button>') + '</div></td></tr>';
  }).join('');
  const filters = ['All', 'Open', 'Assigned', 'In progress', 'Waiting for parts', 'Completed', 'Cancelled'];
  const filterButtons = filters.map((filter) => '<button type="button" class="filter-chip ' + (maintenanceWorkOrderFilter === filter ? 'active' : '') + '" data-mwo-filter="' + safe(filter) + '">' + safe(filter) + '</button>').join('');
  const recentParts = orders.flatMap((order) => (order.partsUsed || []).map((part) => ({
    ...part, workOrderId: order.id, machineName: order.machineName
  }))).sort((a, b) => String(b.issuedAt || '').localeCompare(String(a.issuedAt || ''))).slice(0, 10);
  const partRows = recentParts.map((part) =>
    '<tr><td class="order-code">' + safe(part.workOrderId) + '</td><td>' + safe(part.machineName) + '</td><td><strong>' + safe(part.material) + '</strong><div class="subtle">' + safe(part.materialSku) + '</div></td><td>' + Number(part.quantity).toLocaleString('en-IN') + ' ' + safe(part.unit) + '</td><td>' + (part.costAmount === null ? 'Unpriced' : currency(part.costAmount)) + '</td><td>' + safe(part.issuedByName || '—') + '</td><td>' + new Date(part.issuedAt).toLocaleDateString('en-IN') + '</td></tr>'
  ).join('');
  return head('EQUIPMENT', 'Maintenance work orders', 'Assign repair and preventive work, issue spare parts from stock, and keep service history connected to each machine.',
      canManage ? '<button class="primary-button" data-new-work-order>＋ Create work order</button>' : '') +
    '<div class="inventory-grid">' +
      '<article class="inventory-stat"><span>OPEN WORK ORDERS</span><strong>' + openCount + '</strong><small>Awaiting or in progress</small></article>' +
      '<article class="inventory-stat"><span>URGENT</span><strong>' + urgentCount + '</strong><small>Open urgent work</small></article>' +
      '<article class="inventory-stat"><span>OVERDUE</span><strong>' + overdueCount + '</strong><small>Past target completion date</small></article>' +
      '<article class="inventory-stat"><span>SPARE PARTS ISSUED</span><strong>' + orders.reduce((sum, order) => sum + (order.partsUsed || []).length, 0) + '</strong><small>Linked to work orders</small></article>' +
    '</div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Work order register</strong><span class="subtle">' + orders.length + ' total</span></div>' +
      '<div class="mwo-filters">' + filterButtons + '</div>' +
      (rows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>WORK ORDER</th><th>MACHINE</th><th>ISSUE / TASK</th><th>PRIORITY</th><th>ASSIGNED TO</th><th>DUE DATE</th><th>STATUS</th><th>SPARE PARTS</th><th>ACTIONS</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
        '<div class="empty-state"><h2>' + (orders.length ? 'No work orders in this filter' : 'No maintenance work orders') + '</h2><p>Create a work order when a machine needs repair, inspection or preventive service. Issued spare parts will deduct from inventory and be linked to the order.</p>' + (canManage ? '<button class="primary-button" data-new-work-order>＋ Create work order</button>' : '') + '</div>') +
    '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Recent spare-part issues</strong><span class="subtle">Latest 10 issues</span></div>' +
      (partRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>WORK ORDER</th><th>MACHINE</th><th>SPARE PART</th><th>QUANTITY</th><th>COST SNAPSHOT</th><th>ISSUED BY</th><th>DATE</th></tr></thead><tbody>' + partRows + '</tbody></table></div>' : '<div class="empty-state">No spare parts have been issued to maintenance work orders.</div>') +
    '</section>' +
    '<section class="content-card mwo-help"><strong>Spare-part setup</strong><p>In Materials, mark stocked items as maintenance spare parts. Those items become available to issue on open work orders. Each issue reduces stock, captures the current unit-cost snapshot and creates an auditable stock movement linked to the work order.</p></section>';
}

function createMaintenanceWorkOrder() {
  if (!window.FactoryFlowAuth.has('maintenance.manage')) return;
  if (!machines.length) return notify('Register a machine before creating a maintenance work order.');
  const machineOptions = machines.map((machine) => '<option value="' + safe(machine.id) + '">' + safe(machine.code + ' · ' + machine.name) + '</option>').join('');
  const typeOptions = window.FactoryFlowMaintenanceWorkOrders.TYPES.map((type) => '<option value="' + safe(type) + '">' + safe(type) + '</option>').join('');
  const priorityOptions = window.FactoryFlowMaintenanceWorkOrders.PRIORITIES.map((priority) => '<option value="' + safe(priority) + '"' + (priority === 'Normal' ? ' selected' : '') + '>' + safe(priority) + '</option>').join('');
  openModal('<h2 id="modalTitle">Create maintenance work order</h2><form id="maintenanceWorkOrderForm" class="form-grid">' +
    '<label>Machine<select required name="machineId">' + machineOptions + '</select></label>' +
    '<label>Work-order title<input required minlength="3" maxlength="120" name="title" placeholder="e.g. Replace worn finishing roller"></label>' +
    '<label>Issue / task description<textarea required maxlength="1200" rows="3" name="description" placeholder="Describe the fault, inspection or work required"></textarea></label>' +
    '<div class="form-row"><label>Work type<select name="type">' + typeOptions + '</select></label><label>Priority<select name="priority">' + priorityOptions + '</select></label></div>' +
    '<div class="form-row"><label>Assign technician<input maxlength="100" name="assignedTo" placeholder="Technician / maintenance provider"></label><label>Target completion date<input type="date" name="dueDate"></label></div>' +
    '<div class="form-row"><label>Estimated labour hours<input type="number" name="laborHours" min="0" max="10000" step="0.25" value="0"></label><label>Labour rate (₹ / hour)<input type="number" name="laborRate" min="0" max="1000000" step="0.01" value="0"></label></div>' +
    '<p id="mwoError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Create work order</button></div></form>');
  ui('#maintenanceWorkOrderForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/maintenance/work-orders', {
        method: 'POST',
        body: JSON.stringify({
          machineId: data.get('machineId'), title: data.get('title'), description: data.get('description'),
          type: data.get('type'), priority: data.get('priority'), assignedTo: data.get('assignedTo'), dueDate: data.get('dueDate'),
          laborHours: Number(data.get('laborHours')), laborRate: Number(data.get('laborRate'))
        })
      });
      maintenanceWorkOrders.unshift(result.workOrder);
      save(false);
      closeModal();
      maintenanceWorkOrderFilter = 'All';
      goto('work-orders');
      notify('Work order ' + result.workOrder.id + ' created.');
    } catch (error) {
      const node = ui('#mwoError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function editMaintenanceWorkOrder(workOrderId) {
  const order = maintenanceWorkOrders.find((item) => item.id === workOrderId);
  if (!order) return notify('Maintenance work order not found.');
  const canManage = window.FactoryFlowAuth.has('maintenance.manage');
  const completed = ['Completed', 'Cancelled'].includes(order.status);
  const statuses = order.status === 'Open' ? ['Open', 'Assigned', 'In progress', 'Cancelled'] :
    order.status === 'Assigned' ? ['Assigned', 'Open', 'In progress', 'Waiting for parts', 'Cancelled'] :
    order.status === 'In progress' ? ['In progress', 'Assigned', 'Waiting for parts', 'Completed', 'Cancelled'] :
    order.status === 'Waiting for parts' ? ['Waiting for parts', 'Assigned', 'In progress', 'Cancelled'] : [order.status];
  const parts = (order.partsUsed || []).map((part) =>
    '<tr><td>' + safe(part.material) + '<div class="subtle">' + safe(part.materialSku) + '</div></td><td>' + Number(part.quantity).toLocaleString('en-IN') + ' ' + safe(part.unit) + '</td><td>' + (part.costAmount === null ? 'Unpriced' : currency(part.costAmount)) + '</td></tr>'
  ).join('');
  openModal('<h2 id="modalTitle">' + safe(order.id) + ' · Work order</h2><p><strong>' + safe(order.machineName) + '</strong> · ' + safe(order.machineCode) + '</p>' +
    '<div class="mwo-detail"><strong>' + safe(order.title) + '</strong><p>' + safe(order.description) + '</p><small>' + safe(order.type) + ' · ' + safe(order.priority) + ' · Due ' + safe(order.dueDate || 'not set') + '</small></div>' +
    (canManage && !completed ? '<form id="maintenanceWorkOrderUpdateForm" class="form-grid"><div class="form-row"><label>Status<select name="status">' + statuses.map((statusValue) => '<option value="' + safe(statusValue) + '"' + (order.status === statusValue ? ' selected' : '') + '>' + safe(statusValue) + '</option>').join('') + '</select></label><label>Priority<select name="priority">' + window.FactoryFlowMaintenanceWorkOrders.PRIORITIES.map((priority) => '<option value="' + safe(priority) + '"' + (order.priority === priority ? ' selected' : '') + '>' + safe(priority) + '</option>').join('') + '</select></label></div>' +
      '<div class="form-row"><label>Assigned technician<input name="assignedTo" maxlength="100" value="' + safe(order.assignedTo || '') + '"></label><label>Due date<input type="date" name="dueDate" value="' + safe(order.dueDate || '') + '"></label></div>' +
      '<div class="form-row"><label>Labour hours<input type="number" name="laborHours" min="0" max="10000" step="0.25" value="' + (Number(order.laborHours) || 0) + '"></label><label>Labour rate (₹ / hour)<input type="number" name="laborRate" min="0" max="1000000" step="0.01" value="' + (Number(order.laborRate) || 0) + '"></label></div>' +
      '<p class="subtle">Current labour cost: ' + currency(Number(order.laborCost) || 0) + ' · Spare-part issues: ' + currency((order.partsUsed || []).reduce((sum, part) => sum + (Number(part.costAmount) || 0), 0)) + '</p>' +
      '<label>Resolution / completion notes<textarea name="resolutionNotes" maxlength="1200" rows="3">' + safe(order.resolutionNotes || '') + '</textarea></label>' +
      '<p class="subtle">Completing this work order records a service event and resets the machine’s preventive-maintenance baseline from today.</p><p id="mwoUpdateError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Close</button><button type="submit" class="primary-button">Save updates</button></div></form>' : '<p>Status: ' + safe(order.status) + (order.resolutionNotes ? '<br>Resolution: ' + safe(order.resolutionNotes) : '') + '</p>') +
    '<section class="mwo-parts"><strong>Issued spare parts</strong>' + (parts ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>PART</th><th>QUANTITY</th><th>COST</th></tr></thead><tbody>' + parts + '</tbody></table></div>' : '<p class="subtle">No parts issued to this work order.</p>') + '</section>');
  if (canManage && !completed) ui('#maintenanceWorkOrderUpdateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/maintenance/work-orders/' + encodeURIComponent(order.id), {
        method: 'PATCH',
        body: JSON.stringify({
          status: data.get('status'), priority: data.get('priority'), assignedTo: data.get('assignedTo'),
          dueDate: data.get('dueDate'), resolutionNotes: data.get('resolutionNotes'),
          laborHours: Number(data.get('laborHours')), laborRate: Number(data.get('laborRate'))
        })
      });
      const index = maintenanceWorkOrders.findIndex((item) => item.id === order.id);
      if (index >= 0) maintenanceWorkOrders[index] = result.workOrder;
      if (result.serviceRecord) maintenanceRecords.unshift(result.serviceRecord);
      save(false);
      closeModal();
      render();
      notify('Work order ' + order.id + ' updated.');
    } catch (error) {
      const node = ui('#mwoUpdateError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function issueMaintenanceWorkOrderParts(workOrderId) {
  if (!window.FactoryFlowAuth.has('maintenance.manage')) return;
  const order = maintenanceWorkOrders.find((item) => item.id === workOrderId);
  if (!order || ['Completed', 'Cancelled'].includes(order.status)) return notify('Parts can only be issued to an open work order.');
  const spareParts = materials.filter((item) => item.maintenancePart === true);
  if (!spareParts.length) return notify('No spare parts are marked yet. Open Materials and mark stocked items as maintenance spare parts.');
  const options = spareParts.map((item) => '<option value="' + safe(item.sku) + '">' + safe(item.sku + ' · ' + item.item + ' · ' + item.onHand) + '</option>').join('');
  openModal('<h2 id="modalTitle">Issue spare parts · ' + safe(order.id) + '</h2><p>' + safe(order.machineName) + ' · ' + safe(order.title) + '</p>' +
    '<form id="mwoPartsForm" class="form-grid"><label>Spare part<select name="materialSku">' + options + '</select></label><div class="form-row"><label>Quantity<input required name="quantity" type="number" min="0.01" step="0.01"></label><label>Unit<input required name="unit" maxlength="24" placeholder="kg, pieces, litres"></label></div>' +
    '<p class="subtle">Stock is deducted immediately. The work order stores the issue quantity and current unit-cost snapshot.</p><p id="mwoPartsError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Issue parts</button></div></form>');
  ui('#mwoPartsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/maintenance/work-orders/' + encodeURIComponent(order.id) + '/parts', {
        method: 'POST',
        body: JSON.stringify({ materialSku: data.get('materialSku'), quantity: Number(data.get('quantity')), unit: data.get('unit') })
      });
      const orderIndex = maintenanceWorkOrders.findIndex((item) => item.id === order.id);
      if (orderIndex >= 0) maintenanceWorkOrders[orderIndex] = result.workOrder;
      const materialIndex = materials.findIndex((item) => item.sku === result.material.sku);
      if (materialIndex >= 0) materials[materialIndex] = result.material;
      movements.unshift(result.movement);
      save(false);
      closeModal();
      goto('work-orders');
      notify(result.part.quantity + ' ' + result.part.unit + ' of ' + result.part.material + ' issued to ' + order.id + '.');
    } catch (error) {
      const node = ui('#mwoPartsError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

async function toggleMaintenanceSparePart(sku) {
  if (!window.FactoryFlowAuth.has('materials.manage')) return;
  const material = materials.find((item) => item.sku === sku);
  if (!material) return notify('Material not found.');
  try {
    const result = await window.FactoryFlowAuth.request('/api/materials/' + encodeURIComponent(sku) + '/spare-part', {
      method: 'PATCH',
      body: JSON.stringify({ maintenancePart: material.maintenancePart !== true })
    });
    const index = materials.findIndex((item) => item.sku === sku);
    if (index >= 0) materials[index] = result.material;
    save(false);
    render();
    notify(material.item + (result.material.maintenancePart ? ' marked as a maintenance spare part.' : ' removed from the spare-parts list.'));
  } catch (error) {
    notify(error.message);
  }
}


function editMaintenanceTechnician(technicianId) {
  if (!window.FactoryFlowAuth.has('maintenance.manage')) return;
  const current = technicianId ? maintenanceTechnicians.find((item) => item.id === technicianId) : null;
  if (technicianId && !current) return notify('Technician not found.');
  const days = [
    { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }
  ];
  const selected = current ? current.workingDays || [] : [1, 2, 3, 4, 5, 6];
  openModal('<h2 id="modalTitle">' + (current ? 'Edit technician' : 'Add technician') + '</h2><form id="maintenanceTechnicianForm" class="form-grid">' +
    '<label>Technician / maintenance provider<input required maxlength="100" name="name" value="' + safe(current ? current.name : '') + '"></label>' +
    '<label>Specialty / skills<input maxlength="100" name="specialty" value="' + safe(current ? current.specialty || '' : '') + '" placeholder="e.g. Electrical, mechanical, calibration"></label>' +
    '<div class="form-row"><label>Daily capacity (hours)<input required type="number" name="capacityHoursPerDay" min="0.25" max="24" step="0.25" value="' + (current ? current.capacityHoursPerDay : 8) + '"></label>' +
    '<label>Hourly labour rate (₹)<input type="number" name="hourlyRate" min="0" max="1000000" step="0.01" value="' + (current ? current.hourlyRate || 0 : 0) + '"></label></div>' +
    '<fieldset class="mtech-days"><legend>Working days</legend><div>' + days.map((day) => '<label><input type="checkbox" name="workingDays" value="' + day.value + '"' + (selected.includes(day.value) ? ' checked' : '') + '> ' + day.label + '</label>').join('') + '</div></fieldset>' +
    '<label>Unavailable dates (comma-separated YYYY-MM-DD)<input name="unavailableDates" value="' + safe(current ? (current.unavailableDates || []).join(', ') : '') + '" placeholder="e.g. 2026-11-14, 2026-11-15"></label>' +
    (current ? '<label class="mtech-active"><input type="checkbox" name="active" value="true"' + (current.active !== false ? ' checked' : '') + '> Active technician</label>' : '') +
    '<p id="mtechError" class="form-error" hidden></p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save technician</button></div></form>');
  ui('#maintenanceTechnicianForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const workingDays = data.getAll('workingDays').map(Number);
    const unavailableDates = String(data.get('unavailableDates') || '').split(',').map((value) => value.trim()).filter(Boolean);
    try {
      const result = await window.FactoryFlowAuth.request(current
        ? '/api/maintenance/technicians/' + encodeURIComponent(current.id)
        : '/api/maintenance/technicians', {
        method: current ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: data.get('name'), specialty: data.get('specialty'),
          capacityHoursPerDay: Number(data.get('capacityHoursPerDay')),
          hourlyRate: Number(data.get('hourlyRate')), workingDays, unavailableDates,
          ...(current ? { active: data.get('active') === 'true' } : {})
        })
      });
      if (current) {
        const index = maintenanceTechnicians.findIndex((item) => item.id === current.id);
        if (index >= 0) maintenanceTechnicians[index] = result.technician;
      } else maintenanceTechnicians.unshift(result.technician);
      save(false);
      closeModal();
      render();
      notify('Technician saved.');
    } catch (error) {
      const node = ui('#mtechError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function scheduleMaintenanceWorkOrder(workOrderId) {
  if (!window.FactoryFlowAuth.has('maintenance.manage')) return;
  const order = maintenanceWorkOrders.find((item) => item.id === workOrderId);
  if (!order || ['Completed', 'Cancelled'].includes(order.status)) return notify('Only open work orders can be scheduled.');
  const active = maintenanceTechnicians.filter((item) => item.active !== false);
  if (!active.length) return notify('Add an active technician before scheduling maintenance work.');
  const options = active.map((technician) => '<option value="' + safe(technician.id) + '"' +
    (order.technicianId === technician.id ? ' selected' : '') + '>' +
    safe(technician.name + ' · ' + (technician.specialty || 'General') + ' · ' + technician.capacityHoursPerDay + ' hrs/day') + '</option>').join('');
  openModal('<h2 id="modalTitle">Schedule ' + safe(order.id) + '</h2><p>' + safe(order.machineName + ' · ' + order.title) + '</p>' +
    '<form id="maintenanceScheduleForm" class="form-grid"><label>Technician<select name="technicianId" required>' + options + '</select></label>' +
    '<label>Scheduled date<input required name="scheduledDate" type="date" value="' + safe(order.scheduledDate || order.dueDate || localDateISO()) + '"></label>' +
    '<div class="form-row"><label>Start time<input required name="startTime" type="time" value="' + safe(order.startTime || '09:00') + '"></label>' +
    '<label>End time<input required name="endTime" type="time" value="' + safe(order.endTime || '11:00') + '"></label></div>' +
    '<p class="subtle">Scheduling checks the technician’s working days, unavailable dates, daily capacity and overlapping work orders.</p>' +
    '<p id="mwoScheduleError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save schedule</button></div></form>');
  ui('#maintenanceScheduleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/maintenance/work-orders/' + encodeURIComponent(order.id) + '/schedule', {
        method: 'POST',
        body: JSON.stringify({
          technicianId: data.get('technicianId'), scheduledDate: data.get('scheduledDate'),
          startTime: data.get('startTime'), endTime: data.get('endTime')
        })
      });
      const index = maintenanceWorkOrders.findIndex((item) => item.id === order.id);
      if (index >= 0) maintenanceWorkOrders[index] = result.workOrder;
      save(false);
      closeModal();
      goto('maintenance-calendar');
      notify('Work order ' + order.id + ' scheduled.');
    } catch (error) {
      const node = ui('#mwoScheduleError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function maintenanceCalendarPage() {
  const canManage = window.FactoryFlowAuth.has('maintenance.manage');
  let calendar;
  try {
    calendar = window.FactoryFlowMaintenanceWorkOrders.buildTechnicianCalendar(
      maintenanceWorkOrders, maintenanceTechnicians, maintenanceCalendarDate, 7
    );
  } catch (error) {
    return head('EQUIPMENT', 'Maintenance calendar', error.message);
  }
  const eventRows = calendar.events.map((event) =>
    '<tr><td><strong>' + safe(event.date) + '</strong><div class="subtle">' + safe(new Date(event.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })) + '</div></td>' +
    '<td>' + safe(event.startTime + '–' + event.endTime) + '<div class="subtle">' + Number(event.hours).toFixed(2) + ' hrs</div></td>' +
    '<td><strong>' + safe(event.technicianName) + '</strong></td><td>' + safe(event.machineName) + '</td>' +
    '<td><strong class="order-code">' + safe(event.workOrderId) + '</strong><div class="subtle">' + safe(event.title) + '</div></td>' +
    '<td>' + status(event.priority) + '</td><td>' + status(event.status) + '</td></tr>'
  ).join('');
  const capacityRows = calendar.capacity.map((item) =>
    item.days.map((day) => '<tr><td><strong>' + safe(item.technicianName) + '</strong><div class="subtle">' + item.capacityHoursPerDay + ' hrs/day</div></td>' +
      '<td>' + safe(day.date) + '</td><td>' + (day.available ? '<span class="status on-track">Available</span>' : '<span class="status critical">Unavailable</span>') + '</td>' +
      '<td>' + day.scheduledHours.toFixed(2) + ' hrs</td><td>' + day.remainingHours.toFixed(2) + ' hrs</td></tr>'
    ).join('')
  ).join('');
  const unassigned = maintenanceWorkOrders.filter((order) =>
    !['Completed', 'Cancelled'].includes(order.status) && !order.scheduledDate
  );
  const technicianRows = maintenanceTechnicians.map((technician) =>
    '<tr><td><strong>' + safe(technician.name) + '</strong><div class="subtle">' + safe(technician.specialty || 'General maintenance') + '</div></td>' +
    '<td>' + Number(technician.capacityHoursPerDay).toFixed(2) + ' hrs/day</td>' +
    '<td>' + safe((technician.workingDays || []).map((day) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(', ')) + '</td>' +
    '<td>' + safe((technician.unavailableDates || []).join(', ') || 'None recorded') + '</td>' +
    '<td>' + (technician.active === false ? '<span class="status critical">Inactive</span>' : '<span class="status on-track">Active</span>') + '</td>' +
    '<td>' + (canManage ? '<button class="table-button" data-edit-technician="' + safe(technician.id) + '">Edit</button>' : '—') + '</td></tr>'
  ).join('');
  return head('EQUIPMENT', 'Maintenance calendar', 'Plan repair visits and preventive tasks against technician working days, unavailable dates and daily capacity.',
    '<div class="mtech-actions">' + (canManage ? '<button class="secondary-button" data-new-technician>＋ Add technician</button>' : '') + '<button class="primary-button" data-go="work-orders">Work orders</button></div>') +
    '<section class="content-card mtech-calendar-filter"><form id="maintenanceCalendarForm" class="form-row"><label>Week starts<input type="date" name="fromDate" value="' + safe(maintenanceCalendarDate) + '"></label><button class="secondary-button" type="submit">Show 7 days</button></form><p class="subtle">' + safe(calendar.fromDate) + ' through ' + safe(calendar.toDate) + ' · ' + calendar.events.length + ' scheduled work orders</p></section>' +
    '<div class="inventory-grid"><article class="inventory-stat"><span>TECHNICIANS</span><strong>' + maintenanceTechnicians.filter((item) => item.active !== false).length + '</strong><small>Active facility roster</small></article>' +
    '<article class="inventory-stat"><span>SCHEDULED JOBS</span><strong>' + calendar.events.length + '</strong><small>Within selected week</small></article>' +
    '<article class="inventory-stat"><span>UNSCHEDULED WORK</span><strong>' + unassigned.length + '</strong><small>Open work orders without a slot</small></article>' +
    '<article class="inventory-stat"><span>TECHNICIAN CAPACITY</span><strong>' + calendar.capacity.reduce((sum, row) => sum + row.days.reduce((daySum, day) => daySum + (day.available ? day.remainingHours : 0), 0), 0).toFixed(1) + ' hrs</strong><small>Remaining across selected week</small></article></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Scheduled maintenance · 7 days</strong><span class="subtle">Time slots and assigned equipment</span></div>' +
    (eventRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>DATE</th><th>TIME</th><th>TECHNICIAN</th><th>MACHINE</th><th>WORK ORDER</th><th>PRIORITY</th><th>STATUS</th></tr></thead><tbody>' + eventRows + '</tbody></table></div>' : '<div class="empty-state">No maintenance work orders are scheduled for this period.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Technician daily capacity</strong><span class="subtle">Scheduled versus remaining hours</span></div>' +
    (capacityRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>TECHNICIAN</th><th>DATE</th><th>AVAILABILITY</th><th>BOOKED</th><th>REMAINING</th></tr></thead><tbody>' + capacityRows + '</tbody></table></div>' : '<div class="empty-state">Add technicians to start planning maintenance capacity.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Technician roster</strong><span class="subtle">' + maintenanceTechnicians.length + ' profile(s)</span></div>' +
    (technicianRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>TECHNICIAN</th><th>CAPACITY</th><th>WORKING DAYS</th><th>UNAVAILABLE DATES</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>' + technicianRows + '</tbody></table></div>' : '<div class="empty-state">Add a technician to assign and schedule maintenance work.</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong>Unscheduled work orders</strong><span class="subtle">' + unassigned.length + ' require planning</span></div>' +
    (unassigned.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>WORK ORDER</th><th>MACHINE</th><th>PRIORITY</th><th>DUE DATE</th><th>ACTION</th></tr></thead><tbody>' + unassigned.map((order) => '<tr><td><strong>' + safe(order.id) + '</strong><div class="subtle">' + safe(order.title) + '</div></td><td>' + safe(order.machineName) + '</td><td>' + status(order.priority) + '</td><td>' + safe(order.dueDate || '—') + '</td><td>' + (canManage ? '<button class="table-button" data-schedule-work-order="' + safe(order.id) + '">Schedule</button>' : '—') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty-state">All open work orders have a scheduled date.</div>') + '</section>';
}

function machinesPage() {
  const canManage = window.FactoryFlowAuth.has('machines.manage');
  const today = localDateISO();
  const active = machines.filter((machine) => machine.active !== false);
  const capacity = active.reduce((sum, machine) => sum + (Number(machine.capacityHoursPerDay) || 0), 0);
  const unavailableToday = active.filter((machine) => !window.FactoryFlowMachines.isAvailableOn(machine, today)).length;
  const futureWindows = machines.flatMap((machine) => (machine.maintenanceWindows || [])
    .filter((window) => window.endDate >= today)
    .map((window) => ({ ...window, machineName: machine.name, machineId: machine.id })))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const rows = machines.map((machine) => {
    const available = window.FactoryFlowMachines.isAvailableOn(machine, today);
    const skills = (machine.supportedSkills || []).join(', ') || 'General purpose';
    const upcoming = (machine.maintenanceWindows || []).filter((item) => item.endDate >= today).length;
    return '<tr><td><strong>' + safe(machine.name) + '</strong><div class="subtle">' + safe(machine.code) + '</div></td>' +
      '<td>' + safe(machine.type || '—') + '<div class="subtle">' + safe(machine.location || 'Location not set') + '</div></td>' +
      '<td>' + safe(skills) + '</td><td>' + Number(machine.capacityHoursPerDay).toFixed(1) + ' hrs/day</td><td>' + (Number(machine.idealUnitsPerHour) > 0 ? Number(machine.idealUnitsPerHour).toLocaleString('en-IN') + ' units/hr' : 'Not configured') + '</td>' +
      '<td>' + status(machine.active === false ? 'Inactive' : available ? 'Available today' : 'Maintenance') + '<div class="subtle">' + upcoming + ' upcoming window(s)</div></td>' +
      '<td><div class="machine-actions">' + (canManage ? '<button class="table-button" data-edit-machine="' + safe(machine.id) + '">Edit</button><button class="table-button" data-add-maintenance="' + safe(machine.id) + '">Maintenance</button>' : '—') + '</div></td></tr>';
  }).join('');
  const maintenanceRows = futureWindows.map((item) =>
    '<tr><td><strong>' + safe(item.machineName) + '</strong><div class="subtle">' + safe(item.id) + '</div></td><td>' + safe(item.startDate) + ' → ' + safe(item.endDate) + '</td><td>' + safe(item.reason) + (item.notes ? '<div class="subtle">' + safe(item.notes) + '</div>' : '') + '</td><td>' +
    (canManage ? '<button class="table-button" data-machine-id="' + safe(item.machineId) + '" data-remove-maintenance="' + safe(item.id) + '">Remove</button>' : '—') + '</td></tr>'
  ).join('');
  return head('EQUIPMENT', 'Machines & equipment', 'Register production equipment, set operating capacity and ideal throughput rates, maintain operation compatibility, and block maintenance dates from future plans.',
      canManage ? '<button class="primary-button" data-add-machine>＋ Add machine</button>' : '') +
    '<div class="inventory-grid"><article class="inventory-stat"><span>REGISTERED MACHINES</span><strong>' + machines.length + '</strong><small>Across the selected facility</small></article>' +
    '<article class="inventory-stat"><span>ACTIVE EQUIPMENT</span><strong>' + active.length + '</strong><small>Eligible for new assignments</small></article>' +
    '<article class="inventory-stat"><span>DAILY MACHINE CAPACITY</span><strong>' + capacity.toFixed(1) + '</strong><small>Available machine-hours per operating day</small></article>' +
    '<article class="inventory-stat"><span>NOT AVAILABLE TODAY</span><strong>' + (machines.length - active.filter((machine) => window.FactoryFlowMachines.isAvailableOn(machine, today)).length) + '</strong><small>' + unavailableToday + ' active machine(s) in maintenance</small></article></div>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Equipment register</strong><span class="subtle">' + machines.length + ' machine(s)</span></div>' +
    (rows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>MACHINE</th><th>TYPE / LOCATION</th><th>SUPPORTED OPERATIONS</th><th>CAPACITY</th><th>IDEAL RATE</th><th>STATUS</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
      '<div class="empty-state"><h2>No machines registered</h2><p>Add machines to enable machine-aware production planning, capacity checks and maintenance scheduling.</p>' + (canManage ? '<button class="primary-button" data-add-machine>＋ Register first machine</button>' : '') + '</div>') + '</section>' +
    '<section class="content-card" style="margin-top:18px"><div class="toolbar"><strong style="font-size:12px">Planned maintenance</strong><span class="subtle">' + futureWindows.length + ' upcoming window(s)</span></div>' +
    (maintenanceRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>MACHINE</th><th>WINDOW</th><th>REASON / NOTES</th><th></th></tr></thead><tbody>' + maintenanceRows + '</tbody></table></div>' :
      '<div class="empty-state"><p>No upcoming maintenance windows are recorded.</p></div>') + '</section>';
}

function editMachine(machineId) {
  if (!window.FactoryFlowAuth.has('machines.manage')) return;
  const machine = machineId ? machines.find((item) => item.id === machineId) : null;
  if (machineId && !machine) return notify('Machine not found in this facility.');
  const skills = machine ? (machine.supportedSkills || []).join(', ') : '';
  openModal('<h2 id="modalTitle">' + (machine ? 'Edit machine' : 'Register machine') + '</h2>' +
    '<form id="machineForm" class="form-grid"><div class="form-row"><label>Machine code<input required name="code" maxlength="20" value="' + safe(machine ? machine.code : '') + '" placeholder="e.g. PRESS-01"></label>' +
    '<label>Machine name<input required name="name" maxlength="100" value="' + safe(machine ? machine.name : '') + '" placeholder="e.g. Flexo Press 01"></label></div>' +
    '<div class="form-row"><label>Equipment type<input name="type" maxlength="80" value="' + safe(machine ? machine.type || '' : '') + '" placeholder="e.g. Flexographic printer"></label>' +
    '<label>Location<input name="location" maxlength="100" value="' + safe(machine ? machine.location || '' : '') + '" placeholder="e.g. Shop floor A"></label></div>' +
    '<div class="form-row"><label>Daily operating capacity (hours)<input required type="number" name="capacityHoursPerDay" min="0.25" max="24" step="0.25" value="' + (machine ? Number(machine.capacityHoursPerDay) : 8) + '"></label>' +
    '<label>Ideal output rate (units/hour)<input type="number" name="idealUnitsPerHour" min="0" max="1000000" step="0.01" value="' + (machine && Number(machine.idealUnitsPerHour) > 0 ? Number(machine.idealUnitsPerHour) : '') + '" placeholder="e.g. 120"></label></div>' +
    '<div class="form-row"><label>Service interval (operating hours)<input type="number" name="serviceIntervalHours" min="0" max="100000" step="0.25" value="' + (machine ? Number(machine.serviceIntervalHours) || 0 : 0) + '" placeholder="e.g. 500"></label>' +
    '<label>Service interval (calendar days)<input type="number" name="serviceIntervalDays" min="0" max="3650" step="1" value="' + (machine ? Number(machine.serviceIntervalDays) || 0 : 0) + '" placeholder="e.g. 90"></label></div>' +
    '<div class="form-row"><label>Remind before due (hours)<input type="number" name="serviceAlertLeadHours" min="0" max="500" step="1" value="' + (machine && machine.serviceAlertLeadHours !== undefined ? Number(machine.serviceAlertLeadHours) : 10) + '"></label>' +
    '<label>Remind before due (days)<input type="number" name="serviceAlertLeadDays" min="0" max="365" step="1" value="' + (machine && machine.serviceAlertLeadDays !== undefined ? Number(machine.serviceAlertLeadDays) : 7) + '"></label></div>' +
    '<small class="subtle">Set an hour interval, a calendar interval, or both. Zero disables that interval. Usage is estimated from scheduled machine-hours, falling back to recorded actual hours when present.</small>' +
    '<label>Supported operations / skills<input name="supportedSkills" maxlength="500" value="' + safe(skills) + '" placeholder="Printing, lamination, cutting"></label>' +
    '<small class="subtle">Leave supported operations blank for a general-purpose machine. Use comma-separated names that match a job’s required skill.</small>' +
    (machine ? '<label class="facility-inline-check"><input type="checkbox" name="active"' + (machine.active !== false ? ' checked' : '') + '> Machine active and eligible for new work</label>' : '') +
    '<p id="machineError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save machine</button></div></form>');
  ui('#machineForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      code: data.get('code'), name: data.get('name'), type: data.get('type'),
      location: data.get('location'), capacityHoursPerDay: Number(data.get('capacityHoursPerDay')),
      idealUnitsPerHour: data.get('idealUnitsPerHour') === '' ? 0 : Number(data.get('idealUnitsPerHour')),
      serviceIntervalHours: Number(data.get('serviceIntervalHours') || 0),
      serviceIntervalDays: Number(data.get('serviceIntervalDays') || 0),
      serviceAlertLeadHours: Number(data.get('serviceAlertLeadHours')),
      serviceAlertLeadDays: Number(data.get('serviceAlertLeadDays')),
      supportedSkills: data.get('supportedSkills').split(',').map((value) => value.trim()).filter(Boolean)
    };
    if (machine) payload.active = ui('#machineForm [name="active"]').checked;
    try {
      const result = await window.FactoryFlowAuth.request(machine ? '/api/machines/' + encodeURIComponent(machine.id) : '/api/machines', {
        method: machine ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      const index = machines.findIndex((item) => item.id === result.machine.id);
      if (index < 0) machines.push(result.machine);
      else machines[index] = result.machine;
      save(false);
      closeModal();
      render();
      notify(result.machine.name + ' saved.');
    } catch (error) {
      const node = ui('#machineError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}


function addMachineServiceRecord(machineId) {
  if (!window.FactoryFlowAuth.has('machines.manage')) return;
  const machine = machines.find((item) => item.id === machineId);
  if (!machine) return notify('Machine not found in this facility.');
  const today = localDateISO();
  const actor = window.FactoryFlowAuth.state.user;
  const types = ['Preventive service', 'Inspection', 'Lubrication', 'Calibration', 'Repair', 'Parts replacement', 'Other'];
  openModal('<h2 id="modalTitle">Record completed service · ' + safe(machine.name) + '</h2>' +
    '<form id="machineServiceForm" class="form-grid"><div class="form-row"><label>Service date<input type="date" name="serviceDate" required max="' + today + '" value="' + today + '"></label>' +
    '<label>Service type<select name="serviceType">' + types.map((type) => '<option value="' + safe(type) + '">' + safe(type) + '</option>').join('') + '</select></label></div>' +
    '<label>Performed by<input required maxlength="100" name="performedBy" value="' + safe(actor.name || '') + '"></label>' +
    '<label>Work completed / parts / observations<textarea name="notes" maxlength="500" rows="3" placeholder="Describe the work completed and any follow-up needed"></textarea></label>' +
    '<p class="subtle">Saving this record resets the hour and calendar service counters from the service date.</p>' +
    '<p id="machineServiceError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button" type="submit">Save service record</button></div></form>');
  ui('#machineServiceForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/machines/' + encodeURIComponent(machineId) + '/service', {
        method: 'POST',
        body: JSON.stringify({
          serviceDate: data.get('serviceDate'),
          serviceType: data.get('serviceType'),
          performedBy: data.get('performedBy'),
          notes: data.get('notes')
        })
      });
      maintenanceRecords.push(result.record);
      save(false);
      closeModal();
      goto('maintenance');
      notify('Service record saved for ' + machine.name + '.');
    } catch (error) {
      const node = ui('#machineServiceError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function addMachineMaintenance(machineId) {
  if (!window.FactoryFlowAuth.has('machines.manage')) return;
  const machine = machines.find((item) => item.id === machineId);
  if (!machine) return notify('Machine not found in this facility.');
  const today = localDateISO();
  openModal('<h2 id="modalTitle">Plan maintenance · ' + safe(machine.name) + '</h2>' +
    '<p>All optimizer proposals for this machine will avoid the selected date range, including both start and end dates.</p>' +
    '<form id="machineMaintenanceForm" class="form-grid"><div class="form-row"><label>Start date<input required type="date" name="startDate" value="' + today + '"></label>' +
    '<label>End date<input required type="date" name="endDate" value="' + today + '"></label></div>' +
    '<label>Maintenance reason<input required maxlength="120" name="reason" placeholder="e.g. Preventive maintenance"></label>' +
    '<label>Notes<input maxlength="500" name="notes" placeholder="Service ticket, parts, technician"></label>' +
    '<p id="maintenanceError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save maintenance window</button></div></form>');
  ui('#machineMaintenanceForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await window.FactoryFlowAuth.request('/api/machines/' + encodeURIComponent(machine.id) + '/maintenance', {
        method: 'POST',
        body: JSON.stringify({ startDate: data.get('startDate'), endDate: data.get('endDate'), reason: data.get('reason'), notes: data.get('notes') })
      });
      const index = machines.findIndex((item) => item.id === result.machine.id);
      if (index >= 0) machines[index] = result.machine;
      save(false);
      closeModal();
      render();
      notify('Maintenance window saved for ' + machine.name + '.');
    } catch (error) {
      const node = ui('#maintenanceError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

async function removeMachineMaintenance(machineId, windowId) {
  if (!window.FactoryFlowAuth.has('machines.manage')) return;
  const machine = machines.find((item) => item.id === machineId);
  if (!machine) return notify('Machine not found in this facility.');
  try {
    const result = await window.FactoryFlowAuth.request('/api/machines/' + encodeURIComponent(machineId) + '/maintenance/' + encodeURIComponent(windowId), { method: 'DELETE' });
    const index = machines.findIndex((item) => item.id === result.machine.id);
    if (index >= 0) machines[index] = result.machine;
    save(false);
    render();
    notify('Maintenance window removed.');
  } catch (error) {
    notify(error.message);
  }
}

function invoicesPage() {
  const invoices = invoiceRecords;
  const rows = invoices.map((invoice) => '<tr><td class="order-code">' + invoice.id + '<div class="subtle">GST 18%</div></td><td><div class="item-name">' + invoice.customer + '</div><div class="subtle">' + invoice.job + '</div></td><td>' + currency(invoice.amount) + '</td><td>' + invoice.due + '</td><td>' + status(invoice.status) + '</td><td>' + (invoice.status === 'Paid' ? '<span class="subtle">Received</span>' : '<button class="table-button" data-reminder="' + invoice.id + '">WhatsApp reminder</button>') + '</td></tr>').join('');
  return head('FINANCE', 'GST-ready invoices', 'Create a compliant invoice from delivery proof and nudge payment over WhatsApp.', '<button class="primary-button" data-action="invoice">＋ Create GST invoice</button>') + '<section class="content-card"><div class="toolbar"><div><strong style="font-size:12px">Receivables</strong><span class="subtle" style="margin-left:8px;font-size:11px">₹1.26L pending</span></div><button class="secondary-button" data-action="reminders">◔ Send payment reminders</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>INVOICE</th><th>CUSTOMER / JOB</th><th>AMOUNT</th><th>PAYMENT DUE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}


function gstDocumentLabel(type) {
  return ({ QUOTATION: 'Quotation', TAX_INVOICE: 'Tax invoice', DELIVERY_CHALLAN: 'Delivery challan' })[type] || type;
}

function gstDocumentAmount(document) {
  return document.type === 'DELIVERY_CHALLAN' ? Number(document.declaredValue) || 0 : Number(document.grandTotal) || 0;
}

function invoicesPage() {
  const profile = gstProfiles.find((item) => item.facilityId === (window.FactoryFlowAuth.state.activeFacilityId || '')) || null;
  const canManage = window.FactoryFlowAuth.has('invoices.manage');
  const docs = gstDocuments.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const filtered = gstDocumentFilter === 'ALL' ? docs : docs.filter((doc) => doc.type === gstDocumentFilter);
  const invoiceDocs = docs.filter((doc) => doc.type === 'TAX_INVOICE');
  const outstanding = invoiceDocs.filter((doc) => doc.paymentStatus !== 'Paid')
    .reduce((sum, doc) => sum + (Number(doc.grandTotal) || 0) - (Number(doc.paidAmount) || 0), 0);
  const rows = filtered.map((doc) => '<tr><td><strong class="order-code">' + safe(doc.number) + '</strong><div class="subtle">' + safe(gstDocumentLabel(doc.type)) + ' · FY ' + safe(doc.financialYear) + '</div></td>' +
    '<td><strong>' + safe(doc.customer.name) + '</strong><div class="subtle">' + safe(doc.customer.gstin || 'Unregistered customer') + '</div></td>' +
    '<td>' + currency(gstDocumentAmount(doc)) + (doc.type === 'DELIVERY_CHALLAN' ? '<div class="subtle">Declared value · not an invoice</div>' : '') + '</td>' +
    '<td>' + safe(doc.documentDate) + (doc.dueDate ? '<div class="subtle">Due ' + safe(doc.dueDate) + '</div>' : '') + '</td>' +
    '<td>' + status(doc.status || 'Issued') + '</td>' +
    '<td><button class="table-button" data-print-gst-doc="' + safe(doc.id) + '">Print / PDF</button></td></tr>'
  ).join('');
  const filters = [['ALL', 'All'], ['QUOTATION', 'Quotations'], ['TAX_INVOICE', 'Tax invoices'], ['DELIVERY_CHALLAN', 'Delivery challans']];
  const filterButtons = filters.map(([key, label]) => '<button class="filter-chip ' + (gstDocumentFilter === key ? 'active' : '') + '" data-gst-filter="' + key + '">' + label + '</button>').join('');
  return head('FINANCE', 'GST documents', 'Create numbered quotations, tax invoices and delivery challans with facility GST details and printable layouts.',
      (canManage ? '<div class="gst-page-actions"><button class="secondary-button" data-gst-profile>Business GST profile</button><button class="primary-button" data-create-gst-doc>＋ Create document</button></div>' : '')) +
    '<div class="inventory-grid"><article class="inventory-stat"><span>DOCUMENTS ISSUED</span><strong>' + docs.length + '</strong><small>Across all document types</small></article>' +
      '<article class="inventory-stat"><span>TAX INVOICES</span><strong>' + invoiceDocs.length + '</strong><small>Issued in this facility</small></article>' +
      '<article class="inventory-stat"><span>OUTSTANDING</span><strong>' + currency(outstanding) + '</strong><small>Unpaid issued tax invoices</small></article>' +
      '<article class="inventory-stat"><span>GST REGISTRATION</span><strong>' + (profile ? safe(profile.gstin) : 'Not configured') + '</strong><small>' + (profile ? safe(profile.legalName) : 'Add business details to issue documents') + '</small></article></div>' +
    (!profile ? '<section class="content-card gst-profile-prompt"><strong>Set up the facility GST profile</strong><p>Add the legal business name, GSTIN and registered address before creating GST documents.</p>' + (canManage ? '<button class="primary-button" data-gst-profile>Configure GST profile</button>' : '<p>Ask an administrator or manager to configure the GST profile.</p>') + '</section>' : '') +
    '<section class="content-card gst-register"><div class="toolbar"><strong>Document register</strong><span class="subtle">' + filtered.length + ' record(s)</span></div><div class="mwo-filters">' + filterButtons + '</div>' +
    (rows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>DOCUMENT NUMBER</th><th>BILL TO</th><th>VALUE</th><th>DATE</th><th>STATUS</th><th>OUTPUT</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state"><h2>' + (docs.length ? 'No documents in this filter' : 'No GST documents yet') + '</h2><p>Create a quotation, tax invoice or delivery challan. Document numbers are generated by the server for the active facility and financial year.</p>' + (canManage && profile ? '<button class="primary-button" data-create-gst-doc>＋ Create first document</button>' : '') + '</div>') +
    '</section><section class="content-card gst-method-note"><strong>Tax treatment</strong><p>Intra-state supplies use CGST + SGST; inter-state supplies use IGST. Tax is calculated server-side from the line items and place of supply. Delivery challans show a declared goods value only and are explicitly not tax invoices. Validate HSN/SAC codes and applicable rates with your tax adviser before issuing real documents.</p></section>';
}

function configureGstProfile() {
  if (!window.FactoryFlowAuth.has('invoices.manage')) return;
  const profile = gstProfiles.find((item) => item.facilityId === (window.FactoryFlowAuth.state.activeFacilityId || '')) || {};
  openModal('<h2 id="modalTitle">Business GST profile</h2><p>These details appear as the supplier information on documents issued by this facility.</p><form id="gstProfileForm" class="form-grid">' +
    '<label>Legal business name<input required maxlength="150" name="legalName" value="' + safe(profile.legalName || '') + '"></label>' +
    '<label>Trade name (optional)<input maxlength="150" name="tradeName" value="' + safe(profile.tradeName || '') + '"></label>' +
    '<div class="form-row"><label>GSTIN<input required maxlength="15" name="gstin" value="' + safe(profile.gstin || '') + '" placeholder="29ABCDE1234F1Z5"></label>' +
    '<label>PAN<input required maxlength="10" name="pan" value="' + safe(profile.pan || '') + '" placeholder="ABCDE1234F"></label></div>' +
    '<label>Registered address<input required maxlength="300" name="address" value="' + safe(profile.address || '') + '"></label>' +
    '<div class="form-row"><label>City<input required maxlength="80" name="city" value="' + safe(profile.city || '') + '"></label><label>State<input required maxlength="80" name="state" value="' + safe(profile.state || '') + '"></label></div>' +
    '<div class="form-row"><label>GST state code (2 digits)<input required maxlength="2" pattern="[0-9]{2}" name="stateCode" value="' + safe(profile.stateCode || '') + '" placeholder="29"></label>' +
    '<label>PIN code<input required maxlength="6" pattern="[0-9]{6}" name="pincode" value="' + safe(profile.pincode || '') + '"></label></div>' +
    '<div class="form-row"><label>Email<input type="email" name="email" value="' + safe(profile.email || '') + '"></label><label>Phone<input name="phone" maxlength="20" value="' + safe(profile.phone || '') + '"></label></div>' +
    '<div class="form-row"><label>Bank name (optional)<input name="bankName" maxlength="100" value="' + safe(profile.bankName || '') + '"></label><label>Bank account<input name="bankAccount" maxlength="34" value="' + safe(profile.bankAccount || '') + '"></label></div>' +
    '<label>Bank IFSC<input name="bankIfsc" maxlength="11" value="' + safe(profile.bankIfsc || '') + '" placeholder="ABCD0123456"></label>' +
    '<p class="subtle">GSTIN first two digits must match the state code. PAN must be the PAN embedded in the GSTIN.</p><p id="gstProfileError" class="form-error" hidden></p>' +
    '<div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save GST profile</button></div></form>');
  ui('#gstProfileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    try {
      const result = await window.FactoryFlowAuth.request('/api/gst/profile', {
        method: 'PUT', body: JSON.stringify(payload)
      });
      const index = gstProfiles.findIndex((item) => item.facilityId === result.profile.facilityId);
      if (index >= 0) gstProfiles[index] = result.profile;
      else gstProfiles.push(result.profile);
      save(false);
      closeModal();
      render();
      notify('Facility GST profile saved.');
    } catch (error) {
      const node = ui('#gstProfileError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function createGstDocument() {
  if (!window.FactoryFlowAuth.has('invoices.manage')) return;
  const profile = gstProfiles.find((item) => item.facilityId === (window.FactoryFlowAuth.state.activeFacilityId || ''));
  if (!profile) return configureGstProfile();
  const today = localDateISO();
  const initialLine = () => '<div class="gst-line-entry" data-gst-line><div class="form-row"><label>Description<input required maxlength="250" name="description" value="" placeholder="Goods / services"></label><label>HSN / SAC<input required maxlength="8" name="hsnSac" placeholder="48191010"></label></div>' +
    '<div class="gst-line-grid"><label>Qty<input required type="number" min="0.001" step="0.001" name="quantity" value="1"></label><label>Unit<input required maxlength="20" name="unit" value="pcs"></label>' +
    '<label>Rate (₹)<input required type="number" min="0" step="0.01" name="unitPrice" value="0"></label><label>Discount (₹)<input type="number" min="0" step="0.01" name="discount" value="0"></label>' +
    '<label>GST rate<input required type="number" name="gstRate" value="18" min="0" max="28" step="1"></label></div></div>';
  const lineContainer = '<div id="gstLineItems">' + initialLine() + '</div><button type="button" class="text-button" data-gst-add-line>＋ Add line item</button>';
  const jobsOptions = '<option value="">No linked job</option>' + jobs.map((job) => '<option value="' + safe(job.id) + '">' + safe(job.id + ' · ' + job.customer + ' · ' + job.item) + '</option>').join('');
  openModal('<h2 id="modalTitle">Create GST document</h2><form id="gstDocumentForm" class="form-grid">' +
    '<div class="form-row"><label>Document type<select required name="type"><option value="QUOTATION">Quotation</option><option value="TAX_INVOICE">Tax invoice</option><option value="DELIVERY_CHALLAN">Delivery challan</option></select></label>' +
    '<label>Document date<input required type="date" name="documentDate" value="' + today + '"></label></div>' +
    '<div class="form-row"><label>Bill to / customer name<input required maxlength="150" name="customerName"></label><label>Customer GSTIN (optional)<input maxlength="15" name="customerGstin" placeholder="Unregistered / B2C"></label></div>' +
    '<label>Customer billing address<input required maxlength="300" name="customerAddress"></label>' +
    '<div class="form-row"><label>Place-of-supply state<input required maxlength="80" name="placeOfSupplyState"></label><label>State code<input required maxlength="2" pattern="[0-9]{2}" name="placeOfSupplyStateCode" placeholder="29"></label></div>' +
    '<div class="form-row"><label>Due date (required for tax invoice)<input type="date" name="dueDate"></label><label>Linked production job<select name="reference">' + jobsOptions + '</select></label></div>' +
    '<section class="gst-lines"><div class="toolbar"><strong>Items and services</strong><span class="subtle">GST rates: 0%, 5%, 12%, 18%, 28%</span></div>' + lineContainer + '</section>' +
    '<label>Notes / terms<input maxlength="1200" name="notes" placeholder="Payment terms, delivery notes or quotation validity"></label>' +
    '<p id="gstDocumentError" class="form-error" hidden></p><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Issue document</button></div></form>');
  ui('#gstDocumentForm').addEventListener('click', (event) => {
    if (event.target.closest('[data-gst-add-line]')) ui('#gstLineItems').insertAdjacentHTML('beforeend', initialLine());
  });
  ui('#gstDocumentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const lines = Array.from(form.querySelectorAll('[data-gst-line]')).map((node) => ({
      description: node.querySelector('[name="description"]').value,
      hsnSac: node.querySelector('[name="hsnSac"]').value,
      quantity: Number(node.querySelector('[name="quantity"]').value),
      unit: node.querySelector('[name="unit"]').value,
      unitPrice: Number(node.querySelector('[name="unitPrice"]').value),
      discount: Number(node.querySelector('[name="discount"]').value),
      gstRate: Number(node.querySelector('[name="gstRate"]').value)
    }));
    try {
      const result = await window.FactoryFlowAuth.request('/api/gst/documents', {
        method: 'POST',
        body: JSON.stringify({
          type: data.get('type'), documentDate: data.get('documentDate'), dueDate: data.get('dueDate'),
          customerName: data.get('customerName'), customerGstin: data.get('customerGstin'),
          customerAddress: data.get('customerAddress'), placeOfSupplyState: data.get('placeOfSupplyState'),
          placeOfSupplyStateCode: data.get('placeOfSupplyStateCode'), reference: data.get('reference'), notes: data.get('notes'), lines
        })
      });
      gstDocuments.unshift(result.document);
      save(false);
      closeModal();
      gstDocumentFilter = 'ALL';
      render();
      notify(result.document.number + ' issued.');
    } catch (error) {
      const node = ui('#gstDocumentError');
      node.textContent = error.message;
      node.hidden = false;
    }
  });
}

function printGstDocument(documentId) {
  const document = gstDocuments.find((item) => item.id === documentId);
  if (!document) return notify('GST document not found.');
  const esc = (value) => safe(value === null || value === undefined ? '' : String(value));
  const money = (value) => '₹' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const challan = document.type === 'DELIVERY_CHALLAN';
  const quotation = document.type === 'QUOTATION';
  const title = challan ? 'DELIVERY CHALLAN' : quotation ? 'TAX QUOTATION' : 'TAX INVOICE';
  const rows = document.lines.map((line, index) => '<tr><td>' + (index + 1) + '</td><td>' + esc(line.description) + '</td><td>' + esc(line.hsnSac) + '</td><td class="num">' + Number(line.quantity).toLocaleString('en-IN') + ' ' + esc(line.unit) + '</td><td class="num">' + money(line.unitPrice) + '</td><td class="num">' + money(line.discount) + '</td><td class="num">' + money(line.taxableValue) + '</td>' +
    (!challan ? '<td class="num">' + Number(line.gstRate).toFixed(2) + '%</td><td class="num">' + money(line.taxAmount) + '</td>' : '') +
    '<td class="num">' + money(line.lineTotal) + '</td></tr>').join('');
  const taxRows = challan ? '' : (document.supplyType === 'INTRA_STATE'
    ? '<tr><td>CGST</td><td class="num">' + money(document.cgstAmount) + '</td></tr><tr><td>SGST</td><td class="num">' + money(document.sgstAmount) + '</td></tr>'
    : '<tr><td>IGST</td><td class="num">' + money(document.igstAmount) + '</td></tr>');
  const note = challan
    ? '<strong>Delivery document only — NOT A TAX INVOICE.</strong><br>Declared goods value is shown for movement reference only. No GST is charged or payable through this challan.'
    : quotation
      ? 'This is a quotation/estimate and is not a tax invoice. Taxes are estimates based on the entered place of supply and rates.'
      : 'This is a tax invoice issued with the GST details and tax split recorded for this facility.';
  const printHtml = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(document.number) + '</title><style>' +
    'body{font:12px Arial,sans-serif;color:#18222d;margin:28px}header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #263746;padding-bottom:16px}h1{font-size:22px;margin:0 0 8px}h2{font-size:16px;margin:0}p{margin:4px 0;line-height:1.45}.muted{color:#536474}.meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.panel{border:1px solid #ccd5dc;padding:12px}.num{text-align:right;white-space:nowrap}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #cbd4dc;padding:7px;text-align:left;vertical-align:top}th{background:#f0f3f6;font-size:10px}.totals{width:320px;margin-left:auto}.totals td{padding:7px}.grand{font-size:15px;font-weight:bold;background:#f0f3f6}.notice{margin-top:20px;border:1px solid #ccd5dc;padding:12px;line-height:1.5}.sign{display:flex;justify-content:space-between;margin-top:60px}.sign div{width:42%;border-top:1px solid #80909e;padding-top:8px;text-align:center}@page{size:A4;margin:14mm}@media print{body{margin:0}.no-print{display:none}}</style></head><body>' +
    '<header><div><h1>' + esc(document.seller.legalName) + '</h1><p>' + esc(document.seller.tradeName) + '</p><p>' + esc(document.seller.address) + ', ' + esc(document.seller.city) + ', ' + esc(document.seller.state) + ' - ' + esc(document.seller.pincode) + '</p><p>GSTIN: <strong>' + esc(document.seller.gstin) + '</strong> · PAN: ' + esc(document.seller.pan) + '</p><p>' + esc(document.seller.email) + ' ' + esc(document.seller.phone) + '</p></div><div><h2>' + title + '</h2><p><strong>' + esc(document.number) + '</strong></p><p>Date: ' + esc(document.documentDate) + '</p>' + (document.dueDate ? '<p>Due date: ' + esc(document.dueDate) + '</p>' : '') + '<p>FY: ' + esc(document.financialYear) + '</p></div></header>' +
    '<section class="meta"><div class="panel"><strong>' + (challan ? 'CONSIGNEE / SHIP TO' : 'BILL TO') + '</strong><p><strong>' + esc(document.customer.name) + '</strong></p><p>' + esc(document.customer.address) + '</p><p>' + (document.customer.gstin ? 'GSTIN: ' + esc(document.customer.gstin) : 'Unregistered customer') + '</p></div><div class="panel"><strong>SUPPLY DETAILS</strong><p>Place of supply: ' + esc(document.placeOfSupplyState) + ' (' + esc(document.placeOfSupplyStateCode) + ')</p><p>Supply type: ' + (document.supplyType === 'INTRA_STATE' ? 'Intra-state' : 'Inter-state') + '</p><p>Reference: ' + esc(document.reference || '—') + '</p></div></section>' +
    '<table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="num">Qty / Unit</th><th class="num">Rate</th><th class="num">Discount</th><th class="num">Taxable value</th>' + (challan ? '' : '<th class="num">GST rate</th><th class="num">Tax</th>') + '<th class="num">Line total</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    (challan ? '<table class="totals"><tr><td>Declared goods value</td><td class="num">' + money(document.declaredValue) + '</td></tr><tr><td>GST payable on this challan</td><td class="num">₹0.00</td></tr></table>' :
      '<table class="totals"><tr><td>Taxable value</td><td class="num">' + money(document.taxableValue) + '</td></tr>' + taxRows + '<tr><td>Total GST</td><td class="num">' + money(document.totalTax) + '</td></tr><tr><td>Round off</td><td class="num">' + money(document.roundOff) + '</td></tr><tr class="grand"><td>Grand total</td><td class="num">' + money(document.grandTotal) + '</td></tr></table>') +
    '<div class="notice">' + note + (document.notes ? '<p><strong>Notes / terms:</strong> ' + esc(document.notes) + '</p>' : '') + '</div>' +
    (document.seller.bankName || document.seller.bankAccount ? '<p style="margin-top:14px">Bank: ' + esc(document.seller.bankName) + ' · Account: ' + esc(document.seller.bankAccount) + ' · IFSC: ' + esc(document.seller.bankIfsc) + '</p>' : '') +
    '<div class="sign"><div>Customer acknowledgment</div><div>Authorised signatory<br>' + esc(document.seller.legalName) + '</div></div>' +
    '<button class="no-print" onclick="window.print()">Print / Save as PDF</button></body></html>';
  const win = window.open('', '_blank');
  if (!win) return notify('Allow pop-ups for FactoryFlow to print or save this document as PDF.');
  win.document.open();
  win.document.write(printHtml);
  win.document.close();
  win.focus();
}

function marketplacePage() {
  const suppliers = [{ name: 'Kraftline Papers', product: 'Kraft paper · 180 GSM', price: '₹58.20 / kg', save: '7.5% group saving', initials: 'KP', members: 11 }, { name: 'WestPack Films', product: 'BOPP film · 25 micron', price: '₹176 / kg', save: '5.2% group saving', initials: 'WF', members: 7 }, { name: 'Pioneer Inks', product: 'Water-based ink · black', price: '₹425 / kg', save: 'Verified price', initials: 'PI', members: 0 }];
  const cards = suppliers.map((supplier) => '<article class="supplier-card"><header><span class="person-avatar">' + supplier.initials + '</span><span><strong>' + supplier.name + '</strong><small>✓ Verified supplier</small></span></header><p>' + supplier.product + '</p><h3>' + supplier.price + '</h3><div class="supplier-meta"><span>' + supplier.save + '</span><span>' + (supplier.members ? supplier.members + ' businesses joined' : 'Ready to order') + '</span></div><button class="primary-button" data-group="' + supplier.name + '">' + (supplier.members ? 'Join group buy' : 'Request quote') + '</button></article>').join('');
  return head('B2B NETWORK', 'Better buying, together', 'Discover verified suppliers, join cluster group buys, and protect every payment.', '<button class="primary-button" data-action="supplier">＋ Request supplier</button>') + '<section class="marketplace-hero"><div><span class="eyebrow">YOUR CLUSTER · PACKAGING</span><h2>Buy smarter with businesses like yours.</h2><p>Prices shown are from verified B2B suppliers. Group buys unlock better rates once the minimum quantity is reached.</p></div><div class="protection-card"><span>✦</span><strong>Protected payment</strong><small>Funds release after verified delivery proof.</small></div></section><div class="supplier-grid">' + cards + '</div><section class="panel marketplace-footer"><div><h2>Working capital when you need it</h2><p>Use verified orders and payment history to unlock raw-material financing for your next buy.</p></div><button class="secondary-button" data-action="capital">Check eligibility</button></section>';
}

function settingsPage() {
  return head('WORKSPACE', 'FactoryFlow settings', 'Set your manufacturing cluster, language, and communication defaults.') + '<section class="content-card"><div class="settings-stack"><div><span class="settings-label">MANUFACTURING CLUSTER</span><strong>Packaging</strong><small>Quotes, material names, and supplier discovery fit this cluster.</small></div><button class="secondary-button" data-action="cluster">Change cluster</button><div><span class="settings-label">LANGUAGE / भाषा</span><strong>' + (app.language === 'hi' ? 'हिंदी' : 'English') + '</strong><small>Keep your team and customers comfortable in the language they use.</small></div><button class="secondary-button" data-action="language">Switch to ' + (app.language === 'hi' ? 'English' : 'हिंदी') + '</button><div><span class="settings-label">CUSTOMER CHANNEL</span><strong>WhatsApp first</strong><small>Quote delivery and payment reminders default to WhatsApp.</small></div><button class="secondary-button" data-action="channel">Manage channel</button></div></section>';
}

function render() {
  const permissions = { dashboard: 'dashboard.view', quotes: 'quotes.view', jobs: 'jobs.view', purchases: 'purchases.view', materials: 'materials.view', forecast: 'materials.view', workers: 'workers.view', invoices: 'invoices.view', marketplace: 'marketplace.view', facilities: 'facilities.view', planning: 'planning.view', schedule: 'schedule.view', execution: 'execution.view', analytics: 'analytics.view', costing: 'costing.view', settings: 'settings.view', users: 'users.manage', machines: 'machines.view', maintenance: 'machines.view', 'work-orders': 'maintenance.view', 'maintenance-calendar': 'maintenance.view' };
  if (!window.FactoryFlowAuth.has(permissions[app.view])) app.view = 'dashboard';
  const label = titles[app.view];
  ui('#pageKicker').textContent = label[0];
  ui('#pageTitle').textContent = label[1];
  all('.nav-link[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === app.view));
  const pages = { dashboard: window.FactoryFlowAuth.state.user.role === 'worker' ? workerDashboard : window.FactoryFlowAuth.state.user.role === 'supervisor' ? supervisorDashboard : dashboard, quotes: quotesPage, jobs: jobsPage, purchases: purchasesPage, materials: materialsPage, forecast: forecastPage, workers: workersPage, invoices: invoicesPage, marketplace: marketplacePage, facilities: facilitiesPage, planning: planningPage, schedule: schedulePage, execution: executionPage, analytics: analyticsPage, costing: costingPage, settings: settingsPage, users: usersPage, machines: machinesPage, maintenance: maintenancePage, 'work-orders': maintenanceWorkOrdersPage, 'maintenance-calendar': maintenanceCalendarPage };
  ui('#view').innerHTML = pages[app.view]();
  bind();
}

function goto(next) {
  app.view = next;
  app.filter = 'All';
  ui('.sidebar').classList.remove('open');
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function notify(message) {
  const item = document.createElement('div');
  item.className = 'toast';
  item.innerHTML = '<span>✓</span>' + message;
  ui('#toastRegion').append(item);
  setTimeout(() => item.remove(), 3600);
}
function closeModal() { ui('#modalBackdrop').hidden = true; ui('.modal').classList.remove('document-modal'); }
function openModal(markup, wide) {
  ui('.modal').classList.toggle('document-modal', Boolean(wide));
  ui('#modalContent').innerHTML = markup;
  ui('#modalBackdrop').hidden = false;
  all('[data-close]').forEach((button) => button.addEventListener('click', closeModal));
}
function newQuote() {
  openModal('<h2 id="modalTitle">New quotation</h2><p>Create the quote in English, then send it on WhatsApp in the customer’s preferred language.</p><form id="quoteForm" class="form-grid"><label>Customer name<input required name="customer" placeholder="e.g. Shree Packaging"></label><div class="form-row"><label>Product or service<input required name="scope" placeholder="e.g. Corrugated carton"></label><label>Quantity<input required name="qty" type="number" min="1" placeholder="0"></label></div><div class="form-row"><label>Base quote value (before GST)<input required name="value" type="number" min="1" placeholder="0"></label><label>Valid until<input required name="valid" type="date"></label></div><label>WhatsApp number<input name="phone" type="tel" placeholder="91 98765 43210"></label><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Create quote</button></div></form>');
  ui('#quoteForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const valid = data.get('valid') ? new Date(data.get('valid') + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '7 days';
    quotes.unshift({ id: 'QT-' + (2085 + quotes.length), customer: data.get('customer'), scope: data.get('scope'), qty: Number(data.get('qty')), value: Number(data.get('value')), phone: data.get('phone').replace(/\D/g, ''), valid, status: 'Sent' });
    save(); closeModal(); goto('quotes'); notify('Quote is ready to share on WhatsApp.');
  });
}
function newJob() {
  const activeWorkers = workers.filter((worker) => worker.active !== false);
  if (!activeWorkers.length) {
    notify('Activate a job worker before creating a production job.');
    return;
  }
  const options = activeWorkers.map((worker) => '<option value="' + safe(worker.id) + '">' + safe(worker.name + ' · ' + worker.skill) + '</option>').join('');
  openModal('<h2 id="modalTitle">Create job</h2><p>Turn an accepted quote into a trackable production job.</p><form id="jobForm" class="form-grid"><label>Customer<input required name="customer" placeholder="Customer name"></label><label>Work description<input required name="item" placeholder="e.g. Corrugated carton · 5-ply"></label><div class="form-row"><label>Quantity<input required name="qty" type="number" min="1" placeholder="0"></label><label>Initial worker<select name="workerId">' + options + '</select></label></div><div class="form-row"><label>Estimated production hours (optional)<input name="estimatedHours" type="number" min="0.25" max="100000" step="0.25" placeholder="e.g. 24"></label><label>Job priority<select name="priority"><option>Normal</option><option>Low</option><option>High</option><option>Urgent</option></select></label></div><label>Required operation / skill (optional)<input name="requiredSkill" maxlength="100" placeholder="e.g. Printing, Carton conversion"></label><label>Target completion date (optional)<input name="dueDate" type="date"></label><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Create job</button></div></form>');
  ui('#jobForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const worker = workers.find((item) => item.id === data.get('workerId'));
    if (!worker || worker.active === false) {
      notify('Choose an active job worker.');
      return;
    }
    const dueDate = data.get('dueDate');
    if (dueDate && !window.FactoryFlowScheduling.validDate(dueDate)) {
      notify('Choose a valid target completion date.');
      return;
    }
    const estimatedHours = data.get('estimatedHours').trim();
    const requiredSkill = data.get('requiredSkill').trim();
    if (estimatedHours && (!Number.isFinite(Number(estimatedHours)) || Number(estimatedHours) <= 0 || Number(estimatedHours) > 100000)) {
      notify('Estimated production hours must be greater than zero and no more than 100,000.');
      return;
    }
    if (requiredSkill.length > 100) {
      notify('Required operation / skill must be 100 characters or fewer.');
      return;
    }
    const job = { id: 'JB-' + (842 + jobs.length), customer: data.get('customer').trim(), item: data.get('item').trim(), qty: Number(data.get('qty')), worker: worker.name, due: dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-IN') : 'To schedule', dueDate: dueDate || '', estimatedHours: estimatedHours ? Number(estimatedHours) : null, priority: data.get('priority') || 'Normal', requiredSkill, status: 'With worker', progress: 0, owner: 'RK' };
    jobs.unshift(job);
    save(); closeModal(); goto('jobs'); notify('Job created and assigned to ' + worker.name + '. Schedule its production sessions next.');
  });
}

function newPurchase() {
  openModal('<h2 id="modalTitle">New purchase order</h2><p>Record the raw-material commitment and keep the job promise safe.</p><form id="purchaseForm" class="form-grid"><label>Supplier<input required name="supplier" placeholder="Supplier name"></label><label>Material<input required name="material" placeholder="e.g. Kraft paper · 180 GSM"></label><div class="form-row"><label>Order quantity (optional)<input name="quantity" type="number" min="0.01" step="0.01" placeholder="e.g. 500"></label><label>Unit (optional)<input name="unit" placeholder="kg, sheets, rolls…"></label></div><div class="form-row"><label>Amount (₹)<input required name="amount" type="number" min="1" placeholder="0"></label><label>Expected delivery<input required name="delivery" type="date"></label></div><p class="subtle">Add both quantity and unit to include this order in material planning and track partial receipts. Leave both blank for an amount-only purchase order.</p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Create PO</button></div></form>');
  ui('#purchaseForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const delivery = data.get('delivery') ? new Date(data.get('delivery') + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'To confirm';
    const quantityText = data.get('quantity').trim();
    const unitText = data.get('unit').trim();
    if (Boolean(quantityText) !== Boolean(unitText)) {
      notify('Enter both order quantity and unit, or leave both blank.');
      return;
    }
    const purchase = { id: 'PO-' + (492 + purchases.length), supplier: data.get('supplier').trim(), material: data.get('material').trim(), amount: Number(data.get('amount')), delivery, status: 'Confirmed' };
    if (quantityText && unitText) {
      const quantity = Number(quantityText);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        notify('Enter a valid order quantity.');
        return;
      }
      purchase.quantity = quantity;
      purchase.unit = unitText;
      purchase.receivedQty = 0;
    }
    purchases.unshift(purchase);
    save(); closeModal(); goto('purchases'); notify('Purchase order is ready to send to the supplier.');
  });
}
function safe(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error('The attachment could not be read.')));
    reader.readAsDataURL(file);
  });
}
function openDeliveryProof(jobId) {
  const selectedJob = jobs.find((job) => job.id === jobId);
  if (!selectedJob) return;
  if (!selectedJob.readyForDelivery && selectedJob.status !== 'Delivered') {
    notify('Complete production output, QC inspection and all rework before adding delivery proof.');
    goto('execution');
    return;
  }
  const eligibleJobs = jobs.filter((job) => job.readyForDelivery || job.status === 'Delivered');
  const jobOptions = eligibleJobs.map((job) => '<option value="' + safe(job.id) + '"' + (job.id === selectedJob.id ? ' selected' : '') + '>' + safe(job.id + ' · ' + job.customer + ' · ' + job.item) + '</option>').join('');
  const today = localDateISO();
  const form = '<h2 id="modalTitle">Capture delivery proof</h2><p>Record who received the delivery and attach a signed challan or photo. Files stay in this local workspace.</p><form id="proofForm" class="form-grid"><label>Job<select name="jobId">' + jobOptions + '</select></label><div class="form-row"><label>Delivered on<input required name="deliveredAt" type="date" value="' + today + '"></label><label>Received by<input required name="receivedBy" placeholder="Recipient name"></label></div><label>Challan or reference number<input name="challan" placeholder="e.g. DC-2084"></label><label>Delivery photo or signed challan<input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label><small class="upload-hint">Optional JPG, PNG, WebP, or PDF up to 1 MB.</small><label>Notes<input name="notes" placeholder="e.g. 12 cartons received in good condition"></label><p id="proofError" class="form-error" hidden></p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save proof</button></div></form>';
  openModal(form, true);
  ui('#proofForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get('attachment');
    const error = ui('#proofError');
    let attachment = null;
    if (file && file.size) {
      const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (file.size > 1_000_000) {
        error.textContent = 'Choose an image or PDF smaller than 1 MB.';
        error.hidden = false;
        return;
      }
      if (!acceptedTypes.includes(file.type)) {
        error.textContent = 'Only JPG, PNG, WebP, and PDF files can be used as delivery proof.';
        error.hidden = false;
        return;
      }
      try {
        attachment = { name: file.name, type: file.type, size: file.size, dataUrl: await fileAsDataUrl(file) };
      } catch (readError) {
        error.textContent = readError.message;
        error.hidden = false;
        return;
      }
    }
    const job = jobs.find((item) => item.id === formData.get('jobId'));
    if (!job) return;
    if (!job.readyForDelivery && job.status !== 'Delivered') {
      error.textContent = 'This job has not passed production and QC release checks.';
      error.hidden = false;
      return;
    }
    try {
      const result = await window.FactoryFlowAuth.request('/api/operations/delivery', {
        method: 'POST',
        body: JSON.stringify({
          jobId: job.id,
          receivedBy: formData.get('receivedBy'),
          challan: formData.get('challan'),
          deliveredAt: formData.get('deliveredAt'),
          notes: formData.get('notes'),
          attachment
        })
      });
      const existing = deliveries.findIndex((item) => item.jobId === job.id);
      if (existing >= 0) deliveries.splice(existing, 1, result.delivery); else deliveries.unshift(result.delivery);
      const index = jobs.findIndex((item) => item.id === job.id);
      if (index >= 0) jobs.splice(index, 1, result.job);
      save(false); closeModal(); goto('jobs'); notify('Delivery proof saved for ' + job.id + '.');
    } catch (saveError) {
      error.textContent = saveError.message;
      error.hidden = false;
    }
  });
}
function viewDeliveryProof(jobId) {
  const delivery = deliveries.find((item) => item.jobId === jobId);
  if (!delivery) { openDeliveryProof(jobId); return; }
  const attachment = delivery.attachment;
  const attachmentBlock = attachment
    ? (attachment.type.startsWith('image/') ? '<img class="proof-image" src="' + attachment.dataUrl + '" alt="Delivery proof for ' + safe(delivery.jobId) + '">' : '<a class="proof-file" href="' + attachment.dataUrl + '" download="' + safe(attachment.name) + '">⇩ Download ' + safe(attachment.name) + '</a>')
    : '<div class="proof-empty">No file was attached to this proof record.</div>';
  const body = '<h2 id="modalTitle">Delivery proof · ' + safe(delivery.jobId) + '</h2><p>Saved ' + new Date(delivery.deliveredAt + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + ' for ' + safe(delivery.customer) + '.</p><div class="proof-details"><div><span>RECEIVED BY</span><strong>' + safe(delivery.receivedBy) + '</strong></div><div><span>CHALLAN / REF.</span><strong>' + safe(delivery.challan) + '</strong></div><div><span>NOTES</span><strong>' + safe(delivery.notes) + '</strong></div></div>' + attachmentBlock + '<div class="modal-actions"><button class="secondary-button" type="button" data-close>Close</button><button class="primary-button" type="button" data-proof-job="' + safe(delivery.jobId) + '">Replace proof</button></div>';
  openModal(body, true);
  ui('[data-proof-job]').addEventListener('click', () => openDeliveryProof(delivery.jobId));
}
function quoteDocument(id) {
  const quote = quotes.find((item) => item.id === id);
  if (!quote) return;
  const gst = Math.round(quote.value * .18);
  const total = quote.value + gst;
  const body = '<div class="document-heading"><div><span class="eyebrow">FACTORYFLOW · QUOTE</span><h2 id="modalTitle">Quotation ' + safe(quote.id) + '</h2><p>Prepared for ' + safe(quote.customer) + '</p></div><div class="document-status">' + status(quote.status) + '<small>Valid until ' + safe(quote.valid) + '</small></div></div><div class="document-parties"><div><span>FROM</span><strong>FactoryFlow demo workspace</strong><small>Job-work OS for small manufacturers<br>GSTIN: add in Settings</small></div><div><span>BILL TO</span><strong>' + safe(quote.customer) + '</strong><small>Shared on WhatsApp<br>Preferred language: English / हिंदी</small></div></div><div class="document-lines"><div class="document-line document-line-head"><span>DESCRIPTION</span><span>QTY</span><span>RATE</span><span>AMOUNT</span></div><div class="document-line"><strong>' + safe(quote.scope) + '</strong><span>' + quote.qty.toLocaleString() + ' units</span><span>—</span><strong>' + currency(quote.value) + '</strong></div></div><div class="document-total"><div><span>Subtotal</span><strong>' + currency(quote.value) + '</strong></div><div><span>GST · 18%</span><strong>' + currency(gst) + '</strong></div><div class="grand-total"><span>Quote total</span><strong>' + currency(total) + '</strong></div></div><p class="document-note">This estimate is prepared from the base quote value. Confirm the final HSN/SAC and GST treatment before issuing a tax invoice.</p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Close</button><button class="secondary-button" type="button" data-print-quote="' + quote.id + '">Print</button><button class="primary-button" type="button" data-doc-share="' + quote.id + '">◔ Share on WhatsApp</button></div>';
  openModal(body, true);
  ui('[data-doc-share]').addEventListener('click', () => share(quote.id));
  ui('[data-print-quote]').addEventListener('click', () => printQuote(quote.id));
}
function printQuote(id) {
  const quote = quotes.find((item) => item.id === id);
  if (!quote) return;
  const gst = Math.round(quote.value * .18);
  const total = quote.value + gst;
  const printable = '<h1>FactoryFlow</h1><p class="accent">QUOTATION ' + safe(quote.id) + '</p><hr><p><b>Customer:</b> ' + safe(quote.customer) + '<br><b>Valid until:</b> ' + safe(quote.valid) + '</p><table><thead><tr><th>Description</th><th>Quantity</th><th>Base value</th></tr></thead><tbody><tr><td>' + safe(quote.scope) + '</td><td>' + quote.qty.toLocaleString() + ' units</td><td>' + currency(quote.value) + '</td></tr></tbody></table><div class="totals"><p>Subtotal <b>' + currency(quote.value) + '</b></p><p>GST (18%) <b>' + currency(gst) + '</b></p><h2>Quote total ' + currency(total) + '</h2></div><p class="small">Estimate only. Confirm HSN/SAC and tax treatment before invoicing.</p>';
  const printer = window.open('', '_blank');
  if (!printer) { notify('Please allow pop-ups to print this quotation.'); return; }
  printer.opener = null;
  printer.document.write('<!doctype html><html><head><title>Quote ' + safe(quote.id) + '</title><style>body{font-family:Arial,sans-serif;color:#14251b;padding:42px;max-width:780px;margin:auto}h1{margin:0;font-size:28px}.accent{color:#257a54;font-weight:bold;letter-spacing:1px}hr{border:0;border-top:1px solid #dbe3dc;margin:25px 0}table{border-collapse:collapse;width:100%;margin-top:25px}th,td{padding:12px;text-align:left;border-bottom:1px solid #dbe3dc}th{font-size:11px;color:#65736b;text-transform:uppercase}.totals{margin:24px 0 0 auto;width:310px}.totals p{display:flex;justify-content:space-between}.totals h2{border-top:2px solid #183f2d;padding-top:12px;display:flex;justify-content:space-between;font-size:17px}.small{font-size:11px;color:#65736b;margin-top:44px}</style></head><body>' + printable + '</body></html>');
  printer.document.close();
  printer.focus();
  setTimeout(() => printer.print(), 250);
}
function openReminder(id) {
  const invoice = invoiceRecords.find((item) => item.id === id);
  if (!invoice) return;
  const message = 'Namaste ' + invoice.customer + ', a gentle reminder that ' + invoice.id + ' for ' + currency(invoice.amount) + ' is due ' + invoice.due + '. Please let us know the payment status. Thank you.';
  const body = '<h2 id="modalTitle">Payment reminder</h2><p>Review the WhatsApp message before sending it to ' + safe(invoice.customer) + '.</p><div class="reminder-card"><span>' + safe(invoice.id) + ' · ' + status(invoice.status) + '</span><strong>' + currency(invoice.amount) + '</strong><p>' + safe(message) + '</p></div><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="secondary-button" type="button" data-copy-reminder>Copy text</button><button class="primary-button" type="button" data-send-reminder>◔ Open WhatsApp</button></div>';
  openModal(body);
  ui('[data-copy-reminder]').addEventListener('click', async () => { await navigator.clipboard?.writeText(message); notify('Payment reminder copied.'); });
  ui('[data-send-reminder]').addEventListener('click', () => { window.open('https://wa.me/' + invoice.phone + '?text=' + encodeURIComponent(message), '_blank', 'noopener'); notify('Payment reminder opened in WhatsApp.'); });
}
function share(id) {
  const quote = quotes.find((item) => item.id === id);
  if (!quote) return;
  quote.status = 'Sent';
  save();
  const message = 'Namaste ' + quote.customer + ', your FactoryFlow quote ' + quote.id + ' for ' + quote.scope + ' is ' + currency(quote.value) + '. Valid until ' + quote.valid + '.';
  window.open('https://wa.me/' + (quote.phone || '') + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
  render(); notify(quote.id + ' opened in WhatsApp.');
}
function convert(id) {
  const quote = quotes.find((item) => item.id === id);
  if (!quote) return;
  quote.status = 'Accepted';
  jobs.unshift({ id: 'JB-' + (842 + jobs.length), customer: quote.customer, item: quote.scope, qty: quote.qty, worker: 'Unassigned', due: 'To schedule', status: 'Material pending', progress: 0, owner: 'SD', sellingValue: quote.value, workerCost: 0, otherCost: 0 });
  save(); goto('jobs'); notify(quote.id + ' was converted to a live job.');
}

function downloadCsv(filename, rows) {
  if (!rows.length) {
    notify('There is no data to export yet.');
    return;
  }
  const csvCell = (value) => {
    let text = String(value ?? '');
    if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const csv = '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notify(filename + ' downloaded.');
}

function exportQuotes() {
  const rows = quotes
    .filter((quote) => app.filter === 'All' || quote.status === app.filter)
    .map((quote) => [quote.id, quote.customer, quote.scope, quote.qty, quote.value, quote.valid, quote.status, quote.phone || '']);
  downloadCsv('factoryflow-quotes.csv', [['Quote ID', 'Customer', 'Scope', 'Quantity', 'Base value INR', 'Valid until', 'Status', 'WhatsApp'], ...rows]);
}

function updatePurchase(id) {
  const purchase = purchases.find((item) => item.id === id);
  if (!purchase) return;
  const statuses = ['Draft', 'Confirmed', 'In transit', 'Part received', 'Received', 'Cancelled'];
  const options = statuses.map((value) => '<option' + (purchase.status === value ? ' selected' : '') + '>' + value + '</option>').join('');
  openModal('<h2 id="modalTitle">Update purchase order</h2><p>' + safe(purchase.id) + ' · ' + safe(purchase.material) + '</p><form id="purchaseStatusForm" class="form-grid"><label>Supplier<input name="supplier" value="' + safe(purchase.supplier || '') + '" placeholder="Supplier to assign"></label><label>Order status<select name="status">' + options + '</select></label><label>Purchase amount (₹)<input name="amount" type="number" min="0" step="0.01" value="' + (purchase.amount === null || purchase.amount === undefined ? '' : Number(purchase.amount)) + '" placeholder="Enter supplier quote"></label><label>Expected delivery<input name="delivery" type="text" value="' + safe(purchase.delivery || '') + '" placeholder="e.g. Nov 04 or Today"></label><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save update</button></div></form>');
  ui('#purchaseStatusForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    purchase.status = data.get('status');
    purchase.supplier = data.get('supplier').trim() || 'Supplier to assign';
    const amountText = data.get('amount').trim();
    purchase.amount = amountText === '' ? null : Number(amountText);
    purchase.delivery = data.get('delivery').trim() || 'To confirm';
    save();
    closeModal();
    render();
    notify(purchase.id + ' updated to ' + purchase.status + '.');
  });
}

function receiveMaterials() {
  const eligiblePurchases = purchases.filter((item) => item.status !== 'Cancelled');
  if (!eligiblePurchases.length) {
    notify('Create an active purchase order before recording a receipt.');
    return;
  }
  openModal('<h2 id="modalTitle">Receive material</h2><p>Record a delivery against an existing purchase order. Stock-on-hand and stock health update automatically.</p><form id="receiveMaterialForm" class="form-grid"><label>Purchase order<select name="purchaseId">' + eligiblePurchases.map((item) => '<option value="' + safe(item.id) + '">' + safe(item.id + ' · ' + item.supplier + ' · ' + item.material) + '</option>').join('') + '</select></label><label>Quantity received<input required name="quantity" type="number" min="0.01" step="0.01" placeholder="e.g. 500"></label><label>Unit<input required name="unit" placeholder="kg, sheets, rolls…"></label><label>Receipt status<select name="statusAfterReceipt"><option value="Part received" selected>Part received</option><option value="Received">Received — order complete</option></select></label><label>Delivery note / challan<input name="reference" placeholder="Optional reference"></label><p id="receiptError" class="form-error" hidden></p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Record receipt</button></div></form>');
  ui('#receiveMaterialForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const purchase = purchases.find((item) => item.id === data.get('purchaseId'));
    if (!purchase || purchase.status === 'Cancelled') {
      notify('Cancelled purchase orders cannot receive material.');
      closeModal();
      return;
    }
    if (Number(purchase.quantity) > 0 && purchase.unit && window.FactoryFlowInventory.normalizeUnit(data.get('unit')) !== window.FactoryFlowInventory.normalizeUnit(purchase.unit)) {
      const errorElement = ui('#receiptError');
      errorElement.textContent = 'This purchase order is for ' + purchase.unit + '. Record the receipt using that unit.';
      errorElement.hidden = false;
      return;
    }

    let stockUpdate;
    try {
      stockUpdate = window.FactoryFlowInventory.receiveIntoStock(
        materials,
        purchase.material,
        Number(data.get('quantity')),
        data.get('unit')
      );
    } catch (error) {
      const errorElement = ui('#receiptError');
      errorElement.textContent = error.message;
      errorElement.hidden = false;
      return;
    }

    const receipt = {
      id: 'MR-' + (101 + receipts.length),
      purchaseId: purchase.id,
      supplier: purchase.supplier,
      material: purchase.material,
      quantity: Number(data.get('quantity')),
      unit: data.get('unit').trim(),
      reference: data.get('reference').trim(),
      stockSku: stockUpdate.material.sku,
      stockBefore: stockUpdate.previousOnHand,
      stockAfter: stockUpdate.material.onHand,
      createdMaterial: stockUpdate.created,
      receivedAt: new Date().toISOString()
    };
    receipts.unshift(receipt);
    if (Number.isFinite(Number(purchase.quantity)) && purchase.quantity > 0) {
      purchase.receivedQty = Number(purchase.receivedQty || 0) + receipt.quantity;
      if (purchase.receivedQty >= Number(purchase.quantity)) purchase.status = 'Received';
    }
    movements.unshift({
      id: 'MV-' + (101 + movements.length),
      type: 'Receipt',
      direction: 'IN',
      materialSku: stockUpdate.material.sku,
      material: stockUpdate.material.item,
      quantity: receipt.quantity,
      unit: receipt.unit,
      stockBefore: stockUpdate.previousOnHand || '0 ' + receipt.unit,
      stockAfter: stockUpdate.material.onHand,
      jobId: '',
      reference: receipt.reference || receipt.purchaseId,
      note: 'Material received from ' + receipt.supplier,
      createdAt: receipt.receivedAt
    });
    if (purchase.status !== 'Received') purchase.status = data.get('statusAfterReceipt');
    save();
    closeModal();
    goto('materials');
    notify('Receipt ' + receipt.id + ' recorded. ' + stockUpdate.material.item + ' stock is now ' + stockUpdate.material.onHand + '.');
  });
}

function setMaterialUnitCost(materialSku) {
  const material = materials.find((item) => item.sku === materialSku);
  if (!material) return;
  const parsed = window.FactoryFlowInventory.parseQuantity(material.onHand);
  const unit = parsed ? parsed.unitLabel : 'unit';
  const value = material.unitCost !== null && material.unitCost !== undefined && material.unitCost !== '' && Number.isFinite(Number(material.unitCost)) ? Number(material.unitCost) : '';
  openModal('<h2 id="modalTitle">Set material unit cost</h2><p>' + safe(material.sku + ' · ' + material.item) + '</p><p>Enter the cost in rupees per ' + safe(unit) + '. New consumption records will snapshot this price; older unpriced records remain flagged.</p><form id="materialCostForm" class="form-grid"><label>Cost per ' + safe(unit) + ' (₹)<input required name="unitCost" type="number" min="0" step="0.01" value="' + value + '" placeholder="e.g. 42.50"></label><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save unit cost</button></div></form>');
  ui('#materialCostForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const unitCost = Number(data.get('unitCost'));
    if (!Number.isFinite(unitCost) || unitCost < 0) return;
    material.unitCost = Math.round(unitCost * 100) / 100;
    save();
    closeModal();
    render();
    notify('Unit cost saved for ' + material.item + '.');
  });
}

function editJobCosts(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return;
  const sellingValue = job.sellingValue === null || job.sellingValue === undefined ? '' : Number(job.sellingValue);
  const workerCost = job.workerCost === null || job.workerCost === undefined ? 0 : Number(job.workerCost);
  const otherCost = job.otherCost === null || job.otherCost === undefined ? 0 : Number(job.otherCost);
  openModal('<h2 id="modalTitle">Job costing · ' + safe(job.id) + '</h2><p>' + safe(job.customer + ' · ' + job.item) + '</p><form id="jobCostForm" class="form-grid"><label>Selling value before GST (₹)<input required name="sellingValue" type="number" min="0" step="0.01" value="' + sellingValue + '" placeholder="Enter agreed job value"></label><label>Job-worker / labour charge (₹)<input required name="workerCost" type="number" min="0" step="0.01" value="' + workerCost + '"></label><label>Other direct costs (₹)<input required name="otherCost" type="number" min="0" step="0.01" value="' + otherCost + '"></label><p class="subtle">Material costs come from the unit cost captured on each consumption entry. For quote-converted jobs, the quoted base value is prefilled as selling value.</p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save job costs</button></div></form>');
  ui('#jobCostForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = ['sellingValue', 'workerCost', 'otherCost'].map((key) => Number(data.get(key)));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      notify('Enter valid non-negative costs.');
      return;
    }
    [job.sellingValue, job.workerCost, job.otherCost] = values.map((value) => Math.round(value * 100) / 100);
    save();
    closeModal();
    goto('costing');
    notify('Cost details saved for ' + job.id + '.');
  });
}

function consumeMaterials(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || !['In production', 'With worker'].includes(job.status)) {
    notify('Material consumption can only be recorded for jobs in production or with a job worker.');
    return;
  }
  if (!materials.length) {
    notify('Add inventory items before recording material consumption.');
    return;
  }
  const materialOptions = materials.map((item) => '<option value="' + safe(item.sku) + '">' + safe(item.sku + ' · ' + item.item + ' · ' + item.onHand) + '</option>').join('');
  const form = '<h2 id="modalTitle">Record material use</h2><p>Deduct raw material used for ' + safe(job.id + ' · ' + job.item) + '. Stock cannot fall below zero.</p><form id="consumeMaterialForm" class="form-grid"><label>Production job<input value="' + safe(job.id + ' · ' + job.customer) + '" disabled></label><label>Material<select name="materialSku">' + materialOptions + '</select></label><div class="form-row"><label>Quantity used<input required name="quantity" type="number" min="0.01" step="0.01" placeholder="e.g. 25"></label><label>Unit<input required name="unit" placeholder="kg, sheets, rolls…"></label></div><label>Reason / operation<input name="note" placeholder="e.g. Carton cutting run"></label><p id="consumptionError" class="form-error" hidden></p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Deduct from stock</button></div></form>';
  openModal(form, true);
  ui('#consumeMaterialForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let stockUpdate;
    try {
      stockUpdate = window.FactoryFlowInventory.consumeFromStock(
        materials,
        data.get('materialSku'),
        Number(data.get('quantity')),
        data.get('unit')
      );
    } catch (error) {
      const errorElement = ui('#consumptionError');
      errorElement.textContent = error.message;
      errorElement.hidden = false;
      return;
    }
    const movement = {
      id: 'MV-' + (101 + movements.length),
      type: 'Consumption',
      direction: 'OUT',
      materialSku: stockUpdate.material.sku,
      material: stockUpdate.material.item,
      quantity: stockUpdate.usedQuantity,
      unit: data.get('unit').trim(),
      unitCost: stockUpdate.material.unitCost !== null && stockUpdate.material.unitCost !== undefined && stockUpdate.material.unitCost !== '' && Number.isFinite(Number(stockUpdate.material.unitCost)) ? Number(stockUpdate.material.unitCost) : null,
      costAmount: stockUpdate.material.unitCost !== null && stockUpdate.material.unitCost !== undefined && stockUpdate.material.unitCost !== '' && Number.isFinite(Number(stockUpdate.material.unitCost)) ? Math.round(Number(stockUpdate.material.unitCost) * stockUpdate.usedQuantity * 100) / 100 : null,
      stockBefore: stockUpdate.previousOnHand,
      stockAfter: stockUpdate.onHand,
      jobId: job.id,
      reference: '',
      note: data.get('note').trim() || 'Material used for production',
      createdAt: new Date().toISOString()
    };
    movements.unshift(movement);
    save();
    closeModal();
    goto('materials');
    notify(movement.quantity + ' ' + movement.unit + ' of ' + movement.material + ' deducted for ' + job.id + '. Stock now ' + stockUpdate.onHand + '.');
  });
}

function actionMessage(action) {
  return ({ reply: 'WhatsApp reply is ready for Narmada Foods.', export: 'Quote export is ready to download.', proof: 'Delivery-proof form opened. Add a photo or signed challan.', invite: 'Job-worker invitation link copied.', 'po-update': 'Purchase-order update saved.', receive: 'Material receiving form is ready.', invoice: 'GST invoice draft created from the latest delivery proof.', reminders: 'Two payment reminders are ready to send on WhatsApp.', supplier: 'Supplier requirement posted to your cluster.', capital: 'Eligibility check started. Your data stays private.', cluster: 'Cluster selector will open in the next build.', channel: 'WhatsApp is your default customer channel.' }[action] || 'Update saved.');
}
function toggleLanguage() {
  app.language = app.language === 'en' ? 'hi' : 'en';
  save(); ui('#languageToggle').textContent = app.language === 'hi' ? 'EN' : 'हिं';
  render(); notify(app.language === 'hi' ? 'भाषा हिंदी में बदल दी गई है।' : 'Language set to English.');
}
function bind() {
  all('[data-go]').forEach((button) => button.addEventListener('click', () => goto(button.dataset.go)));
  all('[data-new]').forEach((button) => button.addEventListener('click', () => ({ quote: newQuote, job: newJob, purchase: newPurchase }[button.dataset.new]())));
  all('[data-filter]').forEach((button) => button.addEventListener('click', () => { app.filter = button.dataset.filter; render(); }));
  all('[data-document]').forEach((button) => button.addEventListener('click', () => quoteDocument(button.dataset.document)));
  all('[data-share]').forEach((button) => button.addEventListener('click', () => share(button.dataset.share)));
  all('[data-convert]').forEach((button) => button.addEventListener('click', () => convert(button.dataset.convert)));
  all('[data-proof-job]').forEach((button) => button.addEventListener('click', () => openDeliveryProof(button.dataset.proofJob)));
  all('[data-new-downtime]').forEach((button) => button.addEventListener('click', createDowntimeRecord));
  all('[data-export-analytics]').forEach((button) => button.addEventListener('click', exportAnalyticsCsv));
  all('[data-reset-analytics]').forEach((button) => button.addEventListener('click', () => {
    analyticsFilters.fromDate = '';
    analyticsFilters.toDate = '';
    analyticsFilters.groupBy = 'day';
    save();
    render();
  }));
  const analyticsForm = ui('#analyticsFilterForm');
  if (analyticsForm) analyticsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fromDate = data.get('fromDate');
    const toDate = data.get('toDate');
    if ((fromDate && !window.FactoryFlowAnalytics.validDate(fromDate)) || (toDate && !window.FactoryFlowAnalytics.validDate(toDate))) {
      notify('Choose valid date filters.');
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      notify('From date must be on or before to date.');
      return;
    }
    analyticsFilters.fromDate = fromDate;
    analyticsFilters.toDate = toDate;
    analyticsFilters.groupBy = data.get('groupBy');
    save();
    render();
  });
  all('[data-add-facility]').forEach((button) => button.addEventListener('click', addFacility));
  all('[data-add-machine]').forEach((button) => button.addEventListener('click', () => editMachine()));
  all('[data-edit-machine]').forEach((button) => button.addEventListener('click', () => editMachine(button.dataset.editMachine)));
  all('[data-add-maintenance]').forEach((button) => button.addEventListener('click', () => addMachineMaintenance(button.dataset.addMaintenance)));
  all('[data-service-machine]').forEach((button) => button.addEventListener('click', () => addMachineServiceRecord(button.dataset.serviceMachine)));
  all('[data-new-work-order]').forEach((button) => button.addEventListener('click', createMaintenanceWorkOrder));
  all('[data-new-technician]').forEach((button) => button.addEventListener('click', () => editMaintenanceTechnician()));
  all('[data-edit-technician]').forEach((button) => button.addEventListener('click', () => editMaintenanceTechnician(button.dataset.editTechnician)));
  all('[data-schedule-work-order]').forEach((button) => button.addEventListener('click', () => scheduleMaintenanceWorkOrder(button.dataset.scheduleWorkOrder)));
  const calendarForm = ui('#maintenanceCalendarForm');
  if (calendarForm) calendarForm.addEventListener('submit', (event) => { event.preventDefault(); maintenanceCalendarDate = new FormData(event.currentTarget).get('fromDate') || localDateISO(); render(); });
  all('[data-edit-work-order]').forEach((button) => button.addEventListener('click', () => editMaintenanceWorkOrder(button.dataset.editWorkOrder)));
  all('[data-issue-work-order-parts]').forEach((button) => button.addEventListener('click', () => issueMaintenanceWorkOrderParts(button.dataset.issueWorkOrderParts)));
  all('[data-mwo-filter]').forEach((button) => button.addEventListener('click', () => { maintenanceWorkOrderFilter = button.dataset.mwoFilter; render(); }));
  all('[data-toggle-spare]').forEach((button) => button.addEventListener('click', () => toggleMaintenanceSparePart(button.dataset.toggleSpare)));
  all('[data-remove-maintenance]').forEach((button) => button.addEventListener('click', () => removeMachineMaintenance(button.dataset.machineId, button.dataset.removeMaintenance)));
  all('[data-edit-facility]').forEach((button) => button.addEventListener('click', () => manageFacility(button.dataset.editFacility)));
  all('[data-use-facility]').forEach((button) => button.addEventListener('click', () => switchActiveFacility(button.dataset.useFacility)));
  all('[data-add-user]').forEach((button) => button.addEventListener('click', addWorkspaceUser));
  all('[data-edit-user]').forEach((button) => button.addEventListener('click', () => manageWorkspaceUser(button.dataset.editUser)));
  all('[data-consume-job]').forEach((button) => button.addEventListener('click', () => consumeMaterials(button.dataset.consumeJob)));
  all('[data-cost-job]').forEach((button) => button.addEventListener('click', () => editJobCosts(button.dataset.costJob)));
  all('[data-plan-job]').forEach((button) => button.addEventListener('click', () => planJobMaterials(button.dataset.planJob, button.dataset.planSku || null)));
  all('[data-schedule-job]').forEach((button) => button.addEventListener('click', () => scheduleProduction(button.dataset.scheduleJob)));
  all('[data-execution-job]').forEach((button) => button.addEventListener('click', () => recordProductionOutput(button.dataset.executionJob)));
  all('[data-production-job]').forEach((button) => button.addEventListener('click', () => recordProductionOutput(button.dataset.productionJob)));
  all('[data-qc-job]').forEach((button) => button.addEventListener('click', () => inspectProduction(button.dataset.qcJob)));
  all('[data-rework-job]').forEach((button) => button.addEventListener('click', () => recordRework(button.dataset.reworkJob)));
  all('[data-release-job]').forEach((button) => button.addEventListener('click', () => releaseJobForDelivery(button.dataset.releaseJob)));
  all('[data-delivery-proof]').forEach((button) => button.addEventListener('click', () => openDeliveryProof(button.dataset.deliveryProof)));
  all('[data-edit-worker]').forEach((button) => button.addEventListener('click', () => editWorkerProfile(button.dataset.editWorker)));
  all('[data-remove-session]').forEach((button) => button.addEventListener('click', () => removeProductionSession(button.dataset.removeSession)));
  const optimizerForm = ui('#optimizerOptionsForm');
  if (optimizerForm) optimizerForm.addEventListener('submit', (event) => { event.preventDefault(); runScheduleOptimization(); });
  all('[data-apply-optimizer]').forEach((button) => button.addEventListener('click', confirmScheduleOptimization));
  all('[data-configure-job-optimizer]').forEach((button) => button.addEventListener('click', () => configureJobSchedule(button.dataset.configureJobOptimizer)));
  all('[data-schedule-create]').forEach((button) => button.addEventListener('click', () => {
    const active = window.FactoryFlowScheduling.activeJobs(jobs);
    if (!active.length) return notify('Create an active production job before scheduling.');
    openModal('<h2 id="modalTitle">Choose a job to schedule</h2><form id="scheduleJobPicker" class="form-grid"><label>Production job<select name="jobId">' + active.map((job) => '<option value="' + safe(job.id) + '">' + safe(job.id + ' · ' + job.customer + ' · ' + job.item) + '</option>').join('') + '</select></label><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button" type="submit">Continue</button></div></form>');
    ui('#scheduleJobPicker').addEventListener('submit', (event) => { event.preventDefault(); const jobId = new FormData(event.currentTarget).get('jobId'); closeModal(); scheduleProduction(jobId); });
  }));
  all('[data-shortage-po]').forEach((button) => button.addEventListener('click', () => createShortagePurchaseOrder(button.dataset.shortagePo)));
  all('[data-refresh-forecast]').forEach((button) => button.addEventListener('click', refreshInventoryForecast));
  all('[data-forecast-settings]').forEach((button) => button.addEventListener('click', () => configureForecastSettings(button.dataset.forecastSettings)));
  all('[data-draft-forecast]').forEach((button) => button.addEventListener('click', () => createForecastDraft(button.dataset.draftForecast)));
  all('[data-plan-create]').forEach((button) => button.addEventListener('click', () => {
    const active = window.FactoryFlowPlanning.activeJobs(jobs);
    if (!active.length) return notify('Create an active production job before planning materials.');
    openModal('<h2 id="modalTitle">Choose a job</h2><form id="planningJobForm" class="form-grid"><label>Production job<select name="jobId">' + active.map((job) => '<option value="' + safe(job.id) + '">' + safe(job.id + ' · ' + job.customer + ' · ' + job.item) + '</option>').join('') + '</select></label><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button" type="submit">Continue</button></div></form>');
    ui('#planningJobForm').addEventListener('submit', (event) => { event.preventDefault(); const jobId = new FormData(event.currentTarget).get('jobId'); closeModal(); planJobMaterials(jobId); });
  }));
  all('[data-unit-cost]').forEach((button) => button.addEventListener('click', () => setMaterialUnitCost(button.dataset.unitCost)));
  all('[data-view-proof]').forEach((button) => button.addEventListener('click', () => viewDeliveryProof(button.dataset.viewProof)));
  all('[data-reminder]').forEach((button) => button.addEventListener('click', () => openReminder(button.dataset.reminder)));

  all('[data-gst-profile]').forEach((button) => button.addEventListener('click', configureGstProfile));
  all('[data-create-gst-doc]').forEach((button) => button.addEventListener('click', createGstDocument));
  all('[data-print-gst-doc]').forEach((button) => button.addEventListener('click', () => printGstDocument(button.dataset.printGstDoc)));
  all('[data-gst-filter]').forEach((button) => button.addEventListener('click', () => { gstDocumentFilter = button.dataset.gstFilter; render(); }));

  all('[data-group]').forEach((button) => button.addEventListener('click', () => notify('You joined the ' + button.dataset.group + ' buying group.')));
  all('[data-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'language') return toggleLanguage();
    if (action === 'export') return exportQuotes();
    if (action === 'receive') return receiveMaterials();
    if (action === 'po-update') return updatePurchase(button.dataset.purchaseId);
    notify(actionMessage(action));
  }));
}

async function startFactoryFlowApplication() {
  try {
    await window.FactoryFlowAuth.initialize();
    window.FactoryFlowAuth.applyNavigation();
    const pagePermissions = {
      dashboard: 'dashboard.view', quotes: 'quotes.view', jobs: 'jobs.view',
      purchases: 'purchases.view', materials: 'materials.view', forecast: 'materials.view', workers: 'workers.view',
      invoices: 'invoices.view', marketplace: 'marketplace.view', facilities: 'facilities.view', planning: 'planning.view',
      schedule: 'schedule.view', execution: 'execution.view', analytics: 'analytics.view',
      costing: 'costing.view', settings: 'settings.view', users: 'users.manage', machines: 'machines.view'
    };
    all('.nav-link[data-view]').forEach((button) => button.addEventListener('click', () => {
      if (window.FactoryFlowAuth.has(pagePermissions[button.dataset.view])) goto(button.dataset.view);
    }));
    const facilitySwitcher = ui('#facilitySwitcher');
    if (facilitySwitcher) facilitySwitcher.addEventListener('change', () => switchActiveFacility(facilitySwitcher.value));
    ui('#mobileMenu').addEventListener('click', () => ui('.sidebar').classList.toggle('open'));
    ui('#modalClose').addEventListener('click', closeModal);
    ui('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });
    ui('#notificationButton').addEventListener('click', () => notify('You are signed in to your FactoryFlow workspace.'));
    ui('#dateButton').addEventListener('click', () => notify('Showing work scheduled for today.'));
    ui('#languageToggle').addEventListener('click', toggleLanguage);
    ui('#globalSearch').addEventListener('input', () => {
      if (app.view === 'quotes' && window.FactoryFlowAuth.has('quotes.view')) ui('#quotesBody').innerHTML = quoteRows();
    });
    ui('#todayDate').textContent = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    ui('#languageToggle').textContent = app.language === 'hi' ? 'EN' : 'हिं';
    await hydrateWorkspace();
    window.FactoryFlowAuth.applyNavigation();
    render();
  } catch (error) {
    const shell = document.createElement('main');
    shell.className = 'auth-overlay';
    shell.innerHTML = '<section class="auth-card"><h1>FactoryFlow could not start</h1><p class="auth-error">' + safe(error.message) + '</p><button class="auth-submit" id="factoryFlowRetry" type="button">Retry</button></section>';
    document.body.appendChild(shell);
    shell.querySelector('#factoryFlowRetry').addEventListener('click', () => window.location.reload());
  }
}
startFactoryFlowApplication();
