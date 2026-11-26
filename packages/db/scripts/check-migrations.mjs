// Fails if the schema changed but nobody generated and committed the migration (db:check).
// Runs drizzle-kit generate against a scratch copy of migrations/, so nothing in the repo changes.
// Usage: pnpm db:check (CI runs it on every pull request)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const bin = join(pkg, 'node_modules', '.bin', 'drizzle-kit');
const scratch = '.migration-check'; // relative: drizzle-kit mangles absolute --out paths

function run(args) {
  const result = spawnSync(bin, args, { cwd: pkg, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`drizzle-kit ${args[0]} failed:\n${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}

function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

// 1. The committed migrations are consistent (no clashing or broken snapshots).
run(['check']);

// 2. Generating from the current schema adds nothing new.
rmSync(join(pkg, scratch), { recursive: true, force: true });
cpSync(join(pkg, 'migrations'), join(pkg, scratch), { recursive: true });
let added;
try {
  run([
    'generate',
    '--dialect=postgresql',
    '--schema=./src/schema/index.ts',
    `--out=./${scratch}`,
    '--casing=snake_case',
  ]);
  const before = new Set(listFiles(join(pkg, 'migrations')));
  added = listFiles(join(pkg, scratch)).filter((file) => !before.has(file));
} finally {
  // Always clean up, also when generate fails.
  if (existsSync(join(pkg, scratch))) rmSync(join(pkg, scratch), { recursive: true });
}

if (added.length > 0) {
  console.error('The schema changed but its migration is missing. Run `pnpm db:generate`,');
  console.error('review the new SQL file and commit it. Missing files:');
  for (const file of added) console.error(`  migrations/${file}`);
  process.exit(1);
}
console.log('ok  migrations match the schema');
