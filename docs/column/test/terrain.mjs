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

console.log(`\nWHAT DOES EACH GROUND DO? — ${PAIRS} pairings, ${SEEDS} seeds each, fought on every ground\n`);

// EVERY MAP CARRIES ONE, which is Sam's decision, so the sweep is derived from
// the maps rather than from a list typed here. A ground added to a map and left
// out of a hand-written list would ship unmeasured, and this project has already
// spent a session on a persona table where two of five rows were the same policy.
const GROUNDS = MAPS.map(m => ({ map: m, t: m.terrain, g: TERRAIN[m.terrain] }))
                    .filter(x => x.g);

const flat = measure(pairs, null);
const pc = v => `${(v * 100).toFixed(1)}%`;
const delta = (a, b) => { const d = (b - a) * 100; return `${d >= 0 ? '+' : ''}${d.toFixed(1)}pt`; };

console.log('  ground              mechanism        decided    formalities   kept    battles changed');
console.log('  ' + '-'.repeat(88));
console.log(`  ${'FLAT (control)'.padEnd(20)}${'—'.padEnd(17)}${pc(flat.rate).padStart(7)}${pc(flat.formalityRate).padStart(13)}${pc(flat.medianKept).padStart(9)}${'—'.padStart(15)}`);

const arms = [];
for (const { map, t, g } of GROUNDS) {
  const m = measure(pairs, t);
  const moved = m.results.filter((r, i) => r.p !== flat.results[i].p).length;
  const kind = [g.cap && 'range cap', g.cut && 'cover', g.burn && 'fire', g.flat && 'bare'].filter(Boolean).join('+');
  arms.push({ map, t, g, m, moved, kind });
  console.log(`  ${g.n.padEnd(20)}${kind.padEnd(17)}${pc(m.rate).padStart(7)}${pc(m.formalityRate).padStart(13)}${pc(m.medianKept).padStart(9)}${String(moved).padStart(11)} of ${m.n}`);
}

const best = [...arms].sort((a, b) => a.m.formalityRate - b.m.formalityRate)[0];
const worst = [...arms].sort((a, b) => b.m.formalityRate - a.m.formalityRate)[0];
console.log(`\n  formalities: flat ${pc(flat.formalityRate)}; best ${best.g.n} ${pc(best.m.formalityRate)}; worst ${worst.g.n} ${pc(worst.m.formalityRate)}`);
console.log('');
/* --------------------------------------- what each ground does to the graph */
// Every card against every other, three of each, on every ground. This is
// matchup.mjs's matrix rebuilt at a smaller seed count -- a comparison rather
// than the published figure, so it is printed as a CHANGE. The absolute number
// is matchup.mjs's to state and a second copy of it here would be the defect
// this project finds most often.
//
// THE SPREAD IS THE HEADLINE, not any one card. Round one found that cover did
// not flatten the pool, it changed who was at the top of it -- and Sam's answer
// was to give every map its own ground, so that the variety lives across a run.
// The question this table now answers is whether the BEST CARD IS DIFFERENT ON
// DIFFERENT GROUNDS. If every ground has the same top card, nine features are
// nine decorations.

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
const spread = g => Math.max(...IDS.map(i => g[i])) - Math.min(...IDS.map(i => g[i]));
const top = g => IDS.reduce((a, b) => (g[b] > g[a] ? b : a));

const gFlat = overall(null);
console.log('  the best card on each ground, and how far apart the pool is:\n');
console.log('    ground              best card      its rate    spread');
console.log('    ' + '-'.repeat(54));
console.log(`    ${'FLAT (control)'.padEnd(20)}${top(gFlat).padEnd(15)}${pc(gFlat[top(gFlat)]).padStart(8)}${pc(spread(gFlat)).padStart(10)}`);

const tops = {};
for (const { g, t } of GROUNDS) {
  const r = overall(t);
  tops[t] = top(r);
  console.log(`    ${g.n.padEnd(20)}${top(r).padEnd(15)}${pc(r[top(r)]).padStart(8)}${pc(spread(r)).padStart(10)}`);
}
const distinct = new Set(Object.values(tops));
console.log(`\n    ${distinct.size} different cards are best across the ${GROUNDS.length} grounds: ${[...distinct].join(', ')}`);
console.log(`    flat: ${top(gFlat)}\n`);

/* --------------------------------------------------------------- the guards */
// All three are assertions rather than decoration, and each has already caught
// something in this project.

let bad = 0;
const again = measure(pairs, null);
if (again.results.every((r, i) => r.p === flat.results[i].p))
  console.log(' ok   the flat arm reproduces itself exactly — the run is deterministic');
else { console.log('FAIL  the flat arm did not reproduce itself. Nothing above means anything.'); bad++; }

// A GROUND THAT REACHES NOTHING prints a tidy 0.0pt and reads exactly like a
// rule that does not matter, which is how an unimplemented booster once measured
// +0.58 here. Every one of the nine has to move something.
// A GROUND MAY BE DELIBERATELY BARE -- the drill square is -- but it has to SAY
// so in the data. An inert ground that never declared itself is the failure this
// guard exists for, and a bare one that does declare itself is a design choice
// with its cost on the table.
const inert = arms.filter(a => a.moved === 0 && !a.g.flat);
const declared = arms.filter(a => a.g.flat);
const lying = declared.filter(a => a.moved > 0);
if (!inert.length && !lying.length)
  console.log(` ok   every ground reaches the resolver, or says it is bare (${arms.length - declared.length} live, ${declared.length} bare)`);
else {
  if (inert.length) console.log(`FAIL  ${inert.length} ground(s) changed nothing and never said they were bare: ${inert.map(a => a.g.n).join(', ')}`);
  if (lying.length) console.log(`FAIL  ${lying.length} ground(s) claim to be bare and changed battles: ${lying.map(a => a.g.n).join(', ')}`);
  bad++;
}

// A MAP WITH NO TERRAIN MUST BE THE OLD BATTLE, byte for byte. Every figure in
// this folder was measured flat, so if a mapless resolve() has drifted then the
// whole document is quietly wrong and this file caused it.
const spot = pairs.slice(0, 20).every(p => {
  const x = resolve(p.a, p.b, 3, false, null, null);
  const y = resolve(p.a, p.b, 3);
  return x.winner === y.winner && x.ticks === y.ticks && x.left[0] === y.left[0] && x.left[1] === y.left[1];
});
if (spot) console.log(' ok   resolve() with no terrain is unchanged — the flat field is still the old battle');
else { console.log('FAIL  resolve() with no terrain has drifted from resolve() without the argument.'); bad++; }

// EVERY MAP CARRIES ONE, which is Sam's decision and is the thing a later
// session would quietly break by adding a map.
const bare = MAPS.filter(m => !m.terrain || !TERRAIN[m.terrain]);
if (!bare.length) console.log(` ok   every one of the ${MAPS.length} maps carries a ground`);
else { console.log(`FAIL  ${bare.length} map(s) carry none: ${bare.map(m => m.id).join(', ')}`); bad++; }

console.log(`\n   covered: ${pairs.length} pairings x ${SEEDS} seeds x ${arms.length + 2} grounds,`);
console.log(`   plus ${IDS.length}x${IDS.length} cards on ${GROUNDS.length + 1} grounds\n`);
process.exit(bad ? 1 : 0);
