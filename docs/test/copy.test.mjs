// Does the game still say true things about itself?
//
// Interface copy goes stale exactly the way board data does, and nothing
// complains when it happens. This repository has shipped it twice: a tithe
// sheet promising "squeeze harder and you earn more now" against a measured
// ₡0.3 a turn, and — found by Sam playing v79 — "Holding them costs ₡80 every
// turn. Release one and that stops," where ₡80 was the player's WHOLE upkeep
// bill and most of it was garrisons that go on costing exactly what they cost.
//
// The number was right. The sentence attached to it was false, which is worse
// than a stale number: a stale number is wrong once, a false sentence tells you
// the wrong thing about a decision you are making.
//
// WHAT THIS CAN AND CANNOT DO. It cannot read English. What it can do is refuse
// the mechanism by which copy goes stale: a figure written into a screen as a
// literal instead of read from the rule that decides it. Every literal below
// was a real one in ui.js, and one of them (the debt interest) had already
// drifted out of date in meaning while its digits stayed correct.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RULES, SETS } from '../data.js';
import { createGame, upkeep, vassalUpkeep, releaseSaving, vassalStep } from '../engine.js';

const src = readFileSync(fileURLToPath(new URL('../ui.js', import.meta.url)), 'utf8');

// Comments are where the measurements and the history live, and they are full
// of figures on purpose. Only what the player can actually read is in scope.
// WHITESPACE NORMALISED, because a template literal wraps wherever the line got
// long and a pattern looking for "3 a game" will not match "3\n      a game".
// One pattern here silently could not fire for exactly that reason, which is a
// check that passes while covering nothing -- the failure mode this file is
// full of warnings about.
const prose = src
  .split('\n')
  .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join(' ')
  .replace(/\s+/g, ' ');

// Each entry: a rule, and a pattern that would only match if a screen had
// written that rule's value out by hand instead of reading it.
const LITERALS = [
  ['RULES.debtInterest', /marker at 10%/, 'the debt interest'],
  ['RULES.debtCap', /capped at ₡200\b/, 'the debt cap'],
  ['RULES.passGo', /collecting ₡200\b/, 'the lap payment'],
  ['RULES.startingCash', /dealt ₡2,?000\b/, 'the starting purse'],
  ['RULES.facilityFee', /pays ₡150 and is released/, 'the facility fee'],
  // Added with the guide in v84, which quotes more of the rulebook than any
  // other screen and is therefore the most likely thing in the game to go
  // stale. Every one of these is a figure it states.
  ['RULES.amendCosts', /₡500, then ₡700, then ₡900/, 'the amend fees'],
  ['RULES.amendsPerGame', /\b3 a game\b/, 'how many amends a game'],
  ['RULES.titheRates', /10% \/ 25% \/ 40% \/ 55%/, 'the tithe rates'],
  ['RULES.tradeMax', /Up to 3 squares each way/, 'the contract limit'],
  ['RULES.facilityAttempts', /after 3 attempts/, 'the detention attempts'],
  ['RULES.mortgageRedeem…', /Redeeming costs 55%/, 'the redemption rate'],
  ['RULES.vassalUpkeep', /₡40 \/ ₡100 \/ ₡190 \/ ₡250/, 'the vassal upkeep ladder'],
  ['G.rates.garrison', /keeps for ₡5 a turn/, 'the garrison upkeep']
];

for (const [rule, pattern, what] of LITERALS) {
  test(`the interface does not write out ${what}`, () => {
    const hit = prose.match(pattern);
    assert.equal(hit, null,
      `ui.js states ${what} as a literal ("${hit && hit[0]}") — read ${rule} instead, `
      + 'or it will go on saying the old figure after the rule moves');
  });
}

// The specific sentence Sam found, held as a property rather than as text: the
// vassal line is a PART of the upkeep bill, so anything offering to end it must
// be quoting the part and not the total. If these two are ever equal for a
// player who has built anything, the sheet cannot tell them apart.
test('the vassal upkeep is a part of the bill, not the whole of it', () => {
  const seats = [{ name: 'A', kind: 'human' }, { name: 'B', kind: 'ai', persona: 'spector' }];
  const G = createGame({ seats, seed: 1 });
  const [me, them] = G.players;
  them.lord = me.i; me.vassals.push(them.i);
  const sq = SETS.eden.sq[0];
  me.holdings = [{ sq, garrisons: 3, citadel: 0, mortgaged: 0 }];

  assert.ok(vassalUpkeep(G, me) > 0, 'holding somebody costs something');
  assert.ok(upkeep(G, me) > vassalUpkeep(G, me),
    'a player with garrisons pays more than their vassal line — a screen quoting '
    + 'the total as the cost of the vassal is overstating what releasing them saves');
  assert.equal(upkeep(G, me), vassalUpkeep(G, me) + 3 * RULES.garrisonUpkeep,
    'and the two parts account for the whole bill');
});

test('releasing a vassal saves the step down, not the whole vassal line', () => {
  // The bill is charged by COUNT, so the second vassal costs the difference
  // between the two rates rather than the same again. A sheet promising the
  // whole line back would overstate it for anybody holding more than one.
  const seats = [1, 2, 3, 4].map(i =>
    ({ name: 'P' + i, kind: i === 1 ? 'human' : 'ai', persona: 'spector' }));
  const G = createGame({ seats, seed: 1 });
  const [me, a, b] = G.players;
  for (const v of [a, b]) { v.lord = me.i; me.vassals.push(v.i); }

  assert.equal(releaseSaving(G, me), RULES.vassalUpkeep[1] - RULES.vassalUpkeep[0],
    'holding two, letting one go saves the step between the two rates');
  assert.ok(releaseSaving(G, me) < vassalUpkeep(G, me),
    'which is less than the whole vassal line');

  me.vassals = [a.i]; b.lord = null;
  assert.equal(releaseSaving(G, me), RULES.vassalUpkeep[0],
    'holding one, letting them go ends the line entirely');
});

// The competing-claim sheet asks the step from both ends: what the vassal a
// player already holds is costing them, and what taking one more would cost.
// They are the same arithmetic and the first version of the sheet used one
// figure for both, which is right only for a challenger holding nobody.
test('the vassal step is the cost of the n-th vassal, from either end', () => {
  const seats = [1, 2, 3, 4].map(i =>
    ({ name: 'P' + i, kind: i === 1 ? 'human' : 'ai', persona: 'spector' }));
  const G = createGame({ seats, seed: 1 });
  const v = G.rates.vassal;

  assert.equal(vassalStep(G, 0), 0, 'holding nobody, there is no step');
  assert.equal(vassalStep(G, 1), v[0], 'the first costs the first rate');
  assert.equal(vassalStep(G, 2), v[1] - v[0], 'the second costs the difference');
  assert.equal(vassalStep(G, 3), v[2] - v[1]);
  assert.notEqual(vassalStep(G, 2), vassalStep(G, 1),
    'the steps must differ, or a sheet using one for both could not be wrong');

  // Releasing is the step at your CURRENT count; taking one more is the step
  // above it. A sheet quoting the same number for both overstates one of them.
  const [me, a, b] = G.players;
  for (const x of [a, b]) { x.lord = me.i; me.vassals.push(x.i); }
  assert.equal(releaseSaving(G, me), vassalStep(G, 2), 'letting one of two go');
  assert.equal(vassalStep(G, me.vassals.length + 1), vassalStep(G, 3), 'taking a third');
});
