// Two things an opponent could not do, and now can: clear a debt marker, and
// ask another player for money instead of only ever offering it.
//
// Both were the same shape of defect as the unredeemed pledge — an engine
// function with exactly one call site, the human's button. Measured over 40
// games before this: 49 markers taken and 0 ever cleared, while a marker
// compounds every turn and locks its holder out of buying, bidding, building,
// citadels, contracts and redeeming; and 13.7% of opponent turns spent short of
// cash while holding precisely the square another player needed to close a set,
// with no way to say so.
//
// What the tests pin is the shape of each decision and the direction of the
// persona differences, not the tuning numbers, which live in RULES.

import test from 'node:test';
import assert from 'node:assert/strict';

import { BOARD, SETS, RULES } from '../data.js';
import {
  createGame, aiRepay, seekSale, repayDebt, contractIsLegal, settleContract,
  recordRefusal, refusalBlocks, holding, aiValue
} from '../engine.js';

const hold = (p, sq, extra = {}) =>
  p.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged: 0, ...extra });

function table(personas = ['spector', 'human']) {
  return createGame({
    seats: personas.map((x, i) => x === 'human'
      ? { name: 'H' + i, kind: 'human' }
      : { name: x, kind: 'ai', persona: x }),
    seed: 5, circuits: 72
  });
}

/* ------------------------------------------------------------- debt markers */

test('no marker, nothing to repay', () => {
  const G = table();
  const p = G.players[0];
  p.cash = 3000;
  assert.equal(aiRepay(G, p), 0);
  assert.equal(p.cash, 3000);
});

test('a marker is paid down out of cash, keeping a working reserve', () => {
  const G = table();
  const p = G.players[0];
  const keep = RULES.debtKeep.spector;
  p.debt = 400;
  p.cash = keep + 250;

  assert.equal(aiRepay(G, p), 250);
  assert.equal(p.debt, 150);
  assert.equal(p.cash, keep);
});

test('it clears the marker outright when it can, and says so', () => {
  const G = table();
  const p = G.players[0];
  p.debt = 200;
  p.cash = RULES.debtKeep.spector + 900;

  aiRepay(G, p);
  assert.equal(p.debt, 0);
  assert.ok(G.log.some(e => /clears the debt marker/.test(e.text || '')),
    'clearing a marker is worth a line in the ledger');
});

test('it raises money for a marker rather than waiting for loose change', () => {
  const G = table();
  const p = G.players[0];
  hold(p, SETS.eni.sq[0]);
  hold(p, SETS.eni.sq[1]);
  p.cash = 0;
  p.debt = 600;                       // over every persona's urgent threshold

  aiRepay(G, p);
  assert.ok(p.debt < 600, 'the marker came down');
  assert.ok(p.holdings.some(h => h.mortgaged),
    'and it came down by pledging, which is what a human would have done');
});

test('Varan will not leave any marker standing; Vale ignores a small one', () => {
  const size = Math.floor((RULES.debtUrgent.vale + RULES.debtUrgent.varan) / 2);
  const run = persona => {
    const G = table([persona, 'human']);
    const p = G.players[0];
    hold(p, SETS.eni.sq[0]);
    hold(p, SETS.eni.sq[1]);
    p.cash = 0;
    p.debt = size;
    aiRepay(G, p);
    return p.debt;
  };
  assert.ok(size < RULES.debtUrgent.vale, 'fixture must sit under Vale\'s threshold');
  assert.ok(run('varan') < size, 'Varan raises for it — an irregularity is an irregularity');
  assert.equal(run('vale'), size, 'Vale lets a small one ride');
});

/* ------------------------------------------------------------------ selling */

// A seat one square short of a colour set, where the missing square is held by
// the seller. That is the only holding anyone reliably overpays for.
function shortOfASet(sellerPersona = 'spector') {
  const G = table([sellerPersona, 'human']);
  const seller = G.players[0], buyer = G.players[1];
  const set = SETS.eni.sq;
  hold(seller, set[0]);
  hold(buyer, set[1]);
  hold(buyer, set[2]);
  buyer.cash = 4000;
  seller.cash = 0;
  return { G, seller, buyer, sq: set[0] };
}

test('flush, it does not sell', () => {
  const { G, seller } = shortOfASet();
  seller.cash = RULES.sellNeed.spector + 1;
  assert.equal(seekSale(G, seller), null);
});

test('short of cash, it offers the square somebody needs — and asks to be paid', () => {
  const { G, seller, buyer, sq } = shortOfASet();
  const c = seekSale(G, seller);
  assert.ok(c, 'there is an offer to make');
  assert.equal(c.direction, 2, 'THEY pay — the direction that did not exist');
  assert.equal(c.give, sq);
  assert.equal(c.get, null);
  assert.equal(c.from, seller.i);
  assert.equal(c.to, buyer.i);
  assert.ok(c.cash > 0);
  assert.ok(contractIsLegal(G, c), 'and it is a contract the engine will take');
});

test('never below half list, never above what the buyer holds', () => {
  const { G, seller, buyer, sq } = shortOfASet();
  const c = seekSale(G, seller);
  assert.ok(c.cash >= Math.floor(BOARD[sq].pr * RULES.sellFloorFraction),
    `${c.cash} is under the floor`);
  assert.ok(c.cash <= buyer.cash, 'naming a figure they cannot cover is not a negotiation');
});

test('Varan does not sell to be helpful, only to repair his own books', () => {
  const { G, seller } = shortOfASet('varan');
  seller.cash = 0;
  assert.equal(seekSale(G, seller), null, 'broke is not enough');

  hold(seller, SETS.dom.sq[0], { mortgaged: 1 });
  assert.ok(seekSale(G, seller), 'a square of his own sitting pledged is');
});

test('Varan withdraws rather than discount; Vale comes down a long way', () => {
  const ask = persona => {
    const { G, seller, buyer } = shortOfASet(persona);
    if (persona === 'varan') hold(seller, SETS.dom.sq[0], { mortgaged: 1 });
    const full = seekSale(G, seller);
    // Now put the buyer well below the asking price and ask again.
    buyer.cash = Math.floor(full.cash * 0.55) + 200;
    return { full: full.cash, thin: seekSale(G, seller) };
  };
  const varan = ask('varan');
  const vale = ask('vale');
  assert.equal(varan.thin, null, 'Varan names his figure and does not move off it');
  assert.ok(vale.thin, 'Vale would rather have the money than the principle');
  assert.ok(vale.thin.cash < vale.full, 'and takes less than he asked for');
});

test('Vale asks less than Varan for the same square', () => {
  const one = persona => {
    const { G, seller } = shortOfASet(persona);
    if (persona === 'varan') hold(seller, SETS.dom.sq[0], { mortgaged: 1 });
    return seekSale(G, seller).cash;
  };
  assert.ok(one('vale') < one('varan'),
    'the premium has to survive contact with the buyer, or the three sell alike');
});

/* ------------------------------------------- the money has to actually exist */

test('a contract nobody can pay for is not a legal contract', () => {
  const { G, seller, buyer, sq } = shortOfASet();
  const c = { from: seller.i, to: buyer.i, give: sq, get: null, cash: 900, direction: 2 };
  buyer.cash = 900;
  assert.ok(contractIsLegal(G, c), 'exactly covered is fine');
  buyer.cash = 899;
  assert.equal(contractIsLegal(G, c), false,
    'a human accepting "pay 5000" with 300 would otherwise have taken it for 300');
});

test('the same rule applies when the proposer is the one paying', () => {
  const { G, seller, buyer, sq } = shortOfASet();
  hold(buyer, SETS.dom.sq[0]);
  const c = { from: seller.i, to: buyer.i, give: null, get: SETS.dom.sq[0],
              cash: 500, direction: 1 };
  seller.cash = 500;
  assert.ok(contractIsLegal(G, c));
  seller.cash = 499;
  assert.equal(contractIsLegal(G, c), false);
});

test('a settled sale moves the square one way and the money the other', () => {
  const { G, seller, buyer, sq } = shortOfASet();
  buyer.cash = 3000;
  seller.cash = 100;
  settleContract(G, { from: seller.i, to: buyer.i, give: sq, get: null,
                      cash: 700, direction: 2 });
  assert.equal(holding(seller, sq), null, 'the seller no longer holds it');
  assert.ok(holding(buyer, sq), 'the buyer does');
  assert.equal(buyer.cash, 2300);
  assert.equal(seller.cash, 800);
});

/* --------------------------------------------------------- refusing a sale */

test('a refused sale is remembered, so it is not proposed again next turn', () => {
  const { G, seller, buyer, sq } = shortOfASet();
  const c = seekSale(G, seller);
  assert.ok(c);

  assert.equal(refusalBlocks(G, seller.i, buyer.i, sq), false, 'nothing refused yet');
  recordRefusal(G, c);
  assert.ok(refusalBlocks(G, seller.i, buyer.i, sq),
    'recording only the get-side of a sale records nothing at all, and the ask returns every turn');
  assert.equal(seekSale(G, seller), null, 'and seekSale drops it');
});
