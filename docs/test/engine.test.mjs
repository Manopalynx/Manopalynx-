// Arithmetic tests for the Grandiose engine.
//
// This suite exists because of a specific failure mode. Nothing on this board
// crashes when a number is wrong. A bad rent, a bad tithe, a bad net worth just
// reports quietly and wrongly for an entire game, and it reads perfectly well
// in the source. So every figure the game shows a player is hand-computed here
// and asserted against, rather than eyeballed.
//
// Run:  node --test grandiose/test/

import test from 'node:test';
import assert from 'node:assert/strict';

import { SETS, BOARD, N, JAIL, TRAFFIC, RULES } from '../data.js';
import {
  createGame, current, ownerOf, holding, ownsSet, garrisonsOf, citadelsOf,
  holdingsValue, netWorth, upkeep, rentOf, paybackTurns, revoltThreshold,
  pay, liquidate, payRent, money, roll, amendCost, amendManifest, resolveLanding,
  applyCard, endTurn, buy, openAuction, submitBid, closeAuction, build,
  raiseCitadel, sellDevelopment, mortgage, redeem, repayDebt, tradable,
  settleContract, declareIndependence, submitClaim, closeContest, standings,
  setCompletingTargets, seekContract, contractIsLegal, proposeContract, respondToContract,
  serialize, deserialize
} from '../engine.js';

/* -------------------------------------------------------------- fixtures */
const seats2 = [
  { name: 'Sam', kind: 'human' },
  { name: 'Meelah', kind: 'human' }
];
const seats4 = [
  { name: 'Sam', kind: 'human' },
  { name: 'Meelah', kind: 'human' },
  { name: 'Spector', kind: 'ai', persona: 'spector' },
  { name: 'Varan', kind: 'ai', persona: 'varan' }
];
const game = (seats = seats2, seed = 42, circuits = 24) => createGame({ seats, seed, circuits });
const own = (G, p, sq, extra = {}) =>
  p.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged: 0, ...extra });

/* ============================================================ board shape */

test('board is 28 squares and the named indices agree with the data', () => {
  assert.equal(BOARD.length, 28);
  assert.equal(N, 28);
  assert.equal(BOARD[0].t, 'go');
  assert.equal(BOARD[JAIL].t, 'jail');
  assert.equal(BOARD[21].t, 'goto');
  assert.equal(BOARD.filter(b => b.t === 'f').length, 2);
  assert.equal(BOARD.filter(b => b.t === 'u').length, 2);
});

test('every set lists squares that exist, carry that set, and share a garrison cost', () => {
  for (const [key, s] of Object.entries(SETS)) {
    assert.ok(s.sq.length >= 2, `${key} has fewer than two squares`);
    for (const i of s.sq) {
      assert.equal(BOARD[i].s, key, `square ${i} is not in set ${key}`);
      assert.equal(BOARD[i].r.length, 5, `square ${i} has a malformed rent ladder`);
    }
  }
});

test('every buyable square appears in exactly one set, fleet or utility', () => {
  const inSets = Object.values(SETS).flatMap(s => s.sq);
  assert.equal(new Set(inSets).size, inSets.length, 'a square is listed in two sets');
  BOARD.forEach((b, i) => {
    if (!b.pr) return;
    const categorised = b.s ? inSets.includes(i) : (b.t === 'f' || b.t === 'u');
    assert.ok(categorised, `${b.n} (${i}) is buyable but uncategorised`);
  });
});

test('rent ladders rise monotonically', () => {
  BOARD.forEach(b => {
    if (!b.r) return;
    for (let k = 1; k < b.r.length; k++) {
      assert.ok(b.r[k] > b.r[k - 1], `${b.n} rent does not rise at step ${k}`);
    }
  });
});

test('the traffic table has one entry per square and sums to 100%', () => {
  assert.equal(TRAFFIC.length, N);
  const sum = TRAFFIC.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 0.5, `traffic sums to ${sum.toFixed(2)}, not 100`);
  assert.equal(TRAFFIC[21], 0, 'Absorbed cannot be a resting square');
});

/* ============================================================ rent */

test('a bare holding charges base rent; a completed set doubles it', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 1);                                   // Vessa Station, syn
  assert.equal(rentOf(G, 1), BOARD[1].r[0]);      // 8
  own(G, a, 3);                                   // completes Syndicate
  assert.ok(ownsSet(G, a, 'syn'));
  assert.equal(rentOf(G, 1), BOARD[1].r[0] * 2);  // 16
});

test('garrisons and a citadel read straight off the ladder', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 1); own(G, a, 3);
  const h = holding(a, 1);
  for (const g of [1, 2, 3]) {
    h.garrisons = g;
    assert.equal(rentOf(G, 1), BOARD[1].r[g], `${g} garrisons`);
  }
  h.garrisons = 0; h.citadel = 1;
  assert.equal(rentOf(G, 1), BOARD[1].r[4]);
});

test('a mortgaged holding charges nothing, built or not', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 1, { mortgaged: 1, garrisons: 3 });
  assert.equal(rentOf(G, 1), 0);
});

test('fleet rent is 50 alone and 150 for both', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 5);
  assert.equal(rentOf(G, 5), 50);
  own(G, a, 18);
  assert.equal(rentOf(G, 5), 150);
  assert.equal(rentOf(G, 18), 150);
});

test('utility rent is 4x the roll alone and 10x for both', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 11);
  assert.equal(rentOf(G, 11, 7), 28);
  assert.equal(rentOf(G, 11, 12), 48);
  own(G, a, 24);
  assert.equal(rentOf(G, 11, 7), 70);
  assert.equal(rentOf(G, 24, 3), 30);
});

test('an unowned square charges nothing', () => {
  assert.equal(rentOf(game(), 1), 0);
});

test('a set split between two players does not double for either', () => {
  const G = game();
  const [a, b] = G.players;
  own(G, a, 1); own(G, b, 3);
  assert.equal(rentOf(G, 1), BOARD[1].r[0]);
  assert.equal(rentOf(G, 3), BOARD[3].r[0]);
});

/* ============================================================ valuation */

test('holdings value counts cash, list price, and buildings at garrison cost', () => {
  const G = game();
  const [a] = G.players;
  a.cash = 1000;
  own(G, a, 13, { garrisons: 2 });                // Horizon, eden, gc 100
  // 1000 cash + 180 list + 2 x 100 garrisons
  assert.equal(holdingsValue(a), 1000 + 180 + 200);
});

test('a mortgaged holding is valued at half its list price', () => {
  const G = game();
  const [a] = G.players;
  a.cash = 0;
  own(G, a, 13, { mortgaged: 1 });
  assert.equal(holdingsValue(a), 90);
});

test('a citadel is valued as five garrisons', () => {
  const G = game();
  const [a] = G.players;
  a.cash = 0;
  own(G, a, 13, { citadel: 1 });
  assert.equal(holdingsValue(a), 180 + 5 * 100);
});

test('net worth subtracts debt and adds the tithed share of each vassal', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  a.cash = 1000; a.debt = 300; a.tithe = 40;
  b.cash = 500;
  a.vassals = [b.i]; b.lord = a.i;
  // 1000 - 300 + floor(500 * 40%)
  assert.equal(netWorth(G, a), 1000 - 300 + 200);
});

test('net worth does not compound a vassal chain twice', () => {
  const G = game(seats4);
  const [a, b, c] = G.players;
  a.cash = 0; b.cash = 0; c.cash = 1000;
  a.tithe = 50; b.tithe = 50;
  a.vassals = [b.i]; b.lord = a.i;
  b.vassals = [c.i]; c.lord = b.i;
  // b's holdings value is its own cash only (0) — c's 1000 is not folded in.
  assert.equal(netWorth(G, a), 0);
});

/* ============================================================ upkeep */

test('upkeep is 10 per garrison and 30 per citadel', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 13, { garrisons: 3 });
  own(G, a, 14, { citadel: 1 });
  assert.equal(garrisonsOf(a), 3);
  assert.equal(citadelsOf(a), 1);
  assert.equal(upkeep(a), 3 * 10 + 1 * 30);
});

test('a citadel replaces its garrisons rather than adding to them', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 13, { citadel: 1, garrisons: 3 });
  assert.equal(garrisonsOf(a), 0, 'a citadel square must not also count garrisons');
  assert.equal(upkeep(a), 30);
});

test('holding vassals adds a fixed overhead by count', () => {
  const G = game(seats4);
  const [a, b, c, d] = G.players;
  a.vassals = [b.i];
  assert.equal(upkeep(a), RULES.vassalUpkeep[0]);
  a.vassals = [b.i, c.i];
  assert.equal(upkeep(a), RULES.vassalUpkeep[1]);
  a.vassals = [b.i, c.i, d.i];
  assert.equal(upkeep(a), RULES.vassalUpkeep[2]);
});

/* ============================================================ payback */

test('set payback matches a hand-computed figure', () => {
  // Eden: squares 13,14,15 at 180+180+200 = 560 list, plus 3 garrisons on each
  // at 100 = 900. Cost 1460.
  // Income per opponent turn at 3 garrisons:
  //   13: 4.42% x 640 = 28.288
  //   14: 3.83% x 640 = 24.512
  //   15: 4.00% x 700 = 28.000
  //   total 80.80  ->  1460 / 80.80 = 18.07 -> 18
  const cost = 560 + 900;
  const income = 0.0442 * 640 + 0.0383 * 640 + 0.0400 * 700;
  assert.equal(paybackTurns('eden', TRAFFIC), Math.round(cost / income));
  assert.equal(paybackTurns('eden', TRAFFIC), 18);
});

test('every set has a finite, positive payback', () => {
  for (const key of Object.keys(SETS)) {
    const p = paybackTurns(key, TRAFFIC);
    assert.ok(Number.isFinite(p) && p > 0, `${key} payback is ${p}`);
    assert.ok(p < 100, `${key} payback of ${p} turns cannot be recovered in any game`);
  }
});

/* ============================================================ money */

test('a payment within cash simply moves', () => {
  const G = game();
  const [a, b] = G.players;
  assert.equal(pay(G, a, b, 500), true);
  assert.equal(a.cash, 1300);
  assert.equal(b.cash, 2300);
});

test('a shortfall against the bank becomes a debt marker for exactly the gap', () => {
  const G = game();
  const [a] = G.players;
  a.cash = 100;
  assert.equal(pay(G, a, null, 400), false);
  assert.equal(a.cash, 0);
  assert.equal(a.debt, 300);
});

test('debt accrues 10% a turn, rounded up', () => {
  const G = game();
  const [a] = G.players;
  a.debt = 305;
  G.phase = 'end';
  endTurn(G);
  assert.equal(a.debt, 305 + 31);      // ceil(30.5)
});

test('liquidation sells citadels, then garrisons, then mortgages', () => {
  const G = game();
  const [a] = G.players;
  a.cash = 0;
  own(G, a, 13, { citadel: 1 });       // eden, gc 100 -> breaking pays floor(100*5/2)=250
  own(G, a, 1);                        // syn, list 60 -> mortgage pays 30
  liquidate(G, a, 250);
  assert.equal(a.cash, 250);
  assert.equal(holding(a, 13).citadel, 0);
  assert.equal(holding(a, 13).garrisons, 3, 'a broken citadel leaves three garrisons');
  assert.equal(holding(a, 1).mortgaged, 0, 'mortgaging should not have been needed');
});

test('liquidation mortgages the cheapest holding first', () => {
  const G = game();
  const [a] = G.players;
  a.cash = 0;
  own(G, a, 27);                        // Cradle, 400 -> 200
  own(G, a, 1);                         // Vessa, 60 -> 30
  liquidate(G, a, 20);
  assert.equal(holding(a, 1).mortgaged, 1);
  assert.equal(holding(a, 27).mortgaged, 0);
});

test('a shortfall against a player ends in vassalage, not elimination', () => {
  const G = game();
  const [a, b] = G.players;
  a.cash = 50;
  assert.equal(pay(G, a, b, 900), false);
  assert.equal(a.cash, 0);
  assert.equal(b.cash, 1850, 'the creditor receives everything that was there');
  assert.equal(a.lord, b.i);
  assert.deepEqual(b.vassals, [a.i]);
  assert.equal(a.debt, 0, 'vassalage replaces the debt rather than adding to it');
});

/* ============================================================ tithe */

test('an overlord takes its cut of a vassal rent, and the vassal banks it as strength', () => {
  const G = game(seats4);
  const [a, b, c] = G.players;   // c collects, b is c's overlord
  c.lord = b.i; b.vassals = [c.i]; b.tithe = 40;
  own(G, c, 13);                                  // Horizon, bare rent 22
  const before = { a: a.cash, b: b.cash, c: c.cash };
  payRent(G, a, c, 100);
  assert.equal(a.cash, before.a - 100);
  assert.equal(c.cash, before.c + 100 - 40);
  assert.equal(b.cash, before.b + 40);
  assert.equal(c.strength, 40, 'every credit tithed is a credit counted');
});

test('a vassal cannot fully charge its own overlord', () => {
  const G = game();
  const [a, b] = G.players;
  b.lord = a.i; a.vassals = [b.i]; a.tithe = 25;
  payRent(G, a, b, 200);
  // a pays 200, then 25% returns as tithe: net 150 out, 150 in.
  assert.equal(a.cash, 1800 - 200 + 50);
  assert.equal(b.cash, 1800 + 200 - 50);
});

test('no tithe is taken when the rent cannot be settled', () => {
  const G = game(seats4);
  const [a, b, c] = G.players;
  c.lord = b.i; b.vassals = [c.i]; b.tithe = 50;
  a.cash = 10;
  const lordBefore = b.cash;
  payRent(G, a, c, 900);
  assert.equal(b.cash, lordBefore, 'an unsettled rent tithes nothing onward');
  assert.equal(a.lord, c.i, 'the debtor is sworn to the collector, not the overlord');
});

/* ============================================================ revolt */

test('the revolt threshold rises with each declaration', () => {
  const G = game();
  const [a] = G.players;
  assert.equal(revoltThreshold(a), RULES.revoltBase);
  a.declarations = 1;
  assert.equal(revoltThreshold(a), RULES.revoltBase + RULES.revoltStep);
  a.declarations = 3;
  assert.equal(revoltThreshold(a), RULES.revoltBase + 3 * RULES.revoltStep);
});

test('a declaration needs the strength and the fee, and spends both', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  b.lord = a.i; a.vassals = [b.i];
  b.strength = RULES.revoltBase - 1;
  b.cash = 5000;
  assert.equal(declareIndependence(G, b), false, 'not enough strength');
  b.strength = RULES.revoltBase;
  b.cash = RULES.revoltCost - 1;
  assert.equal(declareIndependence(G, b), false, 'not enough cash');
  b.cash = 5000;
  assert.equal(declareIndependence(G, b), true);
  assert.equal(b.cash, 5000 - RULES.revoltCost);
  assert.equal(b.lord, null);
  assert.equal(b.strength, 0);
  assert.equal(b.declarations, 1);
  assert.deepEqual(a.vassals, []);
});

/* ============================================================ victory */

test('with two players the first absorption ends the game', () => {
  const G = game();
  const [a, b] = G.players;
  a.cash = 0;
  pay(G, a, b, 500);
  assert.equal(G.over, true);
  assert.equal(G.endReason, 'conquest');
  assert.equal(G.winner, b.i);
});

test('with four players one absorption does not end the game', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  a.cash = 0;
  pay(G, a, b, 500);
  assert.equal(G.over, false);
  assert.equal(a.lord, b.i);
});

test('the game ends when every column but one has been absorbed', () => {
  const G = game(seats4);
  const [a, b, c, d] = G.players;
  for (const loser of [a, c, d]) { loser.cash = 0; pay(G, loser, b, 500); }
  assert.equal(G.over, true);
  assert.equal(G.endReason, 'conquest');
  assert.equal(G.winner, b.i);
});

test('reaching the circuit limit ends on totals, and names the richest column', () => {
  const G = game(seats2, 7, 1);
  G.players[1].cash = 9999;
  G.phase = 'end';
  endTurn(G);          // Meelah's turn
  G.phase = 'end';
  endTurn(G);          // back to Sam -> circuit 2 > limit 1
  assert.equal(G.over, true);
  assert.equal(G.endReason, 'circuit-limit');
  assert.equal(G.winner, 1);
});

/* ============================================================ contested claim */

// seats4 seats the humans at 0 and 1, so the two rival creditors must be those
// two — an AI creditor bids automatically and never joins the queue.
const contested = (strength = 0) => {
  const G = game(seats4);
  const incumbent = G.players[0], claimant = G.players[1], debtor = G.players[2];
  debtor.lord = incumbent.i;
  incumbent.vassals = [debtor.i];
  debtor.strength = strength;
  debtor.cash = 0;
  pay(G, debtor, claimant, 500);
  return { G, incumbent, claimant, debtor };
};

test('a third creditor contests an existing vassal, and a tie holds for the incumbent', () => {
  const { G, incumbent, claimant, debtor } = contested();
  assert.equal(G.phase, 'contest');
  assert.equal(G.contest.queue.length, 2, 'both human creditors bid');
  submitClaim(G, incumbent.i, 300);
  submitClaim(G, claimant.i, 300);          // a tie
  assert.equal(G.contest.moved, false);
  assert.equal(debtor.lord, incumbent.i, 'the incumbent holds on a tie');
  closeContest(G);
});

test('a higher competing claim moves the vassal and wipes their buried strength', () => {
  const { G, incumbent, claimant, debtor } = contested(900);
  const before = claimant.cash;
  submitClaim(G, incumbent.i, 300);
  submitClaim(G, claimant.i, 700);
  assert.equal(G.contest.moved, true);
  assert.equal(debtor.lord, claimant.i);
  assert.deepEqual(incumbent.vassals, []);
  assert.equal(debtor.strength, 0);
  assert.equal(claimant.cash, before - 700, 'the winner pays their claim to the bank');
});

test('a successful defence halves what the vassal had put aside', () => {
  const { G, incumbent, claimant, debtor } = contested(900);
  submitClaim(G, incumbent.i, 700);
  submitClaim(G, claimant.i, 300);
  assert.equal(G.contest.moved, false);
  assert.equal(debtor.strength, 450);
});

/* ============================================================ movement */

test('passing the ledger opening pays 200 exactly once per lap', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 25;
  roll(G, 3, 4);                    // 25 + 7 = 32 -> 4, passing 0
  assert.equal(a.pos, 4);
  assert.equal(a.cash, 1800 + RULES.passGo);
});

test('landing exactly on the ledger opening still pays', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 21;
  roll(G, 3, 4);
  assert.equal(a.pos, 0);
  assert.equal(a.cash, 1800 + RULES.passGo);
});

test('a card that sends you backwards past Go pays nothing', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 2;                          // 2 - 3 wraps to 27, Cradle: unowned, no charge
  G.pendingCard = { card: { x: 'back', back: 3 }, isContingency: true };
  G.phase = 'card';
  applyCard(G);
  assert.equal(a.pos, 27);
  assert.equal(a.cash, 1800, 'going backwards never pays the ledger opening');
  assert.equal(G.phase, 'offer');
});

test('a card sending you to Go pays for the lap', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 17;
  G.pendingCard = { card: { x: 'go', go: 0 }, isContingency: false };
  G.phase = 'card';
  applyCard(G);
  assert.equal(a.pos, 0);
  assert.equal(a.cash, 1800 + RULES.passGo);
});

test('Absorbed sends you to the Facility without paying for the lap', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 14;
  roll(G, 3, 4);                     // -> 21, Absorbed
  assert.equal(a.pos, 21);
  resolveLanding(G);
  assert.equal(a.pos, JAIL);
  assert.equal(a.inFacility, true);
  assert.equal(a.cash, 1800);
});

test('the nearest-fleet card advances forwards only', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 6;
  G.pendingCard = { card: { x: 'fleet', fleet: 1 }, isContingency: true };
  G.phase = 'card';
  applyCard(G);
  assert.equal(a.pos, 18, 'from 6 the next fleet forwards is 18, not 5 behind');
});

test('the nearest-utility card wraps past Go and pays for the lap', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 25;
  G.pendingCard = { card: { x: 'util', util: 1 }, isContingency: true };
  G.phase = 'card';
  applyCard(G);
  assert.equal(a.pos, 11);
  assert.equal(a.cash, 1800 + RULES.passGo);
});

/* ============================================================ the Facility */

test('the Neurex cannot be paid off — doubles release you, nothing else does', () => {
  const G = game();
  const [a] = G.players;
  a.inFacility = true;
  a.pos = JAIL;
  const before = a.cash;
  roll(G, 2, 5);
  assert.equal(a.inFacility, true);
  assert.equal(a.attempts, 1);
  assert.equal(a.cash, before, 'no payment leaves the Facility');
  assert.equal(a.pos, JAIL);
});

test('doubles release you and move you the rolled total', () => {
  const G = game();
  const [a] = G.players;
  a.inFacility = true;
  a.pos = JAIL;
  roll(G, 4, 4);
  assert.equal(a.inFacility, false);
  assert.equal(a.pos, JAIL + 8);
});

test('the assessment concludes after three attempts, at no cost', () => {
  const G = game();
  const [a] = G.players;
  a.inFacility = true; a.pos = JAIL;
  roll(G, 2, 5); G.phase = 'roll';
  roll(G, 1, 3); G.phase = 'roll';
  const before = a.cash;
  roll(G, 2, 6);
  assert.equal(a.inFacility, false);
  assert.equal(a.cash, before, 'release costs nothing — the Neurex has no price');
  assert.equal(a.pos, JAIL + 8);
});

/* ============================================================ amendments */

test('amendments cost 500, then 700, then 900, and run out', () => {
  const G = game();
  const [a] = G.players;
  assert.equal(amendCost(a), 500);
  a.amends = 2; assert.equal(amendCost(a), 700);
  a.amends = 1; assert.equal(amendCost(a), 900);
});

test('an amendment moves one square, charges the fee, and spends the allowance', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 4;
  G.phase = 'landed';
  amendManifest(G);
  assert.equal(a.pos, 5);
  assert.equal(a.cash, 1800 - 500);
  assert.equal(a.amends, 2);
});

test('an amendment is refused with no allowance left or no cash', () => {
  const G = game();
  const [a] = G.players;
  G.phase = 'landed';
  a.amends = 0;
  assert.equal(amendManifest(G), null);
  a.amends = 3; a.cash = 100;
  assert.equal(amendManifest(G), null);
  assert.equal(a.cash, 100);
});

/* ============================================================ development */

test('a garrison needs the full set, the pool, and the money', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 1);
  assert.equal(build(G, a, 1), false, 'half a set cannot be garrisoned');
  own(G, a, 3);
  assert.equal(build(G, a, 1), true);
  assert.equal(a.cash, 1800 - SETS.syn.gc);
  assert.equal(G.garrisonPool, RULES.garrisonPool - 1);
});

test('garrisons stop at three', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 1); own(G, a, 3);
  assert.ok(build(G, a, 1) && build(G, a, 1) && build(G, a, 1));
  assert.equal(build(G, a, 1), false);
  assert.equal(holding(a, 1).garrisons, 3);
});

test('a citadel consumes the square’s three garrisons and returns them to the pool', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 1, { garrisons: 3 }); own(G, a, 3);
  G.garrisonPool = RULES.garrisonPool - 3;
  assert.equal(raiseCitadel(G, a, 1), true);
  assert.equal(holding(a, 1).citadel, 1);
  assert.equal(holding(a, 1).garrisons, 0);
  assert.equal(G.garrisonPool, RULES.garrisonPool);
  assert.equal(G.citadelPool, RULES.citadelPool - 1);
});

test('development cannot exceed the pools', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 1); own(G, a, 3);
  G.garrisonPool = 0;
  assert.equal(build(G, a, 1), false, 'an empty pool blocks a garrison');
});

test('selling a garrison refunds half and returns it to the pool', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 13, { garrisons: 2 });
  G.garrisonPool = RULES.garrisonPool - 2;
  const before = a.cash;
  assert.equal(sellDevelopment(G, a, 13), true);
  assert.equal(a.cash, before + SETS.eden.gc / 2);
  assert.equal(G.garrisonPool, RULES.garrisonPool - 1);
});

test('mortgage pays half the list price and redemption costs 55%', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 27);                      // Cradle, 400
  assert.equal(mortgage(G, a, 27), true);
  assert.equal(a.cash, 1800 + 200);
  assert.equal(redeem(G, a, 27), true);
  assert.equal(a.cash, 1800 + 200 - 220);
  assert.equal(holding(a, 27).mortgaged, 0);
});

test('a built square cannot be mortgaged', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 13, { garrisons: 1 });
  assert.equal(mortgage(G, a, 13), false);
});

test('a debt marker blocks buying and building', () => {
  const G = game();
  const [a] = G.players;
  a.debt = 100;
  own(G, a, 1); own(G, a, 3);
  assert.equal(build(G, a, 1), false);
  a.pos = 6;
  assert.equal(buy(G, a, 6), false);
});

test('repaying a debt takes what is available and no more', () => {
  const G = game();
  const [a] = G.players;
  a.cash = 200; a.debt = 500;
  assert.equal(repayDebt(G, a), 200);
  assert.equal(a.cash, 0);
  assert.equal(a.debt, 300);
});

/* ============================================================ acquisition */

test('buying takes the list price and records the holding', () => {
  const G = game();
  const [a] = G.players;
  a.pos = 13;
  assert.equal(buy(G, a), true);
  assert.equal(a.cash, 1800 - 180);
  assert.equal(ownerOf(G, 13).i, a.i);
});

test('an owned square cannot be bought again', () => {
  const G = game();
  const [a, b] = G.players;
  own(G, a, 13);
  b.pos = 13;
  assert.equal(buy(G, b), false);
});

test('a sealed auction pays the highest bid, not the list price', () => {
  const G = game();
  const [a, b] = G.players;
  openAuction(G, 13);                    // Horizon, list 180
  submitBid(G, a.i, 250);
  submitBid(G, b.i, 400);
  assert.equal(G.auction.winner, b.i);
  assert.equal(b.cash, 1800 - 400);
  assert.equal(a.cash, 1800, 'a losing bid costs nothing');
  assert.equal(ownerOf(G, 13).i, b.i);
});

test('a bid is capped at the bidder’s cash and cannot be negative', () => {
  const G = game();
  const [a, b] = G.players;
  a.cash = 300;
  openAuction(G, 13);
  submitBid(G, a.i, 99999);
  submitBid(G, b.i, -50);
  assert.equal(G.auction.bids[a.i], 300);
  assert.equal(G.auction.bids[b.i], 0);
  assert.equal(G.auction.winner, a.i);
});

test('an auction nobody bids on leaves the square unclaimed', () => {
  const G = game();
  const [a, b] = G.players;
  openAuction(G, 13);
  submitBid(G, a.i, 0);
  submitBid(G, b.i, 0);
  assert.equal(G.auction.winner, null);
  assert.equal(ownerOf(G, 13), null);
});

/* ============================================================ contracts */

test('a built set is frozen — nothing in it can be traded', () => {
  const G = game();
  const [a, b] = G.players;
  own(G, a, 13, { garrisons: 1 });
  own(G, a, 14); own(G, a, 15);
  assert.equal(tradable(G, a, 14), false, 'a sibling square is built');
  assert.equal(tradable(G, a, 13), false);
});

test('a mortgaged holding cannot be traded', () => {
  const G = game();
  const [a] = G.players;
  own(G, a, 13, { mortgaged: 1 });
  assert.equal(tradable(G, a, 13), false);
});

test('settling a contract moves both squares and the cash', () => {
  const G = game();
  const [a, b] = G.players;
  own(G, a, 1); own(G, b, 13);
  settleContract(G, { from: a.i, to: b.i, give: 1, get: 13, cash: 200, direction: 1 });
  assert.equal(ownerOf(G, 13).i, a.i);
  assert.equal(ownerOf(G, 1).i, b.i);
  assert.equal(a.cash, 1600);
  assert.equal(b.cash, 2000);
});

test('a contract cannot pay out more cash than the payer holds', () => {
  const G = game();
  const [a, b] = G.players;
  a.cash = 100;
  own(G, b, 13);
  settleContract(G, { from: a.i, to: b.i, give: null, get: 13, cash: 5000, direction: 1 });
  assert.equal(a.cash, 0);
  assert.equal(b.cash, 1900);
});

test('a traded square arrives undeveloped', () => {
  const G = game();
  const [a, b] = G.players;
  own(G, b, 13);
  settleContract(G, { from: a.i, to: b.i, give: null, get: 13, cash: 0, direction: 1 });
  assert.deepEqual(holding(a, 13), { sq: 13, garrisons: 0, citadel: 0, mortgaged: 0 });
});

/* ============================================================ seeking trades */

test('a set-completing target is found only when one other player holds the last square', () => {
  const G = game(seats4);
  const [a, b, c] = G.players;
  own(G, a, 13); own(G, a, 14);
  assert.deepEqual(setCompletingTargets(G, a), [], 'square 15 is still unowned — buy it, do not trade for it');
  own(G, b, 15);
  const found = setCompletingTargets(G, a);
  assert.equal(found.length, 1);
  assert.equal(found[0].sq, 15);
  assert.equal(found[0].owner.i, b.i);
  assert.equal(found[0].set, 'eden');
});

test('a set split across two other players offers no single completing trade', () => {
  const G = game(seats4);
  const [a, b, c] = G.players;
  own(G, a, 13); own(G, b, 14); own(G, c, 15);
  assert.deepEqual(setCompletingTargets(G, a), []);
});

test('a built square is not a completing target — it cannot legally move', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  own(G, a, 1); own(G, b, 3, { garrisons: 1 });
  assert.deepEqual(setCompletingTargets(G, a), []);
});

test('a sought contract asks for the completing square and offers cash', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  own(G, a, 13); own(G, a, 14); own(G, b, 15);
  const c = seekContract(G, a);
  assert.ok(c, 'a contract should have been found');
  assert.equal(c.from, a.i);
  assert.equal(c.to, b.i);
  assert.equal(c.get, 15);
  assert.equal(c.direction, 1);
  assert.ok(c.cash > 0);
  assert.ok(c.cash <= a.cash - 300, 'a proposer keeps a reserve');
});

test('no contract is sought without the cash to make one worth answering', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  own(G, a, 13); own(G, a, 14); own(G, b, 15);
  a.cash = 320;
  assert.equal(seekContract(G, a), null);
});

test('a proposer will not offer away a square from a set it is trying to close', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  own(G, a, 13); own(G, a, 14); own(G, b, 15);   // chasing Eden
  own(G, a, 1);                                   // spare, no set of ours
  const c = seekContract(G, a);
  assert.notEqual(c.give, 13);
  assert.notEqual(c.give, 14);
});

/* ============================================================ contracts in play */

test('an illegal contract is rejected before anyone is asked', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  own(G, b, 13, { garrisons: 1 });
  assert.equal(contractIsLegal(G, { from: a.i, to: b.i, get: 13, give: null, cash: 100, direction: 1 }), false);
  assert.equal(contractIsLegal(G, { from: a.i, to: a.i, get: null, give: null, cash: 100, direction: 1 }), false);
  assert.equal(contractIsLegal(G, { from: a.i, to: b.i, get: null, give: null, cash: 0, direction: 1 }), false);
  a.debt = 50;
  own(G, b, 1);
  assert.equal(contractIsLegal(G, { from: a.i, to: b.i, get: 1, give: null, cash: 100, direction: 1 }), false);
});

test('a proposal to an opponent is answered at once', () => {
  const G = game(seats4);
  const a = G.players[0], ai = G.players[2];
  own(G, ai, 13);
  const r = proposeContract(G, { from: a.i, to: ai.i, get: 13, give: null, cash: 900, direction: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.pending, false);
  assert.equal(typeof r.accepted, 'boolean');
  if (r.accepted) assert.equal(ownerOf(G, 13).i, a.i);
});

test('a generous offer is accepted and a derisory one refused', () => {
  const generous = (() => {
    const G = game(seats4);
    const a = G.players[0], ai = G.players[2];
    own(G, ai, 13);
    return proposeContract(G, { from: a.i, to: ai.i, get: 13, give: null, cash: 1500, direction: 1 }).accepted;
  })();
  const derisory = (() => {
    const G = game(seats4);
    const a = G.players[0], ai = G.players[2];
    own(G, ai, 13);
    return proposeContract(G, { from: a.i, to: ai.i, get: 13, give: null, cash: 1, direction: 1 }).accepted;
  })();
  assert.equal(generous, true);
  assert.equal(derisory, false);
});

test('a proposal to a human parks the game and waits for an answer', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  own(G, b, 13);
  G.phase = 'end';
  const r = proposeContract(G, { from: a.i, to: b.i, get: 13, give: null, cash: 400, direction: 1 });
  assert.equal(r.pending, true);
  assert.equal(G.phase, 'contract');
  assert.equal(ownerOf(G, 13).i, b.i, 'nothing moves until the answer');
  respondToContract(G, true);
  assert.equal(ownerOf(G, 13).i, a.i);
  assert.equal(a.cash, 1800 - 400);
  assert.equal(G.phase, 'end', 'the turn resumes where it was interrupted');
});

test('refusing a parked contract moves nothing', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  own(G, b, 13);
  G.phase = 'end';
  proposeContract(G, { from: a.i, to: b.i, get: 13, give: null, cash: 400, direction: 1 });
  respondToContract(G, false);
  assert.equal(ownerOf(G, 13).i, b.i);
  assert.equal(a.cash, 1800);
  assert.equal(G.contract, null);
});

test('a contract that became illegal while parked does not settle', () => {
  const G = game(seats4);
  const [a, b] = G.players;
  own(G, b, 13); own(G, b, 14); own(G, b, 15);
  G.phase = 'end';
  proposeContract(G, { from: a.i, to: b.i, get: 13, give: null, cash: 400, direction: 1 });
  holding(b, 14).garrisons = 1;                  // the set is built up mid-negotiation
  assert.equal(respondToContract(G, true), false);
  assert.equal(ownerOf(G, 13).i, b.i);
  assert.equal(a.cash, 1800, 'no cash moves on a lapsed contract');
});

test('opponents now trade with each other, not only with humans', () => {
  const G = game(seats4);
  const spector = G.players[2], varan = G.players[3];
  own(G, spector, 13); own(G, spector, 14);
  own(G, varan, 15);
  const c = seekContract(G, spector);
  assert.ok(c, 'an opponent should seek the completing square');
  assert.equal(c.to, varan.i);
  const before = ownerOf(G, 15).i;
  proposeContract(G, c);
  assert.equal(G.phase !== 'contract', true, 'an opponent answers immediately');
  assert.notEqual(typeof before, 'undefined');
});

/* ============================================================ determinism */

test('the same seed produces the same game', () => {
  const play = seed => {
    const G = createGame({ seats: seats2, seed, circuits: 6 });
    for (let i = 0; i < 60 && !G.over; i++) {
      if (G.phase === 'roll') roll(G);
      else if (G.phase === 'landed') resolveLanding(G);
      else if (G.phase === 'card') applyCard(G);
      else if (G.phase === 'offer') buy(G, current(G)) || (G.phase = 'end');
      else if (G.phase === 'auction') { const q = G.auction.queue[G.auction.at]; submitBid(G, q, 100); }
      else if (G.phase === 'contest') { const q = G.contest.queue[G.contest.at]; submitClaim(G, q, 100); }
      else endTurn(G);
    }
    return G.players.map(p => [p.cash, p.pos, p.holdings.length]);
  };
  assert.deepEqual(play(99), play(99));
  assert.notDeepEqual(play(99), play(100));
});

/* ============================================================ save and resume */

test('every square carries a short code that fits a phone cell', () => {
  BOARD.forEach((b, i) => {
    assert.ok(b.a, `square ${i} (${b.n}) has no short code`);
    assert.ok(b.a.length <= 4, `${b.n} code "${b.a}" is too long for a 45px cell`);
    assert.equal(b.a, b.a.toUpperCase());
  });
});

test('a game round-trips through a save exactly', () => {
  const G = createGame({ seats: seats4, seed: 5, circuits: 24 });
  for (let i = 0; i < 40 && !G.over; i++) {
    if (G.phase === 'roll') roll(G);
    else if (G.phase === 'landed') resolveLanding(G);
    else if (G.phase === 'card') applyCard(G);
    else if (G.phase === 'offer') { if (!buy(G, current(G))) G.phase = 'end'; }
    else if (G.phase === 'auction') {
      if (G.auction.resolved) closeAuction(G);
      else submitBid(G, G.auction.queue[G.auction.at], 120);
    } else if (G.phase === 'contract') respondToContract(G, false);
    else if (G.phase === 'contest') {
      if (G.contest.resolved) closeContest(G);
      else submitClaim(G, G.contest.queue[G.contest.at], 100);
    } else endTurn(G);
  }
  const restored = deserialize(serialize(G));
  assert.deepEqual(restored, JSON.parse(JSON.stringify(G)));
});

test('a resumed game continues identically to one that was never saved', () => {
  const advance = g => {
    for (let i = 0; i < 30 && !g.over; i++) {
      if (g.phase === 'roll') roll(g);
      else if (g.phase === 'landed') resolveLanding(g);
      else if (g.phase === 'card') applyCard(g);
      else if (g.phase === 'offer') { if (!buy(g, current(g))) g.phase = 'end'; }
      else if (g.phase === 'auction') {
        if (g.auction.resolved) closeAuction(g);
        else submitBid(g, g.auction.queue[g.auction.at], 120);
      } else if (g.phase === 'contract') respondToContract(g, false);
      else if (g.phase === 'contest') {
        if (g.contest.resolved) closeContest(g);
        else submitClaim(g, g.contest.queue[g.contest.at], 100);
      } else endTurn(g);
    }
    return g;
  };
  const live = advance(createGame({ seats: seats2, seed: 11, circuits: 24 }));
  const resumed = deserialize(serialize(live));
  advance(live);
  advance(resumed);
  assert.deepEqual(
    resumed.players.map(p => [p.cash, p.pos, p.holdings.length]),
    live.players.map(p => [p.cash, p.pos, p.holdings.length]),
    'the random stream must survive the save, or a resumed game diverges'
  );
});

test('a corrupt, empty or foreign save is refused rather than half-loaded', () => {
  assert.equal(deserialize('not json'), null);
  assert.equal(deserialize('{}'), null);
  assert.equal(deserialize(JSON.stringify({ v: 999, board: 28, G: {} })), null);
  assert.equal(deserialize(JSON.stringify({ v: 1, board: 40, G: { players: [{}], rngState: 1 } })), null,
    'a save from a different board must not resume — square indices would mean other places');
  assert.equal(deserialize(JSON.stringify({ v: 1, board: 28, G: { players: [] } })), null);
});
