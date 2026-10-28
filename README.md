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
- Responsive layout for desktop and mobile screens

## Suggested next steps

1. Add production authentication, role-based views, and a hosted database.
2. Connect WhatsApp sharing to an approved WhatsApp Business workflow.
3. Generate compliant GST PDF quotes, invoices, and delivery challans.
4. Integrate supplier verification, payments, and financing partners.
