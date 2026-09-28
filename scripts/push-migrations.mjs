/**
 * Push migration SQL files directly to Supabase via Management API.
 * Each file is run as a separate query.
 *
 * SEC-2026-09-28: the Personal Access Token that used to be hardcoded here was
 * removed from git history (it was an ancestor of codex/careops-operational-spine
 * and this repo is public). It is now read from the environment.
 * See SECURITY-supabase-pat-incident.md.
 *
 * Required env:
 *   SUPABASE_ACCESS_TOKEN  - a Supabase Personal Access Token (sbp_...)
 *                            Create at Supabase -> Account -> Personal Access Tokens.
 *                            Grant only the project(s) you actually push to.
 *   SUPABASE_PROJECT_REF   - optional, defaults to the Care Ops project ref below.
 */

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'amtxcsaynkxgaqazytdz';

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    'FAILED: SUPABASE_ACCESS_TOKEN is not set.\n' +
    'Do NOT hardcode the token. Export it for this shell, e.g.\n' +
    '  $env:SUPABASE_ACCESS_TOKEN = "<your sbp_ token>"\n' +
    'or load it from .exa\\keys.env via Import-BrookKeys in brook.ps1.'
  );
  process.exit(1);
}

const SUPABASE_PAT = process.env.SUPABASE_ACCESS_TOKEN;

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '..', 'supabase', 'migrations');

async function run() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ok = 0;
  let skipped = 0;

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`[${file}]`);

    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    const text = await res.text();

    if (!res.ok) {
      if (text.includes('already exists')) {
        console.log(`  ↳ skipped (already exists)`);
        skipped++;
        continue;
      }
      console.error(`  FAILED: ${text.slice(0, 300)}`);
      process.exit(1);
    }

    console.log(`  OK`);
    ok++;
  }

  console.log(`\nDone: ${ok} applied, ${skipped} skipped`);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
