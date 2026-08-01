// Verifies the published traffic table against the engine that actually moves
// the pieces.
//
// TRAFFIC is not decoration: the game shows it to players as strategy
// information, and paybackTurns() divides by it. If the board's movement rules
// ever drift from the table — a card retargeted, the Facility rules changed,
// a square inserted — nothing would crash and no figure would look odd. The
// game would simply advise players badly for the rest of its life.

import test from 'node:test';
import assert from 'node:assert/strict';

import { BOARD, N, JAIL, TRAFFIC } from '../data.js';
import { createGame, current, roll, resolveLanding, applyCard, endTurn } from '../engine.js';

const ROLLS = 400_000;
const TOLERANCE = 0.5;         // percentage points

// One player, buying nothing. Ownership cannot affect where the dice land, so a
// solo game measures pure movement with no rent, auctions or vassalage in the way.
function measure(seed) {
  const G = createGame({
    seats: [{ name: 'Surveyor', kind: 'human' }],
    seed,
    circuits: Number.MAX_SAFE_INTEGER
  });
  const p = current(G);
  const landings = new Array(N).fill(0);
  let counted = 0;

  while (counted < ROLLS) {
    const result = roll(G);
    // A turn spent held in the Facility is not a landing — the piece did not
    // arrive anywhere. Counting those would inflate square 7 by roughly 6pp.
    if (result && result.held) { G.phase = 'end'; endTurn(G); continue; }

    let guard = 0;
    while (guard++ < 12) {
      if (G.phase === 'landed') { resolveLanding(G); continue; }
      if (G.phase === 'card') { applyCard(G); continue; }
      break;
    }
    landings[p.pos]++;
    counted++;
    G.phase = 'end';
    endTurn(G);
  }
  return landings.map(v => v / counted * 100);
}

test('the published traffic table matches the engine that moves the pieces', () => {
  const measured = measure(20260801);
  const rows = measured.map((v, i) => ({
    i, name: BOARD[i].n, published: TRAFFIC[i], measured: v, delta: v - TRAFFIC[i]
  }));
  const worst = rows.reduce((a, b) => Math.abs(b.delta) > Math.abs(a.delta) ? b : a);

  for (const r of rows) {
    assert.ok(
      Math.abs(r.delta) <= TOLERANCE,
      `square ${r.i} (${r.name}): published ${r.published.toFixed(2)}%, ` +
      `engine produces ${r.measured.toFixed(2)}% — off by ${r.delta.toFixed(2)}pp`
    );
  }
  // Reported so a drift that stays inside tolerance is still visible.
  console.log(`    traffic worst deviation: ${worst.delta >= 0 ? '+' : ''}${worst.delta.toFixed(2)}pp ` +
              `on ${worst.i} (${worst.name})`);
});

test('the Holding Facility is the most-landed square by a wide margin', () => {
  const rest = TRAFFIC.filter((_, i) => i !== JAIL);
  assert.ok(TRAFFIC[JAIL] > Math.max(...rest) * 1.7,
    'the Facility should dominate the board — Eden is priced on sitting just past it');
});

test('Absorbed is never a resting square', () => {
  const measured = measure(12345);
  assert.equal(measured[21], 0, 'a piece cannot end a turn on Absorbed');
});
