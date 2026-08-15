// Does the copy people actually open match the one that gets worked on?
//
// matchbox.html is developed at the root of this branch. GitHub Pages serves /docs
// from claude/grandiose-monopoly-game-y93uw8, so a second copy lives there and that
// is the one with a URL — the one loaded on a phone, and therefore the only one
// anybody's notes are ever about.
//
// Two copies of a file with nothing comparing them are two files. This asserts they
// are byte-identical, so "I tried it and X happened" can never be a report about a
// build that no longer exists.
//
// Run:  node test/published.mjs

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const ROOT   = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH = 'claude/grandiose-monopoly-game-y93uw8';

// The page, and the two companions that only matter once it is on a Home Screen: iOS
// will not take an icon from an SVG or a data: URI, so the icon has to be a real file
// sitting next to the page. All three have to travel together — a page published
// without its icon gets a fallback tile with a letter on it, which is what started
// this.
const FILES = ['matchbox.html', 'matchbox-icon-180.png', 'matchbox.webmanifest'];

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'buffer', stdio: ['ignore','pipe','pipe'] });

let failed = 0;

// The published copy is on another branch, so it has to be fetched before it can be
// read. Do that here rather than assuming somebody remembered to.
let ref = `origin/${BRANCH}`;
try {
  git('fetch', 'origin', BRANCH);
} catch {
  // Offline, or no remote. Fall back to whatever ref is already on disk and say so,
  // because silently checking a month-old fetch would be worse than not checking.
  console.log(`      · could not reach the remote; comparing against whatever ${ref} is already on disk`);
}

let passed = 0;

for (const name of FILES) {
  const local = readFileSync(resolve(ROOT, name));
  let published;
  try {
    published = git('show', `${ref}:docs/${name}`);
  } catch {
    failed++;
    console.log(`FAIL  ${name} is not published at all`);
    console.log(`        · ${ref}:docs/${name} could not be read`);
    continue;
  }
  if (Buffer.compare(local, published) === 0) {
    passed++;
    console.log(` ok   docs/${name} matches this branch's copy`);
  } else {
    failed++;
    console.log(`FAIL  docs/${name} has drifted from the one being worked on`);
    console.log(`        · here it is ${local.length} bytes, published it is ${published.length} bytes`);
  }
}

if (failed) {
  console.log(`\n      The URL people open serves the published copies:`);
  console.log(`        https://manopalynx.github.io/Manopalynx-/matchbox.html`);
  console.log(`      To republish:`);
  console.log(`        git worktree add /tmp/pub ${BRANCH}`);
  FILES.forEach(f => console.log(`        cp ${f} /tmp/pub/docs/${f}`));
  console.log(`        cd /tmp/pub && git commit -am 'Republish matchbox' && git push`);
  console.log(`        git worktree remove /tmp/pub`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
