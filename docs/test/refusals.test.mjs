// An opponent that has been told no.
//
// Before this, a refusal was written to the log and forgotten. seekContract
// re-derived the same best target every turn — the square that closes its set,
// which had not changed — and asked for it again, identically. Measured over 30
// games against a seat that always refuses: 71 proposals a game, one every
// circuit, 95% of them exact repeats, and one contract re-proposed 96 times in a
// single game. Every one of those parks the game in the 'contract' phase waiting
// for a human to answer it.
//
// Nothing about that failed. No figure was wrong and nothing crashed; the game
// was simply exhausting to play. The same measurement now reports 6.0 proposals
// a game, 0.09 a circuit, and a worst case of 3 — which is the cap.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SETS, BOARD, RULES } from '../data.js';
import {
  createGame, seekContract, proposeContract, respondToContract,
  recordRefusal, refusalFor, refusalBlocks
} from '../engine.js';

// Two players, and a set the first can close by taking one square off the second.
// `purse` matters: against a human the opponent offers its whole ceiling at
// once, and that ceiling is the lesser of what it thinks the square is worth
// and what it can spare. Starting it poor is how a later offer can honestly be
// better — it could not afford more at the time, and now it can. With a fixed
// board and a full purse it correctly never returns, having already bid its
// maximum, which is what caught these fixtures out.
function board(purse = 4000) {
  const G = createGame({
    seats: [{ name: 'A', kind: 'ai', persona: 'spector' }, { name: 'B', kind: 'human' }],
    seed: 5, circuits: 72
  });
  const set = SETS.eni.sq;                       // three Enigma squares
  const hold = (p, sq) => p.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged: 0 });
  hold(G.players[0], set[0]);
  hold(G.players[0], set[1]);
  hold(G.players[1], set[2]);                    // B holds the one A needs
  G.players[0].cash = purse;
  G.players[1].cash = 4000;
  return { G, want: set[2] };
}

test('the opponent asks for the square that closes its set', () => {
  const { G, want } = board();
  const c = seekContract(G, G.players[0]);
  assert.ok(c, 'no contract was sought at all');
  assert.equal(c.get, want);
  assert.equal(c.to, 1);
});

test('a refusal is written down', () => {
  const { G, want } = board();
  const c = seekContract(G, G.players[0]);
  proposeContract(G, c);
  assert.equal(G.phase, 'contract', 'a proposal to a human must park for an answer');
  respondToContract(G, false);
  const rec = refusalFor(G, 0, 1, want);
  assert.ok(rec, 'being told no left no trace');
  assert.equal(rec.count, 1);
  assert.equal(rec.sq, want);
});

test('and the same ask does not come straight back', () => {
  const { G } = board();
  proposeContract(G, seekContract(G, G.players[0]));
  respondToContract(G, false);
  assert.equal(seekContract(G, G.players[0]), null,
    'the opponent asked again on the very next turn, which is the whole defect');
});

test('having offered everything it had, it does not come back with the same', () => {
  const { G } = board();                       // rich: the first offer is its ceiling
  proposeContract(G, seekContract(G, G.players[0]));
  respondToContract(G, false);
  G.circuit += RULES.refusalCooldown + 40;
  assert.equal(seekContract(G, G.players[0]), null,
    'it bid its maximum, was refused, and asked again anyway');
});

test('it may return once it can actually afford more', () => {
  const { G, want } = board(500);              // poor: the purse caps the offer
  const first = seekContract(G, G.players[0]);
  assert.ok(first, 'no opening offer');
  const firstCash = first.cash;
  proposeContract(G, first);
  respondToContract(G, false);

  G.circuit += RULES.refusalCooldown;
  G.players[0].cash = 4000;                    // its position has improved
  const second = seekContract(G, G.players[0]);
  assert.ok(second, 'it can afford more and still never came back');
  assert.equal(second.get, want);
  assert.ok(second.cash >= Math.ceil(firstCash * RULES.refusalRaise),
    `came back at ${second.cash} against ${firstCash} — repeating itself, not negotiating`);
});

// Driven through recordRefusal rather than by playing it out, because in a
// fixed position the opponent's valuation binds before the cap can: it offers
// its ceiling, is refused, and cannot honestly beat its own number, so it stops
// after one. The cap only bites in a real game where valuations climb — the
// 30-game measurement bottoms out at exactly 3, which is this limit.
test('asked and answered: after the cap it stops for good', () => {
  const { G, want } = board(50000);
  for (let i = 0; i < RULES.refusalCap; i++) {
    recordRefusal(G, { from: 0, to: 1, get: want, cash: 10, direction: 1 });
  }
  const rec = refusalFor(G, 0, 1, want);
  assert.equal(rec.count, RULES.refusalCap);
  assert.ok(refusalBlocks(G, 0, 1, want), 'the square is not blocked at the cap');

  G.circuit += 200;
  assert.ok(refusalBlocks(G, 0, 1, want), 'the cap expired — it is a cooldown, not a cap');
  assert.equal(seekContract(G, G.players[0]), null,
    'two hundred circuits and fifty thousand credits later it is still asking');
});

// The point of keying on the board rather than on a timer. Picking up another
// square in the set genuinely changes the proposition, and an opponent that
// could not see that would be stubborn rather than principled.
test('the refusal lapses when the board moves under it', () => {
  const { G, want } = board();
  proposeContract(G, seekContract(G, G.players[0]));
  respondToContract(G, false);
  assert.ok(refusalBlocks(G, 0, 1, want), 'not blocked immediately after a refusal');

  // B picks up something else in the same set — a different deal now.
  const other = SETS.eni.sq.find(sq => sq !== want && !G.players[1].holdings.some(h => h.sq === sq));
  G.players[0].holdings = G.players[0].holdings.filter(h => h.sq !== other);
  G.players[1].holdings.push({ sq: other, garrisons: 0, citadel: 0, mortgaged: 0 });
  assert.equal(refusalBlocks(G, 0, 1, want), false,
    'the holdings changed and the old refusal still binds');
});

test('a refusal by one player does not silence the opponent toward another', () => {
  const { G, want } = board();
  recordRefusal(G, { from: 0, to: 1, get: want, cash: 100, direction: 1 });
  assert.ok(refusalBlocks(G, 0, 1, want));
  assert.equal(refusalBlocks(G, 0, 2, want), false, 'a different holder was silenced too');
  assert.equal(refusalBlocks(G, 2, 1, want), false, 'a different proposer was silenced too');
});

test('the record is bounded, so a long game cannot accumulate them forever', () => {
  const { G } = board();
  for (let i = 0; i < 400; i++) {
    recordRefusal(G, { from: 0, to: 1, get: (i % 40), cash: 10, direction: 1 });
  }
  assert.ok(G.refusals.length <= 80, `${G.refusals.length} refusals retained`);
});

test('an old save with no refusal list is still playable', () => {
  const { G } = board();
  delete G.refusals;
  delete G.humanAsked;
  assert.doesNotThrow(() => refusalBlocks(G, 0, 1, 6));
  assert.equal(refusalFor(G, 0, 1, 6), null);
  assert.doesNotThrow(() => seekContract(G, G.players[0]));
});

// The backstop, which is independent of any one opponent's memory. A proposal
// to a human parks the game waiting for an answer, so with three opponents each
// rolling for it the interruptions scale with the seat count.
test('opponents share one interruption of a human per circuit', () => {
  const G = createGame({
    seats: [{ name: 'You', kind: 'human' },
            { name: 'A', kind: 'ai', persona: 'spector' },
            { name: 'B', kind: 'ai', persona: 'varan' }],
    seed: 3, circuits: 72
  });
  G.humanAsked = G.circuit;
  assert.equal(G.humanAsked, G.circuit,
    'the circuit stamp is what aiDevelop checks before parking a proposal');
});
