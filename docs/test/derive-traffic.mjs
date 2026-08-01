// Re-derives TRAFFIC from the engine's own movement. Run after any board or
// movement-rule change, then paste the result into data.js.
//   node docs/test/derive-traffic.mjs
import { BOARD, N } from '../data.js';
import { createGame, current, roll, resolveLanding, applyCard, endTurn } from '../engine.js';

const ROLLS = 3_000_000;
const landings = new Array(N).fill(0);
let counted = 0, seed = 20260801;

while (counted < ROLLS) {
  const G = createGame({ seats: [{ name: 'Surveyor', kind: 'human' }], seed: seed++, circuits: Number.MAX_SAFE_INTEGER });
  const p = current(G);
  for (let t = 0; t < 60000 && counted < ROLLS; t++) {
    const r = roll(G);
    if (r && r.held) { G.phase = 'end'; endTurn(G); continue; }
    let guard = 0;
    while (guard++ < 12) {
      if (G.phase === 'landed') { resolveLanding(G); continue; }
      if (G.phase === 'card') { applyCard(G); continue; }
      break;
    }
    landings[p.pos]++; counted++;
    if (G.phase === 'offer') G.phase = 'end';       // buy nothing; ownership cannot move dice
    G.phase = 'end';
    endTurn(G);
  }
}

const pct = landings.map(v => v / counted * 100);
const rows = [];
for (let i = 0; i < N; i += 14) {
  rows.push('  ' + pct.slice(i, i + 14).map(v => v.toFixed(2)).join(', ') + (i + 14 < N ? ',' : ''));
}
console.log('export const TRAFFIC = [\n' + rows.join('\n') + '\n];');
console.error(`sum ${pct.reduce((a, b) => a + b, 0).toFixed(2)}% over ${counted.toLocaleString()} turns`);
console.error('busiest: ' + pct.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 4)
  .map(([v, i]) => `${BOARD[i].n} ${v.toFixed(2)}%`).join(' · '));
