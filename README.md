# OVSITE

Operational State Intelligence for UK care providers.

OVSITE is a browser-first control layer that sits above care-record, rostering, medication, document and operational systems. It turns fragmented records and system state into manager-ready evidence, action queues and a continuously testable model of operational reality.

## Positioning

OVSITE is not a replacement care-record system.

Most care software answers: **what was recorded?**

OVSITE is being built to answer:

- What does the organisation believe is happening?
- What does each source system say is happening?
- What can actually be evidenced?
- Where do those states disagree?
- What action and evidence are required before the desired state can be treated as verified?

That makes compliance one consumer of the model rather than the whole product.

## Operational State Intelligence

The operational-state engine models important capabilities through seven controls:

1. Available
2. Enabled
3. Permissioned
4. Workflow defined
5. Trained
6. Adopted
7. Evidence verified

A feature being present or enabled is therefore **not** treated as proof that it is operating in reality.

Every control also carries an epistemic state:

- `OBSERVED`
- `INFERRED`
- `MODELED`
- `UNKNOWN`
- `DISPUTED`

OVSITE computes the delta between desired state and observed state, creates a next-action path, and can promote repeated service-level gaps into cross-service patterns without incorrectly treating one local issue as an organisation-wide failure.

## Evidence Contracts

Operational claims can be bound to explicit evidence chains.

Examples:

```text
1:1 SUPPORT
PLAN -> SCHEDULE -> CONTEXT -> DELIVER -> OUTCOME -> ASSURE -> PROVENANCE
```

```text
MEDICATION
ORDER -> STOCK -> SCHEDULE -> ADMINISTRATION -> OUTCOME -> EXCEPTION -> REVIEW -> AUDIT
```

The design rule is simple: **a claim is not demonstrated merely because a related record exists.** The required evidence chain must be satisfied.

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
- Operational State Intelligence: desired-state comparison, evidence contracts, provenance-aware verification and cross-service pattern detection.

## Development

```bash
npm install
npm run dev
```

## Verification

Run these before merge or deployment:

```bash
npm run lint
npm run test
npm run build
npm audit
```

Do not infer deployment readiness from a successful code change alone. Record the exact commit SHA and verification outputs before merge.

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
- Operational State Intelligence UI and persistence layer connected to real provider capability manifests rather than demo-only fixtures.
