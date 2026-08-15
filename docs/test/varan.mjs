// What does an opponent actually demand for one square, in cash?
//
// Not a test -- a measuring instrument. Run: node docs/test/varan.mjs [games]
//
// Reported from play: "Varan doesn't seem to accept any offer that's within
// reason. He currently has 0 money and I'm offering him 500 for a square that
// costs 180, and I have none of that colour."
//
// The offer being priced here is exactly that one, built at real game states:
// the human gives cash and nothing else, receives ONE square the opponent
// holds, and holds none of that square's colour set -- so no threat premium
// can be the explanation.
//
// The price is found by BINARY SEARCH ON aiAcceptsContract ITSELF rather than
// by rebuilding the bar arithmetic here. acceptanceBar is not exported and the
// point is to measure what the game does, not what a second copy of the formula
// in this file would do. Two copies of a rule is how the last defect got in.
//
// ratio is the least acceptable cash divided by the square's LIST price, so
// 2.0 means "he wants double what it says on the board". `leading` splits on
// whether the proposer is top of the table by net worth at that moment, because
// acceptanceBar adds a flat 260 against the leader for Varan alone.

import { BOARD, SETS } from '../data.js';
import { playGame } from './harness.mjs';
import { aiAcceptsContract, netWorth, ownerOf } from '../engine.js';

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
const CEILING = 40000;   // far above any cash any player ever holds

// The least cash that flips the real acceptance test, or null if nothing does.
function priceOf(G, them, proposer, sq) {
  const offer = cash => aiAcceptsContract(G, them, proposer, {
    give: null, get: sq, cash, direction: 1
  });
  if (offer(0)) return 0;
  if (!offer(CEILING)) return null;         // no price carries it at all
  let lo = 0, hi = CEILING;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (offer(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

const stats = new Map();   // persona -> { leading: [], trailing: [], refusals, samples }
const bucket = p => {
  if (!stats.has(p)) stats.set(p, { leading: [], trailing: [], refusals: 0, cashAt: [] });
  return stats.get(p);
};

for (let seed = 1; seed <= N; seed++) {
  playGame({
    seats: SEATS, seed, circuits: CIRCUITS,
    onTurn: g => {
      // Sample sparsely: this is an expensive question to ask.
      if (g.turn % 17) return;
      const me = g.players[0];
      const leader = [...g.players].sort((a, b) => netWorth(g, b) - netWorth(g, a))[0];
      const iLead = leader.i === me.i;
      for (const them of g.players) {
        if (them.kind !== 'ai') continue;
        const b = bucket(them.persona);
        for (const h of them.holdings) {
          const set = BOARD[h.sq].s;
          if (!set) continue;
          // Only squares in a colour set I hold NONE of, so a threat premium
          // is not what is being measured.
          const mine = SETS[set].sq.filter(i => {
            const o = ownerOf(g, i);
            return o && o.i === me.i;
          }).length;
          if (mine) continue;
          const price = priceOf(g, them, me, h.sq);
          if (price === null) { b.refusals++; continue; }
          const ratio = price / BOARD[h.sq].pr;
          (iLead ? b.leading : b.trailing).push(ratio);
          b.cashAt.push(them.cash);
        }
      }
    }
  });
}

const median = a => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const fmt = v => v === null ? '  --' : v.toFixed(2);

console.log(`\n${N} games, ${CIRCUITS} circuits. One square, cash only, no set of mine touched.`);
console.log('Ratio = least cash the opponent accepts, over the square\'s list price.\n');
console.log('  persona    samples   median x list   when I lead   when I do not   no price at all   median cash held');
for (const [p, b] of stats) {
  const all = [...b.leading, ...b.trailing];
  console.log(
    `  ${p.padEnd(10)}${String(all.length).padStart(8)}` +
    `${fmt(median(all)).padStart(16)}` +
    `${fmt(median(b.leading)).padStart(14)}` +
    `${fmt(median(b.trailing)).padStart(16)}` +
    `${String(b.refusals).padStart(18)}` +
    `${String(median(b.cashAt) ?? '--').padStart(19)}`
  );
}

// The headline: how often is the asking price more than double the board price?
console.log('');
for (const [p, b] of stats) {
  const all = [...b.leading, ...b.trailing];
  if (!all.length) continue;
  const over = all.filter(r => r > 2).length;
  const over3 = all.filter(r => r > 3).length;
  console.log(`  ${p.padEnd(10)} wants more than 2x list ${String(Math.round(over / all.length * 100)).padStart(3)}% of the time, more than 3x ${String(Math.round(over3 / all.length * 100)).padStart(3)}%`);
}
console.log('');
