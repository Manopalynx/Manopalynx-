// Is there a game in here? — the counter-graph, measured.
//
// This is the go/no-go for the whole project. Every unit is fought against every
// other over many seeds and the win matrix printed, and three claims are checked
// against it. If they fail, the roster changes while there is still no interface
// to change.
//
//   1. Local counters ARE decisive. Sam's direction is "decisive local counters,
//      but rarely a single decisive counter to an entire composition", so a
//      one-card-type army beating another outright is the TARGET, not a fault.
//      The old claim here -- nothing above 65% or below 35% -- measured exactly
//      the case that is allowed to be lopsided, and it was also finer than the
//      model can resolve: with 86% of pairings decided 95/5, an "overall win
//      rate" moves in steps of 1/11 and the 35-65% band admitted four values.
//      Whether COMPOSITIONS are decisive is the real question and it is asked in
//      test/match.mjs, where mixed armies live.
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

import { UNITS, DRAFT, SPECIALS, BY_ID } from '../data.js';
import { resolve } from '../engine.js';
import { GLYPH } from '../glyphs.js';

const SEEDS = +process.argv[2] || 12;
const SQUAD = 3;              // equal CARDS a side. A pick is a pick, so this is the fair comparison

// THE DRAFT POOL, NOT THE ROSTER. The specials are bought and never dealt, so a
// single-type pairing never contains one -- putting them in this graph would
// measure a matchup the game cannot produce, and would let three shop cards
// rewrite the finding that the twelve drafted ones are decisive against each
// other. They get their own claim at the bottom instead.
const ids = DRAFT.map(u => u.id);
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
// Counted as they fire rather than against a number typed at the bottom, which
// is a number written twice and was wrong in play.mjs for two sessions.
let failed = 0, ran = 0;
const ok = m => { ran++; console.log(` ok   ${m}`); };
const bad = (m, why) => { ran++; failed++; console.log(`FAIL  ${m}`); (why || []).forEach(w => w && console.log(`        · ${w}`)); };

console.log('');

// 1 -----------------------------------------------------------------------
if (decisive / pairs.length >= 0.5)
  ok(`local counters are decisive — ${(decisive / pairs.length * 100).toFixed(0)}% of single-type pairings settled 95/5`);
else bad('local counters are decisive', [
  `only ${(decisive / pairs.length * 100).toFixed(0)}% of pairings settle 95/5; a counter the player cannot feel is not a counter`
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

// 4 -----------------------------------------------------------------------
// EVERY SPECIAL MUST STILL LOSE TO SOMETHING. A special that answers everything
// is not a prize, it is the end of the game. Four of an ordinary card is roughly
// what the same credits buy, so that is the comparison.
{
  const beaten = [];
  for (const sp of SPECIALS) {
    const answers = [];
    for (const id of ids) {
      let w = 0;
      for (let s = 0; s < 8; s++) if (resolve([id, id, id, id], [sp.id], s * 37 + 3).winner === 0) w++;
      if (w >= 6) answers.push(BY_ID[id].n);
    }
    beaten.push({ sp, answers });
  }
  const none = beaten.filter(b => !b.answers.length);
  if (!none.length) {
    ok('every special has an answer in the ordinary roster');
    for (const b of beaten) console.log(`        ${b.sp.n}: ${b.answers.join(', ')}`);
  } else bad('every special has an answer in the ordinary roster', [
    `nothing in the twelve beats: ${none.map(b => b.sp.n).join(', ')}`,
    'a card the drafted roster cannot answer ends the game rather than deepening it'
  ]);
}

/* --------------------------------- does every unit have a face? ------------- */
// A UNIT WITHOUT A GLYPH IS A BLANK COUNTER AND NOTHING THROWS. `glyph()`
// returns an empty string for an id it does not know, which is right for the
// renderer -- a missing mark must not take the battlefield down -- and is exactly
// why it needs a check somewhere else. `detail` is separate because it is drawn
// only at card size, so a glyph missing it looks perfect on the field and blank
// on the deck, which is the harder version of the same defect to notice.
const faceless = UNITS.filter(u => !GLYPH[u.id] || !GLYPH[u.id].d || !GLYPH[u.id].d.length);
const detailless = UNITS.filter(u => GLYPH[u.id] && !Array.isArray(GLYPH[u.id].detail));
const orphan = Object.keys(GLYPH).filter(id => !UNITS.some(u => u.id === id));
if (!faceless.length && !detailless.length && !orphan.length)
  ok(`every one of the ${UNITS.length} units has a mark, and every mark has a unit`);
else bad('every unit has a mark and every mark has a unit', [
  faceless.length ? `no glyph: ${faceless.map(u => u.id).join(', ')} — these deploy as blank counters` : '',
  detailless.length ? `no detail strokes: ${detailless.map(u => u.id).join(', ')} — blank on a card face` : '',
  orphan.length ? `glyph with no unit: ${orphan.join(', ')}` : '']);

console.log(`\n${ran - failed} of ${ran} claims hold\n`);
process.exit(failed ? 1 : 0);
