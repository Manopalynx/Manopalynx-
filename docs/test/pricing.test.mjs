// A credit is worth more to a player who has none.
//
// Opponents used to price a square purely in list money while the game is
// played in far less than that: 8,000 credits are dealt, the whole buyable
// board is 5,690, and from circuit 36 the table holds about 15% of the start
// for the rest of the game. Measured before this existed, an opponent wanted a
// median 3.3x list for one square, and Varan holding 140 credits still asked
// around 950 for a square listed at 180.
//
// liquidityWeight scales only the CASH leg of a contract, against sellNeed --
// the figure each persona already treats as short. The behavioural test at the
// bottom is the one that matters: the same offer, the same square, the same
// board, refused by a flush opponent and taken by an empty one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, liquidityWeight, aiAcceptsContract } from '../engine.js';
import { RULES, BOARD } from '../data.js';

const seats = [
  { name: 'Samuel', kind: 'human' },
  { name: 'Spector', kind: 'ai', persona: 'spector' },
  { name: 'High Commander Varan', kind: 'ai', persona: 'varan' },
  { name: 'Adran Vale', kind: 'ai', persona: 'vale' }
];

test('a player with plenty values a credit at face', () => {
  for (const persona of ['spector', 'varan', 'vale']) {
    const need = RULES.sellNeed[persona];
    assert.equal(liquidityWeight({ persona, cash: need, debt: 0 }), 1);
    assert.equal(liquidityWeight({ persona, cash: need * 10, debt: 0 }), 1);
  }
});

test('a player with nothing values a credit at the full hunger', () => {
  for (const persona of ['spector', 'varan', 'vale']) {
    assert.equal(
      liquidityWeight({ persona, cash: 0, debt: 0 }),
      1 + RULES.cashHunger[persona]
    );
  }
});

test('the weight is bounded however deep the hole is', () => {
  // A marker compounds at 10% a turn and can run to thousands. Without the
  // clamp the weight would run away with it and any offer at all would look
  // like salvation.
  for (const persona of ['spector', 'varan', 'vale']) {
    const w = liquidityWeight({ persona, cash: 0, debt: 100000 });
    assert.equal(w, 1 + RULES.cashHunger[persona]);
    assert.ok(w <= 1 + RULES.cashHunger[persona] + 1e-9);
  }
});

test('money already owed is not money in hand', () => {
  const persona = 'spector';
  const need = RULES.sellNeed[persona];
  const flush = liquidityWeight({ persona, cash: need, debt: 0 });
  const owing = liquidityWeight({ persona, cash: need, debt: need });
  assert.equal(flush, 1);
  assert.ok(owing > flush, 'a player holding the money but owing it is still short');
});

test('Varan is the least moved by being empty, on purpose', () => {
  // seekSale establishes that he keeps a thin purse deliberately and must not
  // become the softest seller at the table just for being empty.
  const at = persona => liquidityWeight({ persona, cash: 0, debt: 0 });
  assert.ok(at('varan') < at('spector'), 'Varan should bend less than Spector');
  assert.ok(at('varan') < at('vale'), 'Varan should bend less than Vale');
});

test('an empty opponent sells for less than a flush one', () => {
  // The whole point, through the real acceptance path rather than the weight in
  // isolation. Asserted as a comparison of the two THRESHOLDS rather than
  // against a fixed price: what a square is worth depends on how much of its
  // set is owned and how much of the board is still free, so any single number
  // here would be a fact about this synthetic board and not about the rule.
  const priceFor = (G, them, me, sq) => {
    const takes = cash => aiAcceptsContract(G, them, me, {
      give: null, get: sq, cash, direction: 1
    });
    let lo = 0, hi = 40000;
    if (takes(0)) return 0;
    if (!takes(hi)) return null;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (takes(mid)) hi = mid; else lo = mid;
    }
    return hi;
  };

  for (const seat of [1, 2, 3]) {
    const G = createGame({ seats, seed: 7, circuits: 72 });
    const them = G.players[seat];
    const me = G.players[0];
    const sq = BOARD.findIndex(b => b.pr && b.s);
    them.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged: 0 });

    them.cash = RULES.sellNeed[them.persona] * 4;
    const flush = priceFor(G, them, me, sq);

    them.cash = 0;
    const empty = priceFor(G, them, me, sq);

    assert.ok(flush !== null && empty !== null, `${them.persona}: no price carried it`);
    assert.ok(
      empty < flush,
      `${them.persona} wants ${empty} when empty and ${flush} when flush -- being broke should lower the price`
    );
  }
});
