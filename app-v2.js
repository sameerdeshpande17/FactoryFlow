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

const invoiceRecords = [
  { id: 'INV-392', customer: 'Kaleva Naturals', job: 'JB-831 · Label roll', amount: 72000, due: 'Today', status: 'Due soon', phone: '919845678901' },
  { id: 'INV-389', customer: 'Narmada Foods', job: 'JB-822 · Pouch run', amount: 54000, due: 'Oct 24', status: 'Overdue', phone: '919812345678' },
  { id: 'INV-385', customer: 'Shree Packaging', job: 'JB-812 · Carton run', amount: 126000, due: 'Paid Oct 22', status: 'Paid', phone: '919876543210' }
];

const materials = [
  { sku: 'RM-0142', item: 'Kraft paper · 180 GSM', category: 'Paper', location: 'A-12', onHand: '3,840 kg', stock: 82, status: 'In stock' },
  { sku: 'RM-0251', item: 'BOPP film · 25 micron', category: 'Film', location: 'B-04', onHand: '1,260 kg', stock: 56, status: 'In stock' },
  { sku: 'RM-0089', item: 'Water-based ink · black', category: 'Ink', location: 'C-18', onHand: '32 kg', stock: 24, status: 'Low stock' },
  { sku: 'RM-0324', item: 'Packaging adhesive', category: 'Adhesive', location: 'D-09', onHand: '42 kg', stock: 13, status: 'Critical' },
  { sku: 'RM-0197', item: 'Mono-carton board', category: 'Board', location: 'B-22', onHand: '640 sheets', stock: 68, status: 'In stock' }
];

const app = { view: 'dashboard', filter: 'All', language: localStorage.getItem('ff-language') || 'en' };
const ui = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const stClass = (value) => ({ Sent: 'setup', Viewed: 'on-track', 'Follow up': 'delayed', Accepted: 'running', 'In production': 'running', 'With worker': 'on-track', 'Material pending': 'delayed', 'QC review': 'setup', 'In transit': 'on-track', Confirmed: 'running', 'Part received': 'setup', 'In stock': 'in-stock', 'Low stock': 'low', Critical: 'critical', Paid: 'in-stock', Overdue: 'critical', 'Due soon': 'low' }[value] || 'setup');

const titles = {
  dashboard: ['JOB-WORK OS', 'Overview'], quotes: ['SALES', 'Quotes'], jobs: ['JOB CONTROL', 'Jobs'],
  purchases: ['PURCHASING', 'Purchase orders'], materials: ['RAW MATERIAL', 'Materials'],
  workers: ['PARTNERS', 'Job workers'], invoices: ['FINANCE', 'GST invoices'],
  marketplace: ['B2B NETWORK', 'Marketplace'], settings: ['WORKSPACE', 'Settings']
};

function save() {
  localStorage.setItem('ff-quotes', JSON.stringify(quotes));
  localStorage.setItem('ff-jobs', JSON.stringify(jobs));
  localStorage.setItem('ff-language', app.language);
  ui('#quoteBadge').textContent = quotes.filter((quote) => quote.status === 'Follow up').length || '0';
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

function dashboard() {
  const hello = app.language === 'hi' ? 'नमस्ते, Sameer' : 'Namaste, Sameer';
  return head('WEDNESDAY · OCTOBER 28', hello, app.language === 'hi' ? 'आज आपका काम, पैसा और माल एक जगह पर है।' : 'Your factory’s work, money, and material—at a glance.', '<button class="primary-button" data-new="quote">＋ New quote</button>') +
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
  return '<article class="work-card"><strong>' + job.id + ' · ' + job.item + '</strong><p>' + job.qty.toLocaleString() + ' units · ' + job.customer + '</p><footer><span class="small-avatar">' + job.owner + '</span><span class="due ' + (warning ? 'warn' : '') + '">◷ ' + note + '</span></footer></article>';
}
function jobsPage() {
  const pending = jobs.find((job) => job.status === 'Material pending') || jobs[0];
  const active = jobs.filter((job) => job.status === 'In production' || job.status === 'With worker');
  const qc = jobs.find((job) => job.status === 'QC review') || jobs[0];
  return head('JOB CONTROL', 'Jobs in motion', 'Assign job workers, track progress, and capture proof before delivery.', '<button class="primary-button" data-new="job">＋ Create job</button>') +
  '<section class="kanban"><div class="kanban-column"><div class="kanban-title">READY TO ASSIGN <span class="kanban-count">1</span></div>' + jobCard(pending, 'Material pending', true) + '<article class="work-card"><strong>Assign a verified worker</strong><p>Match capacity, rate, and delivery promise in one place.</p><footer><button class="text-button" data-go="workers">Find workers →</button></footer></article></div><div class="kanban-column"><div class="kanban-title">WITH JOB WORKER <span class="kanban-count">' + active.length + '</span></div>' + active.map((job) => jobCard(job, job.due)).join('') + '</div><div class="kanban-column"><div class="kanban-title">DELIVERY & QC <span class="kanban-count">1</span></div>' + jobCard(qc, 'Proof needed') + '<article class="work-card"><strong>Capture delivery proof</strong><p>Attach a signed challan or delivery photo, then issue the invoice.</p><footer><span class="status setup">Ready</span><button class="text-button" data-action="proof">Add proof →</button></footer></article></div></section>';
}

function purchasesPage() {
  const rows = purchases.map((po) => '<tr><td class="order-code">' + po.id + '</td><td class="item-name">' + po.supplier + '</td><td>' + po.material + '</td><td>' + currency(po.amount) + '</td><td>' + po.delivery + '</td><td>' + status(po.status) + '</td><td><button class="table-button" data-action="po-update">Update</button></td></tr>').join('');
  return head('PURCHASING', 'Purchase orders', 'Keep every raw-material commitment and delivery date visible.', '<button class="primary-button" data-new="purchase">＋ New purchase order</button>') + '<section class="content-card"><div class="toolbar"><strong style="font-size:12px">Open purchase orders</strong><button class="secondary-button" data-go="marketplace">◇ Find suppliers</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>PO</th><th>SUPPLIER</th><th>MATERIAL</th><th>AMOUNT</th><th>DELIVERY</th><th>STATUS</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}

function materialsPage() {
  const low = materials.filter((item) => item.status !== 'In stock').length;
  const rows = materials.map((item) => '<tr><td class="order-code">' + item.sku + '</td><td class="item-name">' + item.item + '</td><td>' + item.category + '</td><td>' + item.location + '</td><td>' + item.onHand + '</td><td><div class="stock-bar ' + (item.status === 'Critical' ? 'critical' : item.status === 'Low stock' ? 'warn' : '') + '"><i style="width:' + item.stock + '%"></i></div></td><td>' + status(item.status) + '</td></tr>').join('');
  return head('RAW MATERIAL', 'Material you can trust', 'See stock health early, before a job worker or customer has to wait.', '<button class="primary-button" data-new="purchase">＋ Purchase material</button>') + '<div class="inventory-grid"><article class="inventory-stat"><span>TRACKED MATERIALS</span><strong>48</strong><small>Across 4 storage zones</small></article><article class="inventory-stat"><span>REORDER ALERTS</span><strong>' + low + '</strong><small>Needs a purchase order today</small></article><article class="inventory-stat"><span>STOCK VALUE</span><strong>₹8.42L</strong><small>↑ 3.8% vs. last month</small></article></div><section class="content-card"><div class="toolbar"><strong style="font-size:12px">Stock by material</strong><button class="secondary-button" data-action="receive">＋ Receive material</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>SKU</th><th>MATERIAL</th><th>CATEGORY</th><th>LOCATION</th><th>ON HAND</th><th>STOCK LEVEL</th><th>STATUS</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}

function workersPage() {
  const people = [['Ravi Cartons', 'Carton conversion · 72% capacity', 'RK', ''], ['Aman Printworks', 'Flexo printing · 44% capacity', 'AP', 'alt'], ['Sanket Lamination', 'Film lamination · Available', 'SL', 'gold'], ['Disha Finishing', 'Spot UV & finishing · 61% capacity', 'DF', '']];
  const list = people.map((person) => '<div class="team-person"><span class="person-avatar ' + person[3] + '">' + person[2] + '</span><span class="person-info"><strong>' + person[0] + ' <span class="verified">✓ verified</span></strong><small>' + person[1] + '</small></span><span class="status on-track">Verified</span></div>').join('');
  return head('PARTNERS', 'Your job-worker network', 'Assignments, rate visibility, and delivery proof without endless follow-ups.', '<button class="primary-button" data-action="invite">＋ Invite worker</button>') + '<section class="team-grid"><div class="panel"><header class="panel-header"><h2>Available job workers</h2><button class="text-button" data-go="marketplace">Discover suppliers →</button></header><div class="team-list">' + list + '</div></div><div class="panel"><header class="panel-header"><h2>Active assignments</h2><span class="status running">3 live</span></header><div class="schedule-list">' + schedule('JB-841', 'Ravi Cartons', '12,000 cartons · due today', 68) + schedule('JB-838', 'Aman Printworks', '8,000 pouches · due tomorrow', 42) + schedule('JB-835', 'Ravi Cartons', 'Waiting for black ink', 15, true) + '</div><div class="panel callout" style="margin:18px -1px -1px"><h2 style="font-size:14px;margin-top:0">Proof makes payment easy</h2><p style="margin-bottom:12px">Capture a delivery photo or signed challan and share it instantly.</p><button class="secondary-button" data-action="proof">Add delivery proof</button></div></div></section>';
}

function invoicesPage() {
  const invoices = invoiceRecords;
  const rows = invoices.map((invoice) => '<tr><td class="order-code">' + invoice.id + '<div class="subtle">GST 18%</div></td><td><div class="item-name">' + invoice.customer + '</div><div class="subtle">' + invoice.job + '</div></td><td>' + currency(invoice.amount) + '</td><td>' + invoice.due + '</td><td>' + status(invoice.status) + '</td><td>' + (invoice.status === 'Paid' ? '<span class="subtle">Received</span>' : '<button class="table-button" data-reminder="' + invoice.id + '">WhatsApp reminder</button>') + '</td></tr>').join('');
  return head('FINANCE', 'GST-ready invoices', 'Create a compliant invoice from delivery proof and nudge payment over WhatsApp.', '<button class="primary-button" data-action="invoice">＋ Create GST invoice</button>') + '<section class="content-card"><div class="toolbar"><div><strong style="font-size:12px">Receivables</strong><span class="subtle" style="margin-left:8px;font-size:11px">₹1.26L pending</span></div><button class="secondary-button" data-action="reminders">◔ Send payment reminders</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>INVOICE</th><th>CUSTOMER / JOB</th><th>AMOUNT</th><th>PAYMENT DUE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
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
  const label = titles[app.view];
  ui('#pageKicker').textContent = label[0];
  ui('#pageTitle').textContent = label[1];
  all('.nav-link[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === app.view));
  const pages = { dashboard, quotes: quotesPage, jobs: jobsPage, purchases: purchasesPage, materials: materialsPage, workers: workersPage, invoices: invoicesPage, marketplace: marketplacePage, settings: settingsPage };
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
  openModal('<h2 id="modalTitle">Create job</h2><p>Turn an accepted quote into a trackable production job.</p><form id="jobForm" class="form-grid"><label>Customer<input required name="customer" placeholder="Customer name"></label><label>Work description<input required name="item" placeholder="e.g. Corrugated carton · 5-ply"></label><div class="form-row"><label>Quantity<input required name="qty" type="number" min="1" placeholder="0"></label><label>Job worker<select name="worker"><option>Ravi Cartons</option><option>Aman Printworks</option><option>Sanket Lamination</option></select></label></div><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Create job</button></div></form>');
  ui('#jobForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    jobs.unshift({ id: 'JB-' + (842 + jobs.length), customer: data.get('customer'), item: data.get('item'), qty: Number(data.get('qty')), worker: data.get('worker'), due: 'To schedule', status: 'With worker', progress: 0, owner: 'RK' });
    save(); closeModal(); goto('jobs'); notify('Job is assigned to ' + data.get('worker') + '.');
  });
}
function newPurchase() {
  openModal('<h2 id="modalTitle">New purchase order</h2><p>Record the raw-material commitment and keep the job promise safe.</p><form id="purchaseForm" class="form-grid"><label>Supplier<input required name="supplier" placeholder="Supplier name"></label><label>Material<input required name="material" placeholder="e.g. Kraft paper · 180 GSM"></label><div class="form-row"><label>Amount (₹)<input required name="amount" type="number" min="1" placeholder="0"></label><label>Expected delivery<input required name="delivery" type="date"></label></div><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Create PO</button></div></form>');
  ui('#purchaseForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const delivery = data.get('delivery') ? new Date(data.get('delivery') + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'To confirm';
    purchases.unshift({ id: 'PO-' + (492 + purchases.length), supplier: data.get('supplier'), material: data.get('material'), amount: Number(data.get('amount')), delivery, status: 'Confirmed' });
    closeModal(); goto('purchases'); notify('Purchase order is ready to send to the supplier.');
  });
}
function safe(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
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
  jobs.unshift({ id: 'JB-' + (842 + jobs.length), customer: quote.customer, item: quote.scope, qty: quote.qty, worker: 'Unassigned', due: 'To schedule', status: 'Material pending', progress: 0, owner: 'SD' });
  save(); goto('jobs'); notify(quote.id + ' was converted to a live job.');
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
  all('[data-reminder]').forEach((button) => button.addEventListener('click', () => openReminder(button.dataset.reminder)));
  all('[data-group]').forEach((button) => button.addEventListener('click', () => notify('You joined the ' + button.dataset.group + ' buying group.')));
  all('[data-action]').forEach((button) => button.addEventListener('click', () => { if (button.dataset.action === 'language') toggleLanguage(); else notify(actionMessage(button.dataset.action)); }));
}

all('.nav-link[data-view]').forEach((button) => button.addEventListener('click', () => goto(button.dataset.view)));
ui('#mobileMenu').addEventListener('click', () => ui('.sidebar').classList.toggle('open'));
ui('#modalClose').addEventListener('click', closeModal);
ui('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });
ui('#notificationButton').addEventListener('click', () => notify('Two material alerts and one customer reply need attention.'));
ui('#dateButton').addEventListener('click', () => notify('Showing work scheduled for today.'));
ui('#languageToggle').addEventListener('click', toggleLanguage);
ui('#globalSearch').addEventListener('input', () => { if (app.view === 'quotes') ui('#quotesBody').innerHTML = quoteRows(); });
ui('#todayDate').textContent = new Date(2026, 9, 28).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
ui('#languageToggle').textContent = app.language === 'hi' ? 'EN' : 'हिं';
save();
render();
