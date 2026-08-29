// WHAT DOES COVER DO? — his note 20, round one, measured before it is wired up.
//
// The maps have been cosmetic and that was the point. This is the first thing
// that makes one mean something, and it is the answer Sam has held for the
// composition red since it first went red: battlefield variety rather than
// softer counters.
//
// It is worth building now because of what `settled.mjs` measured. A battle-side
// effect the size of one card of nine changes a third of the pairings that were
// "decided" — so there is room in a battle for terrain to matter. Before that,
// this project's own standing reasoning predicted terrain to be dead along with
// every other thing that happens inside a battle, and it would have been built
// on a false expectation either way.
//
// THE FLAT FIELD IS THE CONTROL AND IT IS FREE. `resolve()` takes terrain as an
// optional last argument defaulting to none, so a battle with no terrain is
// byte-for-byte the battle every existing figure was measured on. The arms below
// are the same 400 pairings fought twice.
//
// THREE QUESTIONS, and the third is the one the whole note is for:
//
//   1. Does cover reach the resolver at all? An arm that changes nothing prints
//      a tidy 0.0pt and reads exactly like a rule that does not matter.
//   2. What does it do to the pair of numbers settled.mjs separated — how many
//      pairings are DECIDED, and how many are FORMALITIES?
//   3. What does it do to the counter graph, and to Amabie in particular? Amabie
//      is the top card in the pool at 80.3% with range 62, and cover is a direct
//      answer to it. If cover does not move Amabie it is not doing the job it
//      was chosen for.
//
// Run:  node docs/column/test/terrain.mjs
//       PAIRS=60 node docs/column/test/terrain.mjs      # a smoke run

import { DRAFT, TERRAIN, MAPS } from '../data.js';
import { resolve } from '../engine.js';
import { samplePairs, measure, SEEDS } from './pairings.mjs';

const PAIRS = Number(process.env.PAIRS || 400);
const pairs = samplePairs(PAIRS);

console.log(`\nWHAT DOES COVER DO? — ${PAIRS} pairings, ${SEEDS} seeds each, fought on both grounds\n`);
console.log(`  ${TERRAIN.cover.says}`);
console.log(`  band y ${TERRAIN.cover.from}–${TERRAIN.cover.to} of a field ${140} deep; both lines advance into it.`);
const mapped = MAPS.filter(m => m.terrain);
console.log(`  carried by ${mapped.length} of ${MAPS.length} maps: ${mapped.map(m => m.n).join(', ')}\n`);

/* ------------------------------------------------------- 1 and 2: the pairings */

const flat = measure(pairs, null);
const cover = measure(pairs, 'cover');
const moved = cover.results.filter((r, i) => r.p !== flat.results[i].p).length;

const pc = v => `${(v * 100).toFixed(1)}%`;
const delta = (a, b) => { const d = (b - a) * 100; return `${d >= 0 ? '+' : ''}${d.toFixed(1)}pt`; };

console.log('                                   flat        cover       change');
console.log('  ' + '-'.repeat(62));
console.log(`  decided 95/5 or harder      ${pc(flat.rate).padStart(9)}${pc(cover.rate).padStart(12)}${delta(flat.rate, cover.rate).padStart(13)}`);
console.log(`  FORMALITIES                 ${pc(flat.formalityRate).padStart(9)}${pc(cover.formalityRate).padStart(12)}${delta(flat.formalityRate, cover.formalityRate).padStart(13)}`);
console.log(`  median winner kept          ${pc(flat.medianKept).padStart(9)}${pc(cover.medianKept).padStart(12)}${delta(flat.medianKept, cover.medianKept).padStart(13)}`);
console.log(`  drew at the tick ceiling    ${pc(flat.draws).padStart(9)}${pc(cover.draws).padStart(12)}${delta(flat.draws, cover.draws).padStart(13)}`);
console.log(`\n  battles the ground changed: ${moved} of ${pairs.length} pairings\n`);

/* ------------------------------------------------ 3: what it does to the graph */
// Every card against every other, three of each, on both grounds. This is
// matchup.mjs's matrix — rebuilt here at a smaller seed count because it is a
// comparison rather than the published figure, and printed as a CHANGE, since
// the absolute number is matchup.mjs's to state and would be a second copy of it.

const IDS = DRAFT.map(u => u.id);
function overall(terrain) {
  const seeds = 4, rate = {};
  for (const x of IDS) {
    let w = 0, n = 0;
    for (const y of IDS) {
      if (x === y) continue;
      for (let s = 0; s < seeds; s++) {
        const r = resolve([x, x, x], [y, y, y], s * 13 + 7, false, null, terrain);
        w += r.winner === 0 ? 1 : r.winner === null ? 0.5 : 0;
        n++;
      }
    }
    rate[x] = w / n;
  }
  return rate;
}
const gFlat = overall(null), gCover = overall('cover');

const rows = IDS.map(id => ({ id, flat: gFlat[id], cover: gCover[id], d: gCover[id] - gFlat[id] }))
                .sort((a, b) => b.flat - a.flat);
console.log('  single-type win rate against the whole pool, by ground:\n');
console.log('    card             flat     cover    change');
console.log('    ' + '-'.repeat(44));
for (const r of rows) {
  console.log(`    ${r.id.padEnd(14)}${pc(r.flat).padStart(8)}${pc(r.cover).padStart(9)}${delta(r.flat, r.cover).padStart(11)}`);
}

// THE SPREAD IS THE POINT, not any one card. A pool where the best card wins 80%
// and the worst 26% is a pool with a right answer; closing that gap is what
// "decisive local counters, rarely a decisive counter to a whole composition"
// asks for.
const spread = g => Math.max(...IDS.map(i => g[i])) - Math.min(...IDS.map(i => g[i]));
console.log(`\n    top-to-bottom spread   ${pc(spread(gFlat)).padStart(8)}${pc(spread(gCover)).padStart(9)}${delta(spread(gFlat), spread(gCover)).padStart(11)}`);

/* --------------------------------------------------------------- the guards */
// Both are assertions rather than decoration, and both have caught something in
// this project already.

let bad = 0;
const again = measure(pairs, null);
if (again.results.every((r, i) => r.p === flat.results[i].p))
  console.log('\n ok   the flat arm reproduces itself exactly — the run is deterministic');
else { console.log('\nFAIL  the flat arm did not reproduce itself. Nothing above means anything.'); bad++; }

if (moved > 0)
  console.log(` ok   cover reaches the resolver — ${moved} of ${pairs.length} pairings came out differently`);
else { console.log(' FAIL cover changed nothing, so the rule never reached the resolver.'); bad++; }

// A MAP WITH NO TERRAIN MUST BE THE OLD BATTLE, byte for byte. Every figure in
// this folder was measured flat, so if a mapless resolve() has drifted then the
// whole document is quietly wrong and this file caused it.
const spot = pairs.slice(0, 20).every(p => {
  const x = resolve(p.a, p.b, 3, false, null, null);
  const y = resolve(p.a, p.b, 3);
  return x.winner === y.winner && x.ticks === y.ticks && x.left[0] === y.left[0] && x.left[1] === y.left[1];
});
if (spot) console.log(' ok   resolve() with no terrain is unchanged — the flat field is still the old battle');
else { console.log(' FAIL resolve() with no terrain has drifted from resolve() without the argument.'); bad++; }

console.log(`\n   covered: ${pairs.length} pairings x ${SEEDS} seeds x 3 arms, plus ${IDS.length}x${IDS.length} cards on two grounds\n`);
process.exit(bad ? 1 : 0);
