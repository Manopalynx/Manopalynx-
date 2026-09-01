// THE HEAD SECTION OF A DOCUMENT IS THE COPY THAT GOES STALE FIRST.
//
// docs/column/README.md opens with "Where it stands", and that section declares
// itself the only present-tense part of the file: "where this and the log
// disagree, this wins". It then sat at `column-v22` / `grandiose-v96` for nine
// builds while the code moved to v31 / v105 -- so a reader following the
// document's own reading rule got the wrong build, and every model this file was
// pasted into was told the project was nine builds behind where it is.
//
// Nothing could have caught it. test/offline.mjs already asserts data.js BUILD
// and sw.js CACHE agree with EACH OTHER; nothing asserted that the prose naming
// them agrees with either. This is that check.
//
// SCOPED TO THE HEAD SECTION ON PURPOSE. The build log below it quotes old
// versions deliberately -- `grandiose-v88` in the service-worker section, and
// the head section's own sentence about having said `column-v22` -- and a
// whole-file scan would fail on history that is correct as written. The rule is
// that the LIVE strings must appear in the head section, not that no old one may.

import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// DERIVED FROM THE FILES, never restated here. A number written twice will
// disagree, and the second copy is usually the one in the check.
const one = (src, re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`could not find ${what} -- the check is stale, not the code`);
  return m[1];
};

const BUILD = one(read('docs/column/data.js'), /export const BUILD\s*=\s*'([^']+)'/, 'BUILD in docs/column/data.js');
const CACHE = one(read('docs/sw.js'), /const CACHE\s*=\s*'([^']+)'/, 'CACHE in docs/sw.js');

const doc = read('docs/column/README.md');
const START = '## Where it stands';
const END = '## Why "The Column"';
const i = doc.indexOf(START), j = doc.indexOf(END);
if (i < 0 || j < 0 || i >= j) throw new Error('the head section anchors moved -- fix this check');
const head = doc.slice(i, j);

let failed = 0;
const claim = (ok, name, detail) => {
  console.log(ok ? ` ok   ${name}` : `FAIL  ${name}`);
  if (detail) console.log(`        ${detail}`);
  if (!ok) failed++;
};

claim(head.includes('`' + BUILD + '`'),
  "the Column README's head section names the live BUILD",
  `data.js is ${BUILD}; "Where it stands" ${head.includes('`' + BUILD + '`') ? 'says so' : 'does not mention it'}`);

claim(head.includes('`' + CACHE + '`'),
  "the Column README's head section names the live CACHE",
  `docs/sw.js is ${CACHE}; "Where it stands" ${head.includes('`' + CACHE + '`') ? 'says so' : 'does not mention it'}`);

// The ladder is the other thing that grew from five to nine while the prose kept
// the old five. It is a list, so it can be compared rather than eyeballed.
const order = one(read('docs/column/data.js'), /order:\s*\[([^\]]+)\]/, 'RUN.order in docs/column/data.js')
  .split(',').map(s => s.trim().replace(/^'|'$/g, ''));
const missing = order.filter(o => !head.includes(o));
claim(missing.length === 0,
  "the head section's run names every opponent the ladder holds",
  `${order.length} in RUN.order${missing.length ? `; not named in the head section: ${missing.join(', ')}` : '; all named'}`);

console.log(`\n${3 - failed} of 3 claims hold`);
process.exit(failed ? 1 : 0);
