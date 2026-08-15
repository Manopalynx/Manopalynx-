// How often a game reaches its designed ending, by table and by length.
//
// READ THE TABLE NAME BEFORE BELIEVING A NUMBER FROM THIS FILE.
//
// Every table here seated TWO humans until now, and Sam plays one human against
// three opponents. So every conquest figure this instrument produced, for as
// long as it has existed, described a game he does not play -- and it is a real
// number from a real instrument, which is exactly what makes it convincing.
// Twice in one session it had me report the direction of an effect backwards to
// him: halving the vassal upkeep reads as a heavy loss on the two-human tables
// and is a gain on his own.
//
// His table is last and named. The seat counts are spelled out rather than
// abbreviated to '2', '3', '4', because the composition is the thing that was
// invisible, not the count.
import { RULES } from '../data.js';
import { playGame } from './harness.mjs';
const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });
const TABLES = {
  '2 seats · 2 human': [HUMAN('Sam'), HUMAN('Meelah')],
  '3 seats · 2 human, 1 opponent': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector')],
  '4 seats · 2 human, 2 opponents':
    [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector'), AI('Varan', 'varan')],
  // The one Sam actually plays: one human, one of each persona.
  "4 seats · 1 human, 3 opponents — SAM'S TABLE":
    [HUMAN('Samuel'), AI('Spector', 'spector'), AI('High Commander Varan', 'varan'),
     AI('Adran Vale', 'vale')]
};
const N = +(process.argv[2] || 40);
const cashes = [2000];
const circuits = [48, 72, 96, 120];
const orig = RULES.startingCash;
console.log('\nabsorption rate / sets completed of 8 / avg turns\n');
for (const [label, seats] of Object.entries(TABLES)) {
  console.log(`  ${label}`);
  console.log('    cash |' + circuits.map(c => `   ${String(c).padStart(2)} circ`).join(''));
  for (const cash of cashes) {
    RULES.startingCash = cash;
    const cells = [];
    for (const c of circuits) {
      let conq = 0, turns = 0;
      for (let seed = 1; seed <= N; seed++) {
        const G = playGame({ seats, seed, circuits: c });
        if (G.endReason === 'conquest') conq++;
        turns += G.turn;
      }
      cells.push(`${String(Math.round(conq / N * 100)).padStart(4)}% ${String(Math.round(turns / N)).padStart(3)}t`);
    }
    console.log(`  ${String(cash).padStart(6)} |` + cells.map(c => ' ' + c).join(''));
  }
  console.log('');
}
RULES.startingCash = orig;
