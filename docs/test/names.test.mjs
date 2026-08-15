// A player goes by one short name, everywhere.
//
// The board called him Vale and the trade sheet called him Adran. Both were
// reading the same persona -- 'Adran Vale' -- and splitting it at opposite
// ends: ui.js took `.pop()`, the trade sheet took `[0]`. Varan is worse than
// cosmetic on the same rule, because 'High Commander Varan' opens on a rank:
// the trade sheet offered a deal with "High".
//
// It survived because both halves looked deliberate in isolation, and the only
// way to catch it is from outside, comparing them. Two more sites rendered the
// SAME "vassal · X" label -- one in engine.js, one in ui.js -- written
// separately and disagreeing.
//
// So there are two checks here and they are different in kind. The first is
// behaviour: the helper returns the name you would use at the table. The second
// is structural: nothing anywhere is allowed to split a player's name itself,
// because that is how the second implementation got in the first time. Assert
// the agreement, or accept that two copies of a thing are two things.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { displayName } from '../engine.js';
import { PERSONAS } from '../data.js';

const read = f => readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8');

test('an opponent goes by the name you would use at the table', () => {
  assert.equal(displayName({ kind: 'ai', name: 'Adran Vale' }), 'Vale');
  assert.equal(displayName({ kind: 'ai', name: 'High Commander Varan' }), 'Varan');
  assert.equal(displayName({ kind: 'ai', name: 'Spector' }), 'Spector');
});

test('a human keeps their first name', () => {
  assert.equal(displayName({ kind: 'human', name: 'Samuel' }), 'Samuel');
  assert.equal(displayName({ kind: 'human', name: 'Sam Chalk' }), 'Sam');
});

test('every persona shortens to something a player would recognise', () => {
  for (const [key, p] of Object.entries(PERSONAS)) {
    const short = displayName({ kind: 'ai', name: p.n });
    assert.ok(short.length, `${key} shortens to nothing`);
    assert.ok(
      !/^(High|Commander|Lord|The|Mr|Ms)$/i.test(short),
      `${key} shortens to the rank "${short}" rather than the name`
    );
    // The short form has to be in the full one, or it is not the same player.
    assert.ok(p.n.includes(short), `${key}: "${short}" is not part of "${p.n}"`);
  }
});

test('nothing splits a player name for itself', () => {
  // Only the one definition in engine.js may take a name apart. Any other
  // `.name.split(' ')` is a second implementation of this rule, and the two
  // ends of a string are one typo apart.
  for (const file of ['engine.js', 'ui.js', 'score.js', 'galaxy.js']) {
    const lines = read(file).split('\n');
    lines.forEach((line, i) => {
      if (!/\.name\.split\(' '\)|\bname\.split\(' '\)/.test(line)) return;
      const isTheDefinition = file === 'engine.js'
        && /p\.kind === 'ai' \? p\.name\.split\(' '\)\.pop\(\)/.test(line);
      assert.ok(
        isTheDefinition,
        `${file}:${i + 1} splits a player name instead of calling displayName -- ${line.trim()}`
      );
    });
  }
});
