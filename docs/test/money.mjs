// Where does the money go?
//
// Not a test -- a measuring instrument. Run: node docs/test/money.mjs [games]
//
// Reported from play: "much of the money leaves circulation through many
// different avenues -- cards, debt, upkeep, detention, amend."
//
// The engine's cash movements fall into three kinds, and only the first two
// change how much money exists:
//
//   ENTERS   pay() is never involved. p.cash += ... against the bank: passing
//            the Ledger, pledging a square, selling a garrison or citadel back,
//            and the paying half of a Contingency card.
//   LEAVES   pay(G, from, null, amount) -- a `to` of null means the bank. Tax,
//            upkeep, card penalties, the facility fee. Plus the direct
//            deductions that name no recipient: buying a square, building,
//            winning an auction or a contest, the cost of a revolt, redeeming
//            a pledge, and repaying a marker.
//   MOVES    from one player to another and nets to zero: rent, tithe, the
//            cash leg of a contract.
//
// What is measured here is the STOCK, not the flows: the sum of every player's
// cash, sampled once per circuit. That is deliberate. Attributing each credit
// to the avenue that took it needs the engine instrumented at every one of the
// 25 sites that move cash, and a mis-attributed total that looks precise is
// worse than an honest aggregate -- this file has shipped that mistake before.
// The stock is unarguable: it is the money the players are actually holding.
//
// Alongside it, the same players' wealth in squares, so the question "is the
// money gone, or has it turned into board?" can be answered rather than guessed.

import { RULES, BOARD, SETS } from '../data.js';
import { playGame } from './harness.mjs';
import { upkeep } from '../engine.js';

const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });
const SEATS = [
  HUMAN('Samuel'),
  AI('Spector', 'spector'),
  AI('High Commander Varan', 'varan'),
  AI('Adran Vale', 'vale')
];

const N = +(process.argv[2] || 30);
const CIRCUITS = +(process.argv[3] || 72);

// Sampled per circuit, then averaged across games at the same circuit.
const cashAt = new Map();     // circuit -> [total cash]
const boardAt = new Map();    // circuit -> [total list value of squares held]
const debtAt = new Map();     // circuit -> [total debt outstanding]
const upkeepAt = new Map();   // circuit -> [total upkeep billed that turn]
const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };

const started = RULES.startingCash * SEATS.length;

for (let seed = 1; seed <= N; seed++) {
  let lastCircuit = -1;
  playGame({
    seats: SEATS, seed, circuits: CIRCUITS,
    onTurn: g => {
      if (g.circuit === lastCircuit) return;
      lastCircuit = g.circuit;
      const cash = g.players.reduce((n, p) => n + p.cash, 0);
      const board = g.players.reduce((n, p) =>
        n + p.holdings.reduce((m, h) => m + BOARD[h.sq].pr, 0), 0);
      const debt = g.players.reduce((n, p) => n + p.debt, 0);
      const up = g.players.reduce((n, p) => n + upkeep(g, p), 0);
      push(cashAt, g.circuit, cash);
      push(boardAt, g.circuit, board);
      push(debtAt, g.circuit, debt);
      push(upkeepAt, g.circuit, up);
    }
  });
}

const avg = a => a && a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;

console.log(`\n${N} games, ${CIRCUITS} circuits, four seats.`);
console.log(`Everyone starts with ${RULES.startingCash}, so ${started} credits enter at the table.`);
console.log('\n  circuit   cash held   % of start   board at list   debt   upkeep/turn');

const circuits = [...cashAt.keys()].sort((a, b) => a - b);
for (const c of circuits) {
  if (c % 6 && c !== circuits[circuits.length - 1] && c !== 1) continue;
  const cash = avg(cashAt.get(c));
  console.log(
    `  ${String(c).padStart(7)}` +
    `${String(cash).padStart(12)}` +
    `${String(Math.round(cash / started * 100) + '%').padStart(13)}` +
    `${String(avg(boardAt.get(c))).padStart(16)}` +
    `${String(avg(debtAt.get(c))).padStart(7)}` +
    `${String(avg(upkeepAt.get(c))).padStart(14)}`
  );
}

// The turning point: the circuit at which the table holds the most cash it will
// ever hold. After that the board is taking money faster than it is giving it.
let peak = { c: 0, v: -1 };
for (const c of circuits) {
  const v = avg(cashAt.get(c));
  if (v > peak.v) peak = { c, v };
}
const last = circuits[circuits.length - 1];
const end = avg(cashAt.get(last));
console.log(`\n  Cash peaks at circuit ${peak.c} on ${peak.v} credits, ${Math.round(peak.v / started * 100)}% of what was dealt.`);
console.log(`  By circuit ${last} the table holds ${end}, which is ${Math.round(end / started * 100)}% of the start`);
console.log(`  and ${Math.round(end / Math.max(1, peak.v) * 100)}% of the peak.`);
console.log(`  Cash per player at the end: ${Math.round(end / SEATS.length)}. A single garrison on the`);
console.log(`  cheapest set costs ${Math.min(...Object.values(SETS).map(s => s.gc))}.\n`);
