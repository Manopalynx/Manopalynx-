// How long a debt marker lasts, and what the player can do while it is there.
//
// Sam watched an opponent go into debt and never come back, and the cap in v70
// was the first attempt at it. The cap made the marker stop LOOKING hopeless --
// it had reached ₡4,084 before -- and changed nothing else: median spell 15
// turns, longest 145, identical from ₡200 to uncapped. So the stuckness is not
// the size of the marker. This instrument exists to say what it IS.
//
// A marker is not only a debt. While one stands a player cannot buy, cannot
// build, cannot trade and cannot bid, so the marker also removes every route by
// which a player would earn their way out of it.
//
// The last two lines are what that does, and they took three attempts to ask
// properly. Measuring the PURSE said a player earns more with a marker than
// without one -- nonsense, with an obvious cause: buying a square empties a
// purse, and a player under a marker cannot buy, so doing nothing looked like
// doing well. Measuring NET WORTH PER TURN said -1 against 0, because net worth
// is very nearly conserved across a table and any per-player average of it is
// pinned to zero by construction, whoever you average. Both were real numbers
// about the wrong thing.
//
// What answers it is the SPELL, start to end: how much ground a player makes
// while the marker stands. Flat is the finding -- not sinking, not climbing,
// simply out of the game and waiting.
//
// The comparison this was written for is RULES.lapRepaysDebt -- whether the
// lap payment goes against the marker before it reaches the purse. Run it both
// ways; the second argument flips the rule.
import { RULES } from '../data.js';
import { playGame } from './harness.mjs';
import { holdingsValue } from '../engine.js';

const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });
const SAMS_TABLE = [HUMAN('Samuel'), AI('Spector', 'spector'),
  AI('High Commander Varan', 'varan'), AI('Adran Vale', 'vale')];

const money = n => '₡' + Math.round(n);
const median = a => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0) + '%';

function run(N, circuits) {
  const spells = [];             // every completed spell, in turns
  const made = [];               // ground gained over a spell that ended
  const stuck = [];              // ground gained over one that never did
  let open = 0;                  // spells still standing when the game ended
  let inDebtTurns = 0, freeTurns = 0;
  let everInDebt = 0, players = 0;
  let atCap = 0;

  for (let seed = 1; seed <= N; seed++) {
    // Per player: turn the current spell started, cash at the last look, and
    // whether they have ever carried a marker at all.
    const st = new Map();
    playGame({
      seats: SAMS_TABLE, seed, circuits,
      onTurn: G => {
        for (const p of G.players) {
          let s = st.get(p.i);
          if (!s) { s = { since: null, worth: 0, last: 0, ever: false }; st.set(p.i, s); }
          // holdingsValue counts cash and squares together, so selling a
          // square to raise cash is neutral and only real ground moves it.
          const now = holdingsValue(p);
          if (p.debt) {
            inDebtTurns++;
            if (RULES.debtCap && p.debt >= RULES.debtCap) atCap++;
            if (s.since === null) { s.since = G.turn; s.worth = now; s.ever = true; }
            s.last = now;
          } else {
            freeTurns++;
            if (s.since !== null) {
              spells.push(G.turn - s.since);
              made.push(now - s.worth);
              s.since = null;
            }
          }
        }
      }
    });
    for (const [, s] of st) {
      players++;
      if (s.ever) everInDebt++;
      if (s.since !== null) { open++; stuck.push(s.last - s.worth); }
    }
  }

  const all = spells.length + open;
  console.log(`\n  ${N} games · ${circuits} circuits · Sam's table`
    + `   ${RULES.lapRepaysDebt ? 'THE LAP REPAYS THE MARKER' : 'lap payment goes to the purse'}\n`);
  console.log(`    seats that ever carried a marker   ${pct(everInDebt, players)}`);
  console.log(`    spells that ended                  ${pct(spells.length, all)}`
    + `  (${open} of ${all} were still standing at the end)`);
  console.log(`    spell length, median / worst       ${median(spells)}t / `
    + `${spells.length ? Math.max(...spells) : 0}t`);
  console.log(`    turns spent under a marker         ${pct(inDebtTurns, inDebtTurns + freeTurns)}`
    + (RULES.debtCap ? `, ${pct(atCap, inDebtTurns)} of them pinned at the ₡${RULES.debtCap} cap` : ''));
  console.log(`\n    ground made over a spell that ENDED   ${money(median(made))} (median)`);
  console.log(`    ground made over one that did NOT    ${money(median(stuck))} (median, `
    + `over ${open} still standing)`);
  return { median: median(spells), ended: spells.length / Math.max(all, 1) };
}

const N = +(process.argv[2] || 100);
if (process.argv[3]) RULES.lapRepaysDebt = process.argv[3] !== 'off';
run(N, 96);
console.log('');
