// Buying a square back out of pledge.
//
// redeem() existed from the start, but its only caller was the human's Manage
// button. For every opponent, pledging was therefore not borrowing against a
// square — it was selling it for half price, permanently. Measured over 25 full
// games: 353 pledges, none ever redeemed, a median pledge outliving 23 of the
// owner's own turns, and 56% of all turns with at least one square somewhere on
// the board earning nothing for anybody.
//
// aiRedeem() runs before the build loop and undoes that. What the tests below
// pin is the shape of the decision rather than the numbers, since the reserve is
// a tuning dial in RULES: it never redeems into a hole, it never redeems while
// carrying a debt marker, and it takes the square it can actually use first.

import test from 'node:test';
import assert from 'node:assert/strict';

import { BOARD, SETS, RULES } from '../data.js';
import { createGame, aiRedeem, redeemCost, rentOf, canBuild } from '../engine.js';

function seat(persona = 'spector') {
  const G = createGame({
    seats: [{ name: 'A', kind: 'ai', persona }, { name: 'B', kind: 'human' }],
    seed: 5, circuits: 72
  });
  return G;
}
const hold = (p, sq, mortgaged = 0) =>
  p.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged });
const has = (p, sq) => p.holdings.find(h => h.sq === sq);

test('nothing pledged, nothing to do', () => {
  const G = seat();
  const p = G.players[0];
  hold(p, SETS.eni.sq[0]);
  assert.equal(aiRedeem(G, p), false);
  assert.equal(p.cash, G.players[0].cash);
});

test('a pledged square comes back when the cash is there', () => {
  const G = seat();
  const p = G.players[0];
  const sq = SETS.eni.sq[0];
  hold(p, sq, 1);
  p.cash = RULES.redeemReserve + redeemCost(sq);
  assert.equal(rentOf(G, sq), 0, 'a pledged square earns nothing to begin with');

  assert.equal(aiRedeem(G, p), true);
  assert.equal(has(p, sq).mortgaged, 0);
  assert.equal(p.cash, RULES.redeemReserve);
  assert.ok(rentOf(G, sq) > 0, 'and earns again afterwards');
});

test('it will not redeem down past the reserve', () => {
  const G = seat();
  const p = G.players[0];
  const sq = SETS.eni.sq[0];
  hold(p, sq, 1);
  p.cash = RULES.redeemReserve + redeemCost(sq) - 1;

  assert.equal(aiRedeem(G, p), false);
  assert.equal(has(p, sq).mortgaged, 1);
  assert.equal(p.cash, RULES.redeemReserve + redeemCost(sq) - 1);
});

test('a debt marker outranks it', () => {
  const G = seat();
  const p = G.players[0];
  const sq = SETS.eni.sq[0];
  hold(p, sq, 1);
  p.cash = 99999;
  p.debt = 50;

  assert.equal(aiRedeem(G, p), false, 'clear what you owe before buying anything back');
  assert.equal(has(p, sq).mortgaged, 1);
});

test('the square it can build on comes before a cheaper one it cannot', () => {
  const G = seat();
  const p = G.players[0];
  const set = SETS.eni.sq;                       // held complete, so buildable
  set.forEach(sq => hold(p, sq, 0));
  has(p, set[0]).mortgaged = 1;

  // A loose square from another set, cheaper to redeem, and no use to anyone.
  const loose = Object.keys(BOARD)
    .map(Number)
    .find(sq => BOARD[sq].s && BOARD[sq].s !== 'eni'
      && redeemCost(sq) < redeemCost(set[0]));
  assert.ok(loose !== undefined, 'fixture needs a cheaper square outside the set');
  hold(p, loose, 1);

  // Enough for exactly one of the two.
  p.cash = RULES.redeemReserve + redeemCost(set[0]);
  aiRedeem(G, p);

  assert.equal(has(p, set[0]).mortgaged, 0, 'the one that completes a set');
  assert.equal(has(p, loose).mortgaged, 1, 'not the cheap one it cannot use');
  assert.ok(canBuild(G, p, set[0]), 'and it can be built on again');
});

test('it clears several in one turn when it is genuinely flush', () => {
  const G = seat();
  const p = G.players[0];
  const set = SETS.eni.sq;
  set.forEach(sq => hold(p, sq, 1));
  p.cash = RULES.redeemReserve + set.reduce((a, sq) => a + redeemCost(sq), 0);

  assert.equal(aiRedeem(G, p), true);
  assert.ok(set.every(sq => !has(p, sq).mortgaged), 'all three back');
  assert.equal(p.cash, RULES.redeemReserve);
});
