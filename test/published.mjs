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

const ROOT      = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL     = resolve(ROOT, 'matchbox.html');
const BRANCH    = 'claude/grandiose-monopoly-game-y93uw8';
const PUBLISHED = 'docs/matchbox.html';

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

let published;
try {
  published = git('show', `${ref}:${PUBLISHED}`);
} catch {
  console.log(`FAIL  the published copy is missing`);
  console.log(`        · ${ref}:${PUBLISHED} could not be read. If Pages has moved, this check needs its branch updating.`);
  process.exit(1);
}

const local = readFileSync(LOCAL);

if (Buffer.compare(local, published) === 0) {
  console.log(` ok   docs/matchbox.html on ${BRANCH} is the file in this branch's root`);
} else {
  failed++;
  console.log(`FAIL  the published copy has drifted from the one being worked on`);
  console.log(`        · root matchbox.html is ${local.length} bytes, ${PUBLISHED} is ${published.length} bytes`);
  console.log(`        · the URL people open serves the second one:`);
  console.log(`          https://manopalynx.github.io/Manopalynx-/matchbox.html`);
  console.log(`        · to republish:`);
  console.log(`            git worktree add /tmp/pub ${BRANCH}`);
  console.log(`            cp matchbox.html /tmp/pub/${PUBLISHED}`);
  console.log(`            cd /tmp/pub && git commit -am 'Republish matchbox.html' && git push`);
}

console.log(`\n${failed ? 0 : 1} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
