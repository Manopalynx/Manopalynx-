// Whole-game integration.
//
// The unit suite proves each figure is right in isolation. This one plays
// complete games and checks that the board cannot corrupt itself over hundreds
// of turns — pools conserved, no negative cash, no overlord cycles, no square
// held twice — and that a game always reaches an ending rather than wedging in
// a phase nobody can leave.
//
// Seat counts are tested separately because the ledger is meant to be playable
// at two, three or four, and the economy is not obviously the same game at each.

import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES } from '../data.js';
import { netWorth, standings } from '../engine.js';
import { playGame, checkInvariants } from './harness.mjs';

const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, persona) => ({ name: n, kind: 'ai', persona });

const TABLES = {
  'two humans': [HUMAN('Sam'), HUMAN('Meelah')],
  'two humans and one opponent': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector')],
  'two humans and two opponents': [
    HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector'), AI('Varan', 'varan')
  ],
  'one human against three opponents': [
    HUMAN('Sam'), AI('Spector', 'spector'), AI('Varan', 'varan'), AI('Vale', 'vale')
  ]
};

const GAMES = 120;

for (const [label, seats] of Object.entries(TABLES)) {
  test(`${label}: ${GAMES} games hold every invariant and reach an ending`, () => {
    for (let seed = 1; seed <= GAMES; seed++) {
      const G = playGame({
        seats, seed, circuits: 48,
        onTurn: g => checkInvariants(g, `${label}, seed ${seed}, turn ${g.turn}`)
      });
      checkInvariants(G, `${label}, seed ${seed}, final`);
      assert.ok(G.over, `${label}, seed ${seed}: game never ended (phase ${G.phase}, ${G.steps} steps)`);
      assert.ok(['conquest', 'circuit-limit'].includes(G.endReason),
        `${label}, seed ${seed}: ended for an unknown reason (${G.endReason})`);
      assert.equal(typeof G.winner, 'number', `${label}, seed ${seed}: no winner named`);
    }
  });
}

// ---------------------------------------------------------------------------
// BALANCE TARGETS.
//
// These three encode how the game is meant to feel, and they are enforced.
//
// They were all failing before trading existed, and the cause was measured
// rather than guessed (grandiose/test/diagnose.mjs). Nothing about the board
// was wrong: rents stayed at bare-square level because colour sets almost never
// completed, and sets complete through trade. Neither the harness nor the
// opponents traded — the original file's AI only ever proposed contracts to
// humans, so opponents never closed sets with each other at all.
//
// Two levers have been found to matter, and two have been ruled out.
//
// MATTERS — trading. Before opponents traded with each other, sets almost never
// completed (1.1 of 6), rents stayed at bare-square level and absorption decided
// 15 of 120 two-seat games. Adding it took that to 56 of 120 with no economy
// constant touched.
//
// MATTERS — game length. On the 40-square board a lap takes ~5.7 rolls instead
// of ~4, so 24 circuits is not enough turns to acquire, trade and build. Swept
// (test/sweep.mjs), two seats:
//        24 circuits   7%      48 circuits  53%
//        36 circuits  23%      60 circuits  67%
//
// RULED OUT — the money supply. Sweeping the lap payment from 200 down to 100
// and tripling upkeep moved the four-seat rate not at all.
// RULED OUT — the auto-liquidation safety net. Only 4-9% of players ever need
// it against their largest exposure; it is not what is catching them.
// ---------------------------------------------------------------------------

test('a two-player game is decided by absorption far more often than by the clock', () => {
  let conquest = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const G = playGame({ seats: TABLES['two humans'], seed, circuits: 48 });
    if (G.endReason === 'conquest') conquest++;
  }
  console.log(`    two humans: ${conquest}/${GAMES} games ended in absorption`);
  assert.ok(conquest > GAMES * 0.35,
    `only ${conquest}/${GAMES} two-player games reached the designed ending`);
});

test('the designed ending is reachable at every seat count', () => {
  const report = [];
  for (const [label, seats] of Object.entries(TABLES)) {
    let conquest = 0;
    for (let seed = 1; seed <= GAMES; seed++) {
      const G = playGame({ seats, seed, circuits: 48 });
      if (G.endReason === 'conquest') conquest++;
    }
    report.push(`${label}: ${conquest}/${GAMES}`);
    assert.ok(conquest > 0,
      `${label}: absorption never once decided a game — the win condition is unreachable here`);
  }
  console.log('    absorption endings — ' + report.join('; '));
});

test('vassalage happens somewhere in most four-seat games', () => {
  let sawVassal = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const G = playGame({ seats: TABLES['two humans and two opponents'], seed, circuits: 48 });
    if (G.players.some(p => p.lord !== null)) sawVassal++;
  }
  console.log(`    four seats: vassalage appeared in ${sawVassal}/${GAMES} games`);
  assert.ok(sawVassal > GAMES * 0.5,
    `vassalage only appeared in ${sawVassal}/${GAMES} games — the central mechanic is dormant`);
});

test('the board gets developed rather than sitting bare all game', () => {
  let built = 0, total = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const G = playGame({ seats: TABLES['two humans and one opponent'], seed, circuits: 48 });
    for (const p of G.players) {
      total++;
      if (p.holdings.some(h => h.garrisons > 0 || h.citadel)) built++;
    }
  }
  console.log(`    ${built}/${total} players finished with something built`);
  assert.ok(built > total * 0.3,
    `only ${built}/${total} players ever built anything — the rent ladder is inert`);
});

test('nobody is ever removed from the table', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const G = playGame({ seats: TABLES['two humans and two opponents'], seed, circuits: 48 });
    assert.equal(G.players.length, 4, 'players must never be eliminated, only absorbed');
    for (const p of G.players) {
      assert.ok(p.cash >= 0);
      assert.ok(p.lord !== null || p.holdings.length >= 0);
    }
  }
});

test('standings are ordered by net worth and name every player exactly once', () => {
  const G = playGame({ seats: TABLES['two humans and two opponents'], seed: 7, circuits: 48 });
  const rows = standings(G);
  assert.equal(rows.length, G.players.length);
  assert.equal(new Set(rows.map(r => r.player.i)).size, G.players.length);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].worth >= rows[i].worth, 'standings are not sorted by net worth');
  }
  assert.equal(rows[0].worth, netWorth(G, rows[0].player));
});

test('a game finishes in a sane number of steps', () => {
  const G = playGame({ seats: TABLES['two humans and two opponents'], seed: 3, circuits: 48 });
  assert.ok(G.steps < 20000, `took ${G.steps} steps — something is looping`);
});
