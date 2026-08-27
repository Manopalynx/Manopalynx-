// Is there a game in here? — the counter-graph, measured.
//
// This is the go/no-go for the whole project. Every unit is fought against every
// other over many seeds and the win matrix printed, and three claims are checked
// against it. If they fail, the roster changes while there is still no interface
// to change.
//
//   1. No dominant unit and no dead one — nothing above 65% or below 35% overall.
//   2. Real cycles — at least one A>B>C>A with every edge at 60/40 or wider, and
//      every unit inside at least one such cycle.
//   3. Every unit is somebody's answer — for each U there is a V it beats better
//      than anything else in the pool does.
//
// The thresholds are a first guess chosen to be checkable, not a measurement.
// If a change to them flips every claim at once, the metric has no room in it
// and the number is not the thing to touch.
//
// Run:  node docs/column/test/matchup.mjs [seeds]

import { UNITS, BY_ID } from '../data.js';
import { resolve } from '../engine.js';

const SEEDS = +process.argv[2] || 12;
const SQUAD = 3;              // equal CARDS a side. A pick is a pick, so this is the fair comparison

const ids = UNITS.map(u => u.id);
const win = {};               // win[a][b] = fraction of seeds a beats b
ids.forEach(a => { win[a] = {}; });

for (const a of ids) {
  for (const b of ids) {
    if (a === b) { win[a][b] = 0.5; continue; }
    let w = 0, n = 0;
    for (let s = 0; s < SEEDS; s++) {
      // Both orderings, so no result can be an artefact of which army deploys
      // as side 0. The Ledger's record has three separate defects that were
      // really the shape of the harness rather than the thing measured.
      const x = resolve(Array(SQUAD).fill(a), Array(SQUAD).fill(b), s * 101 + 7);
      const y = resolve(Array(SQUAD).fill(b), Array(SQUAD).fill(a), s * 101 + 7);
      if (x.winner === 0) w++; else if (x.winner === null) w += 0.5;
      if (y.winner === 1) w++; else if (y.winner === null) w += 0.5;
      n += 2;
    }
    win[a][b] = w / n;
  }
}

/* ------------------------------------------------------------------ the matrix */
const pad = s => String(s).padStart(5);
console.log(`\n${SQUAD} a side, ${SEEDS} seeds, both deployments. Row beats column:\n`);
console.log('           ' + ids.map(i => pad(i.slice(0, 5))).join(''));
for (const a of ids) {
  const row = ids.map(b => a === b ? pad('·') : pad((win[a][b] * 100).toFixed(0)));
  console.log(a.padEnd(11) + row.join(''));
}

const overall = {};
for (const a of ids) {
  const others = ids.filter(b => b !== a);
  overall[a] = others.reduce((s, b) => s + win[a][b], 0) / others.length;
}

console.log('\noverall win rate against the whole pool:');
[...ids].sort((x, y) => overall[y] - overall[x])
  .forEach(a => console.log(`  ${(overall[a] * 100).toFixed(1).padStart(5)}%  ${a}`));

/* ------------------------------------------- how much room does the model have? */
// Five tuning passes each flipped a unit from dead to dominant on a small change,
// which is the catalogue's tell that a metric has no room in it. So: measure the
// room directly rather than keep tuning against it. If almost every pairing is
// 0% or 100%, the resolver produces binary outcomes and "overall win rate" is
// really "how many pairings did this unit cross the line on" -- a count, not a
// rate, and no amount of tuning will move it smoothly.
const pairs = [];
for (const a of ids) for (const b of ids) if (a !== b) pairs.push(win[a][b]);
const decisive = pairs.filter(p => p <= 0.05 || p >= 0.95).length;
console.log(`\nof ${pairs.length} pairings, ${decisive} (${(decisive / pairs.length * 100).toFixed(0)}%) ` +
            `are decided 95/5 or harder — the model's room to express a close matchup`);

/* ------------------------------------------------------------------ the claims */
let failed = 0;
const ok = m => console.log(` ok   ${m}`);
const bad = (m, why) => { failed++; console.log(`FAIL  ${m}`); (why || []).forEach(w => console.log(`        · ${w}`)); };

console.log('');

// 1 -----------------------------------------------------------------------
const hot = ids.filter(a => overall[a] > 0.65);
const cold = ids.filter(a => overall[a] < 0.35);
if (!hot.length && !cold.length) ok('no unit is dominant and none is dead (all 35-65%)');
else bad('no unit is dominant and none is dead', [
  ...hot.map(a => `${a} wins ${(overall[a] * 100).toFixed(1)}% of the pool — dominant`),
  ...cold.map(a => `${a} wins ${(overall[a] * 100).toFixed(1)}% of the pool — dead pick`)
]);

// 2 -----------------------------------------------------------------------
const EDGE = 0.60;
const cycles = [];
for (const a of ids) for (const b of ids) for (const c of ids) {
  if (a === b || b === c || a === c) continue;
  if (win[a][b] >= EDGE && win[b][c] >= EDGE && win[c][a] >= EDGE) cycles.push([a, b, c]);
}
const inCycle = new Set(cycles.flat());
const orphans = ids.filter(a => !inCycle.has(a));
if (cycles.length && !orphans.length) {
  ok(`${cycles.length} three-cycles at ${EDGE * 100}/${100 - EDGE * 100} or wider, every unit inside one`);
  console.log(`        e.g. ${cycles[0].join(' > ')} > ${cycles[0][0]}`);
} else bad('real cycles, with every unit in one', [
  `${cycles.length} cycles found`,
  orphans.length ? `outside every cycle: ${orphans.join(', ')}` : 'no cycles at all'
]);

// 3 -----------------------------------------------------------------------
const noAnswer = [];
for (const u of ids) {
  const answers = ids.some(v => v !== u &&
    ids.every(w => w === u || win[u][v] >= win[w][v]));
  if (!answers) noAnswer.push(u);
}
if (!noAnswer.length) ok('every unit is the best answer in the pool to something');
else bad('every unit is the best answer to something', [
  `nothing is best answered by: ${noAnswer.join(', ')}`
]);

console.log(`\n${3 - failed} of 3 claims hold\n`);
process.exit(failed ? 1 : 0);
