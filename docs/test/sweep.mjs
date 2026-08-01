import { RULES } from '../data.js';
import { playGame } from './harness.mjs';
const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });
const TABLES = {
  '2': [HUMAN('Sam'), HUMAN('Meelah')],
  '3': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector')],
  '4': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector'), AI('Varan', 'varan')]
};
const N = +(process.argv[2] || 40);
const cashes = [2000];
const circuits = [48, 72, 96, 120];
const orig = RULES.startingCash;
console.log('\nabsorption rate / sets completed of 8 / avg turns\n');
for (const [label, seats] of Object.entries(TABLES)) {
  console.log(`  ${label} seats`);
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
