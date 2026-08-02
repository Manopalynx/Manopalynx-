// The last two things an opponent could not do: settle with the Overseer to
// walk out of detention, and amend the manifest to move one square along.
//
// Both were human-only buttons. Measured over 40 games: an opponent sat 924
// detained turns and in 371 of them was holding the fee several times over,
// and 10.5% of landings had a cheaper square one step along that it could
// afford to move to.
//
// Neither of these fixes a broken opponent — they make a working one harder to
// beat — so what is pinned here is that each decision has a reason behind it
// and that the three personas differ in the direction they are meant to.

import test from 'node:test';
import assert from 'node:assert/strict';

import { BOARD, SETS, RULES } from '../data.js';
import {
  createGame, roll, aiPayFacilityFee, openBoardFraction, landingCost, aiAmend,
  amendCost, ownerOf
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

// Hand out every buyable square except `leave` of them, so openBoardFraction
// lands where the test wants it.
function buyUpBoard(G, leave) {
  const buyable = BOARD.map((b, i) => b.pr ? i : -1).filter(i => i >= 0);
  const owner = G.players[G.players.length - 1];
  for (const sq of buyable.slice(0, buyable.length - leave)) {
    if (!ownerOf(G, sq)) hold(owner, sq);
  }
}

/* ------------------------------------------------------ leaving detention */

test('a full board is worth paying to get out onto', () => {
  const G = table();
  const p = G.players[0];
  p.inFacility = true;
  p.cash = 3000;
  assert.ok(openBoardFraction(G) > 0.9, 'nothing is owned yet');

  assert.ok(aiPayFacilityFee(G, p));
  assert.equal(p.inFacility, false);
  assert.equal(p.cash, 3000 - RULES.facilityFee);
  assert.equal(p.attempts, 0);
});

test('a bought-up board is not, and it stays where it is', () => {
  const G = table();
  const p = G.players[0];
  buyUpBoard(G, 0);
  p.inFacility = true;
  p.cash = 3000;
  assert.equal(openBoardFraction(G), 0, 'every square is spoken for');

  assert.equal(aiPayFacilityFee(G, p), false,
    'a lap of a finished board is a tour of everyone else\'s citadels');
  assert.ok(p.inFacility);
  assert.equal(p.cash, 3000);
});

test('it does not pay the fee into a settlement', () => {
  const G = table();
  const p = G.players[0];
  p.inFacility = true;
  p.cash = RULES.facilityFee + RULES.facilityFeeReserve - 1;
  assert.equal(aiPayFacilityFee(G, p), false);
  assert.ok(p.inFacility);
});

test('a favour in hand is spent instead of the fee', () => {
  const G = table();
  const p = G.players[0];
  p.inFacility = true;
  p.cash = 3000;
  p.pardons = 1;
  assert.equal(aiPayFacilityFee(G, p), false, 'the free way out is not a decision');

  // roll() is where both are reached, and it prefers the favour.
  G.phase = 'roll';
  roll(G, 2, 5);
  assert.equal(p.inFacility, false);
  assert.equal(p.pardons, 0);
  assert.equal(p.cash, 3000, 'and it cost nothing');
});

test('Varan pays almost to the end of the board; Vale sits down early', () => {
  // A board bought up to somewhere between the two thresholds.
  const between = (RULES.facilityPayUntil.varan + RULES.facilityPayUntil.vale) / 2;
  const buyable = BOARD.filter(b => b.pr).length;
  const out = persona => {
    const G = table([persona, 'human']);
    buyUpBoard(G, Math.round(buyable * between));
    const p = G.players[0];
    p.inFacility = true;
    p.cash = 3000;
    return aiPayFacilityFee(G, p);
  };
  assert.ok(out('varan'), 'he will not sit in an improperly documented facility');
  assert.equal(out('vale'), false, 'he shall address the crowd from here');
});

test('a human is never moved out of the cell for free', () => {
  const G = table(['human', 'spector']);
  const p = G.players[0];
  p.inFacility = true;
  p.cash = 3000;
  G.phase = 'roll';
  roll(G, 2, 5);
  assert.ok(p.inFacility, 'the buttons are the human\'s to press');
  assert.equal(p.cash, 3000);
});

/* ------------------------------------------------------ amending the manifest */

test('what a square costs to stand on', () => {
  const G = table();
  const [p, other] = G.players;
  const sq = SETS.eni.sq[0];
  hold(other, sq);

  assert.ok(landingCost(G, p, sq) > 0, 'somebody else\'s square costs rent');
  assert.equal(landingCost(G, p, 0), 0, 'a corner costs nothing');

  const taxSq = BOARD.findIndex(b => b.t === 'tax');
  assert.equal(landingCost(G, p, taxSq), BOARD[taxSq].amt);

  const pledged = SETS.eni.sq[1];
  hold(other, pledged, { mortgaged: 1 });
  assert.equal(landingCost(G, p, pledged), 0, 'a pledged square earns nobody anything');
});

test('it does not amend to dodge a small rent', () => {
  const G = table();
  const [p, other] = G.players;
  // A bare Syndicate square: rent 2. Nowhere near ₡500.
  const sq = SETS.syn.sq[0];
  hold(other, sq);
  p.pos = sq;
  p.cash = 5000;
  G.phase = 'landed';

  assert.equal(aiAmend(G, p), null);
  assert.equal(p.pos, sq);
  assert.equal(p.amends, RULES.amendsPerGame, 'and it did not spend one');
});

test('it does amend off a citadel', () => {
  const G = table();
  const [p, other] = G.players;
  const set = SETS.bas.sq;                       // the dear end of the board
  set.forEach(sq => hold(other, sq));
  const cit = set[0];
  const h = other.holdings.find(x => x.sq === cit);
  h.citadel = 1; h.garrisons = 0;

  p.pos = cit;
  p.cash = 6000;
  G.phase = 'landed';
  const before = p.cash;

  const r = aiAmend(G, p);
  assert.ok(r, 'a citadel is what this is for');
  assert.equal(p.pos, (cit + 1) % BOARD.length);
  assert.equal(p.amends, RULES.amendsPerGame - 1);
  assert.ok(before - p.cash >= RULES.amendCosts[0], 'and it paid for it');
  assert.deepEqual(r.path, [(cit + 1) % BOARD.length], 'the step is walkable');
});

test('it will not amend itself broke', () => {
  const G = table();
  const [p, other] = G.players;
  const set = SETS.bas.sq;
  set.forEach(sq => hold(other, sq));
  const h = other.holdings.find(x => x.sq === set[0]);
  h.citadel = 1;

  p.pos = set[0];
  p.cash = amendCost(p) + RULES.amendReserve - 1;
  G.phase = 'landed';

  assert.equal(aiAmend(G, p), null, 'the reserve is the point of the reserve');
  assert.equal(p.pos, set[0]);
});

test('a human is never nudged off a square by the engine', () => {
  const G = table(['human', 'spector']);
  const [p, other] = G.players;
  const set = SETS.bas.sq;
  set.forEach(sq => hold(other, sq));
  other.holdings.find(x => x.sq === set[0]).citadel = 1;
  p.pos = set[0];
  p.cash = 9000;
  G.phase = 'landed';

  assert.equal(aiAmend(G, p), null);
  assert.equal(p.pos, set[0]);
  assert.equal(p.amends, RULES.amendsPerGame);
});

test('Varan reaches for the paperwork sooner than Vale', () => {
  // A saving between the two margins: worth it to Varan, not to Vale.
  const at = persona => {
    const G = table([persona, 'human']);
    const [p, other] = G.players;
    const set = SETS.ven.sq;
    set.forEach(sq => hold(other, sq));
    const h = other.holdings.find(x => x.sq === set[0]);
    h.garrisons = 3;
    p.pos = set[0];
    p.cash = 9000;
    G.phase = 'landed';
    return { moved: !!aiAmend(G, p), saving: landingCost(G, p, set[0]) };
  };
  const varan = at('varan'), vale = at('vale');
  const fee = RULES.amendCosts[0];
  assert.ok(varan.saving > fee * RULES.amendMargin.varan
         && varan.saving < fee * RULES.amendMargin.vale,
    `fixture must sit between the margins (saving ${varan.saving}, fee ${fee})`);
  assert.ok(varan.moved, 'Varan files the amendment');
  assert.equal(vale.moved, false, 'Vale would rather pay the rent than make a fuss');
});
