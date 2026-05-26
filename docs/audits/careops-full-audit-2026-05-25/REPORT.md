# CareOps Full Audit Report

Date: 2026-05-25

## Scope

- Hazelcare/CareOps local codebase and production-readiness signals from the Vercel screenshot.
- Local lint, build, test, circular dependency, and npm security checks.
- Workspace-level Vision Builder dependency audit.
- Initial inventory of other project workspaces to queue next.

## Positives

- Production deployment is live and Vercel reports the deployment as ready.
- The app has meaningful automated coverage: 29 test files and 72 tests.
- Import stress tests are exercising real care-planner style CSV, ZIP, PDF, DOCX, and XLSX data.
- The app already has strong operational modules: briefing, note workspace, staff monitoring, imports, reports, risk/PBS, templates, settings, and admin backup flows.
- Hazelcare app dependency audit is clean: 0 vulnerabilities.
- Shared Vision Builder browser tooling audit is clean: 0 vulnerabilities after local lock metadata cleanup.
- Circular dependency check reports no circular dependencies.

## Negatives Found And Fixed

- Lint warnings across app and training hub code were fixed. Current `npm run lint` exits clean.
- Vite build crashed through the symlinked workspace path. `vite.config.ts` now pins the real root and preserves symlinks so production build works from this workspace.
- Root app folder was cluttered with screenshots, probes, JSON reports, smoke scripts, and temp bundles. Audit evidence was moved under this folder.
- `login-data.json` contained live credentials. It was removed from the working tree and added to `.gitignore`.
- Test runs emitted repeated Node 25 `localStorage` warnings. Storage access now uses a browser/test-safe adapter with Node memory fallback.
- PDF import tests emitted PDF.js Node environment and missing font-data warnings. The universal extractor now uses the legacy PDF.js build in this path and provides standard font data for Node tests.
- Shared Vision Builder root audit reported stale vulnerable lock metadata for `basic-ftp`, `ip-address`, and `ws`. Installed versions were already patched, and duplicate stale lock entries were removed locally.
- Audit/probe artifacts that belonged together were collected under `docs/audits/careops-full-audit-2026-05-25/`.

## Remaining Negatives / Need Fixing

- Rotate any credential that was ever stored in `login-data.json`. Removing the file does not invalidate an already exposed secret.
- Vercel dashboard still needs account-side cleanup from the screenshot:
  - Production checklist showed 3/5.
  - Web Analytics was not enabled.
  - Deployment Settings showed 4 recommendations.
  - Environment Variables showed 7 entries to review.
- Latest local fixes have not been deployed in this pass.
- Madge still prints 3 benign skipped-file warnings for Vite-only imports: PDF worker URL imports and `tailwindcss`. It still reports no circular dependency.
- The wider `vision-builder` workspace is very dirty with many generated/untracked client sites and deleted old site folders. Any commit should be tightly scoped.

## Verification

- `npm run lint`: pass
- `npm run build`: pass
- `npm run test`: pass, 29 files / 72 tests
- `npm audit --json` in `hazelcare-ops`: 0 vulnerabilities
- `npm audit --json` in Vision Builder root: 0 vulnerabilities
- `npx madge --circular --extensions ts,tsx ./src`: no circular dependency found

## Other Project Queue

Inventory found 55 package-based projects across `vision-builder` and `EXA-TECH`.

Recommended order after Hazelcare:

1. `hazelcare-training-hub` - closest sibling to the fixed app; run lint/build and align any deployment config.
2. `exa-live-ops` - already modified in the root workspace and has hub/server build scripts.
3. `royal-hemp-store`, `hemp-partnership-pitch`, `savor-sin`, `safeguard-roofing`, `site` - active Vite-style apps with lint/build scripts.
4. `care-ops-saas`, `arbiflow-saas`, `arbiflow-agency` - present but need stack/package validation before audit.
5. EXA core apps: `live-ops-ui`, `worldmonitor`, `moltbot-sandbox`, `AEGIS-os` - larger blast radius, should be handled one at a time.
6. Generated client sites such as `camborne-roofing`, `penzance-roofing`, `redruth-roofing`, `tidy-fencing`, `waterfront-window-cleaning`, and others - mostly build/preview checks plus visual QA.

