// How often does a sealed bid end level? Not a test — a measuring instrument.
//   node docs/test/ties.mjs
//
// Both humans here bid the same round number, which is the worst case and also
// the likeliest one at a real table. Spread the bids and the rate goes to zero;
// the honest answer is that it depends entirely on how your table bids.
import { BOARD } from '../data.js';
import { createGame, current, roll, resolveLanding, applyCard, endTurn, buy,
         openAuction, submitBid, closeAuction, submitClaim, closeContest,
         aiWantsToBuy, aiDevelop, aiBid, autoSettle, settleNow } from '../engine.js';
const seats = [
  { name: 'Sam', kind: 'human' }, { name: 'Meelah', kind: 'human' },
  { name: 'Spector', kind: 'ai', persona: 'spector' }, { name: 'Varan', kind: 'ai', persona: 'varan' }
];
let auctions = 0, tiedTop = 0, tiedAny = 0, zeroAll = 0;
for (let seed = 1; seed <= 60; seed++) {
  const G = createGame({ seats, seed, circuits: 72 });
  let steps = 0;
  while (!G.over && steps++ < 400000) {
    const p = current(G);
    switch (G.phase) {
      case 'roll': roll(G); break;
      case 'landed': resolveLanding(G); break;
      case 'card': applyCard(G); break;
      case 'settle': autoSettle(G); settleNow(G); break;
      case 'offer': {
        const wants = p.kind === 'ai' ? aiWantsToBuy(G, p, p.pos) : p.cash > BOARD[p.pos].pr + 200;
        if (wants && buy(G, p)) break;
        openAuction(G, p.pos); break;
      }
      case 'auction': {
        if (G.auction.resolved) {
          const vals = Object.values(G.auction.bids).sort((a, b) => b - a);
          auctions++;
          if (vals.length > 1 && vals[0] === vals[1] && vals[0] > 0) tiedTop++;
          if (vals.every(v => v === 0)) zeroAll++;
          const seen = new Set(); let dup = false;
          for (const v of vals) { if (v > 0 && seen.has(v)) dup = true; seen.add(v); }
          if (dup) tiedAny++;
          closeAuction(G); break;
        }
        const who = G.auction.queue[G.auction.at];
        const q = G.players[who];
        // Humans bid a round number, which is exactly how ties happen at a real table.
        submitBid(G, who, q.kind === 'ai' ? aiBid(G, q, G.auction.sq)
          : Math.min(q.cash, Math.round(BOARD[G.auction.sq].pr / 50) * 50));
        break;
      }
      case 'contest':
        if (G.contest.resolved) { closeContest(G); break; }
        submitClaim(G, G.contest.queue[G.contest.at], 100); break;
      case 'end':
        if (p.kind === 'ai') aiDevelop(G, p);
        if (G.over) break;
        endTurn(G); break;
      default: steps = 400000;
    }
  }
}
const pc = n => (n / auctions * 100).toFixed(1) + '%';
console.log(`auctions over 60 games   ${auctions}`);
console.log(`  top bid was tied       ${tiedTop}  (${pc(tiedTop)})  <- these now go to a runoff`);
console.log(`  any two bids equal     ${tiedAny}  (${pc(tiedAny)})`);
console.log(`  nobody bid at all      ${zeroAll}  (${pc(zeroAll)})`);
