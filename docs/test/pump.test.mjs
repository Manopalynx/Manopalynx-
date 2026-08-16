// Can a player make money by doing something and then undoing it?
//
// Sam found that they could, by playing: sell a citadel, raise it again, and
// the board is exactly where it started with more in your purse. On The Compact
// that was +₡225 a cycle and on Agora +₡300, repeatable for as long as you
// cared to tap the button.
//
// The cause was one number written out in six places -- `gc * 5 / 2`, four
// times in engine.js and twice in ui.js. A citadel was priced as though selling
// it liquidated the whole stack, when the three garrisons under it go back to
// the BOARD rather than being sold. Fixed by deriving all six from
// developmentSaleValue.
//
// WHY THIS IS A SWEEP AND NOT A TEST OF THAT ONE NUMBER. The defect was
// invisible to everything: 300-game sweeps never found it because
// sellDevelopment has exactly one caller, the human's button, so no opponent
// and no harness game has ever sold a development in the entire history of this
// file. A test naming the citadel would have caught the citadel. This drives
// EVERY reversible action round its own loop and asks the same question of each,
// so a new one arrives already covered.
//
// The check is not on the price. It is that the BOARD returns to its starting
// state and the purse does not grow -- which is the property that matters and
// the only one a future pricing change cannot quietly violate.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SETS, BOARD } from '../data.js';
import {
  createGame, raiseCitadel, sellDevelopment, build, pledge, redeem, holding
} from '../engine.js';

const seats = [{ name: 'A', kind: 'human' }, { name: 'B', kind: 'ai', persona: 'spector' }];

// Everything about a player and the pools EXCEPT cash. If this matches before
// and after, a loop changed nothing but the purse — which is exactly the
// condition under which a gain is a pump rather than a trade.
const boardState = (G, p) => JSON.stringify([
  p.holdings.map(h => [h.sq, h.garrisons, h.citadel, h.mortgaged]).sort(),
  G.garrisonPool, G.citadelPool, p.debt, p.lord, [...p.vassals]
]);

const own = (G, p, sq, h = {}) =>
  p.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged: 0, ...h });

// Runs `cycle` up to ten times and reports what it did. A loop that never ran
// is reported as such rather than passing quietly: a fixture that cannot reach
// the action would otherwise look exactly like an action that cannot pay.
function runLoop(setUp, cycle) {
  const G = createGame({ seats, seed: 1 });
  const p = G.players[0];
  p.cash = 100000;
  setUp(G, p);
  const before = { cash: p.cash, state: boardState(G, p) };
  let ran = 0;
  for (let k = 0; k < 10; k++) { if (cycle(G, p) === false) break; ran++; }
  return {
    ran,
    restored: before.state === boardState(G, p),
    perCycle: ran ? (p.cash - before.cash) / ran : 0
  };
}

const firstOf = key => SETS[key].sq[0];

for (const [key, set] of Object.entries(SETS)) {
  test(`${set.n}: selling a citadel and raising it again cannot pay`, () => {
    const r = runLoop(
      (G, p) => { for (const i of set.sq) own(G, p, i, { citadel: 1 }); G.citadelPool -= set.sq.length; },
      (G, p) => sellDevelopment(G, p, firstOf(key)) && raiseCitadel(G, p, firstOf(key))
    );
    assert.ok(r.ran > 0, 'the loop never ran, so this asserts nothing');
    assert.ok(r.restored, 'the board did not come back to its starting state');
    assert.ok(r.perCycle <= 0,
      `a citadel round trip pays ₡${r.perCycle} a cycle on ${set.n} — this is a money pump`);
  });

  test(`${set.n}: selling a garrison and building it again cannot pay`, () => {
    const r = runLoop(
      (G, p) => { for (const i of set.sq) own(G, p, i, { garrisons: 3 }); G.garrisonPool -= 3 * set.sq.length; },
      (G, p) => sellDevelopment(G, p, firstOf(key)) && build(G, p, firstOf(key))
    );
    assert.ok(r.ran > 0, 'the loop never ran, so this asserts nothing');
    assert.ok(r.restored, 'the board did not come back to its starting state');
    assert.ok(r.perCycle <= 0,
      `a garrison round trip pays ₡${r.perCycle} a cycle on ${set.n}`);
  });

  test(`${set.n}: pledging a square and redeeming it cannot pay`, () => {
    const r = runLoop(
      (G, p) => { for (const i of set.sq) own(G, p, i); },
      (G, p) => pledge(G, p, firstOf(key)) && redeem(G, p, firstOf(key))
    );
    assert.ok(r.ran > 0, 'the loop never ran, so this asserts nothing');
    assert.ok(r.restored, 'the board did not come back to its starting state');
    assert.ok(r.perCycle < 0,
      `pledging and redeeming is free on ${set.n} — it must cost the interest`);
  });
}

// The other half of the same number. Under the old pricing a citadel stack was
// the one thing on the board that did not depreciate at all: sell the citadel
// for 5gc/2 and its three garrisons for 3gc/2 and all 4gc came back, where a
// garrison alone returns half. Building was free to reverse.
test('taking a citadel stack down to nothing returns half of what it cost', () => {
  for (const [key, set] of Object.entries(SETS)) {
    const sq = firstOf(key);
    const G = createGame({ seats, seed: 1 });
    const p = G.players[0];
    p.cash = 0;
    own(G, p, sq, { citadel: 1 });
    G.citadelPool--;
    const spent = set.gc * 4;                  // three garrisons, then the step
    sellDevelopment(G, p, sq);                 // citadel -> three garrisons
    for (let k = 0; k < 3; k++) sellDevelopment(G, p, sq);
    assert.equal(holding(p, sq).garrisons, 0, `${set.n} did not come all the way down`);
    assert.equal(p.cash, Math.floor(spent / 2),
      `${set.n} returned ₡${p.cash} against ₡${spent} spent — the rule is half`);
  }
});
