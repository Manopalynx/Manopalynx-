// Every square that is not a property must carry a drawn mark.
//
// The mark is the only thing distinguishing twelve of the busiest cells on the
// board from each other — CLMN and CON in particular, which take 10.4% of all
// landings between them and were once COL/CON, recorded in the README as the
// worst possible pair to confuse. If a square type were added later and no icon
// drawn for it, nothing would fail: the cell would quietly fall back to a bare
// four-letter code, which is the state this work exists to end. So the mapping
// is asserted to be total rather than assumed to be kept up to date.
//
// ui.js imports from './data.js' and touches no DOM at module scope for the
// parts read here, but it does reference `document` on load, so the ICON map is
// read as source rather than imported. That keeps this test free of a DOM shim.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { BOARD, TRAFFIC } from '../data.js';

const ui = readFileSync(fileURLToPath(new URL('../ui.js', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

// The keys of the ICON object literal, read from source.
const block = ui.match(/const ICON = \{([\s\S]*?)\n\};/);
const iconKeys = new Set([...(block?.[1] ?? '').matchAll(/^\s{2}(\w+):/gm)].map(m => m[1]));

const nonProperty = [...new Set(BOARD.filter(b => b.t !== 'p').map(b => b.t))];

test('the ICON map was found in ui.js', () => {
  assert.ok(block, 'could not find `const ICON = {…};` — update this test with it');
  assert.ok(iconKeys.size > 0, 'ICON parsed as empty');
});

test('every non-property square type has a mark', () => {
  const missing = nonProperty.filter(t => !iconKeys.has(t));
  assert.deepEqual(missing, [],
    `these square types would render as a bare code: ${missing.join(', ')}`);
});

test('no mark is drawn for a type no square uses', () => {
  const spare = [...iconKeys].filter(t => !nonProperty.includes(t));
  assert.deepEqual(spare, [], `ICON carries marks nothing on the board uses: ${spare.join(', ')}`);
});

test('properties are left unmarked, so a mark means "not an ordinary square"', () => {
  assert.equal(iconKeys.has('p'), false, 'properties must keep the colour bar as their identity');
});

test('every mark is inline SVG with no external reference', () => {
  const body = block[1];
  assert.equal(/<image|xlink:href|url\(|https?:/.test(body), false,
    'a mark reaches outside the file — it must survive with no network and no cache entry');
  assert.ok(/currentColor/.test(body), 'marks must inherit colour so the corners can be gold');
});

// The mark must stay out of flow. In flow it does not overflow the cell — it
// grows the grid track, which un-squares the whole board and puts the page into
// a scroll. That was measured, not predicted: a 15px mark above an 11px code
// took the board from 375 wide by 375 to 375 by 497.
test('the mark is out of flow, so it cannot resize a grid track', () => {
  assert.match(css, /\.cell \.cico\{[^}]*position:absolute/,
    'the mark must be absolutely placed or it contributes height to its row');
  assert.match(css, /\.cell \.cico\{[^}]*pointer-events:none/,
    'the mark must not intercept the tap that selects the square');
});

// Two independent ways the board stopped being square, both closed. Either one
// alone is enough; both are asserted because the failure is silent — a taller
// board still renders, still plays, and simply pushes the page into a scroll.
test('the board cannot be grown by its own contents', () => {
  assert.match(css, /\.board\{[^}]*min-height:0/,
    'a flex item in a column has min-height:auto, which outranks aspect-ratio');
  assert.match(css, /grid-template-rows:minmax\(0,/,
    'a bare fr track is minmax(auto,1fr) and floors at its content');
  assert.match(css, /\.board\{[^}]*aspect-ratio:1/, 'the board is square by definition');
});

test('the code and price sit above the mark', () => {
  assert.match(css, /\.cell \.code,\.cell \.cpr\{[^}]*z-index:2/,
    'the colour bar is z-index:1, so the text needs to clear both it and the mark');
});

// Not a rule, a record. These are the figures the work was justified by, and if
// the board changes enough to move them the justification should be re-read
// rather than inherited.
test('the marked-and-bare squares still carry the traffic that justified this', () => {
  const bare = BOARD.reduce((a, b, i) => a + (b.t !== 'p' && !b.pr ? TRAFFIC[i] : 0), 0);
  const decks = BOARD.reduce((a, b, i) => a + (b.t === 'con' || b.t === 'col' ? TRAFFIC[i] : 0), 0);
  assert.ok(bare > 24 && bare < 30, `bare non-property traffic is now ${bare.toFixed(2)}%, was 27.23%`);
  assert.ok(decks > 8 && decks < 13, `deck traffic is now ${decks.toFixed(2)}%, was 10.42%`);
});
