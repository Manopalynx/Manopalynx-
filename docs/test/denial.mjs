// How often does Varan reach for a denial, and how often does one exist at all?
// Not a test — a measuring instrument. Run: node docs/test/denial.mjs [games]
import { BOARD } from '../data.js';
import { createGame, current, roll, resolveLanding, applyCard, endTurn, buy,
         openAuction, submitBid, closeAuction, submitClaim, closeContest,
         aiWantsToBuy, aiDevelop, seekContract, proposeContract, respondToContract,
         denialTargets, setCompletingTargets, autoSettle, settleNow } from '../engine.js';

const seats = [
  { name: 'Sam', kind: 'human' },
  { name: 'Meelah', kind: 'human' },
  { name: 'Spector', kind: 'ai', persona: 'spector' },
  { name: 'Varan', kind: 'ai', persona: 'varan' }
];
const GAMES = +(process.argv[2] || 60);
let chances = 0, taken = 0, hadOwnSet = 0, turnsWithVaran = 0;

for (let seed = 1; seed <= GAMES; seed++) {
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
        openAuction(G, p.pos);
        break;
      }
      case 'auction':
        if (G.auction.resolved) { closeAuction(G); break; }
        submitBid(G, G.auction.queue[G.auction.at],
          Math.floor(G.players[G.auction.queue[G.auction.at]].cash / 4));
        break;
      case 'contest':
        if (G.contest.resolved) { closeContest(G); break; }
        submitClaim(G, G.contest.queue[G.contest.at],
          Math.floor(G.players[G.contest.queue[G.contest.at]].cash * 0.3));
        break;
      case 'contract': respondToContract(G, true); break;
      case 'end': {
        if (p.persona === 'varan' && !p.debt) {
          turnsWithVaran++;
          const denials = denialTargets(G, p);
          const own = setCompletingTargets(G, p);
          if (denials.length) {
            chances++;
            if (own.length) hadOwnSet++;
            const c = seekContract(G, p, 'varan');
            if (c && denials.some(d => d.sq === c.get)) taken++;
          }
        }
        if (p.kind === 'ai') aiDevelop(G, p);
        if (G.phase === 'contract') respondToContract(G, true);
        if (G.over) break;
        endTurn(G); break;
      }
      default: steps = 400000;
    }
  }
}
console.log(`over ${GAMES} games at 72 circuits`);
console.log(`  Varan turns where he could act        ${turnsWithVaran}`);
console.log(`  ... a denial target existed           ${chances} (${(chances / turnsWithVaran * 100).toFixed(1)}% of his turns)`);
console.log(`  ... of those, he already had a set to close  ${hadOwnSet}`);
const free = chances - hadOwnSet;
console.log(`  ... he went for the denial            ${taken} (${(taken / Math.max(1, chances) * 100).toFixed(1)}% of chances)`);
console.log(`  ... ignoring turns where closing his own set came first, ${(taken / Math.max(1, free) * 100).toFixed(1)}%`);
