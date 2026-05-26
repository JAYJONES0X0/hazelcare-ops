# CareOps Full Audit Evidence

This folder holds screenshots, JSON reports, smoke-test captures, and one-off probe scripts from the CareOps/Hazelcare full audit and repair pass.

Start with `REPORT.md` for the current positives, negatives, fixes, remaining Vercel/account actions, and next-project queue.

Root cleanup notes:

- Audit evidence was moved here from the project root so the app root contains source/config files only.
- `login-data.json` was not moved because it contained live credentials. It has been removed from the working tree and added to `.gitignore`.
- Rotate any credentials that were ever stored in `login-data.json` before treating the deployment as secure.

Verification commands used after fixes:

- `npm run lint`
- `npm run build`
- `npm run test`
- `npm audit`
