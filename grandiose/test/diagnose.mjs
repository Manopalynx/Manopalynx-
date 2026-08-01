// Why do games not reach absorption? Isolates the mechanism rather than
// guessing at it. Run: node grandiose/test/diagnose.mjs [games]
//
// Absorption can only happen on a payment to another PLAYER — a rent. So there
// are exactly three things that can be preventing it:
//   (a) rents are too small to exceed anyone's cash,
//   (b) rents are big enough but auto-liquidation always covers the gap,
//   (c) rents big enough to matter are never charged, because sets never complete.
// Each is measured below.

import { BOARD, SETS } from '../data.js';
import { rentOf, ownsSet, ownerOf } from '../engine.js';
import { playGame } from './harness.mjs';

const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });
const TABLES = {
  '2 seats': [HUMAN('Sam'), HUMAN('Meelah')],
  '3 seats': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector')],
  '4 seats': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector'), AI('Varan', 'varan')]
};
const GAMES = +(process.argv[2] || 60);
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const pct = v => (v * 100).toFixed(0).padStart(4) + '%';

// What a player could raise by breaking everything down and mortgaging it all.
function fireSale(p) {
  let v = 0;
  for (const h of p.holdings) {
    const b = BOARD[h.sq];
    const gc = b.s ? SETS[b.s].gc : 0;
    if (h.citadel) v += Math.floor(gc * 5 / 2);
    else v += h.garrisons * Math.floor(gc / 2);
    if (!h.mortgaged) v += Math.floor(b.pr / 2);
  }
  return v;
}

// The largest rent this player could be charged by anyone else, right now.
function worstExposure(G, p) {
  let worst = 0;
  for (let i = 0; i < BOARD.length; i++) {
    const o = ownerOf(G, i);
    if (!o || o.i === p.i) continue;
    worst = Math.max(worst, rentOf(G, i, 7));
  }
  return worst;
}

const rows = [];
for (const [label, seats] of Object.entries(TABLES)) {
  const rents = [], setsDone = [], holdings = [], turnsArr = [];
  let samples = 0, cashCovers = 0, needsNet = 0, wouldFall = 0;

  for (let seed = 1; seed <= GAMES; seed++) {
    const G = playGame({
      seats, seed, circuits: 24,
      onTurn: g => {
        for (const p of g.players) {
          const exposure = worstExposure(g, p);
          if (exposure <= 0) continue;
          samples++;
          if (p.cash >= exposure) cashCovers++;
          else if (p.cash + fireSale(p) >= exposure) needsNet++;
          else wouldFall++;
        }
        for (let i = 0; i < BOARD.length; i++) {
          const r = rentOf(g, i, 7);
          if (r > 0) rents.push(r);
        }
      }
    });
    setsDone.push(Object.keys(SETS).filter(k => G.players.some(p => ownsSet(G, p, k))).length);
    for (const p of G.players) holdings.push(p.holdings.length);
    turnsArr.push(G.turn);
  }

  rows.push({
    label,
    medRent: median(rents),
    maxRent: Math.max(...rents, 0),
    sets: (setsDone.reduce((a, b) => a + b, 0) / GAMES),
    holdings: median(holdings),
    turns: Math.round(turnsArr.reduce((a, b) => a + b, 0) / GAMES),
    cashCovers: cashCovers / samples,
    needsNet: needsNet / samples,
    wouldFall: wouldFall / samples
  });
}

console.log('\nRent actually on the board\n');
console.log('table     median rent  largest rent  sets completed  median holdings  turns');
for (const r of rows) {
  console.log(`${r.label}   ${String(r.medRent).padStart(11)}  ${String(r.maxRent).padStart(12)}  ` +
    `${r.sets.toFixed(1).padStart(14)}  ${String(r.holdings).padStart(15)}  ${String(r.turns).padStart(5)}`);
}

console.log('\nAgainst the largest rent each player is exposed to, how are they placed?\n');
console.log('table     cash covers it  needs the safety net  would actually fall');
for (const r of rows) {
  console.log(`${r.label}   ${pct(r.cashCovers).padStart(14)}  ${pct(r.needsNet).padStart(20)}  ${pct(r.wouldFall).padStart(19)}`);
}
console.log('\n"would actually fall" is the ceiling on how often absorption can ever fire.\n');
