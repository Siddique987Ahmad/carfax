// Copies every .env.example in the repo to .env next to it, without overwriting existing .env files.
// Usage: pnpm env:init
import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['node_modules', '.git', '.turbo', 'dist', 'build', '.next', '.expo']);

function findExamples(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !skip.has(entry.name)) {
      found.push(...findExamples(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name === '.env.example') {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

for (const example of findExamples(root)) {
  const target = join(dirname(example), '.env');
  const name = relative(root, target) || '.env';
  if (existsSync(target)) {
    console.log(`kept     ${name} (already exists)`);
  } else {
    copyFileSync(example, target);
    console.log(`created  ${name}`);
  }
}
