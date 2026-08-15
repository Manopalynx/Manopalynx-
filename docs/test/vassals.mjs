// The vassal economy, measured.
//
// Written because `releaseVassal` in engine.js has exactly one caller anywhere
// in the codebase: the human button bound at ui.js:1417. `aiDevelop` -- the
// opponent's entire end-of-turn repertoire -- repays, redeems, builds, raises
// citadels, declares independence, sets a tithe and proposes a contract. It
// never releases. So no opponent has ever let a vassal go, in any game, and one
// that takes a vassal pays the upkeep until the vassal revolts, a rival
// contests the claim away, or the game ends.
//
// That is the same defect class Instance 3 swept for and wrote up: an engine
// function whose only caller is a human button. This measures what it costs.
//
// What each figure IS, stated exactly, because a real number with the wrong
// word beside it is how this repository keeps fooling itself:
//
//   arrangements  p.lord observed moving from null to a seat.
//   freed         p.lord observed moving back to null. Independence only --
//                 a release cannot appear here while nothing calls it.
//   moved         p.lord observed moving from one seat directly to another,
//                 which is a contest resolving.
//   upkeep        RULES.vassalUpkeep for the count held, summed over every
//                 sampled turn a lord held at least one vassal. DERIVED from
//                 the count at sample time, not observed being charged.
//   stranded      sampled turns where a lord held at least one vassal and
//                 could not cover that turn's upkeep line out of cash. The
//                 state in which a human would press Release and an opponent
//                 cannot.
//   baseline      the control, and the number that decides whether any of the
//                 above means anything: sampled turns where a player held NO
//                 vassal and still could not have covered the one-vassal line
//                 of RULES.vassalUpkeep[0] out of cash. If `stranded` and
//                 `baseline` are close, these players are simply poor and
//                 vassalage is not what is doing it.
//
// Sampling is once per completed turn, via the harness `onTurn` hook. Anything
// that forms and dissolves inside a single turn is invisible here.
//
// There is deliberately NO tithe-income column, and the two obvious ways to add
// one are both wrong. Do not put it back without reading this:
//
//   * A vassal's `strength` looks like a tithe meter and is not. TWO sites
//     write it -- payRent (engine.js:308) adds the credit actually tithed, and
//     endTurn (engine.js:861) adds the tithe RATE once per the lord's own turn
//     as the revolt clock. Summing its gains mixes credits with a rate and
//     reports a number in no unit at all. Subtracting the rate back out means
//     knowing whose turn just ended, which `onTurn` does not say, and the
//     resets in vassalise/contest/release make the deltas lossy on top.
//   * Parsing the tithe out of G.log overcounts. payRent writes its note
//     BEFORE pay() reports whether the payment settled, so the log narrates
//     tithe on rent that was never actually paid.
//
// The figure that matters here is what holding a vassal COSTS and how often the
// holder cannot pay it. Instance 3 already measured the income side at roughly
// a third of a credit per turn, and nothing found since disputes it.

import { RULES } from '../data.js';
import { playGame } from './harness.mjs';

const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });

// Sam's table: one human, three opponents, one of each persona.
const SEATS = [
  HUMAN('Samuel'),
  AI('Spector', 'spector'),
  AI('High Commander Varan', 'varan'),
  AI('Adran Vale', 'vale')
];

const N = +(process.argv[2] || 40);
const CIRCUITS = +(process.argv[3] || 72);

const upkeepLine = p => p.vassals.length
  ? RULES.vassalUpkeep[Math.min(p.vassals.length - 1, RULES.vassalUpkeep.length - 1)]
  : 0;

const blank = () => ({
  arrangements: 0, freed: 0, moved: 0,
  lordTurns: 0, upkeep: 0, stranded: 0, inDebt: 0,
  peakHeld: 0, heldAtEnd: 0,
  freeTurns: 0, freePoor: 0
});

// Kept apart so a human lord cannot be mistaken for an opponent one: the human
// CAN release, so their figures are the control group.
const ai = blank(), human = blank();
let games = 0, gamesWithAny = 0, endedHolding = 0;

for (let seed = 1; seed <= N; seed++) {
  const prevLord = new Map();
  let sawAny = false;

  const G = playGame({
    seats: SEATS, seed, circuits: CIRCUITS,
    onTurn: g => {
      for (const p of g.players) {
        const was = prevLord.has(p.i) ? prevLord.get(p.i) : null;
        const now = p.lord;
        if (was !== now) {
          const bucket = now !== null
            ? (g.players[now].kind === 'ai' ? ai : human)
            : (was !== null && g.players[was].kind === 'ai' ? ai : human);
          if (was === null && now !== null) { bucket.arrangements++; sawAny = true; }
          else if (was !== null && now === null) bucket.freed++;
          else bucket.moved++;
        }
        prevLord.set(p.i, now);

        // Cost of holding, and the state that should end it.
        const b = p.kind === 'ai' ? ai : human;
        if (p.vassals.length) {
          const line = upkeepLine(p);
          b.lordTurns++;
          b.upkeep += line;
          if (p.cash < line) b.stranded++;
          if (p.debt) b.inDebt++;
          if (p.vassals.length > b.peakHeld) b.peakHeld = p.vassals.length;
        } else {
          // The control: same poverty test, same credits, no vassal involved.
          b.freeTurns++;
          if (p.cash < RULES.vassalUpkeep[0]) b.freePoor++;
        }
      }
    }
  });

  games++;
  if (sawAny) gamesWithAny++;
  for (const p of G.players) {
    if (p.vassals.length) {
      (p.kind === 'ai' ? ai : human).heldAtEnd += p.vassals.length;
      endedHolding++;
    }
  }
}

const row = (label, b) => {
  const perTurn = n => b.lordTurns ? (n / b.lordTurns).toFixed(1) : '--';
  console.log(
    `  ${label.padEnd(10)}` +
    `${String(b.arrangements).padStart(6)}` +
    `${String(b.freed).padStart(7)}` +
    `${String(b.moved).padStart(7)}` +
    `${String(b.lordTurns).padStart(9)}` +
    `${String(perTurn(b.upkeep)).padStart(10)}` +
    `${pct(b.stranded, b.lordTurns).padStart(10)}` +
    `${pct(b.freePoor, b.freeTurns).padStart(10)}` +
    `${pct(b.inDebt, b.lordTurns).padStart(8)}` +
    `${String(b.peakHeld).padStart(6)}`
  );
};

const pct = (n, d) => d ? `${Math.round(n / d * 100)}%` : '--';

console.log(`\n${N} games, ${CIRCUITS} circuits, one human and three opponents.`);
console.log(`${gamesWithAny} of ${games} games formed at least one arrangement.\n`);
console.log('              formed  freed  moved  lordTurns  upkeep/t  stranded  baseline  inDebt  peak');
row('opponent', ai);
row('human', human);

console.log(`\n  Releases by an opponent: 0, structurally -- nothing outside ui.js calls releaseVassal.`);
console.log(`  Opponents still holding a vassal when the game ended: ${ai.heldAtEnd}.\n`);
