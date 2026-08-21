import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src', 'api', 'public'];
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.css', '.md', '.txt']);
const SKIP_PARTS = [
  `${path.sep}_tests${path.sep}`,
  '.test.',
  '.spec.',
  `${path.sep}docs${path.sep}`,
];
const SKIP_FILES = new Set([
  path.normalize('src/lib/stress-test-tasks.ts'),
]);

const FORBIDDEN = [
  { label: 'legacy HazelCare Ops brand', regex: /hazel\s*care\s+ops/gi },
  { label: 'legacy CareOps brand', regex: /\bcareops\b/gi },
  { label: 'legacy Care Ops brand', regex: /\bcare\s+ops\b/gi },
  { label: 'legacy backup filename', regex: /care-ops-backup-/gi },
  { label: 'removed embedded settings PIN', regex: /236693!/g },
  { label: 'false encryption claim', regex: /E2E\s+Field-Locked\s+Encryption/gi },
  { label: 'false client-side security vault', regex: /Security\s+Vault/gi },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function skipped(file) {
  const normalized = path.normalize(file);
  if (SKIP_FILES.has(normalized)) return true;
  return SKIP_PARTS.some((part) => normalized.includes(part));
}

const findings = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (skipped(file) || !TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      for (const rule of FORBIDDEN) {
        rule.regex.lastIndex = 0;
        if (rule.regex.test(lines[index])) {
          findings.push({
            file,
            line: index + 1,
            label: rule.label,
            excerpt: lines[index].trim().slice(0, 180),
          });
        }
      }
    }
  }
}

if (findings.length) {
  console.error('OVSITE runtime identity audit failed.');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} — ${finding.label}`);
    console.error(`  ${finding.excerpt}`);
  }
  process.exit(1);
}

console.log('OVSITE runtime identity audit passed. No forbidden live identity/control strings found.');
