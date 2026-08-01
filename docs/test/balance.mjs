// Balance probe. Not a test — a measuring instrument.
//
// Run:  node grandiose/test/balance.mjs [gamesPerCell]
//
// Sweeps the two levers that set how much pressure the board applies (the lap
// payment and garrison upkeep) and reports what each combination does to the
// rate at which games reach their designed ending.

import { RULES } from '../data.js';
import { playGame } from './harness.mjs';

const HUMAN = n => ({ name: n, kind: 'human' });
const AI = (n, p) => ({ name: n, kind: 'ai', persona: p });
const TABLES = {
  '2 seats': [HUMAN('Sam'), HUMAN('Meelah')],
  '3 seats': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector')],
  '4 seats': [HUMAN('Sam'), HUMAN('Meelah'), AI('Spector', 'spector'), AI('Varan', 'varan')]
};

const GAMES = +(process.argv[2] || 80);
const original = { passGo: RULES.passGo, garrisonUpkeep: RULES.garrisonUpkeep, citadelUpkeep: RULES.citadelUpkeep };

function sample(seats, games) {
  let conquest = 0, vassalEver = 0, builtAny = 0, players = 0;
  let cashSum = 0, cashN = 0, turns = 0;
  for (let seed = 1; seed <= games; seed++) {
    let sawVassal = false;
    const G = playGame({
      seats, seed, circuits: 24,
      onTurn: g => {
        if (g.players.some(p => p.lord !== null)) sawVassal = true;
        if (g.turn % 8 === 0) { for (const p of g.players) { cashSum += p.cash; cashN++; } }
      }
    });
    if (G.endReason === 'conquest') conquest++;
    if (sawVassal || G.players.some(p => p.lord !== null)) vassalEver++;
    for (const p of G.players) { players++; if (p.holdings.some(h => h.garrisons || h.citadel)) builtAny++; }
    turns += G.turn;
  }
  return {
    conquest: conquest / games,
    vassal: vassalEver / games,
    built: builtAny / players,
    cash: Math.round(cashSum / Math.max(1, cashN)),
    turns: Math.round(turns / games)
  };
}

const pct = v => (v * 100).toFixed(0).padStart(3) + '%';

console.log(`\nBaseline (passGo ${original.passGo}, garrison upkeep ${original.garrisonUpkeep}), ${GAMES} games per cell\n`);
console.log('table     absorbed  vassalage  built  median cash  turns');
for (const [label, seats] of Object.entries(TABLES)) {
  const r = sample(seats, GAMES);
  console.log(`${label}   ${pct(r.conquest)}     ${pct(r.vassal)}     ${pct(r.built)}   ${String(r.cash).padStart(8)}  ${String(r.turns).padStart(5)}`);
}

console.log('\nSweep — absorption rate by lap payment and garrison upkeep\n');
const passGoOptions = [200, 160, 140, 120, 100];
const upkeepOptions = [10, 20, 30];

for (const [label, seats] of Object.entries(TABLES)) {
  console.log(`  ${label}`);
  console.log('    upkeep |' + passGoOptions.map(g => `  Go ${String(g).padStart(3)}`).join(''));
  for (const up of upkeepOptions) {
    const cells = [];
    for (const go of passGoOptions) {
      RULES.passGo = go;
      RULES.garrisonUpkeep = up;
      RULES.citadelUpkeep = up * 3;
      cells.push(pct(sample(seats, GAMES).conquest).padStart(7));
    }
    console.log(`    ${String(up).padStart(6)} |` + cells.join(''));
  }
  console.log('');
}

Object.assign(RULES, original);
