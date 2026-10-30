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
- Production material planning by job, aggregated demand across active jobs, on-hand and incoming purchase-order coverage, and draft purchase orders for shortages
- Responsive layout for desktop and mobile screens

## Suggested next steps

1. Add production authentication, role-based views, and a hosted database.
2. Connect WhatsApp sharing to an approved WhatsApp Business workflow.
3. Generate compliant GST PDF quotes, invoices, and delivery challans.
4. Integrate supplier verification, payments, and financing partners.
