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
  recordRefusal, refusalBlocks, holding, aiValue, redeemCost, ownsSet, rentOf,
  contractValue, netValue, aiCounter, aiAcceptsContract
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

/* ------------------------------------------------- trading a pledged square */

// A pledged square may now change hands. It is the only exit its owner has:
// measured over 40 games, a pledged square is one short of somebody else's set
// on 40% of all turns while its owner can afford to redeem it only 6.6% of the
// time, and the buyer's value net of the redemption was positive in all 13,254
// cases. Both sides wanted the deal and the rules forbade it.
//
// What makes it a deal rather than a giveaway is that the price knows about the
// redemption, and that the pledge travels with the square.

test('a pledged square is worth the redemption less than a live one', () => {
  const { G, seller, buyer, sq } = shortOfASet();
  const live = seekSale(G, seller).cash;

  holding(seller, sq).mortgaged = 1;
  const pledged = seekSale(G, seller).cash;

  assert.ok(pledged < live, `pledged ${pledged} is not below live ${live}`);
  assert.ok(live - pledged >= redeemCost(sq) * 0.5,
    `only ${live - pledged} came off for a redemption costing ${redeemCost(sq)}`);
});

test('the buyer is not charged twice — the price is net, not on top', () => {
  const { G, seller, buyer, sq } = shortOfASet();
  holding(seller, sq).mortgaged = 1;
  const c = seekSale(G, seller);
  assert.ok(c.cash + redeemCost(sq) <= buyer.cash,
    'the asking price plus the redemption is more than the buyer holds');
});

// The uplift is the whole reason one of these is worth buying, and the whole
// reason selling one is dangerous. It counts as owned, so it closes the set.
test('taking a pledged square still closes the set it belongs to', () => {
  const G = table();
  const [a, b] = G.players;
  const set = SETS.eni.sq;
  hold(a, set[0], { mortgaged: 1 });
  hold(b, set[1]); hold(b, set[2]);

  assert.equal(ownsSet(G, b, 'eni'), false);
  settleContract(G, { from: a.i, to: b.i, give: set[0], get: null, cash: 100, direction: 2 });
  assert.ok(ownsSet(G, b, 'eni'), 'a pledged square counts as owned');
  assert.equal(holding(b, set[0]).mortgaged, 1, 'and is still pledged');
  assert.ok(rentOf(G, set[1], 7) > BOARD[set[1]].r[0],
    'so the rent on its siblings doubled the moment it changed hands');
  assert.equal(rentOf(G, set[0], 7), 0, 'while it earns nothing itself');
});

test('an opponent values it as a dead square, not a live one', () => {
  const G = table();
  const [ai, them] = G.players;
  const set = SETS.eni.sq;
  hold(them, set[0]);
  hold(ai, set[1]); hold(ai, set[2]);

  const live = contractValue(G, ai, set[0], null, 0, them.i);
  holding(them, set[0]).mortgaged = 1;
  const dead = contractValue(G, ai, set[0], null, 0, them.i);

  assert.ok(dead < live, `a pledged square valued at ${dead} against a live ${live}`);
  assert.ok(live - dead >= redeemCost(set[0]) * 0.5,
    'the redemption barely registered in the valuation');
});

test('Varan will not make a monopoly a bargain', () => {
  const { G, seller } = shortOfASet('varan');
  hold(seller, SETS.dom.sq[0], { mortgaged: 1 });      // his distress gate
  const sq = SETS.eni.sq[0];

  assert.ok(seekSale(G, seller), 'he will sell the live one, at his own price');
  holding(seller, sq).mortgaged = 1;
  const offer = seekSale(G, seller);
  assert.ok(!offer || offer.give !== sq,
    'a pledged set-closer is the cheap version of the thing he refuses to do');
});

test('the others will sell one', () => {
  for (const persona of ['spector', 'vale']) {
    const { G, seller } = shortOfASet(persona);
    holding(seller, SETS.eni.sq[0]).mortgaged = 1;
    const c = seekSale(G, seller);
    assert.ok(c && c.give === SETS.eni.sq[0], `${persona} would not sell a pledged square`);
  }
});

/* -------------------------------------------------- countering a sale */

// aiCounter returned null for anything but an offer of cash, so a player trying
// to SELL was told no and given no figure. That direction only became reachable
// with seekSale, and it is the one a pledged square is nearly always disposed of
// through — so the half of the negotiation that names a price did not exist for
// exactly the half of the game this feature is about.
//
// The buyer here is an OPPONENT, not a human. proposeContract parks anything
// aimed at a human for them to answer themselves, so aiAcceptsContract is never
// asked to speak for one — a first draft of these tests put a human in that seat
// and failed against an engine that was behaving correctly.
function aiWantsTheSet(persona = 'spector') {
  const G = table([persona, 'human']);
  const [buyer, seller] = G.players;
  const set = SETS.eni.sq;
  hold(seller, set[0]);
  hold(buyer, set[1]);
  hold(buyer, set[2]);
  buyer.cash = 4000;
  return { G, buyer, seller, sq: set[0] };
}

test('refusing a sale names what they would pay', () => {
  const { G, buyer, seller, sq } = aiWantsTheSet();
  const c = { from: seller.i, to: buyer.i, give: sq, get: null,
              cash: 9000, direction: 2 };            // far too much
  assert.equal(aiAcceptsContract(G, buyer, seller, c), false, 'fixture must be refused');

  const counter = aiCounter(G, buyer, seller, c);
  assert.ok(counter, 'a refusal with no figure is a coin flip, not a negotiation');
  assert.equal(counter.direction, 2, 'still a sale');
  assert.equal(counter.give, sq);
  assert.ok(counter.cash < c.cash, 'they came down from what was asked');
  assert.ok(counter.cash <= buyer.cash, 'and named a figure they actually hold');
  assert.ok(aiAcceptsContract(G, buyer, seller, counter),
    'they named a figure they would then refuse, which is worse than saying nothing');
});

test('no counter when the price was already good enough', () => {
  const { G, buyer, seller, sq } = aiWantsTheSet();
  const c = { from: seller.i, to: buyer.i, give: sq, get: null, cash: 1, direction: 2 };
  assert.ok(aiAcceptsContract(G, buyer, seller, c), 'fixture must be accepted');
  assert.equal(aiCounter(G, buyer, seller, c), null, 'they would have taken it');
});

// "Opens below his ceiling" is testable directly: a figure one credit above the
// one they named is either still acceptable to them or it is not.
//
// Varan buys to DENY. A set he would be completing is one he prices at nothing,
// and a square that blocks a rival is one Spector prices at nothing — his branch
// discounts a set he has no foothold in to 0.55. So each is asked about the
// purchase his own character actually wants, and the assertion is about how he
// opens rather than about what he would pay.
function opensBelowCeiling(G, buyer, seller, sq) {
  const c = { from: seller.i, to: buyer.i, give: sq, get: null, cash: 9000, direction: 2 };
  const k = aiCounter(G, buyer, seller, c);
  assert.ok(k, 'no figure was named at all');
  assert.ok(aiAcceptsContract(G, buyer, seller, k), 'they would refuse their own figure');
  return aiAcceptsContract(G, buyer, seller, { ...k, cash: k.cash + 1 });
}

test('Spector names the true figure; Varan opens under his', () => {
  const forSpector = aiWantsTheSet('spector');
  assert.equal(
    opensBelowCeiling(forSpector.G, forSpector.buyer, forSpector.seller, forSpector.sq),
    false, 'Spector states the figure, so a credit more is a figure he refuses');

  // Varan is asked about the purchase his character actually wants: breaking a
  // set somebody else has closed. aiValue only pays its denial multiple when ONE
  // rival holds the whole group — including the square being sold — so the
  // seller here holds all three. Asked instead about a set he would be
  // completing, he prices it under his own acceptance bar and declines at any
  // price, which is in character and not a defect.
  const G = createGame({
    seats: [{ name: 'varan', kind: 'ai', persona: 'varan' }, { name: 'H', kind: 'human' }],
    seed: 5, circuits: 72
  });
  const [varan, seller] = G.players;
  const set = SETS.bas.sq;                    // dear enough to clear his bar
  set.forEach(sq => hold(seller, sq));
  varan.cash = 4000;
  assert.ok(opensBelowCeiling(G, varan, seller, set[0]),
    'Varan named his ceiling rather than opening under it');
});
