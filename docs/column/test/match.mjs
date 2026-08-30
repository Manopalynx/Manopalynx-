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
//      86% of one-card-type pairings are decided 95/5 or harder. If mixed
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

import { UNITS, BY_ID, RULES, UPGRADE, SHOP, RUN, BOOSTS } from '../data.js';
import { playMatch, playRun, resolve, rng, offer, armyFrom, isUp,
         stock, spend, buyFor } from '../engine.js';

const N = +process.argv[2] || 200;
const HUMAN = 'house';
// THE FIVE PERSONAS THE RUN ACTUALLY SEATS, and no duplicate. This list read
// ['counter','varan','harlow','hale','leader'] for its whole life, and `counter`
// is a one-line alias of `varan` in POLICIES -- so two of the five rows were the
// same policy printing identical figures to the digit, 200 matches spent
// re-measuring a row that was already on screen, while `vex` (the run's FIRST
// opponent) was never measured at all. Derived from RUN.order rather than typed,
// so the table cannot drift from the sequence a run actually plays.
const AGAINST = [...RUN.order];
// A draft is pick TOKENS, and an upgrade token puts nothing on the field. Count
// through armyFrom rather than restating the rule: this figure is the one the
// legibility claim rests on, and a second copy of a rule is how it goes wrong.
const bodies = picks => armyFrom(picks).cards.reduce((n, id) => n + (BY_ID[id].count || 1), 0);
const upShare = picks => picks.filter(isUp).length / (picks.length || 1);

console.log(`\n${N} matches per table · ${RULES.lives} lives · ${RULES.picksPerRound} picks a round ` +
            `· loser opens with ${RULES.loserBonusPicks} extra\n`);
console.log('table                        human wins   rounds   alternation  final bodies   upgrades   earned   longest round');
console.log('─'.repeat(118));

let worstAlt = null, worstAltN = 0, biggest = 0, edgeWin = 0, straightWin = 0, thrownWin = 0, ups = 0, upsN = 0;
let worstThrow = -1, worstThrowOpp = '';

for (const persona of AGAINST) {
  let humanWins = 0, rounds = 0, alt = 0, altN = 0, army = 0, longest = 0, up = 0, earned = 0;

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
    // What a match pays out in total, both sides. The market is priced against
    // this number and against nothing else.
    for (const rd of r.rounds) earned += rd.paid[0] + rd.paid[1];
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
  if (worstAlt === null || Math.abs(alternation - 0.5) > Math.abs(worstAlt - 0.5)) {
    worstAlt = alternation; worstAltN = altN;
  }

  console.log(
    `one human vs ${persona.padEnd(8)}` +
    `${(humanWins / N * 100).toFixed(1).padStart(12)}%` +
    `${(rounds / N).toFixed(1).padStart(9)}` +
    `${(alternation * 100).toFixed(0).padStart(11)}%` +
    `${avgArmy.toFixed(1).padStart(13)}` +
    `${(upPicks * 100).toFixed(0).padStart(10)}%` +
    `${(earned / N).toFixed(0).padStart(9)}` +
    `${(longest / 10).toFixed(0).padStart(14)}s`
  );
}

console.log('\n"alternation" is how often the winner of a round also wins the next.');
console.log('100% is a snowball the extra pick cannot fix; 0% is an oscillator where');
console.log('losing is how you win. Neither is a game.');
console.log(`"upgrades" is the share of picks spent making an existing card stronger`);
console.log(`rather than adding one -- at most ${UPGRADE.max} levels a card, +${(UPGRADE.step * 100).toFixed(0)}% health and damage each.`);
console.log(`"earned" is total credits paid across a match, both sides: a purse of ${SHOP.purse} to each side`);
console.log(`at a round's end, plus one a surviving body to the winner. A market opens every ${SHOP.every}`);
console.log(`rounds and both sides spend.\n`);

/* ------------------------------------------- does composition make it close? */
// Random mixed armies of the size a mid-match round actually fields, against
// each other. Compared against the 95/5 figure for single-card-type pairings.
const rand = rng(99);
const SIZE = 9;
let decisive = 0, total = 0, drawn = 0, fought = 0, formality = 0;
for (let i = 0; i < 400; i++) {
  const a = [], b = [];
  for (let k = 0; k < SIZE; k++) {
    a.push(offer(rand, 1)[0]);
    b.push(offer(rand, 1)[0]);
  }
  // Same pair of armies over several seeds: a pairing is "decisive" if the same
  // side wins nearly every time. One battle can only ever return 0 or 1.
  let wins = 0, keptT = 0, keptN = 0;
  const seeds = 8;
  const start = [bodies(a), bodies(b)];
  for (let s = 0; s < seeds; s++) {
    const r = resolve(a, b, s * 37 + 3);
    if (r.winner === 0) wins++; else if (r.winner === null) { wins += 0.5; drawn++; }
    // HOW MUCH OF ITSELF THE WINNER HAD LEFT, from the resolver's own survivor
    // count, so this cannot report a margin the battle did not produce.
    if (r.winner !== null) { keptT += r.left[r.winner] / start[r.winner]; keptN++; }
    fought++;
  }
  const p = wins / seeds;
  if (p <= 0.05 || p >= 0.95) {
    decisive++;
    if (keptN && keptT / keptN > 0.60) formality++;
  }
  total++;
}
console.log(`mixed armies of ${SIZE} cards, 400 pairs over 8 seeds each:`);
console.log(`  ${decisive} of ${total} (${(decisive / total * 100).toFixed(0)}%) decided 95/5 or harder`);
// DECIDED IS NOT THE SAME THING AS ONE-SIDED, and the line above has been read
// as the second for five sessions. The eight seeds vary nothing but a +/-0.6
// field-unit deployment jitter -- under 1% of the field -- and there is no
// combat randomness anywhere, so "the same side wins 95% of 8 seeds" says the
// result survives a sub-1% wobble. That is REPEATABILITY. One-sidedness is
// whether the winner still had an army afterwards, and it is a different number:
// the median winner here keeps under half of its own. `test/settled.mjs` carries
// the whole finding, including that no rule of the resolver causes the figure
// above and that upgrading ONE card of the loser's nine rescues nearly half of
// these pairings.
//
// BOTH NUMBERS ARE PRINTED AND ONLY THE FIRST IS CLAIMED AGAINST. Which of them
// the game should be held to is a design decision and it is Sam's; re-aiming a
// red check at the number that passes would settle it by stealth.
console.log(`  ${formality} of ${total} (${(formality / total * 100).toFixed(0)}%) were FORMALITIES — decided and the winner kept over 60% of its army`);
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
//
// AGAINST ALL FIVE, and that is the whole correction. This measured `varan`
// alone for its entire life, and varan is the ONE opponent throwing does not
// beat: -0.5pt against it, +2.7 to +10.9 against the other four, +4.3 overall
// across 15,000 paired matches. So the check sat green on the single fixture
// where the effect vanishes -- the same fault as the persona table above, one
// row of which was a duplicate. A guard aimed at the case that does not show the
// defect is decoration, and this one was.
{
  const M = +process.env.THROW || 120;
  let sAll = 0, tAll = 0, n = 0;
  console.log('throwing the opening round, against each opponent:');
  for (const opp of RUN.order) {
    let s = 0, t = 0;
    for (let m = 0; m < M; m++) {
      if (playMatch({ a: 'counter', b: opp, seed: m * 17 + 9 }).winner === 0) s++;
      if (playMatch({ a: 'thrower', b: opp, seed: m * 17 + 9 }).winner === 0) t++;
    }
    sAll += s; tAll += t; n += M;
    const d = (t - s) / M;
    if (d > worstThrow) { worstThrow = d; worstThrowOpp = opp; }
    console.log(`  vs ${opp.padEnd(8)} straight ${(s / M * 100).toFixed(1)}%   thrown ${(t / M * 100).toFixed(1)}%` +
                `   ${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}pt`);
  }
  straightWin = sAll / n; thrownWin = tAll / n;
  console.log(`  ${'overall'.padEnd(11)} straight ${(straightWin * 100).toFixed(1)}%   thrown ${(thrownWin * 100).toFixed(1)}%` +
              `   ${thrownWin >= straightWin ? '+' : ''}${((thrownWin - straightWin) * 100).toFixed(1)}pt` +
              `   over ${n} paired matches, se about ${(Math.sqrt(0.5 / n) * 100).toFixed(1)}pt\n`);
}

/* -------------------- does every purchase actually buy something? ------------ */
// THE SWEEP, NOT THE INSTANCE. A shopper that buys a thing whose effect it did
// not write down will buy it again, and the engine will take the credits both
// times -- which is the Ledger's money pump with the sign reversed. It is not
// hypothetical: the first version of `buyFor` bought the same sabotage EIGHT
// times in one visit, because sabotage lands in a Set and it scored every
// candidate against a board it never updated. Nothing threw; the credits went.
//
// So the claim is the general one and it runs over BOTH shoppers: apply a
// policy's buys in order, and every one of them must move the state it claims to
// move. `armyFrom` is the arbiter, because it is what the resolver reads.
/* ------------------- the seat that plays like a person, and what it costs ---- */
// SAM'S NOTE 19. He played a run, bought nothing, and was still winning at match
// five; every figure this file had printed said a run is one to two matches. The
// page was checked first and agrees with the sweep to within noise, so the gap
// was never a defect -- it was that the harness had no seat that plays like him.
// `house` takes the first card offered and is a deliberate floor; `counter`
// scores a pick by fighting three copies of it against three of theirs.
//
// `ace` asks what a player asks -- what does the board look like AFTER this pick,
// against everything they actually hold -- and `buyFor` shops the same way, which
// is the first human shopping policy this project has ever had: `playMatch`
// called the opponent's `spend()` for BOTH sides for the whole life of the
// economy, so "should I buy a life?" had never been asked by a player once.
//
// OFF BY DEFAULT AND EXPENSIVE ON PURPOSE. A seat that drafts by resolving
// spends about 5ms a card of every offer of every pick, so a run is twelve
// seconds rather than thirty milliseconds. `ACE=40` is enough to separate the
// arms; the suite cannot afford it on every save and should not pretend to.
const ACE = +process.env.ACE || 0;
if (ACE) {
  const stat = out => {
    const mean = out.reduce((x, y) => x + y, 0) / out.length;
    const se = Math.sqrt(out.reduce((x, y) => x + (y - mean) ** 2, 0) / out.length / out.length);
    return { mean, se, best: Math.max(...out),
             three: 100 * out.filter(v => v >= 3).length / out.length,
             five: 100 * out.filter(v => v >= 5).length / out.length };
  };
  console.log(`\nhow far a run gets, by who is sitting in it — ${ACE} runs an arm`);
  console.log('seat                        matches survived    best  reached 3  reached 5');
  for (const [label, opt] of [
    ['house, the floor',      { a: 'house',   shop: ['ai', 'ai'] }],
    ['counter',               { a: 'counter', shop: ['ai', 'ai'] }],
    ['ace, never shops',      { a: 'ace',     shop: ['none', 'ai'], boost: 'ace' }],
    ['ace, plays the market', { a: 'ace',     shop: ['ace', 'ai'], boost: 'ace' }],
  ]) {
    const out = [];
    for (let s = 1; s <= ACE; s++) out.push(playRun({ ...opt, seed: s }).survived);
    const r = stat(out);
    console.log(`${label.padEnd(24)} ${r.mean.toFixed(2)} ±${r.se.toFixed(2)}`.padEnd(52) +
      `${String(r.best).padStart(4)}  ${r.three.toFixed(0).padStart(8)}%  ${r.five.toFixed(0).padStart(8)}%`);
  }
  // AND WHICH OPPONENT IS ACTUALLY HARD. The persona table in this file is the
  // FLOOR player's, so it says how hard each persona is for somebody who takes
  // whatever is in front of them. That is not the difficulty curve a run has.
  console.log(`\nmatch win rate against each opponent, floor seat against ace — ${ACE} matches each`);
  console.log('opponent      floor    ace');
  for (const opp of RUN.order) {
    const win = a => {
      let w = 0;
      for (let s = 1; s <= ACE; s++) w += playMatch({ a, b: opp, seed: s * 977 + 5 }).winner === 0 ? 1 : 0;
      return 100 * w / ACE;
    };
    console.log(`${opp.padEnd(12)} ${win('house').toFixed(0).padStart(4)}%  ${win('ace').toFixed(0).padStart(4)}%`);
  }
}

let pumpWhy = null, pumpN = 0;
{
  const r = rng(31337);
  let dud = null, applied = 0;
  const fingerprint = (mine, foe, lives, wide) => {
    const a = armyFrom(mine), b = armyFrom(foe);
    return JSON.stringify([a.cards.length, a.up, [...a.eq].sort(), [...a.ord].sort(),
                           [...b.sab].sort(), lives, wide]);
  };
  for (let i = 0; i < 40 && !dud; i++) {
    const mine = [], theirs = [];
    for (let k = 0; k < 7; k++) { mine.push(offer(r, 1)[0]); theirs.push(offer(r, 1)[0]); }
    mine.push(mine[0]);
    for (const money of [30, 55, 90, 150, 260, 400]) {
      for (const [who, shopper] of [['the opponent', spend], ['the player', buyFor]]) {
        let army = mine.slice(), foe = theirs.slice(), lives = 3, wide = 0, m = money;
        for (const buy of shopper(money, mine, lives, theirs, [])) {
          const was = fingerprint(army, foe, lives, wide);
          if (buy.k === 'life') lives++;
          else if (buy.k === 'upgrade') army.push('up:' + buy.id);
          else if (buy.k === 'card' || buy.k === 'special') army.push(buy.id);
          else if (buy.k === 'kit') army.push('eq:' + buy.id);
          else if (buy.k === 'order') army.push('ord:' + buy.id);
          else if (buy.k === 'sabotage') foe.push('sab:' + buy.id);
          else if (buy.k === 'offer') wide = 1;
          applied++;
          if (fingerprint(army, foe, lives, wide) === was)
            dud = `${who} bought ${buy.k}${buy.id ? ' ' + buy.id : ''} with ${money} and nothing changed`;
          if (dud) break;
        }
        if (dud) break;
      }
      if (dud) break;
    }
  }
  pumpWhy = dud; pumpN = applied;
}

/* -------------- can the opponent reach every shelf, and only the shelves? ---- */
// BOTH DIRECTIONS, because the action surface has two sides and this project has
// already been bitten by each of them. The shop grew an item the opponent could
// not buy TWICE; and in the Ledger, `sellDevelopment` was a player action no
// opponent had, which is why a money pump survived every sweep that existed.
//
// So: every kind `stock()` puts on the player's screen must be a kind `spend()`
// actually buys, and every kind `spend()` buys must be one `stock()` offers. An
// item only one side can reach is not a market, it is an asymmetry nobody wrote
// down -- and the shopper rewrite that made this true cost the opponent real
// strength, which is a price worth keeping something red about.
let shelfKinds = '', shelfWhy = [];
{
  const r = rng(90210);
  const shelved = new Set(), bought = new Set();
  // Real armies, not hand-typed ones: a shelf that depends on holding something
  // upgradeable or on the enemy fielding a target only appears against a draft.
  for (let i = 0; i < 60; i++) {
    const mine = [], theirs = [];
    for (let k = 0; k < 6; k++) { mine.push(offer(r, 1)[0]); theirs.push(offer(r, 1)[0]); }
    // A held card, so `upgrade` is reachable; the duplicate is what an upgrade needs.
    mine.push(mine[0]);
    for (const money of [15, 25, 35, 60, 90, 140, 220, 320]) {
      for (const lives of [1, 3, RULES.lives]) {
        stock(money, mine, lives, theirs, []).forEach(x => shelved.add(x.k));
        spend(money, mine, lives, theirs, []).forEach(x => bought.add(x.k));
      }
    }
  }
  const unreachable = [...shelved].filter(k => !bought.has(k));
  const unlisted = [...bought].filter(k => !shelved.has(k));
  shelfKinds = [...shelved].sort().join(', ');
  shelfWhy = [
    unreachable.length ? `on the player's screen, never bought by the opponent: ${unreachable.join(', ')}` : '',
    unlisted.length ? `bought by the opponent, never on the player's screen: ${unlisted.join(', ')}` : ''
  ].filter(Boolean);
  console.log(`market shelves reachable by both sides: ${shelfKinds}\n`);
}

/* ------------------- is any booster in the pool a dud? (the control) --------- */
// THE GUARD FOR A CLASS, NOT AN INSTANCE. A booster that changes nothing is
// invisible: the run still ends, the screen still names it, and nothing throws.
// So every booster in BOOSTS is measured the same way, and the pool cannot grow
// a dead option without this going red.
//
// THE CONTROL IS THE WHOLE POINT, and getting it right took three goes.
//
//   1. Ranked against EACH OTHER, three of the five read NEGATIVE and were nearly
//      cut: preferring a mediocre booster means not taking the best one, so
//      anything below the top of the pool reads as a loss. A ranking, not a value.
//   2. Against a run that takes NOTHING, all five read +0.63 to +1.63 -- but the
//      arm was "prefer X, take something else when X is not offered", so it was
//      still collecting real boosters. A booster id the engine does not implement
//      scores +0.58 at 2.9 standard errors in that arm. This check PASSED that
//      mutation, which is the only reason the flaw was found.
//   3. `prefer: X, take: -1` takes X when offered and nothing when it is not.
//      That is the arm subtracted from the control below, and a dead id now
//      measures zero in it, because it is the only arm where X is the only thing
//      that differs.
// THE SEAT AND THE UNIT ARE PART OF THE FIGURE. This measures a `counter` seat
// -- a competent drafter, not the `house` floor the tables above use -- and
// counts matches SURVIVED, not matches played. Both were left unstated when
// these numbers were first published, and a measured figure whose parameters are
// not written down is not reproducible: the same pool re-measured as played
// matches from the floor seat gives 2.43 against 1.67 and neither is wrong.
// SIZED AGAINST THE SMALLEST BOOSTER IN THE POOL, not against the clock. At 60
// an arm the Vanguard reads 2.2 standard errors, which is a fifth of a sigma
// above this claim's own 2-sigma bar -- a guard that close to its threshold is
// the flaky check this file has an entry about, and a real change either side of
// it would be unreadable. At 120 the same booster reads about 3, for about
// ninety seconds more. RUNS=300 is what a quoted figure is measured at.
// 300, NOT 120, AND THIS FILE ALREADY SAID SO -- the line above calls 300 what a
// quoted figure is measured at, and then measured the quoted figures at 120.
//
// At 120 runs the error bar on an arm is about +/-0.25 matches, so a real +0.22
// booster reads 1.9 sigma and the check calls it dead. That happened to The
// Ledger on the run that shipped it: 1.9 sigma at 120, 2.8 sigma at 300, same
// booster, same code. A check that cannot resolve the thing it is judging fails
// honest work and passes nothing extra.
//
// RUNS=120 still cuts it down for a smoke run; the default is now the standard.
const RUNS = +process.env.RUNS || 300;
// MEAN AND ITS ERROR, because "better than nothing" needs a bar and 0 is not one.
// A booster that does nothing measures 0 ± the noise, so a threshold of "above
// zero" catches a dead one about half the time -- which is a check that reads
// green on the defect it exists for. The bar is TWO standard errors of the
// difference instead. The seeds are fixed, so this is reproducible run to run;
// the error bar is about telling a real effect from a lucky one, not about the
// figure moving when nothing changed.
// AND THE ARM IS `force`, NOT `prefer`, which is a defect this file carried into
// every booster figure it has ever printed.
//
// `prefer` holds the booster only when it is among the three drawn. With a pool
// of three that was almost always; with five it is three times in five, and with
// eight it would be three in eight -- so EVERY effect shrinks as the pool grows,
// for no reason but the size of the pool. That is exactly what was seen when the
// pool went three to four to five: The Compact read +0.30, then +0.38, then
// +0.28, then +0.19, and Field surgeons +0.32 down to +0.04, while neither
// booster changed at all.
//
// `engine.js` says this in its own comment beside the arms -- "the question a
// pool needs answered is what is this worth IF YOU HAVE IT" -- and this file was
// asking a different one. `force` holds it from the first match, so a figure is
// about the booster rather than about how often it was drawn.
const runLen = force => {
  const v = [];
  for (let i = 0; i < RUNS; i++) v.push(playRun({ a: 'counter', seed: i * 7 + 1, force, take: -1 }).survived);
  const m = v.reduce((a, b) => a + b, 0) / RUNS;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, RUNS - 1));
  return { m, se: sd / Math.sqrt(RUNS) };
};
console.log(`booster value — matches SURVIVED by a counter seat, ${RUNS} runs an arm`);
const control = runLen(null);
console.log(`  ${'taking nothing'.padEnd(18)} ${control.m.toFixed(2)}   (the control)`);
// EVERY dead one, not the first. Reporting one at a time turns a pool that needs
// re-cutting into a queue of single fixes, and the shape of the answer -- which
// KIND of booster is dead -- is only visible when they are listed together.
const deadBoosts = [];
for (const b of BOOSTS) {
  const v = runLen(b.id);
  const d = v.m - control.m, se = Math.hypot(v.se, control.se);
  console.log(`  ${b.n.padEnd(18)} ${v.m.toFixed(2)}   ${d >= 0 ? '+' : ''}${d.toFixed(2)}  (${(d / se).toFixed(1)}σ)`);
  // THE BAR IS BACK TO TWO STANDARD ERRORS ABOVE THE CONTROL, and the story of
  // it moving is worth keeping: it was relaxed to a floor on a reading that
  // turned out to be this file's own instrument. Field surgeons appeared to fade
  // from +0.32 to +0.04 as the pool grew, which looked like a booster going
  // stale and was the arm shrinking every effect. With `force` it is +0.21 at
  // 2.6 sigma and clears the original bar.
  //
  // A check relaxed to match a measurement that was wrong is worse than one left
  // red, so it is put back. If a deep pool ever genuinely wants texture below
  // this bar, that is a decision to take on a correct measurement rather than on
  // this one.
  if (d <= 2 * se)
    deadBoosts.push(`${b.n}: ${d >= 0 ? '+' : ''}${d.toFixed(2)} matches against taking nothing, ` +
                    `${(d / se).toFixed(1)}σ — not distinguishable from a booster that does nothing`);
}
console.log('');

/* --------------------------------------------------------------------- claims */
// Counted as they fire. A total typed at the bottom is a number written twice,
// and it had already gone wrong once in play.mjs.
let failed = 0, ran = 0;
const ok = m => { ran++; console.log(` ok   ${m}`); };
const bad = (m, why) => { ran++; failed++; console.log(`FAIL  ${m}`); (why || []).forEach(w => w && console.log(`        · ${w}`)); };

// THE FIGURE CARRIES ITS OWN ERROR. At 60 matches a table this read 62% and at
// 400 it reads 58.7% -- the same build, and the small sample was noise that
// looked like a balance problem worth acting on. A number without its error is
// a number you cannot decide anything with.
const altSE = Math.sqrt(worstAlt * (1 - worstAlt) / Math.max(1, worstAltN));
const altBand = `${(worstAlt * 100).toFixed(1)}% ±${(altSE * 100).toFixed(1)} over ${worstAltN} rounds`;
if (worstAlt >= 0.35 && worstAlt <= 0.65) ok(`the extra pick is neither a snowball nor an oscillator (worst table ${altBand})`);
else bad('the extra pick is neither a snowball nor an oscillator', [
  `worst table alternates at ${altBand}, wanted 35-65%`,
  altSE > 0.02 ? `that error bar is wide -- run this with more matches before acting on it` : '',
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
// pay, and re-measured on the current build -- after the market, the specials,
// the kit and the booster re-cut -- it pays exactly what it always did:
// +4.3 points across 15,000 paired matches, positive against four of the five
// personas and flat (-0.5pt) against varan. He has decided to leave it
// legitimate until he has played the game himself rather than guard it on a
// sweep's say-so. So
// the claim is no longer "it must not pay". It is "it must not be the only way
// to play": an edge a good player can take is a line, a 15-point edge is a
// dominant strategy and the first three rounds stop mattering.
// WHAT THE SAMPLE CAN SEE, checked before the threshold was. The natural claim is
// on the WORST opponent -- an edge that averages +4pt and is +15pt against one
// persona is a dominant line in every match against that persona. But at 120
// paired matches an opponent the standard error is about 6.5pt, so a 15pt bar on
// a single row is a coin toss dressed as a guard, and raising the sample until it
// is not costs about 12,000 matches. So the TRIGGER is the overall figure, where
// 600 paired matches give a standard error near 2pt, and the worst row is printed
// and named in the failure so a per-persona blow-up is still visible. The
// per-opponent spread itself is not news to be caught: +10.9pt against Harlow and
// -0.5pt against Varan is measured, documented and Sam's to rule on.
const gap = thrownWin - straightWin;
if (gap <= 0.15) ok(`throwing the opening round is a line, not the only line ` +
  `(+${(gap * 100).toFixed(1)}pt overall, worst +${(worstThrow * 100).toFixed(1)}pt vs ${worstThrowOpp})`);
else bad('throwing the opening round is a line, not the only line', [
  `against ${worstThrowOpp} throwing the opening round is worth +${(worstThrow * 100).toFixed(1)}pt, ` +
  `and +${(gap * 100).toFixed(1)}pt averaged over all five`,
  'an edge that large is not a strategy a player chooses, it is the strategy',
  'Sam left this legitimate until he had played the game; it is a decision, not a tuning miss'
]);

const upRate = ups / upsN;
if (upRate >= 0.10 && upRate <= 0.50) ok(`upgrades are a real pick and not the only pick (${(upRate * 100).toFixed(0)}% of picks)`);
else bad('upgrades are a real pick and not the only pick', [
  `${(upRate * 100).toFixed(0)}% of picks are upgrades, wanted 10-50%`,
  upRate < 0.10 ? 'nobody takes them: an upgrade is not worth a pick, so the crowd never shrinks'
                : 'everybody takes them: reinforcement is dead and the army never grows'
]);

if (!pumpWhy) ok(`every purchase changes the board — ${pumpN} applied, both shoppers`);
else bad('every purchase changes the board', [pumpWhy,
  'a purchase whose effect is not written down gets bought again, and paid for again']);

if (!shelfWhy.length) ok(`the opponent reaches every shelf and no others — ${shelfKinds}`);
else bad('the opponent reaches every shelf and no others', shelfWhy);

if (!deadBoosts.length) ok(`every booster beats taking none — the pool has no dead option (${BOOSTS.length} boosters, ${RUNS} runs an arm)`);
else bad(`the booster pool has no dead option — ${deadBoosts.length} of ${BOOSTS.length} do not clear the control`, [
  ...deadBoosts,
  'a booster that does not beat the control is a choice the player is asked to make for nothing',
  'which of these to cut, buff or keep as texture is a design decision, not a tuning miss']);

console.log(`\n${ran - failed} of ${ran} claims hold\n`);
process.exit(failed ? 1 : 0);
