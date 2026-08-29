// WHY is a mixed composition settled before a shot is fired?
//
// `match.mjs` has printed the same red for every session that has measured it:
// 59% of mixed nine-card armies are decided 95/5 or harder. That says HOW OFTEN
// and has never said WHY, and the difference matters more than it looks, because
// the red is load-bearing for the rest of the game:
//
//   the field resets every round, so a booster that acts INSIDE a battle can
//   only change a round that was close -- and most rounds are not close. Every
//   battle-side booster this project has measured is dead for that reason. The
//   two axes that work, more picks and something that carries between matches,
//   are nearly exhausted. Nothing new opens until this moves.
//
// So this proposes nothing and tunes nothing. It answers one question -- what
// would have to be different for these battles to stop being formalities -- and
// hands Sam the answer to spend.
//
// THREE PARTS, and the method hardens as it goes. A cause is not interesting
// because it correlates; it is interesting because REMOVING it changes the
// outcome.
//
//   1  WHICH PRE-BATTLE NUMBER ALREADY KNOWS THE WINNER.
//   2  WHETHER PAIRINGS IT CALLS EVEN ARE STILL DECIDED. If they are, the
//      number is a symptom rather than the cause.
//   3  THE RULE-OUT ARMS. One rule of the resolver switched off at a time, the
//      SAME pairings re-fought, and the decisive rate compared. This is the only
//      part that can establish a cause rather than an association.
//
// EVERY COMPARISON IS BRACKETED BY CONTROLS THAT ARE NEITHER OPTION, because a
// differential without one flatters everything in the column and this project
// has shipped that mistake: an unimplemented booster once scored +0.58.
//
//   part 1   `coin` knows nothing and must land on 50%.
//            `oracle` is told the answer and must land on 100%.
//   part 3   a NO-OP arm changes nothing and must move the figure by exactly
//            0.0pt -- if it does not, the run is not deterministic and no other
//            arm means anything. A LOUD arm changes something enormous and must
//            move it a long way -- if it does not, the mutation is not reaching
//            the resolver and every "no effect" below is a no-op sailing
//            through, which is exactly how a dead booster once measured alive.
//
// Run:  node docs/column/test/settled.mjs
//       PAIRS=60 node docs/column/test/settled.mjs      # a smoke run
//
// No browser, no DOM, no clock. Pure engine, seeded, reproducible.

import { DRAFT, BY_ID } from '../data.js';
import { resolve, rng, offer } from '../engine.js';

const PAIRS = Number(process.env.PAIRS || 400);
const SEEDS = 8;                 // battles per pairing, as match.mjs
const SIZE = 9;                  // cards a side, as match.mjs

/* ------------------------------------------------------------------ the pairing */
// Straight out of match.mjs, deliberately: an explanation of a number has to be
// an explanation of THAT number, so the generator, the size, the seed arithmetic
// and the 95/5 line are copied rather than re-chosen.
//
// A DRAW IS HALF A WIN HERE TOO, and counted, for the reason match.mjs gives: a
// battle that never finishes reads as a close one, and 28% of them once did.
function fight(a, b, start) {
  let wins = 0, drawn = 0, keptT = 0, keptN = 0;
  for (let s = 0; s < SEEDS; s++) {
    const r = resolve(a, b, s * 37 + 3);
    if (r.winner === 0) wins++;
    else if (r.winner === null) { wins += 0.5; drawn++; }
    // HOW MUCH OF ITSELF THE WINNER HAD LEFT. `left` is the resolver's own
    // survivor count, so this cannot report a margin the battle did not produce.
    if (r.winner !== null && start) {
      keptT += r.left[r.winner] / start[r.winner];
      keptN++;
    }
  }
  const p = wins / SEEDS;
  return { p, drawn, decisive: p <= 0.05 || p >= 0.95, kept: keptN ? keptT / keptN : null };
}

/* ----------------------------------------------------------------- the features */
// Each is signed: positive favours side A. Only the SIGN is read in part 1, so
// none of them needs scaling against the others.

const bodies = id => BY_ID[id].count || 1;
const dpsOf  = u => u.dmg * 10 / u.rate;
const sum = (army, f) => army.reduce((t, id) => t + f(id), 0);

const totals = army => ({
  bodies: sum(army, bodies),
  hp:     sum(army, id => bodies(id) * BY_ID[id].hp),
  dps:    sum(army, id => bodies(id) * dpsOf(BY_ID[id])),
  // The engine's own "how strong does this look on paper", squared in body
  // count, which every drafting policy already reads.
  paper:  sum(army, id => { const u = BY_ID[id], n = bodies(id); return n * n * u.hp * dpsOf(u); }),
  arm:    sum(army, id => bodies(id) * (BY_ID[id].arm || 0)) / Math.max(1, sum(army, bodies)),
});

// HOW MUCH OF A HIT SURVIVES THE ARMOUR IT LANDS ON. The resolver's rule is
// `d = max(1, d - arm)`: a flat subtraction per hit, so it is a THRESHOLD and
// not a percentage. A 15-damage hit into 12 armour delivers 3 and a 130-damage
// hit into the same armour delivers 118 -- the small hit loses 80% of itself
// and the big one 9%. If that is what settles these battles, then quantity
// should be worth nothing and this should be worth everything, which is a
// falsifiable pair rather than a story.
function pierce(mine, theirs) {
  let t = 0, n = 0;
  for (const x of mine) for (const y of theirs) {
    const u = BY_ID[x], v = BY_ID[y];
    const w = bodies(x) * bodies(y);
    t += (Math.max(1, u.dmg - (v.arm || 0)) / u.dmg) * w;
    n += w;
  }
  return n ? t / n : 0;
}

/* -------------------------------------------------- the counter matrix, measured */
// Every card against every other, three of each, so "does A's hand answer B's
// hand" is read off fought battles rather than off the stat block. This is
// matchup.mjs's matrix rebuilt locally at a smaller seed count: it is a FEATURE
// here, not a published claim, so it needs to be cheap rather than exact.
//
// IT IS BUILT BEFORE ANY ARM MUTATES ANYTHING, and used only in parts 1 and 2.
const IDS = DRAFT.map(u => u.id);
const M = {};
{
  const seeds = 4;
  for (const x of IDS) {
    M[x] = {};
    for (const y of IDS) {
      if (x === y) { M[x][y] = 0.5; continue; }
      if (M[y] && M[y][x] !== undefined) { M[x][y] = 1 - M[y][x]; continue; }
      let w = 0;
      for (let s = 0; s < seeds; s++) {
        const r = resolve([x, x, x], [y, y, y], s * 13 + 7);
        w += r.winner === 0 ? 1 : r.winner === null ? 0.5 : 0;
      }
      M[x][y] = w / seeds;
    }
  }
}

function counterEdge(a, b) {
  let t = 0, n = 0;
  for (const x of a) for (const y of b) {
    const w = bodies(x) * bodies(y);
    t += (M[x][y] - 0.5) * w;
    n += w;
  }
  return n ? t / n : 0;
}

/* ------------------------------------------------------------------ the sampling */
// `offer` can return an upgrade token for a card already held. match.mjs's
// generator keeps them and so does this, because the thing being explained
// included them -- but every feature above indexes BY_ID with a bare id, so an
// upgrade token would read `undefined` and take the arithmetic to NaN in
// silence. Strip them at the door and print how many, rather than assuming the
// count is zero.
let stripped = 0;
const bare = army => army.filter(t => {
  const ok = !t.includes(':');
  if (!ok) stripped++;
  return ok;
});

function samplePairs(n, seed) {
  const rand = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    // THE DRAW ORDER IS PART OF THE FIXTURE. match.mjs takes one card for A and
    // then one for B, alternating, off a single stream. Drawing all of A and
    // then all of B is the same distribution and a DIFFERENT SAMPLE, and it
    // landed 1.5pt off the figure this file exists to explain -- close enough to
    // look like agreement and not close enough to be it. Interleave, as it does.
    const a = [], b = [];
    for (let k = 0; k < SIZE; k++) {
      a.push(offer(rand, 1)[0]);
      b.push(offer(rand, 1)[0]);
    }
    const A = bare(a), B = bare(b);
    if (A.length && B.length) out.push({ a: A, b: B });
  }
  return out;
}

function measure(pairs) {
  let decisive = 0, drawn = 0, fought = 0;
  const results = [];
  for (const p of pairs) {
    const r = fight(p.a, p.b, [totals(p.a).bodies, totals(p.b).bodies]);
    results.push(r);
    if (r.decisive) decisive++;
    drawn += r.drawn;
    fought += SEEDS;
  }
  return { n: pairs.length, decisive, rate: decisive / pairs.length, draws: drawn / fought, results };
}

/* =========================================================== 0. the control arm */
// If this does not come back at match.mjs's figure, this file is explaining a
// different number and nothing after it means anything.

console.log(`\nWHY IS A COMPOSITION SETTLED? — ${PAIRS} pairs of ${SIZE} cards, ${SEEDS} seeds each\n`);

const pairs = samplePairs(PAIRS, 99);
const control = measure(pairs);
pairs.forEach((p, i) => { p.r = control.results[i]; });

console.log(`control: ${control.decisive} of ${control.n} (${(control.rate * 100).toFixed(1)}%) decided 95/5 or harder`);
console.log(`         ${(control.draws * 100).toFixed(0)}% of battles drew at the tick ceiling`);
console.log(`         ${stripped} upgrade token(s) stripped before feature arithmetic\n`);

/* ================================================ 1. which number knows the winner */

const FEATURES = {
  bodies:  (a, b) => totals(a).bodies - totals(b).bodies,
  hp:      (a, b) => totals(a).hp     - totals(b).hp,
  dps:     (a, b) => totals(a).dps    - totals(b).dps,
  paper:   (a, b) => totals(a).paper  - totals(b).paper,
  armour:  (a, b) => totals(a).arm    - totals(b).arm,
  pierce:  (a, b) => pierce(a, b)     - pierce(b, a),
  counter: (a, b) => counterEdge(a, b),
};

const coinRand = rng(4242);
const CONTROLS = {
  'coin — knows nothing': () => coinRand() - 0.5,
  'oracle — told the answer': (a, b, r) => (r.p >= 0.5 ? 1 : -1),
};

function agreement(fn) {
  let hit = 0, n = 0;
  for (const p of pairs) {
    if (!p.r.decisive) continue;        // an undecided pairing has no winner to agree with
    const v = fn(p.a, p.b, p.r);
    if (v === 0) continue;              // a feature that abstains is not scored either way
    const winner = p.r.p >= 0.95 ? 0 : 1;
    if ((v > 0 ? 0 : 1) === winner) hit++;
    n++;
  }
  return { pct: n ? hit / n : 0, n };
}

const row = (name, r) =>
  `   ${name.padEnd(26)}${(r.pct * 100).toFixed(1).padStart(7)}%   ${String(r.n).padStart(4)} scored`;

console.log('1. WHICH PRE-BATTLE NUMBER ALREADY KNOWS THE WINNER');
console.log('   Of the decided pairings only. 50% is knowing nothing — and BELOW 50%');
console.log('   is not noise, it is the same knowledge with the sign reversed.\n');
for (const [n, f] of Object.entries(CONTROLS)) console.log(row(n, agreement(f)));
console.log('   ' + '-'.repeat(48));
const agree = {};
for (const [n, f] of Object.entries(FEATURES)) {
  const r = agreement(f);
  agree[n] = r.pct;
  console.log(row(n, r));
}

const ranked = Object.entries(agree).sort((x, y) => Math.abs(y[1] - 0.5) - Math.abs(x[1] - 0.5));
console.log(`\n   furthest from knowing nothing: ${ranked.map(([n, v]) =>
  `${n} ${(v * 100).toFixed(0)}%`).slice(0, 3).join(', ')}\n`);

/* ============================================ 2. what happens when it is level */

console.log('2. THE SAME PAIRINGS, SPLIT BY HOW LEVEL EACH FEATURE IS');
console.log('   Quartiles of |feature|, most-level quarter first. A feature that is the');
console.log('   cause should leave its most-level quarter much less decided.\n');
console.log('   feature      most level ->                              least level');
console.log('   ' + '-'.repeat(64));

for (const [name, fn] of Object.entries(FEATURES)) {
  const scored = pairs.map(p => ({ v: Math.abs(fn(p.a, p.b, p.r)), d: p.r.decisive }))
                      .sort((x, y) => x.v - y.v);
  const q = Math.floor(scored.length / 4);
  const cells = [];
  for (let i = 0; i < 4; i++) {
    const s = scored.slice(i * q, i === 3 ? scored.length : (i + 1) * q);
    cells.push(`${(s.filter(x => x.d).length / s.length * 100).toFixed(0)}% (n=${s.length})`);
  }
  console.log(`   ${name.padEnd(12)}${cells.map(c => c.padEnd(13)).join('')}`);
}
console.log('');

/* ================================================= 3. the rule-out arms */
// The engine holds no cached specs -- `specFor` reads BY_ID live and returns the
// unit object itself when nothing modifies it -- so a rule can be switched off
// by editing the unit table in memory, the SAME pairings re-fought, and the
// decisive rate compared against the control. Every arm restores what it changed.

const save = () => DRAFT.map(u => ({ u, arm: u.arm, defl: u.defl, dmg: u.dmg, splash: u.splash }));
const restore = s => s.forEach(o => {
  o.arm === undefined ? delete o.u.arm : (o.u.arm = o.arm);
  o.defl === undefined ? delete o.u.defl : (o.u.defl = o.defl);
  o.u.dmg = o.dmg;
  o.splash === undefined ? delete o.u.splash : (o.u.splash = o.splash);
});

const ARMS = [
  ['NO-OP (control that changes nothing)', () => {}],
  ['armour off — no flat per-hit subtraction', () => DRAFT.forEach(u => { delete u.arm; })],
  ['deflection off — the Kraken shield rule', () => DRAFT.forEach(u => { delete u.defl; })],
  ['splash off — no area damage at all', () => DRAFT.forEach(u => { delete u.splash; })],
  ['armour AND deflection off', () => DRAFT.forEach(u => { delete u.arm; delete u.defl; })],
  ['LOUD (control that must move it) — every card hits for 400', () => DRAFT.forEach(u => { u.dmg = 400; })],
];

console.log('3. RULE-OUT ARMS — one rule of the resolver off, the same pairings re-fought');
console.log('   "battles changed" is how many of the individual battles came out');
console.log('   differently from the control. An arm that changes NO battles has not');
console.log('   reached the resolver, and its 0pt is a no-op rather than a finding.\n');
console.log('   arm                                          decided     vs control   battles changed');
console.log('   ' + '-'.repeat(88));

const flat = control.results.map(r => r.p);
for (const [label, apply] of ARMS) {
  const s = save();
  apply();
  const m = measure(pairs);
  restore(s);

  const moved = m.results.filter((r, i) => r.p !== flat[i]).length;
  const delta = (m.rate - control.rate) * 100;
  console.log(`   ${label.padEnd(45)}${(m.rate * 100).toFixed(1).padStart(5)}%   ${((delta >= 0 ? '+' : '') + delta.toFixed(1) + 'pt').padStart(9)}   ${String(moved).padStart(5)} of ${m.n}`);
}

// THE TWO CONTROLS ARE ASSERTIONS, not decoration. Re-run them here rather than
// trusting the eye: a reader skims a table, and both of these have a value that
// is correct only in one place.
const noop = (() => { const s = save(); const m = measure(pairs); restore(s); return m; })();
const loud = (() => {
  const s = save(); DRAFT.forEach(u => { u.dmg = 400; });
  const m = measure(pairs); restore(s); return m;
})();

console.log('');
let bad = 0;
if (noop.rate === control.rate && noop.results.every((r, i) => r.p === flat[i]))
  console.log('   ok   the no-op arm reproduced the control exactly — the run is deterministic');
else { console.log('   FAIL the no-op arm did NOT reproduce the control. Nothing else here is safe.'); bad++; }

const loudMoved = loud.results.filter((r, i) => r.p !== flat[i]).length;
if (loudMoved > 0)
  console.log(`   ok   the loud arm reached the resolver — ${loudMoved} of ${loud.n} pairings changed`);
else { console.log('   FAIL the loud arm changed nothing, so the mutation never reached the resolver.'); bad++; }

/* ============================ 4. is "decided" the same thing as "one-sided"? */
// THE MOST IMPORTANT PART OF THIS FILE, and it questions the metric rather than
// the game.
//
// A pairing is called decided when the same side wins at least 95% of 8 seeds.
// The only thing those seeds vary is a positional jitter of +/-0.6 field units
// applied to each body at deployment -- under 1% of the field's width. Nothing
// else in the resolver is random: no to-hit roll, no damage spread, no initiative.
//
// So "decided 95/5" means THE RESULT SURVIVES A SUB-1% WOBBLE, which for a
// deterministic simulator is close to a tautology: two armies that are not
// near-identical will produce the same winner every time. It is a measure of
// REPEATABILITY, and it has been read as a measure of ONE-SIDEDNESS.
//
// Those are different claims and they come apart. A battle won with 2 bodies of
// 34 left is repeatable and is not a formality; a battle won with 30 of 34 left
// is both. The survivor margin can tell them apart and the win share cannot, so
// this splits the decided pairings by how much of itself the winner had left.

const decided = pairs.filter(p => p.r.decisive && p.r.kept !== null);
const kept = decided.map(p => p.r.kept).sort((x, y) => x - y);
const at = q => kept.length ? kept[Math.min(kept.length - 1, Math.floor(q * kept.length))] : NaN;
const band = (lo, hi) => kept.filter(k => k >= lo && k < hi).length;

console.log('4. IS "DECIDED" THE SAME THING AS "ONE-SIDED"?');
console.log('   Of the DECIDED pairings, how much of its own army the winner had left.');
console.log('   A formality keeps most of it. A close fight repeatably won keeps little.\n');
console.log(`   decided pairings scored : ${decided.length}`);
console.log(`   median survivors kept   : ${(at(0.5) * 100).toFixed(0)}%   (quartiles ${(at(0.25) * 100).toFixed(0)}% / ${(at(0.75) * 100).toFixed(0)}%)\n`);
console.log('   winner kept          pairings');
console.log('   ' + '-'.repeat(40));
for (const [lo, hi, tag] of [[0, 0.15, 'under 15%  — won on its last bodies'],
                             [0.15, 0.35, '15–35%'],
                             [0.35, 0.60, '35–60%'],
                             [0.60, 1.01, 'over 60%   — a formality']]) {
  const n = band(lo, hi);
  console.log(`   ${tag.padEnd(34)}${String(n).padStart(4)}  ${(n / decided.length * 100).toFixed(0)}%`);
}

// THE TWO NUMBERS SIDE BY SIDE, derived here rather than left for a reader to
// work out, because the whole point is that they are not the same number and
// one of them has been standing in for the other.
const formalities = band(0.60, 1.01);
console.log(`\n   of all ${pairs.length} pairings:`);
console.log(`     ${control.decisive} (${(control.rate * 100).toFixed(0)}%) are DECIDED   — the same side wins a sub-1% wobble`);
console.log(`     ${formalities} (${(formalities / pairs.length * 100).toFixed(0)}%) are FORMALITIES — decided AND the winner kept most of its army`);
console.log('');

/* ================== 5. how much help does the losing side actually need? */
// The question part 4 opened. The project's standing explanation for its dead
// battle-side boosters is that a round was already decided before it started,
// so nothing happening inside it could matter. Part 4 says that is true of 12%
// of pairings rather than 59%, which puts the explanation in question and NOT
// the measurements -- the revive really did score +0.13 and +0.10.
//
// So ask the general question instead of rebuilding one booster: HOW BIG DOES AN
// ADVANTAGE INSIDE A BATTLE HAVE TO BE BEFORE A DECIDED PAIRING STOPS BEING
// DECIDED? If a large one barely moves anything, then every battle-side effect
// is structurally dead and the revive was never going to work at any size, which
// is an answer about the game. If a small one flips a third of them, there is
// room in there and the revive died of its own design.
//
// The dose is the upgrade rule, because it already exists, it is already
// per-side, and it is the only per-side strength dial in the engine that does
// not change the number of bodies: +35% health AND damage per level, to three.
// It is applied to the side that LOST -- the direct form of the question, rather
// than buffing an arbitrary side and reading the average.
//
// LEVEL 0 IS THE NO-OP and must flip nothing at all.

const lose = pairs.filter(p => p.r.decisive);

// The ladder is in FRACTIONS OF AN ARMY, not in levels, because a level is a
// large dose and the interesting question is where the threshold sits relative
// to what a booster is actually worth. Upgrading one card of nine moves roughly
// a ninth of the army by 35%; a revive that stands one body of thirty-odd back
// up once a round is smaller than that, so the bottom of this ladder is still
// generous to it. Which card is arbitrary and deterministic: the first distinct
// id in the list, so the run reproduces.
const upSome = (army, levels, howMany) => {
  if (!levels || !howMany) return army;
  const out = [...army];
  const ids = [...new Set(army)].slice(0, howMany === Infinity ? undefined : howMany);
  for (const id of ids) for (let i = 0; i < levels; i++) out.push('up:' + id);
  return out;
};

const DOSES = [
  ['nothing (no-op)',            0, 0],
  ['one card, +35%',             1, 1],
  ['three cards, +35%',          1, 3],
  ['every card, +35%',           1, Infinity],
  ['every card, +70%',           2, Infinity],
];

console.log('5. HOW MUCH HELP DOES THE LOSING SIDE NEED?');
console.log('   The decided pairings re-fought with the LOSER upgraded: +35% health and');
console.log('   damage a level, on some or all of its cards. "rescued" means no longer');
console.log('   decided against it; "won" means decided the other way.\n');
console.log('   the loser gets           rescued        won outright   still decided against it');
console.log('   ' + '-'.repeat(78));

for (const [tag, lv, many] of DOSES) {
  let rescued = 0, won = 0;
  for (const p of lose) {
    const aLost = p.r.p <= 0.05;
    const a = aLost ? upSome(p.a, lv, many) : p.a;
    const b = aLost ? p.b : upSome(p.b, lv, many);
    const r = fight(a, b, [totals(p.a).bodies, totals(p.b).bodies]);
    const loserShare = aLost ? r.p : 1 - r.p;
    if (loserShare >= 0.95) won++;
    else if (loserShare > 0.05) rescued++;
  }
  const still = lose.length - rescued - won;
  const pc = n => `${String(n).padStart(4)} (${(n / lose.length * 100).toFixed(0)}%)`;
  console.log(`   ${tag.padEnd(25)}${pc(rescued)}${' '.repeat(7)}${pc(won)}${' '.repeat(8)}${pc(still)}`);
  if (lv === 0 && (rescued || won)) { console.log('   FAIL the no-op dose changed a pairing, so this table is not measuring the dose.'); bad++; }
}
console.log(`\n   scored over ${lose.length} decided pairings\n`);

// WHAT THIS RUN COVERED, not merely that it finished.
console.log(`\n   covered: ${pairs.length} pairings x ${SEEDS} seeds x ${ARMS.length} arms = ${pairs.length * SEEDS * ARMS.length} battles`);
console.log(`   plus the counter matrix: ${IDS.length} x ${IDS.length} cards over 4 seeds\n`);

process.exit(bad ? 1 : 0);
