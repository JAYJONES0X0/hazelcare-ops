# Hazelcare Ops / CareOps

Browser-first operational intelligence for supported living teams. CareOps ingests care exports, rosters, PDFs, DOCX files, and ZIP packs, then turns them into manager-ready evidence: dashboards, briefing views, staff monitoring, task packs, reports, document builders, and audit support.

## Positioning

CareOps is not a replacement care-record system. It is the operational intelligence layer above systems such as Nourish and CarePlanner. It helps managers see what needs attention now, improve documentation quality, and produce evidence before audit pressure hits.

## Architecture

- React, TypeScript, Vite.
- Vercel-hosted SPA with serverless auth endpoints.
- Local-first care data processing in the browser.
- IndexedDB for larger diary-entry history.
- LocalStorage for settings, actions, compliance state, staff notes, and small operational records.
- No automatic upload of care records to a third-party database in the core workflow.

## Core Workflows

- Import Hub: ingest CSV, TXT, PDF, DOCX, XLS/XLSX/XLSM, and ZIP packs.
- Dashboard and Briefing: operational overview after import.
- Care Logs: per-client diary review.
- Staff Monitoring: documentation, handover, and coverage intelligence.
- Client Records and Task Packs: care/risk/PBS-oriented evidence builders.
- Reports and Templates: printable/exportable audit artefacts.
- Settings/Admin: local backup, restore, governance, and session tools.

## Development

```bash
npm install
npm run dev
```

## Verification

Run these before deploying or handing to another agent:

```bash
npm run lint
npm run test
npm run build
npm audit
```

Expected state after the current hardening pass:

- Build: passes.
- Tests: 29 files / 72 tests pass.
- Security audit: 0 vulnerabilities.
- Lint: 0 errors; warnings remain as technical-debt backlog.

## Deployment

Production is deployed through Vercel.

```bash
npx vercel --prod
```

Required environment variables include:

- `AUTH_LOGIN_EMAIL`
- `AUTH_PASSWORD`
- `AUTH_SESSION_SECRET`
- optional role mapping via `AUTH_LOGIN_EMAIL_ROLES`

## Pilot Boundary

Current state is suitable for controlled founding-pilot use, not unrestricted public SaaS launch. Before full launch, complete:

- Formal RBAC enforcement review across all privileged surfaces.
- Pilot onboarding SOP and support runbook.
- Legal review of DPA/DPIA wording.
- Data backup/export operating procedure for local-first records.
- Lint warning debt reduction, especially `any`, effect-state, and hook dependency warnings.
