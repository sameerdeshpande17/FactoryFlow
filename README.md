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
- Verified supplier discovery, group buying, payment protection, and working-capital entry points
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
- Production output captures actual hours worked and can link to a scheduled session; legacy records without actual hours are excluded from throughput rates and flagged in analytics
- Role-based access for administrators, managers, production supervisors, and workers, with server-enforced permissions and worker-scoped workspace data
- Multiple factory facilities under one organization, with facility-specific jobs, inventory, workers, schedules, production/QC records, downtime and delivery proofs
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
