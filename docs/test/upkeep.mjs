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
// AND THE PRICE OF FIXING IT — 300 games, 96 circuits, Sam's table:
//
//   garrison   conquest ending   human wins   human ends sworn
//     ₡10            51%             47%            34%
//     ₡7             72%             48%            42%
//     ₡5             79%             42%            50%
//
//   Every credit taken off the bill is a credit that stays in the room and
//   turns into rent, and rent concentrates where upkeep merely destroys. So the
//   designed ending arrives more often AND the human is absorbed more often;
//   there is no rate that buys one without the other. The knee is at ₡7: it
//   takes 21 points of conquest for 8 points of being sworn and leaves the win
//   rate flat, where the next step buys 7 more for another 8 and 6 points of
//   win rate. Measure both columns before moving this number again.
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
      // A citadel replaces three garrisons: ₡30 instead of ₡30, so no change.
      const bill = n === 4 ? 0 : s.sq.length * RULES.garrisonUpkeep;
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
          if (p.vassals.length) vTurns += upkeep(p) - g * RULES.garrisonUpkeep
            - c * RULES.citadelUpkeep;
          const was = seen.get(p.i);
          if (was !== undefined) { if (g > was) built += g - was; else if (g < was) sold += was - g; }
          seen.set(p.i, g);
          const u = upkeep(p);
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
// Second argument scales BOTH building upkeep figures, so the same instrument
// can be pointed at a proposed rate without a second copy of it drifting away
// from this one. `node upkeep.mjs 30 0.5` is the halved rate.
const scale = +(process.argv[3] || 1);
if (scale !== 1) {
  RULES.garrisonUpkeep = Math.round(RULES.garrisonUpkeep * scale);
  RULES.citadelUpkeep = Math.round(RULES.citadelUpkeep * scale);
  console.log(`\n  ** building upkeep scaled ×${scale} — garrison `
    + `${money(RULES.garrisonUpkeep)}, citadel ${money(RULES.citadelUpkeep)} **`);
}
staticTable(3);
staticTable(2);
dynamic(N, 72);
console.log('');
