// Does a garrison pay for the bill it brings with it?
//
// Sam's report: "the upkeep from the squares and the vassals often mean they
// don't generate enough to justify keeping them". The vassal half of that was
// measured and halved in v62. This is the other half.
//
// TWO measurements, because either one alone misleads:
//
//   1. STATIC. Per set, the marginal garrison's rent uplift against the ₡10 a
//      turn it costs to keep. This is the arithmetic of the decision as a
//      player faces it, and it does not depend on how a game happens to go.
//
//   2. DYNAMIC. Over whole games on Sam's table, what the building bill
//      actually came to beside everything else leaving a purse. A garrison can
//      be worth building and still be the thing that empties the room, because
//      the bill lands every turn and the rent lands when somebody lands on you.
//
// Traffic is a per-opponent-turn landing chance, so income scales with the
// number of opponents and upkeep does not. Sam plays three; the two-opponent
// column is there because the difference between those columns IS the finding.
//
// WHAT IT SAID, at ₡10 a garrison (the rate this was written against):
//
//   The FIRST garrison does not pay for itself on ANY set. Not one — from −5 a
//   turn on Agora to −26 on Enigma, at three opponents. The game asks you to
//   climb through a step that is always a loss, and on the two cheap sets the
//   climb never gets above water at all: Syndicate is negative at every
//   garrison level and only a citadel rescues it. That is the defect. It is not
//   that buildings are unaffordable; it is that the first rung is a tax.
//
//   Buildings are 77% of every upkeep line paid in a game — ₡24.7k of garrison
//   bills against ₡7.9k of vassal bills, on a board dealt ₡8,000. And 70% of
//   the garrisons built are torn down again, which is the shape of Sam's
//   complaint: people build, cannot carry the bill, and sell back.
//
//   Citadels are all but dead at ₡30: 0.04 held per player-turn. At ₡15 that is
//   0.14 — three and a half times as many. A mechanic priced out of the game.
//
// AND THE PRICE OF FIXING IT — 1000 games, 96 circuits, Sam's table:
//
//   rate        conquest ending   human wins   human ends sworn
//   ₡10/₡30           50%             45%            36%
//   ₡7/₡21            71%             43%            47%
//   ₡5/₡20            77%             42%            51%
//   ₡5/₡15            80%             40%            52%
//
//   Every credit taken off the bill is a credit that stays in the room and
//   turns into rent, and rent concentrates where upkeep merely destroys. So the
//   designed ending arrives more often AND the human is absorbed more often;
//   no rate buys one without the other.
//
//   USE A THOUSAND GAMES FOR THIS TABLE. At 300 the same measurement showed a
//   knee at ₡7 — 21 points of conquest for 8 of being sworn with the win rate
//   FLAT — and I reported that to Sam as the recommendation. There is no knee.
//   The win-rate column moves about 5 points across the whole range and at 300
//   games that is inside the noise, so a monotone gradient read as a corner. It
//   is roughly two points of conquest per point of being sworn, all the way
//   down, and picking a rate is picking a spot on a line rather than finding
//   the good one.
//
//   And the human here is the harness policy — builds whenever it comfortably
//   can, buys at list plus a cushion — not Sam. The direction of the win column
//   is trustworthy because the same policy plays every rate; its level is not.
import { BOARD, SETS, TRAFFIC, RULES } from '../data.js';
import { playGame } from './harness.mjs';
import { upkeep, garrisonsOf, citadelsOf } from '../engine.js';

const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });
const SAMS_TABLE = [HUMAN('Samuel'), AI('Spector', 'spector'),
  AI('High Commander Varan', 'varan'), AI('Adran Vale', 'vale')];

const money = n => '₡' + Math.round(n);

/* ---------------------------------------------------------- 1. static */
// Rent at garrison level n for square i, taking the doubled-bare-set rent as
// the baseline, because you cannot build without holding the set.
const rentAt = (i, n) => n === 0 ? BOARD[i].r[0] * 2 : BOARD[i].r[n];

function staticTable(nOpp) {
  console.log(`\n  A GARRISON AGAINST ITS OWN BILL — ${nOpp} opponents\n`);
  console.log('  set              g1      g2      g3   citadel   (rent per turn the step adds,'
    + ` against ${money(RULES.garrisonUpkeep)}/turn each`);
  for (const [k, s] of Object.entries(SETS)) {
    const cells = [];
    for (const n of [1, 2, 3, 4]) {
      // Every square in the set steps together in practice, so the set is the
      // unit of the decision even though the bill is per garrison.
      const gain = s.sq.reduce((a, i) =>
        a + nOpp * TRAFFIC[i] / 100 * (rentAt(i, n) - rentAt(i, n - 1)), 0);
      // Derive the step's bill from the two rates rather than assuming the
      // citadel replaces three garrisons at the same money. It did at ₡10/₡30
      // -- 30 against 30, so the citadel step was free -- and that coincidence
      // was written in here as a constant `0`, which quietly stops being true
      // the moment the two rates are moved by different amounts. At ₡5/₡20 the
      // citadel costs ₡5 a square MORE than the garrisons it replaces.
      const bill = s.sq.length * (n === 4
        ? RULES.citadelUpkeep - 3 * RULES.garrisonUpkeep
        : RULES.garrisonUpkeep);
      const net = gain - bill;
      cells.push(`${(net >= 0 ? '+' : '') + Math.round(net)}`.padStart(7));
    }
    console.log(`  ${s.n.padEnd(14)}${cells.join(' ')}`);
  }
  console.log('\n  A positive figure means the step earns more per turn than it costs to keep.');
}

/* --------------------------------------------------------- 2. dynamic */
function dynamic(N, circuits) {
  let gTurns = 0, cTurns = 0, vTurns = 0, turns = 0;
  let short = 0, shortOf = 0;          // turns a player could not cover upkeep
  let built = 0, sold = 0;
  const seen = new Map();              // player -> last known garrison count

  for (let seed = 1; seed <= N; seed++) {
    seen.clear();
    playGame({
      seats: SAMS_TABLE, seed, circuits,
      onTurn: G => {
        for (const p of G.players) {
          if (p.out) continue;
          const g = garrisonsOf(p), c = citadelsOf(p);
          gTurns += g; cTurns += c; turns++;
          if (p.vassals.length) vTurns += upkeep(G, p) - g * RULES.garrisonUpkeep
            - c * RULES.citadelUpkeep;
          const was = seen.get(p.i);
          if (was !== undefined) { if (g > was) built += g - was; else if (g < was) sold += was - g; }
          seen.set(p.i, g);
          const u = upkeep(G, p);
          if (u && p.cash < u) { short++; shortOf += u - p.cash; }
        }
      }
    });
  }
  const gBill = gTurns * RULES.garrisonUpkeep, cBill = cTurns * RULES.citadelUpkeep;
  const total = gBill + cBill + vTurns;
  console.log(`\n  WHAT THE BILL CAME TO — ${N} games, ${circuits} circuits, Sam's table\n`);
  console.log(`    garrison upkeep paid   ${money(gBill / N).padStart(8)} per game`
    + `  (${(gTurns / turns).toFixed(2)} garrisons held per player-turn)`);
  console.log(`    citadel upkeep paid    ${money(cBill / N).padStart(8)} per game`
    + `  (${(cTurns / turns).toFixed(2)} citadels)`);
  console.log(`    vassal upkeep paid     ${money(vTurns / N).padStart(8)} per game`);
  console.log(`    ------------------------------------`);
  console.log(`    every upkeep line      ${money(total / N).padStart(8)} per game`
    + `  — buildings are ${Math.round((gBill + cBill) / total * 100)}% of it`);
  console.log(`\n    garrisons built ${(built / N).toFixed(1)} per game, sold back `
    + `${(sold / N).toFixed(1)} — ${Math.round(sold / Math.max(built, 1) * 100)}% torn down again`);
  console.log(`    a player was short of their own upkeep on `
    + `${(short / turns * 100).toFixed(1)}% of turns, by ${money(shortOf / Math.max(short, 1))} on average`);
  return { total: total / N, buildings: (gBill + cBill) / N, sold: sold / N, short: short / turns };
}

const N = +(process.argv[2] || 30);
// Second argument names the two rates outright — `node upkeep.mjs 30 5/20` —
// rather than scaling them together, so the instrument can be pointed at a
// proposal that moves them by different amounts. It scaled them by one factor
// until Sam asked for ₡5/₡20, which no single factor can express.
if (process.argv[3]) {
  const [g, c] = process.argv[3].split('/').map(Number);
  RULES.garrisonUpkeep = g; RULES.citadelUpkeep = c;
  console.log(`\n  ** garrison ${money(g)}, citadel ${money(c)} — a citadel is `
    + `${money(Math.abs(c - 3 * g))} ${c >= 3 * g ? 'more' : 'less'} than the three `
    + `garrisons it replaces **`);
}
staticTable(3);
staticTable(2);
dynamic(N, 72);
console.log('');
