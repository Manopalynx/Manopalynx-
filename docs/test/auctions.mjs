// How much of the game is auctions, and how much of that is ceremony?
// Not a test — a measuring instrument. Run: node docs/test/auctions.mjs [games]
//
// TRUST THESE FIGURES: auctions per game, how many need a human to bid, and
// straight purchases. They follow from the rules.
//
// DO NOT TRUST "won by the player who declined". The harness declines on one
// rule (cash > price + 200) and then bids on another (a third of cash), so it
// can talk itself out of a purchase and straight back into it. That number
// measures this file's incoherence, not the game's.
import { BOARD } from '../data.js';
import { createGame, current, roll, resolveLanding, applyCard, endTurn, buy,
         openAuction, submitBid, closeAuction, submitClaim, closeContest,
         aiWantsToBuy, aiDevelop, seekContract, proposeContract, respondToContract } from '../engine.js';

const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });
const TABLES = {
  '2 humans': [HUMAN('Sam'), HUMAN('Meelah')],
  '2 humans + 1': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector')],
  '2 humans + 2': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector'), AI('Varan', 'varan')]
};
const GAMES = +(process.argv[2] || 40);

for (const [label, seats] of Object.entries(TABLES)) {
  let auctions = 0, withHuman = 0, declinerWon = 0, noBid = 0, turns = 0, first10 = 0, buys = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const G = createGame({ seats, seed, circuits: 48 });
    let steps = 0;
    while (!G.over && steps++ < 200000) {
      const p = current(G);
      switch (G.phase) {
        case 'roll': roll(G); break;
        case 'landed': resolveLanding(G); break;
        case 'card': applyCard(G); break;
        case 'offer': {
          const wants = p.kind === 'ai' ? aiWantsToBuy(G, p, p.pos) : p.cash > BOARD[p.pos].pr + 200;
          if (wants && buy(G, p)) { buys++; break; }
          G.__decliner = p.i;
          if (!openAuction(G, p.pos)) break;
          auctions++;
          if (G.circuit <= 10) first10++;
          if (G.auction.queue.length) withHuman++;
          break;
        }
        case 'auction': {
          if (G.auction.resolved) {
            if (G.auction.winner === null || G.auction.winner === undefined) noBid++;
            else if (G.auction.winner === G.__decliner) declinerWon++;
            closeAuction(G); break;
          }
          const who = G.auction.queue[G.auction.at];
          submitBid(G, who, Math.min(Math.floor(G.players[who].cash / 3),
                                     Math.floor(BOARD[G.auction.sq].pr * 1.1)));
          break;
        }
        case 'contest':
          if (G.contest.resolved) { closeContest(G); break; }
          submitClaim(G, G.contest.queue[G.contest.at], Math.floor(G.players[G.contest.queue[G.contest.at]].cash * 0.3));
          break;
        case 'contract': respondToContract(G, true); break;
        case 'end': {
          if (p.kind === 'ai') aiDevelop(G, p);
          else { const c = seekContract(G, p, 'spector'); if (c) proposeContract(G, c); }
          if (G.phase === 'contract') { respondToContract(G, true); }
          if (G.over) break;
          endTurn(G); break;
        }
        default: steps = 200000;
      }
    }
    turns += G.turn;
  }
  const per = n => (n / GAMES).toFixed(1);
  console.log(`\n${label}`);
  console.log(`  auctions per game        ${per(auctions).padStart(6)}   (straight purchases ${per(buys)})`);
  console.log(`  of those, in first 10 circuits ${per(first10).padStart(5)}`);
  console.log(`  needing a human to bid   ${per(withHuman).padStart(6)}`);
  console.log(`  won by the player who declined ${(declinerWon / Math.max(1, auctions) * 100).toFixed(0).padStart(3)}%`);
  console.log(`  nobody bid at all              ${(noBid / Math.max(1, auctions) * 100).toFixed(0).padStart(3)}%`);
  console.log(`  turns per game           ${per(turns).padStart(6)}`);
}
