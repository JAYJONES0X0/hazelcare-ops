# Supabase Management API PAT â€” revoked, needs history rewrite

**Status as of 2026-09-28: the credential is already dead. Confirmed 401 from the Supabase Management API.**

## What was found

A Supabase **Personal Access Token** (Management API, project-admin scope) was committed in
`d60eb94` inside `scripts/push-migrations.mjs`:

```
const SUPABASE_PAT = 'sbp_<REDACTED_40_HEX_CHARS>';
const PROJECT_REF = 'amtxcsaynkxgaqazytdz';
```

- **Credential type:** `sbp_` = Supabase Personal Access Token (Management API).
  Full project-admin scope â€” it can read/modify the database, run migrations, and read secrets.
  This is materially more powerful than a service-role key, because it grants *account* access,
  not just project access.
- **Probe result:** `GET https://api.supabase.com/v1/projects/amtxcsaynkxgaqazytdz`
  returned **401**. The token has been revoked/expired. No rotation is urgent.

## Exposure assessment (verified, not assumed)

| Surface | State | How verified |
|---|---|---|
| Remote `origin/codex/careops-operational-spine` | **CLEAN** | `git show origin/...:scripts/push-migrations.mjs` â†’ exit 128, file absent. `d60eb94` is **not** an ancestor of the remote branch. |
| All other remote branches | CLEAN | `git grep` across every `refs/remotes/*` found no `sbp_` match. |
| Local branch `codex/careops-operational-spine` | **CONTAINS IT** | `d60eb94` is an ancestor (merge-base check exit 0). |
| Working tree | Clean | `scripts/` on disk holds only `anonymize-dataset.mjs` + `audit-pii.mjs`; hardcoded-secret scan found nothing. |
| Repo visibility | **PUBLIC** â€” `JAYJONES0X0/hazelcare-ops` | GitHub API `private = false`. |

**So: this was never a public leak.** GitHub Push Protection blocked the branch, which is the
system working as intended. The documented blocker is accurate.

**The real, live risk is local.** The repo is public, the credential is admin-scope, and it sits
in local history. The failure mode is mundane: any agent running `git add -A && git commit` on
that branch, followed by a push attempt. Push Protection would *probably* block it â€” but that is
a safety net, not a control. `.gitignore` does not currently exclude `scripts/`.

**POST-RELEASE VERIFICATION (2026-09-28):** The remote master has since moved to `d69e3a2` -> `44fc152` "release: deploy full OVSITE operational spine and truth ledger". Re-scanned all 24 remote-only commits plus `FETCH_HEAD` remote spine `cd509d1` for the `sbp_` literal and long JWTs: **clean**. The credential was never pushed to any ref on GitHub. History rewrite of the local spine was cosmetic; a full `git filter-repo` on the pushed history is NOT required for confidentiality.\n\n## Required actions

1. **Do not push** `codex/careops-operational-spine` in its current state. Do not force-push it.
2. **Rotate anyway** before reuse â€” a dead token is not a revoked token, and this one may be
   sitting in a Supabase project PAT list somewhere. Confirm it is deleted in
   Supabase â†’ Account â†’ Personal Access Tokens.
3. **Clean history before any release of that branch** (see release plan).
4. **Move credentials out of source** â€” `push-migrations.mjs` must read the PAT from
   `process.env.SUPABASE_ACCESS_TOKEN`, never a literal.

## Safe history rewrite (do this when releasing the branch)

`git filter-repo` is the right tool; it rewrites and expires the reflog, unlike `filter-branch`.

```powershell
# 1. Back up first â€” this rewrites history irreversibly.
cd C:\Users\brook\vision-builder\hazelcare-ops
git branch backup-spine-pre-scrub
git remote add backup git@github.com:JAYJONES0X0/hazelcare-ops-backup.git  # private repo!

# 2. Scrub the literal from every ref.
pip install git-filter-repo
git filter-repo --replace-text <(echo 'sbp_<REDACTED_40_HEX_CHARS>==>***REMOVED***') --force

# 3. Verify the literal is gone everywhere.
git grep -I -n 'sbp_<REDACTED_40_HEX_CHARS>' --all
# must return nothing

# 4. Only then force-push, and only if you intend to rewrite the published branch.
git push origin --force --all
```

**Hard rule (unchanged from doctrine): never bypass GitHub Push Protection.** A block means a real
secret is present. Fix the secret.

## Note on the earlier "hardcoded Supabase token" description

The empire state file described this as a "hardcoded Supabase token." It is more accurately a
**Supabase Personal Access Token with account-level scope** â€” meaning a leak would compromise the
account, not just one project. The distinction matters if this is ever discussed with a third party.


