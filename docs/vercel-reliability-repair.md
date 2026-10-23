# CareOps deployment repair — 22 October 2026

This release makes the referenced TypeScript projects part of the build, pins Node 24, updates dependencies, fixes the upload error handler, and replaces the unchecked deployment script with a verified Git-only release path.

Authentication now requires the configured second factor after the password unless the pre-existing explicit emergency bypass is enabled. Pending challenges expire in five minutes and cannot be used as session cookies. Completion is bound to the original identity and role, with durable replay checks. The session format is now v3, so users with older sessions must sign in again. No production password or authenticator secret is rotated by this release.

Production rate limits use atomic Redis counters and fail closed when the backing service is unavailable. The already-consumed production recovery-code and staff-link Redis keys retain their original names. Local in-memory counters are confined to offline development/tests.

Replay-key selection follows `VERCEL_ENV` before `NODE_ENV`, since Vercel Preview builds also run in Node's production mode. Preview recovery codes and staff links stay in the Preview namespace, while consumed Production keys remain valid across the release.

New document uploads use browser-to-Blob multipart transfer with a 25 MiB policy and a separate private-store credential, `EVIDENCE_BLOB_READ_WRITE_TOKEN`. The app saves an authenticated application URL for downloads. If the private credential is absent, uploads fail clearly; there is no fallback to the public store. Existing public document objects and references are not migrated or deleted by this change.

## Configuration for cutover

Connect a private Blob store to the CareOps project using the `EVIDENCE_BLOB` environment-variable prefix. Preserve the existing `BLOB_READ_WRITE_TOKEN` and connection until old objects have been reviewed and migrated. Use a separate private store for Preview when testing actual uploads. These connections need to exist before the new upload flow is considered verified.

Authentication requires `AUTH_PASSWORD`, `AUTH_SESSION_SECRET`, `AUTH_LOGIN_EMAIL`, a configured second factor, and the existing `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Keep Preview secrets separate from Production. The existing Redis credentials are scoped to `codex/careops-operational-spine`; do not broaden that scope simply to run a preview.

The remaining npm advisories are the Mammoth command-line chain (`argparse` / `sprintf-js`). The registry currently offers no patched sprintf-js release. Do not force npm's proposed Mammoth downgrade. The application's browser import path does not use Mammoth's command-line argument parser; review the dependency when an upstream fix becomes available.

## Release checks

Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `npm audit --audit-level=high`. The build must run `tsc -b`, not plain `tsc`. Confirm the exact team, project, commit and READY deployment, then verify the login and upload boundaries in the deployed environment. A Git push alone is not proof that production is live.
