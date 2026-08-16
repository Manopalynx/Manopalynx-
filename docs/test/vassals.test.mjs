// Absorbing an overlord takes the oaths sworn to them.
//
// Before this a creditor could take somebody's oath and leave that person's own
// vassals where they were -- holding a debtor who went on collecting from
// people the creditor had no claim on. That is bookkeeping rather than conquest.
//
// Driven through pay(), which is the only route into vassalage: a shortfall
// against another PLAYER is what swears one to the other. Reaching for bind
// directly would exercise a function nobody calls that way.
//
// The last test is the honest limit of the change, and it exists because the
// comment in engine.js first claimed something stronger than the code does. A
// chain of two is still reachable, since a player who is ALREADY a vassal may
// take a vassal of their own; measured over 60 games the deepest chain is two.
// If that is ever changed deliberately, this is the test that should fail.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, pay, payRent, netWorth, holdingsValue } from '../engine.js';
import { checkInvariants } from './harness.mjs';
import { BOARD } from '../data.js';

const seats = [
  { name: 'Samuel', kind: 'human' },
  { name: 'Spector', kind: 'ai', persona: 'spector' },
  { name: 'High Commander Varan', kind: 'ai', persona: 'varan' },
  { name: 'Adran Vale', kind: 'ai', persona: 'vale' }
];

const game = (seed = 3) => createGame({ seats, seed, circuits: 72 });
// Nothing to raise and nothing in hand, so pay() cannot settle and must swear.
const broke = p => { p.cash = 0; p.holdings = []; };

test('an absorbed overlord hands over the oaths sworn to them', () => {
  const G = game();
  const [me, a, b, c] = G.players;
  for (const v of [b, c]) { v.lord = a.i; a.vassals.push(v.i); }
  broke(a);
  me.cash = 5000;

  pay(G, a, me, 400);

  assert.equal(a.lord, me.i, 'the absorbed overlord is sworn to the creditor');
  assert.deepEqual(a.vassals, [], 'and keeps none of their own');
  assert.ok(me.vassals.includes(a.i), 'the creditor holds them');
  assert.ok(me.vassals.includes(b.i) && me.vassals.includes(c.i),
    'and holds the oaths that were sworn to them');
  assert.equal(b.lord, me.i);
  assert.equal(c.lord, me.i);
  checkInvariants(G, 'after absorbing an overlord');
});

test('absorbing somebody who holds nobody changes nothing else', () => {
  const G = game(11);
  const [me, a, b] = G.players;
  b.lord = null;
  broke(a);
  me.cash = 5000;

  pay(G, a, me, 250);

  assert.deepEqual(me.vassals, [a.i], 'only the debtor is taken');
  assert.equal(b.lord, null, 'an unrelated seat is untouched');
  checkInvariants(G);
});

test('the roles can still invert without closing a loop', () => {
  // The creditor is the debtor's own vassal: binding naively would make each
  // the other's overlord and every walk of the chain would run forever.
  const G = game(5);
  const [me, a] = G.players;
  me.lord = a.i; a.vassals.push(me.i);
  broke(a);
  me.cash = 5000;

  pay(G, a, me, 300);

  assert.equal(a.lord, me.i, 'the debtor is now sworn to their former vassal');
  assert.equal(me.lord, null, 'who has thrown off the old arrangement');
  checkInvariants(G, 'after the roles invert');
});

test('a transferred vassal counts toward the new overlord, once', () => {
  const G = game(7);
  const [me, a, b] = G.players;
  b.lord = a.i; a.vassals.push(b.i);
  // Something for the tithe to be a share OF.
  const sq = BOARD.findIndex(s => s.pr && s.s);
  b.holdings = [{ sq, garrisons: 0, citadel: 0, mortgaged: 0 }];
  broke(a);
  me.cash = 5000; me.holdings = []; me.debt = 0; me.tithe = 25;

  pay(G, a, me, 200);

  // holdingsValue counts cash as well as squares -- it is the base tribute is a
  // share of -- so the expected figure is derived from it rather than written
  // out. A literal here would have been a fact about this fixture's purse.
  const share = Math.floor(holdingsValue(b) * me.tithe / 100);
  assert.ok(share > 0, 'the transferred vassal is worth something to count');
  assert.equal(netWorth(G, me), holdingsValue(me) - me.debt + share,
    'the new overlord counts the transferred vassal exactly once');
  // And the absorbed overlord no longer counts them at all.
  assert.equal(netWorth(G, a), holdingsValue(a) - a.debt,
    'the absorbed overlord counts nothing for a vassal they no longer hold');
});

test('a chain of two is still reachable, and that is the current limit', () => {
  // A player who is already a vassal may take a vassal of their own. This is
  // NOT flattened, and the engine comment must not claim otherwise.
  const G = game(13);
  const [top, mid, low] = G.players;
  mid.lord = top.i; top.vassals.push(mid.i);
  broke(low);
  mid.cash = 5000;

  pay(G, low, mid, 150);

  assert.equal(low.lord, mid.i, 'the debtor is sworn to a player who is themselves sworn');
  assert.equal(mid.lord, top.i, 'and that arrangement stands');
  let depth = 0, at = low;
  while (at.lord !== null && depth < 8) { depth++; at = G.players[at.lord]; }
  assert.equal(depth, 2, 'so the chain is two deep');
  checkInvariants(G, 'with a chain of two');
});

test('an overlord pays their own vassal the net, once', () => {
  // NOTE: this passes under the OLD gross-then-refund path too, and says so
  // rather than pretending otherwise — paying 200 and taking 50 back lands on
  // the same balances as paying 150. It pins the arithmetic; the test below is
  // the one that can tell the two apart, because the difference only exists
  // when the overlord cannot cover the gross.
  const G = game(17);
  const [lord, v] = G.players;
  v.lord = lord.i; lord.vassals.push(v.i);
  lord.tithe = 25;
  const sq = BOARD.findIndex(b => b.pr && b.s);
  v.holdings = [{ sq, garrisons: 0, citadel: 0, mortgaged: 0 }];
  lord.cash = 1000; v.cash = 0;
  const rent = 200, cut = Math.floor(rent * lord.tithe / 100);

  payRent(G, lord, v, rent);

  assert.equal(lord.cash, 1000 - (rent - cut), 'the overlord is out the net, not the gross');
  assert.equal(v.cash, rent - cut, 'and the vassal receives the net');
  assert.equal(v.strength, cut, 'the revolt clock still ticks by the tithe levied');
});

test('an overlord short of the gross but good for the net does not fall', () => {
  // The whole point of paying the net. Gross 200, tithe 25% so net 150; the
  // overlord holds 160. Paying the gross would have liquidated them and, with
  // nothing to raise, sworn them to their own vassal.
  const G = game(19);
  const [lord, v] = G.players;
  v.lord = lord.i; lord.vassals.push(v.i);
  lord.tithe = 25;
  lord.cash = 160; lord.holdings = [];
  v.cash = 0; v.holdings = [];

  payRent(G, lord, v, 200);

  assert.equal(lord.lord, null, 'the overlord is still nobody’s vassal');
  assert.equal(lord.cash, 10, 'having paid the net of 150');
  assert.equal(v.cash, 150);
  checkInvariants(G, 'after an overlord pays their own vassal');
});

test('rent to somebody else’s vassal still tithes onward', () => {
  const G = game(23);
  const [payer, v, lord] = G.players;
  v.lord = lord.i; lord.vassals.push(v.i);
  lord.tithe = 25; lord.cash = 0;
  payer.cash = 1000; v.cash = 0;

  payRent(G, payer, v, 200);

  assert.equal(payer.cash, 800, 'the payer is out the full rent');
  assert.equal(v.cash, 150, 'the vassal keeps the rest');
  assert.equal(lord.cash, 50, 'and the overlord takes the cut');
});
