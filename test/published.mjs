// Does the copy people actually open match the one that gets worked on?
//
// matchbox.html is developed at the root. GitHub Pages serves /docs from main, so a
// second copy lives at docs/matchbox.html and that is the one with a URL — the one
// loaded on a phone, and therefore the only one anybody's notes are ever about.
//
// Two copies of a file with nothing comparing them are two files. This asserts they
// are byte-identical, so "I tried it and X happened" can never be a report about a
// build that no longer exists.
//
// Both copies are on this branch now, so this reads the working tree rather than
// fetching another branch: drift is caught before the commit instead of after a push.
//
// Run:  node test/published.mjs

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The page, and the two companions that only matter once it is on a Home Screen: iOS
// will not take an icon from an SVG or a data: URI, so the icon has to be a real file
// sitting next to the page. All three have to travel together — a page published
// without its icon gets a fallback tile with a letter on it, which is what started
// this.
const FILES = ['matchbox.html', 'matchbox-icon-180.png', 'matchbox.webmanifest'];

let passed = 0, failed = 0;

for (const name of FILES) {
  let local, published;
  try {
    local = readFileSync(resolve(ROOT, name));
  } catch {
    failed++;
    console.log(`FAIL  ${name} is missing from the root`);
    continue;
  }
  try {
    published = readFileSync(resolve(ROOT, 'docs', name));
  } catch {
    failed++;
    console.log(`FAIL  ${name} is not published at all`);
    console.log(`        · docs/${name} could not be read`);
    continue;
  }
  if (Buffer.compare(local, published) === 0) {
    passed++;
    console.log(` ok   docs/${name} matches the root copy`);
  } else {
    failed++;
    console.log(`FAIL  docs/${name} has drifted from the one being worked on`);
    console.log(`        · root ${local.length} bytes, published ${published.length} bytes`);
  }
}

// Matching in the working tree is the assertion. But "published" means what Pages is
// actually serving, and Pages serves what was pushed — so an uncommitted docs/ copy is
// two agreeing files and a stale URL. Say so rather than reporting a clean pass.
try {
  const dirty = execFileSync(
    'git', ['status', '--porcelain', '--', ...FILES, ...FILES.map(f => `docs/${f}`)],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  if (dirty && !failed) {
    console.log(`\n      · the copies agree but are not committed, so the URL still serves the old build:`);
    dirty.split('\n').forEach(l => console.log(`          ${l}`));
  }
} catch { /* no git, or not a repo — the byte comparison above still stands */ }

if (failed) {
  console.log(`\n      The URL people open serves the published copies:`);
  console.log(`        https://manopalynx.github.io/Manopalynx-/matchbox.html`);
  console.log(`      To republish:`);
  FILES.forEach(f => console.log(`        cp ${f} docs/${f}`));
  console.log(`        git commit -am 'Republish matchbox' && git push`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
