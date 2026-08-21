# OVSITE

Operational oversight for UK care providers.

OVSITE is a browser-first operational intelligence layer for adult social care providers. It ingests care exports, rosters, PDFs, DOCX files and ZIP packs, then turns them into manager-ready evidence: dashboards, briefings, staff monitoring, task packs, reports, document builders and audit support.

## Positioning

OVSITE is not a replacement care-record system. It sits above systems such as Nourish and CarePlanner to help managers see what needs attention now, improve documentation quality, reconstruct evidence and prepare for operational or regulatory scrutiny.

## Canonical product identity

- Product: `OVSITE`
- Package: `ovsite-os`
- Production application: `https://app.ovsite.co.uk`
- Public site: `https://ovsite.co.uk`

Historical CareOps/Hazelcare Ops names may remain inside dated audit artefacts or explicit compatibility/migration code. They are not current product identity.

## Architecture

- React, TypeScript and Vite.
- Vercel-hosted SPA with serverless authentication endpoints.
- Local-first care-data processing in the browser.
- IndexedDB for larger diary-entry history.
- LocalStorage for settings, actions, compliance state, staff notes and small operational records.
- No automatic upload of care records to a third-party database in the core workflow.

## Core workflows

- Import Hub: ingest CSV, TXT, PDF, DOCX, XLS/XLSX/XLSM and ZIP packs.
- Dashboard and Briefing: operational overview after import.
- Care Logs: per-client diary review.
- Staff Monitoring: documentation, handover and coverage intelligence.
- Client Records and Task Packs: care/risk/PBS-oriented evidence builders.
- Reports and Templates: printable/exportable audit artefacts.
- Settings/Admin: local backup, restore, governance and session tools.

## Development

```bash
npm install
npm run dev
```

## Verification

Run the actual verification suite before deployment or handover. Do not treat historical pass counts as current evidence.

```bash
npm run lint
npm run test
npm run build
npm audit
```

The CI verification gate runs repository-contained deterministic tests and excludes the workstation-only import stress report whose source corpus is not committed to GitHub. Run that stress corpus separately when the private test inputs are available.

Record the exact commit SHA and verification result for any production release.

## Deployment

Production is deployed through Vercel. The application project currently serves `app.ovsite.co.uk`.

```bash
npx vercel --prod
```

Authentication configuration currently includes:

- `AUTH_LOGIN_EMAIL`
- `AUTH_PASSWORD` as the bootstrap credential
- `AUTH_SESSION_SECRET`
- optional role mapping via `AUTH_LOGIN_EMAIL_ROLES`
- Upstash Redis variables where durable credential/replay state is enabled

Environment variables are deployment-scoped. A changed production variable does not retroactively mutate an already-created deployment; redeploy after infrastructure-level changes.

## Credential and session behaviour

- The first successful in-app password rotation replaces the bootstrap password with a salted scrypt credential stored in the configured durable store.
- After a durable credential exists, the old `AUTH_PASSWORD` bootstrap value no longer authenticates users.
- Password rotation signs out the browser that performed the change and requires a fresh login.
- Other previously issued application sessions are not yet globally revoked by password rotation; they remain bounded by the normal session lifetime (currently up to 24 hours). Global session revocation is therefore a remaining auth-hardening item, not a claimed current capability.
- The Settings page does not use a client-side PIN as an authentication boundary. Access is governed by the authenticated application session and role rules.

## Security and pilot boundary

Current state is for controlled founding-pilot use, not unrestricted public SaaS launch. Before full launch, complete and evidence:

- global session revocation / credential-epoch enforcement across privileged server routes;
- formal RBAC enforcement review across privileged surfaces;
- pilot onboarding SOP and support runbook;
- legal review of DPA/DPIA wording;
- data backup/export operating procedure for local-first records;
- production identity and legacy-key migration verification;
- lint/security debt review.

## Provenance rule

Do not mechanically rewrite dated audit folders or historical evidence to make them look current. Historical names are evidence of what existed at that point in time. Current runtime, documentation, deployment metadata and user-facing controls must use OVSITE unless a legacy identifier is required solely for compatibility.
