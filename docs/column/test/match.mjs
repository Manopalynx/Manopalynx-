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

import { UNITS, BY_ID, RULES, UPGRADE } from '../data.js';
import { playMatch, resolve, rng, offer, armyFrom, isUp } from '../engine.js';

const N = +process.argv[2] || 200;
const HUMAN = 'house';
const AGAINST = ['counter', 'varan', 'harlow', 'hale', 'leader'];
// A draft is pick TOKENS, and an upgrade token puts nothing on the field. Count
// through armyFrom rather than restating the rule: this figure is the one the
// legibility claim rests on, and a second copy of a rule is how it goes wrong.
const bodies = picks => armyFrom(picks).cards.reduce((n, id) => n + (BY_ID[id].count || 1), 0);
const upShare = picks => picks.filter(isUp).length / (picks.length || 1);

console.log(`\n${N} matches per table · ${RULES.lives} lives · ${RULES.picksPerRound} picks a round ` +
            `· loser opens with ${RULES.loserBonusPicks} extra\n`);
console.log('table                        human wins   rounds   alternation  final bodies   upgrades   longest round');
console.log('─'.repeat(104));

let worstAlt = null, biggest = 0, edgeWin = 0, straightWin = 0, thrownWin = 0, ups = 0, upsN = 0;

for (const persona of AGAINST) {
  let humanWins = 0, rounds = 0, alt = 0, altN = 0, army = 0, longest = 0, up = 0;

  for (let m = 0; m < N; m++) {
    const r = playMatch({ a: HUMAN, b: persona, seed: m * 31 + 5 });
    if (r.winner === 0) humanWins++;
    rounds += r.rounds.length;
    // BODIES, not cards. A card deploys up to ten of them and it is bodies that
    // have to be told apart on a 393pt-wide screen. The first version of this
    // check counted cards and would have reported a legible field at roughly
    // three times the real crowd.
    army += bodies(r.army[0]) + bodies(r.army[1]);
    up += (upShare(r.army[0]) + upShare(r.army[1])) / 2;
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
  const upPicks = up / N;
  ups += up; upsN += N;
  biggest = Math.max(biggest, avgArmy);
  if (worstAlt === null || Math.abs(alternation - 0.5) > Math.abs(worstAlt - 0.5)) worstAlt = alternation;

  console.log(
    `one human vs ${persona.padEnd(8)}` +
    `${(humanWins / N * 100).toFixed(1).padStart(12)}%` +
    `${(rounds / N).toFixed(1).padStart(9)}` +
    `${(alternation * 100).toFixed(0).padStart(11)}%` +
    `${avgArmy.toFixed(1).padStart(13)}` +
    `${(upPicks * 100).toFixed(0).padStart(10)}%` +
    `${(longest / 10).toFixed(0).padStart(15)}s`
  );
}

console.log('\n"alternation" is how often the winner of a round also wins the next.');
console.log('100% is a snowball the extra pick cannot fix; 0% is an oscillator where');
console.log('losing is how you win. Neither is a game.');
console.log(`"upgrades" is the share of picks spent making an existing card stronger`);
console.log(`rather than adding one -- at most ${UPGRADE.max} levels a card, +${(UPGRADE.step * 100).toFixed(0)}% health and damage each.\n`);

/* ------------------------------------------- does composition make it close? */
// Random mixed armies of the size a mid-match round actually fields, against
// each other. Compared against the 95/5 figure for single-card-type pairings.
const rand = rng(99);
const SIZE = 9;
let decisive = 0, total = 0, drawn = 0, fought = 0;
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
    if (r.winner === 0) wins++; else if (r.winner === null) { wins += 0.5; drawn++; }
    fought++;
  }
  const p = wins / seeds;
  if (p <= 0.05 || p >= 0.95) decisive++;
  total++;
}
console.log(`mixed armies of ${SIZE} cards, 400 pairs over 8 seeds each:`);
console.log(`  ${decisive} of ${total} (${(decisive / total * 100).toFixed(0)}%) decided 95/5 or harder`);
// A BATTLE THAT NEVER FINISHES READS AS A CLOSE ONE. Every "contested" figure in
// this file counts a draw as half a win, so unresolved battles quietly improve
// every number here. They did: the movement rule marched both armies straight
// through each other and out of the far wall, 28% of battles ended at the 3000
// tick ceiling, and the headline finding of the session before this one was
// substantially that artefact. This line is the guard.
console.log(`  ${(drawn / fought * 100).toFixed(0)}% of those battles ended in a draw at the tick ceiling\n`);

/* -------------- is numerical advantage NON-LINEAR? (Sam's point 6) ----------- */
// The point is not that an extra card should lose. It is that the SAME extra
// card should be worth less to a big army than to a small one -- otherwise the
// comeback pick compounds and the match is arithmetic. So measure the same
// advantage at every army size the match actually reaches, rather than picking
// one size and inventing a threshold for it, which is what this test did first.
const CURVE = [2, 4, 8, 12, 16];
const edge = {};
{
  console.log('army size   one extra card wins   a quarter more army wins');
  for (const size of CURVE) {
    const r2 = rng(4242);
    let one = 0, more = 0, n = 0;
    const extraN = Math.max(1, Math.round(size * 0.25));
    for (let i = 0; i < 200; i++) {
      const base = [];
      for (let k = 0; k < size; k++) base.push(offer(r2, 1)[0]);
      const ex = [];
      for (let k = 0; k < extraN; k++) ex.push(offer(r2, 1)[0]);
      if (resolve([...base, ex[0]], base, i * 13 + 1).winner === 0) one++;
      if (resolve([...base, ...ex], base, i * 13 + 7).winner === 0) more++;
      n++;
    }
    edge[size] = one / n;
    console.log(`${String(size).padStart(8)}   ${(one / n * 100).toFixed(0).padStart(18)}%` +
                `   ${(more / n * 100).toFixed(0).padStart(20)}%  (+${extraN})`);
  }
  edgeWin = edge[8];
  console.log('');
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

// Sam's point 6, stated as the thing he actually asked for: the same extra card
// must be worth LESS to a large army than to a small one.
const decline = edge[CURVE[0]] - edge[CURVE[CURVE.length - 1]];
if (decline >= 0.10) ok(`numerical advantage is non-linear — one extra card is worth ` +
  `${(edge[CURVE[0]] * 100).toFixed(0)}% at ${CURVE[0]} cards and ${(edge[CURVE[CURVE.length - 1]] * 100).toFixed(0)}% at ${CURVE[CURVE.length - 1]}`);
else bad('numerical advantage is non-linear', [
  `one extra card wins ${(edge[CURVE[0]] * 100).toFixed(0)}% at ${CURVE[0]} cards and still ` +
  `${(edge[CURVE[CURVE.length - 1]] * 100).toFixed(0)}% at ${CURVE[CURVE.length - 1]}: the advantage does not decay with army size`,
  'AOE and durability are meant to be what bends this, so this is the figure they are tuned against'
]);

// THE GUARD, not the instance. A battle that hits the tick ceiling is scored as
// half a win everywhere in this file, so unresolved battles flatter every other
// figure in it -- which is exactly how a movement rule that walked both armies
// off the field passed for a session as a balance improvement.
if (drawn / fought <= 0.05) ok(`battles resolve — ${(drawn / fought * 100).toFixed(0)}% draw at the tick ceiling`);
else bad('battles resolve', [
  `${(drawn / fought * 100).toFixed(0)}% of battles hit MAX_TICKS with both sides alive`,
  'every "contested" figure above counts a draw as half a win, so this inflates all of them'
]);

// SAM'S RULING, not a target this file invented. Throwing the opening round DOES
// pay once upgrades exist -- +4.3 points across 6,000 paired matches, positive
// against all four opponents -- and he has decided to leave it legitimate until
// he has played the game himself rather than guard it on a sweep's say-so. So
// the claim is no longer "it must not pay". It is "it must not be the only way
// to play": an edge a good player can take is a line, a 15-point edge is a
// dominant strategy and the first three rounds stop mattering.
const gap = thrownWin - straightWin;
if (gap <= 0.15) ok(`throwing the opening round is a line, not the only line ` +
  `(${(thrownWin * 100).toFixed(1)}% against ${(straightWin * 100).toFixed(1)}%, ${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)}pt)`);
else bad('throwing the opening round is a line, not the only line', [
  `throwing wins ${(thrownWin * 100).toFixed(1)}% against ${(straightWin * 100).toFixed(1)}% playing straight`,
  'an edge that large is not a strategy a player chooses, it is the strategy'
]);

const upRate = ups / upsN;
if (upRate >= 0.10 && upRate <= 0.50) ok(`upgrades are a real pick and not the only pick (${(upRate * 100).toFixed(0)}% of picks)`);
else bad('upgrades are a real pick and not the only pick', [
  `${(upRate * 100).toFixed(0)}% of picks are upgrades, wanted 10-50%`,
  upRate < 0.10 ? 'nobody takes them: an upgrade is not worth a pick, so the crowd never shrinks'
                : 'everybody takes them: reinforcement is dead and the army never grows'
]);

console.log(`\n${7 - failed} of 7 claims hold\n`);
process.exit(failed ? 1 : 0);
