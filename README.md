# OVSITE

Operational oversight for UK care providers.

OVSITE is a browser-first operational intelligence layer for adult social care providers. It ingests care exports, rosters, PDFs, DOCX files and ZIP packs and turns them into manager-ready operational evidence.

## Canonical product identity

- Product: `OVSITE`
- Package: `ovsite-os`
- Production application: `https://app.ovsite.co.uk`
- Public site: `https://ovsite.co.uk`

Historical CareOps/Hazelcare Ops names may remain only in dated audit artefacts or explicit compatibility/migration code. They are not current product identity.

## Architecture

- React, TypeScript and Vite
- Vercel-hosted SPA and serverless authentication endpoints
- Local-first care-data processing
- IndexedDB for larger diary history
- LocalStorage for smaller operational state

## Verification

Before merge or deployment run:

```bash
npm run lint
npm run test
npm run build
npm audit
```

This recovery patch deliberately does not add or modify GitHub Actions workflows. Verification should be recorded against the exact commit SHA.

## Authentication

Configuration includes:

- `AUTH_LOGIN_EMAIL`
- `AUTH_PASSWORD` as the bootstrap credential
- `AUTH_SESSION_SECRET`
- optional `AUTH_LOGIN_EMAIL_ROLES`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN` for durable password rotation

The first successful in-app password change replaces the bootstrap password with a salted scrypt credential in the durable store. If durable storage is not configured, the change-password endpoint fails explicitly instead of pretending to update the credential.

Password rotation clears the browser session that performs the change. Application-session revalidation also checks the credential rotation state. This is not a claim that every privileged server route globally revokes every previously issued session; broader server-route enforcement remains a separate authentication review item.

## Provenance

Do not mechanically rewrite historical evidence. Preserve dated audit provenance. Current runtime, active documentation, export filenames and user-facing controls should use OVSITE except where a legacy identifier is retained solely for migration compatibility.
