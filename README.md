# FactoryFlow

FactoryFlow is a WhatsApp-first, bilingual job-work OS for small manufacturers. The first MVP is configured for a packaging cluster and can be adapted for garment, furniture, or machine-part makers.

## Run locally

FactoryFlow now includes a dependency-free local workspace service. With Node.js 18 or later installed, run:

    npm start

Then open http://localhost:4173. The service stores operational data in data/factoryflow.json, which is intentionally ignored by Git. A fresh workspace begins from data/seed.json.

Opening index.html directly is still supported as a browser-only fallback, but changes then remain in that browser rather than the workspace data store.

## What is included

- Quote workflow with WhatsApp sharing and quote-to-job conversion
- Purchase orders and raw-material stock signals
- Job-worker discovery, assignment, and delivery-proof workflow
- GST invoice and WhatsApp payment-reminder workspace
- Facility-scoped supplier directory with internal evidence review, profile completeness and transparent trust indicators derived from closed purchase-order history
- English/Hindi language switch and responsive layout
- Local API-backed persistence for quotes, jobs, purchases, and materials
- Delivery-proof records with recipient, challan/reference, notes, and an optional 1 MB photo or PDF
- Quote CSV export that respects the selected quote status filter
- Purchase-order status and expected-delivery updates
- Material receipt log linked to purchase orders, persisted with the workspace
- Automatic stock-on-hand reconciliation when a material receipt is saved, including unit validation and low-stock status updates
- Job-linked raw-material consumption with insufficient-stock guards, unit validation, and an auditable stock movement history
- Job profitability view with selling value, historical material consumption cost, job-worker charges, other direct costs, gross profit, and margin
- Material unit-cost setup with cost snapshots on future consumption records; incomplete historic costs remain visibly flagged
- Production material planning by job, aggregating demand across active jobs and deducting material already consumed by each job before comparing remaining needs with on-hand stock and committed purchase orders
- Draft shortage purchase orders, supplier and amount assignment, incoming-order coverage after confirmation, and partial receipt tracking
- Production scheduling by job and worker, daily capacity checks, worker availability dates, scheduled production queue, and deadline-risk alerts
- Production output logs with worker, shift, planned date, produced/good/rejected quantities, and job progress reconciliation
- QC inspections, defect dispositions, rework and reinspection tracking, and a controlled release-for-delivery gate
- Production analytics with date-filtered output trends, yield, QC pass/fail rates, worker productivity, planned-versus-actual hours for linked sessions, delivery timeliness, and job performance
- Machine/workstation downtime logging by time, machine, reason, reporter, and optional job reference, with machine and reason summaries
- Machine-level OEE analytics with availability, performance against configurable ideal throughput, good-unit quality, scheduled-day capacity utilization, merged downtime, and explainable bottleneck signals
- Machine preventive-maintenance plans with operating-hour and calendar intervals, due-soon/overdue reminders, audited service history and rules-based breakdown-risk indicators
- Maintenance work orders with machine linkage, assignment, priorities, due dates, controlled status transitions, completion service-history updates, labour estimates and repair-cost snapshots
- Maintenance spare-part designation, work-order-linked stock issue, automatic inventory deduction, unit-cost snapshots and auditable stock movements
- Production output captures actual hours worked and can link to a scheduled session; legacy records without actual hours are excluded from throughput rates and flagged in analytics
- Role-based access for administrators, managers, production supervisors, and workers, with server-enforced permissions and worker-scoped workspace data
- Multiple factory facilities under one organization, with facility-specific jobs, inventory, workers, schedules, production/QC records, downtime and delivery proofs
- Inventory demand forecasting from weighted recent and lookback consumption, supplier lead times, safety stock, review periods, open purchase commitments, coverage estimates and stockout risk
- Explainable production schedule optimization that ranks active jobs by deadline and priority, allocates estimated remaining work against worker skills, availability and daily capacity, and previews deadline/capacity gaps before an explicit apply action
- Per-material supplier lead-time, safety-stock, review-period, minimum-order, pack-multiple and preferred-supplier settings
- Idempotent forecast-generated draft purchase orders with duplicate-draft protection, supplier suggestions, cost estimates and an auditable forecast snapshot; drafts require manual review and confirmation
- Facility assignment per user, secure facility switching, administrator facility management, and consolidated cross-facility operational summaries
- Salted scrypt password hashes, HttpOnly SameSite session cookies, CSRF checks, first-admin setup, forced password change for provisioned accounts, login throttling, and audit history
- Responsive layout for desktop and mobile screens

## Authentication setup

On a fresh workspace, open the application and create the first administrator account. Administrators can then create Manager, Production supervisor, and Worker accounts from User management. Newly created accounts must change their temporary password before accessing workspace data. Worker accounts must be linked to an active job-worker profile and can record output only against their own scheduled sessions.

| Role | Intended access |
|---|---|
| Administrator | Full workspace, account management, audit history |
| Manager | Sales, purchasing, inventory, production, finance, analytics and workspace management; cannot manage user accounts |
| Production supervisor | Jobs, material/schedule views, production output, QC, rework and downtime; no sales, purchasing, finance or account administration |
| Worker | Own assigned jobs and schedules, and production output recording only |

Authentication is enforced by the local Node.js workspace server. Passwords use salted scrypt hashes; session cookies are HttpOnly and SameSite, and state-changing API requests require a CSRF token. The server enforces role permissions and returns role-scoped bootstrap data; browser navigation hiding is only a usability layer.

Do not expose this development server directly to the public internet; use HTTPS, a reverse proxy with appropriate security headers, backups, and a managed deployment before production use. Browser-only `file://` mode is not supported for authenticated workspaces.

Sessions are held in server memory and have a fixed eight-hour lifetime from sign-in; restarting the Node.js server invalidates active sessions and requires users to sign in again. User accounts and audit events are persisted in the workspace JSON store. Bootstrap responses never include password hashes or the raw user/audit collections. This local JSON store and in-memory session store are suitable for a single-process development workspace, not concurrent multi-instance production hosting. This milestone does not add MFA, email verification, password-reset email, a hosted database, or production-grade identity provider integration.

## Suggested next steps

1. Add production authentication, role-based views, and a hosted database.
2. Connect WhatsApp sharing to an approved WhatsApp Business workflow.
3. Generate compliant GST PDF quotes, invoices, and delivery challans.
4. Integrate supplier verification, payments, and financing partners.


## Machine OEE and performance data

Machine OEE is calculated as **Availability × Performance × Quality** for the selected reporting period.

- **Availability** = scheduled machine-hours remaining after recorded downtime ÷ scheduled machine-hours.
- **Performance** = recorded produced units ÷ (configured ideal units per hour × run hours).
- **Quality** = good units ÷ produced units, using the production output records linked to each machine.
- **OEE** = availability × performance × quality. Machines without an ideal throughput rate or complete component data show OEE as unavailable instead of receiving an assumed score.
- **Capacity utilization** is a separate measure: scheduled hours divided by daily machine capacity on dates with scheduled work. It is not treated as a 24/7 calendar.

Set each machine’s **Ideal output rate (units/hour)** in Machines & equipment to enable its performance and OEE calculation. Use a representative sustainable rate for that machine and operation. If actual output exceeds the configured ideal rate, raw performance is shown for review while the OEE product caps the performance factor at 100%.

Downtime intervals are merged to avoid counting overlapping records twice and are capped at the machine’s scheduled hours for that date. Since schedule records store a date and total hours rather than exact shift start/end times, this is a daily estimate rather than shift-time overlap. Sessions recorded inside planned maintenance windows are excluded from planned OEE time and surfaced as a scheduling conflict.

The bottleneck watchlist currently uses review thresholds of at least 85% scheduled capacity utilization, below 80% availability, below 85% performance, or below 98% good-unit yield. These are product review thresholds, not universal manufacturing standards. QC inspections remain job-level unless explicitly linked to a machine; machine quality uses recorded production good/produced quantities rather than attributing job-level QC inspections to individual equipment.


## Predictive maintenance and equipment health

Configure preventive service on **Machines & equipment** using an operating-hour interval, a calendar-day interval, or both. Reminder lead times are configurable independently. Zero disables an interval. The health page shows overdue and due-soon service, usage since the most recent service record, recent downtime trends, service history and a transparent 0–100 review score.

Service usage is estimated from machine-linked scheduled hours. When production actual hours exist for a session, those actual hours are used; otherwise the scheduled hours are a proxy. Recording a completed service establishes a new counter baseline from its service date. When no service has ever been logged, the machine registration date is used as the initial baseline.

The breakdown-risk score is a deterministic heuristic, not a failure probability or trained prediction model. It combines overdue/due-soon preventive service, downtime-event frequency, recorded downtime hours, and repeated breakdown/repair reason labels during the 90-day lookback. It does not use IoT sensors, vibration readings, temperature, or live machine telemetry. Use it to prioritize human inspection, not as a substitute for a maintenance engineer’s assessment.

Service logs are facility-scoped, permission-checked and audited. Administrators and managers can configure intervals and record service; production supervisors can view service status and health indicators.


## Maintenance work orders and spare parts

Create a work order against a registered machine for a breakdown repair, preventive task, inspection, calibration, lubrication or parts replacement. Work orders support technician assignment, priority, target completion date, labour-hour and hourly-rate estimates, resolution notes and controlled status transitions. A completed repair automatically adds a machine service-history record, resetting the preventive-maintenance baseline.

In Materials, administrators and managers can mark stocked inventory items as **maintenance spare parts**. Production supervisors can issue those items against open work orders. An issue checks available quantity and unit, deducts inventory, stores the quantity and current unit-cost snapshot on the work order, and records an inventory movement linked to the work-order ID. Work orders show labour cost and issued-part cost separately so repair cost is traceable.

Completed or cancelled work orders are locked against further edits and spare-part issues. Work orders, spare-part movements and service records are facility-scoped and audited. Workers do not receive work-order or maintenance service-history data.


## Maintenance calendar and technician capacity

Create facility-specific technician profiles with a specialty, daily hour capacity, hourly rate, working weekdays and unavailable dates. Schedule an open maintenance work order into a technician time slot. The server validates the technician is active and works that weekday, checks recorded time off, rejects overlapping bookings and prevents booked hours from exceeding the technician's daily capacity.

The Maintenance calendar shows a seven-day schedule, assigned technician and machine, unscheduled work orders, technician roster and per-day booked versus remaining hours. Work orders retain their explicit date and start/end times. Technician labour rates are copied onto scheduled work orders as cost snapshots; changing a technician's rate later does not retroactively change the recorded work-order rate.

Technician profiles, schedules and work orders are facility-scoped, permission-checked and audited. Administrators, managers and production supervisors can view and manage the roster and schedule; workers do not receive maintenance technician or work-order data. This is a planning calendar, not a live dispatch/attendance or payroll system.


## GST documents and printable PDF output

Each facility can store its legal business name, GSTIN, PAN, registered address, state code and optional contact/bank details. The document register issues quotations, tax invoices and delivery challans with separate sequential numbers for each facility and Indian financial year (April–March).

Line items capture description, HSN/SAC, quantity, unit, unit price, discount and a supported GST rate (0%, 5%, 12%, 18% or 28%). The server validates the document and calculates taxable value, CGST + SGST for intra-state supplies, or IGST for inter-state supplies, then applies invoice rounding. The first two digits of the seller GSTIN must match its state code; when a customer GSTIN is supplied, its state code must match place of supply.

Delivery challans display a declared goods value for movement/dispatch reference and explicitly show that they are not tax invoices; no GST is calculated as payable on a challan. The document view opens a print-ready A4 layout. Use the browser's **Print → Save as PDF** to create a PDF.

**Important limitations:** this is a document drafting and tax-calculation workflow, not a legal opinion or a connection to the GST Network. GSTIN validation checks format and PAN/state consistency; it does not verify a registration with the GST portal. HSN/SAC classification, applicable rates, exemption, reverse charge, place of supply, invoice particulars, e-invoice/IRN/QR requirements, e-way bills and statutory retention must be checked for each transaction. Government IRP submission, digital signatures and automatic e-invoicing are not included in this milestone.


## WhatsApp Business Cloud API integration

FactoryFlow connects to Meta's official WhatsApp Business Platform Cloud API. The server reads these environment variables; do not store tokens or App Secrets in the browser, repository or workspace JSON:

```text
WHATSAPP_GRAPH_API_VERSION=v26.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_server_access_token
WHATSAPP_APP_SECRET=your_meta_app_secret
WHATSAPP_VERIFY_TOKEN=your_random_webhook_verify_token
```

Configure a Meta Business app with WhatsApp enabled, connect the business phone number, generate a server-side access token with the required WhatsApp messaging permission, and set the callback URL to `https://YOUR_DOMAIN/api/whatsapp/webhook`. Use the same verify token in Meta and the server, then subscribe the app to the relevant WhatsApp webhook fields. The webhook GET handshake checks the verify token and returns Meta's challenge; POST deliveries are checked against `X-Hub-Signature-256` using the App Secret.

The WhatsApp Business page supports facility-specific customer contacts, recorded opt-in/opt-out, approved template sends and the outbound delivery history. GST quotations, tax invoices and delivery challans have a WhatsApp action. Only template messages are sent; template names and language codes must match templates approved in WhatsApp Manager. Configure the suggested names (`factoryflow_quote_ready`, `factoryflow_invoice_issued`, `factoryflow_delivery_update`, `factoryflow_order_update`) in Meta before use.

A recorded opt-in and its source are required before each send. Contact and message records are created and updated through dedicated server APIs, not the generic workspace-sync endpoint. They are facility-scoped, audited and hidden from supervisor/worker bootstrap data. Provider acceptance is recorded separately from sent/delivered/read/failed webhook status.

**Before enabling production sends:** collect and retain customer permission according to applicable laws and Meta policy, provide a clear opt-out mechanism, obtain approval for utility/marketing templates, configure a public HTTPS webhook and set up a durable access token. The app stores consent source/date as evidence supplied by your team; it cannot independently prove the customer consented. Actual sends require valid Meta credentials, an active business phone number and approved templates. No live messages are sent in automated tests.


## Supplier verification and internal trust indicator

Administrators and managers can maintain a supplier register for each active facility. Profiles may include contact details, GSTIN, PAN, address, supplied product categories and internal notes. The server validates the format of supplied tax identifiers and checks that a separately entered PAN matches the PAN embedded in a GSTIN; these checks do not query or certify a government registration.

A supplier starts as **Unverified**. An administrator or manager can record a review status. Setting a supplier to **Verified internally** requires a verification method and a traceable evidence reference. The record stores who performed the review and when; it does not represent government accreditation, third-party certification or a guarantee of supplier quality. Review history is retained when the status changes.

The optional 0–100 FactoryFlow supplier indicator is deliberately transparent:
- 40 points for an internally verified supplier (15 while review is pending, otherwise 0).
- Up to 25 profile-completeness points: valid GSTIN (10), address (5), contact method (5), and product categories (5).
- Up to 35 fulfilment points based on received purchase orders divided by closed purchase orders (received plus cancelled). Open purchase orders are excluded.

No numeric indicator is shown until at least one closed purchase order exists for that supplier in the selected facility. Orders are matched by the supplier name recorded on the purchase order, so name consistency matters. The indicator is a facility's internal due-diligence aid, not an independent rating, credit score or prediction. It does not use fabricated reviews or imply that a supplier has been externally vetted.

Supplier profiles and verification evidence references are API-managed, facility-scoped and audited. They are not accepted from generic browser workspace sync, and workers/supervisors do not receive the supplier register. Evidence references are identifiers or notes supplied by the reviewer; uploading or validating original certificates is outside this milestone.

**Payment protection is not active in this release.** FactoryFlow does not hold, escrow, release or transfer customer or supplier funds. A regulated payment/escrow provider and a separate integration are required before protected payments can be offered.
