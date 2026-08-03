// The tithe, and the second ledger it pays for.
//
// Both halves of vassalage were unreachable. Strength — what a vassal buries
// against their overlord — came only from the overlord's cut of rent the VASSAL
// collected, and a vassal is by definition somebody who ran out of money, so
// almost nobody lands on their squares. Measured over 80 games it reached a
// median of 0 and a maximum of 87 against the 1400 then needed: not one
// declaration of independence in 128 arrangements. And the tithe rate that was
// supposed to drive it was one line of random for all three opponents, landing
// at 30.3%, 33.0% and 30.7% — the same number three times.
//
// Neither failed. The mechanic ran exactly as written, for every game.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SETS, RULES } from '../data.js';
import {
  createGame, setTithe, aiTithe, endTurn, revoltThreshold, declareIndependence,
  netWorth, holdingsValue
} from '../engine.js';

function table(personas = ['spector', 'spector']) {
  return createGame({
    seats: personas.map((x, i) => x === 'human'
      ? { name: 'H' + i, kind: 'human' }
      : { name: x + i, kind: 'ai', persona: x }),
    seed: 5, circuits: 72
  });
}
const swear = (G, vassal, lord) => { vassal.lord = lord.i; lord.vassals.push(vassal.i); };
const LAST_CIRCUIT = 71;                       // one short of the default 72

/* ------------------------------------------------------------- the clock */

test('a vassal gains strength at the tithe rate, every turn held', () => {
  const G = table();
  const [lord, vassal] = G.players;
  swear(G, vassal, lord);
  setTithe(G, lord, 40);
  vassal.strength = 0;

  G.cur = lord.i;
  G.phase = 'end';
  endTurn(G);
  assert.equal(vassal.strength, 40, 'one turn under a 40% tithe is 40 buried');

  G.cur = lord.i;
  G.phase = 'end';
  endTurn(G);
  assert.equal(vassal.strength, 80);
});

test('the rate is the clock — a heavier tithe arms them sooner', () => {
  const turnsToArm = rate => {
    const G = table();
    const [lord, vassal] = G.players;
    swear(G, vassal, lord);
    setTithe(G, lord, rate);
    vassal.strength = 0;
    let n = 0;
    while (vassal.strength < revoltThreshold(vassal) && n < 500) {
      G.cur = lord.i; G.phase = 'end'; endTurn(G); n++;
    }
    return n;
  };
  const heavy = turnsToArm(55), light = turnsToArm(10);
  assert.ok(heavy < light, `${heavy} turns at 55% against ${light} at 10%`);
  assert.ok(light > heavy * 3, 'the two ends of the dial have to be a real distance apart');
});

test('nobody who holds nobody accrues anything', () => {
  const G = table();
  const [lord] = G.players;
  setTithe(G, lord, 55);
  G.cur = lord.i; G.phase = 'end';
  assert.doesNotThrow(() => endTurn(G));
});

/* ------------------------------------------------- the price of declaring */

test('an opponent faces exactly the bar the interface quotes a human', () => {
  const G = table(['spector', 'human']);
  const [lord, human] = G.players;
  swear(G, human, lord);
  human.strength = revoltThreshold(human);
  human.cash = RULES.revoltCost;
  assert.ok(declareIndependence(G, human), 'the cost is the cost');
  assert.equal(human.lord, null);
  assert.equal(human.cash, 0, 'and it is spent');
});

test('a credit short is a credit short', () => {
  const G = table();
  const [lord, vassal] = G.players;
  swear(G, vassal, lord);
  vassal.strength = revoltThreshold(vassal);
  vassal.cash = RULES.revoltCost - 1;
  assert.equal(declareIndependence(G, vassal), false);
  assert.equal(vassal.lord, lord.i);
});

/* --------------------------------------------------------- setting the rate */

// An opponent used to assign p.tithe directly, skipping the ledger line. A
// human's change was entered; Varan swinging from 10% to 55% was silent — and
// the rate is the clock on a vassal's freedom.
test('every change of rate is entered in the ledger', () => {
  const G = table();
  const [lord] = G.players;
  const before = G.log.length;
  assert.ok(setTithe(G, lord, 55));
  assert.ok(G.log.length > before, 'nothing was written down');
  assert.ok(/sets the tithe at 55%/.test(G.log[0].text));
});

test('setting it to what it already is writes nothing', () => {
  const G = table();
  const [lord] = G.players;
  setTithe(G, lord, 40);
  const after = G.log.length;
  assert.equal(setTithe(G, lord, 40), false);
  assert.equal(G.log.length, after, 'the ledger would fill with a rate that never moved');
});

test('a rate that is not on the menu is refused', () => {
  const G = table();
  const [lord] = G.players;
  setTithe(G, lord, 999);
  assert.ok(RULES.titheRates.includes(lord.tithe), `${lord.tithe}% is not a rate anyone may set`);
});

/* --------------------------------------------------------------- character */

test('Varan takes the top of the range and Vale the bottom', () => {
  const rate = persona => {
    const G = table([persona, 'spector']);
    const [lord, vassal] = G.players;
    swear(G, vassal, lord);
    aiTithe(G, lord);
    return lord.tithe;
  };
  assert.equal(rate('varan'), Math.max(...RULES.titheRates), 'the terms are meant to be punitive');
  assert.equal(rate('vale'), Math.min(...RULES.titheRates), 'you may keep your flag');
});

// Spector holds them to the end and then takes everything, because by then
// nothing has time to happen. The rate is the highest that cannot arm a vassal
// in the circuits remaining.
test('Spector eases up as the swarm closes', () => {
  const at = circuit => {
    const G = table(['spector', 'vale']);
    const [lord, vassal] = G.players;
    swear(G, vassal, lord);
    G.circuit = circuit;
    aiTithe(G, lord);
    return lord.tithe;
  };
  const early = at(1), late = at(LAST_CIRCUIT);
  assert.ok(late > early, `${late}% at the end against ${early}% at the start`);
  assert.equal(late, Math.max(...RULES.titheRates), 'at the last circuit there is nothing to lose');
});

// The tithe sheet promises a human that their overlord cannot see how close
// they are. An opponent that read it would be playing a different game from the
// one the interface describes.
test('and he does not read what he is promised not to see', () => {
  const rateWith = strength => {
    const G = table(['spector', 'vale']);
    const [lord, vassal] = G.players;
    swear(G, vassal, lord);
    G.circuit = 40;
    vassal.strength = strength;
    aiTithe(G, lord);
    return lord.tithe;
  };
  const armed = RULES.revoltBase - 1;           // all but ready to declare
  assert.equal(rateWith(0), rateWith(armed),
    'his rate moved with a number the interface says he cannot see');
});

/* ------------------------------------------------- what the rate is really for */

// Not income. Measured, a tithe returns ₡0.3 a turn against ₡108 of upkeep.
// What it scales is the share of a vassal's holdings that counts toward the
// overlord's total — which is why squeezing is worth anything at all.
test('the rate scales what a vassal adds to your total', () => {
  const G = table();
  const [lord, vassal] = G.players;
  swear(G, vassal, lord);
  vassal.holdings.push({ sq: SETS.eni.sq[0], garrisons: 0, citadel: 0, mortgaged: 0 });

  setTithe(G, lord, 10);
  const light = netWorth(G, lord);
  setTithe(G, lord, 55);
  const heavy = netWorth(G, lord);
  assert.ok(heavy > light, 'a heavier tithe has to be worth something, or there is no decision');
  assert.equal(heavy - light,
    Math.floor(holdingsValue(vassal) * 0.55) - Math.floor(holdingsValue(vassal) * 0.10));
});
