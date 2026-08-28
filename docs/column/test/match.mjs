// Does the MATCH work? — Sam's round structure, measured.
//
// matchup.mjs asks whether the units counter each other. This asks the two
// questions that only the whole structure can answer, and they are the second
// half of the go/no-go:
//
//   1. IS THE RUBBER BAND AN OSCILLATOR? The loser of a round gets an extra
//      pick, so the loser is permanently ahead on card count — 6 against 7 by
//      round two, and compounding. If that is too strong, losing a round is how
//      you win the next one, every match runs to 5-4, and the first rounds do
//      not matter. Measured as the chance the winner of round N also wins N+1:
//      pure oscillation is 0%, pure snowball is 100%.
//
//   2. DOES COMPOSITION CREATE THE CLOSENESS THAT SINGLE MATCHUPS LACK?
//      76% of one-card-type pairings are decided 95/5 or harder. If mixed
//      armies are decided just as hard, the game is settled at the draft and
//      the battle is a formality. If they are not, the closeness lives in
//      composition, which is where a drafting game wants it.
//
// It also prints how long a match runs and how big the armies get, because
// round nine is roughly thirty bodies a side on a portrait phone and legibility
// is the step Sam's loop hangs on.
//
// The harness seats ONE human policy against ONE named persona, at the real
// number of lives, with the composition printed beside every figure. sweep.mjs
// in the Ledger seated two humans for its entire life while Sam plays one
// against three, so every conquest figure in that repository described a game
// he does not play. That is the most expensive mistake in this record.
//
// Run:  node docs/column/test/match.mjs [matches]

import { UNITS, BY_ID, RULES } from '../data.js';
import { playMatch, resolve, rng, offer } from '../engine.js';

const N = +process.argv[2] || 200;
const HUMAN = 'house';
const AGAINST = ['counter', 'varan', 'harlow', 'hale', 'leader'];
const bodies = cards => cards.reduce((n, id) => n + (BY_ID[id].count || 1), 0);

console.log(`\n${N} matches per table · ${RULES.lives} lives · ${RULES.picksPerRound} picks a round ` +
            `· loser opens with ${RULES.loserBonusPicks} extra\n`);
console.log('table                        human wins   rounds   alternation  final bodies   longest round');
console.log('─'.repeat(92));

let worstAlt = null, biggest = 0, edgeWin = 0, straightWin = 0, thrownWin = 0;

for (const persona of AGAINST) {
  let humanWins = 0, rounds = 0, alt = 0, altN = 0, army = 0, longest = 0;

  for (let m = 0; m < N; m++) {
    const r = playMatch({ a: HUMAN, b: persona, seed: m * 31 + 5 });
    if (r.winner === 0) humanWins++;
    rounds += r.rounds.length;
    // BODIES, not cards. A card deploys up to ten of them and it is bodies that
    // have to be told apart on a 393pt-wide screen. The first version of this
    // check counted cards and would have reported a legible field at roughly
    // three times the real crowd.
    army += bodies(r.army[0]) + bodies(r.army[1]);
    for (const rd of r.rounds) longest = Math.max(longest, rd.ticks);
    // Did the winner of round n also win round n+1?
    for (let i = 1; i < r.rounds.length; i++) {
      const prevWinner = 1 - r.rounds[i - 1].lost;
      const thisWinner = 1 - r.rounds[i].lost;
      if (prevWinner === thisWinner) alt++;
      altN++;
    }
  }

  const alternation = alt / altN;
  const avgArmy = army / (2 * N);
  biggest = Math.max(biggest, avgArmy);
  if (worstAlt === null || Math.abs(alternation - 0.5) > Math.abs(worstAlt - 0.5)) worstAlt = alternation;

  console.log(
    `one human vs ${persona.padEnd(8)}` +
    `${(humanWins / N * 100).toFixed(1).padStart(12)}%` +
    `${(rounds / N).toFixed(1).padStart(9)}` +
    `${(alternation * 100).toFixed(0).padStart(11)}%` +
    `${avgArmy.toFixed(1).padStart(13)}` +
    `${(longest / 10).toFixed(0).padStart(14)}s`
  );
}

console.log('\n"alternation" is how often the winner of a round also wins the next.');
console.log('100% is a snowball the extra pick cannot fix; 0% is an oscillator where');
console.log('losing is how you win. Neither is a game.\n');

/* ------------------------------------------- does composition make it close? */
// Random mixed armies of the size a mid-match round actually fields, against
// each other. Compared against the 95/5 figure for single-card-type pairings.
const rand = rng(99);
const SIZE = 9;
let decisive = 0, total = 0;
for (let i = 0; i < 400; i++) {
  const a = [], b = [];
  for (let k = 0; k < SIZE; k++) {
    a.push(offer(rand, 1)[0]);
    b.push(offer(rand, 1)[0]);
  }
  // Same pair of armies over several seeds: a pairing is "decisive" if the same
  // side wins nearly every time. One battle can only ever return 0 or 1.
  let wins = 0;
  const seeds = 8;
  for (let s = 0; s < seeds; s++) {
    const r = resolve(a, b, s * 37 + 3);
    if (r.winner === 0) wins++; else if (r.winner === null) wins += 0.5;
  }
  const p = wins / seeds;
  if (p <= 0.05 || p >= 0.95) decisive++;
  total++;
}
console.log(`mixed armies of ${SIZE} cards, 400 pairs over 8 seeds each:`);
console.log(`  ${decisive} of ${total} (${(decisive / total * 100).toFixed(0)}%) decided 95/5 or harder\n`);

/* ------------------------- does an extra card just win? (Sam's point 6) ------ */
// "number of cards drafted = probability of winning" is the thing the design is
// meant to refuse. Same random composition on both sides, then one extra card
// given to side 0. If that alone decides it, the draft is arithmetic.
{
  const r2 = rng(4242);
  let won = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const base = [];
    for (let k = 0; k < 8; k++) base.push(offer(r2, 1)[0]);
    const extra = offer(r2, 1)[0];
    const out = resolve([...base, extra], base, i * 13 + 1);
    if (out.winner === 0) won++;
    n++;
  }
  edgeWin = won / n;
  console.log(`one extra card against an otherwise identical army: wins ${(edgeWin * 100).toFixed(0)}% of 300\n`);
}

/* ---------------- is it worth losing on purpose? (Sam's point 5) ------------- */
// Sam asked for this by name. `thrower` deliberately loses its opening round to
// bank the extra pick, then plays to counter; `counter` plays straight from the
// first pick. Same opponent, same seeds. If throwing wins more, losing pays and
// the rule needs a guard -- and this is the Ledger's money-pump class of defect,
// which is why it is a sweep rather than a hunch.
{
  let straight = 0, thrown = 0;
  const M = 300;
  for (let m = 0; m < M; m++) {
    if (playMatch({ a: 'counter', b: 'varan', seed: m * 17 + 9 }).winner === 0) straight++;
    if (playMatch({ a: 'thrower', b: 'varan', seed: m * 17 + 9 }).winner === 0) thrown++;
  }
  straightWin = straight / M; thrownWin = thrown / M;
  console.log(`playing straight from pick one : ${(straightWin * 100).toFixed(1)}% of ${M} matches`);
  console.log(`throwing the opening round     : ${(thrownWin * 100).toFixed(1)}%\n`);
}

/* --------------------------------------------------------------------- claims */
let failed = 0;
const ok = m => console.log(` ok   ${m}`);
const bad = (m, why) => { failed++; console.log(`FAIL  ${m}`); (why || []).forEach(w => console.log(`        · ${w}`)); };

if (worstAlt >= 0.35 && worstAlt <= 0.65) ok(`the extra pick is neither a snowball nor an oscillator (worst table ${(worstAlt * 100).toFixed(0)}%)`);
else bad('the extra pick is neither a snowball nor an oscillator', [
  `worst table alternates at ${(worstAlt * 100).toFixed(0)}%, wanted 35-65%`,
  worstAlt > 0.65 ? 'winning a round predicts winning the next: the extra pick is too weak'
                  : 'losing a round predicts winning the next: the extra pick is too strong'
]);

if (biggest <= 40) ok(`a match ends with about ${biggest.toFixed(0)} bodies a side, which a portrait phone can still tell apart`);
else bad('the field stays legible on a phone', [
  `${biggest.toFixed(0)} bodies a side by the end, ${(biggest * 2).toFixed(0)} on screen`,
  `on a 393pt portrait field that is roughly ${Math.sqrt(393 * 550 / (biggest * 2)).toFixed(0)}pt of space each`
]);

// Sam's principle: decisive LOCAL counters, but rarely a single decisive counter
// to a whole composition. matchup.mjs checks the first half; this is the second.
if (decisive / total < 0.40) ok(`compositions are contested — only ${(decisive / total * 100).toFixed(0)}% of mixed armies settle 95/5`);
else bad('compositions are contested', [
  `${(decisive / total * 100).toFixed(0)}% of mixed nine-card armies settle 95/5`,
  'a composition decided as hard as a single matchup means the battle is a formality'
]);

if (edgeWin <= 0.70) ok(`an extra card is an advantage, not a result (${(edgeWin * 100).toFixed(0)}%)`);
else bad('an extra card is an advantage, not a result', [
  `one extra card alone wins ${(edgeWin * 100).toFixed(0)}% — card count is close to being the whole game`
]);

if (thrownWin <= straightWin + 0.03) ok(`losing on purpose does not pay (${(thrownWin * 100).toFixed(1)}% against ${(straightWin * 100).toFixed(1)}%)`);
else bad('losing on purpose does not pay', [
  `throwing the opening round wins ${(thrownWin * 100).toFixed(1)}% against ${(straightWin * 100).toFixed(1)}% playing straight`,
  'the extra pick is worth more than the round it costs'
]);

console.log(`\n${5 - failed} of 5 claims hold\n`);
process.exit(failed ? 1 : 0);
