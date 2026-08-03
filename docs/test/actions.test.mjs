// Every button in the interface has to name an action that exists.
//
// This is a whole-file check rather than a test of behaviour, because the defect
// it exists for is invisible by every other means. One sheet button was written
// `data-fn="closeSheet()"` — with the parentheses — against forty-odd written
// without them. bindSheet does `ACTIONS[name](...args)`, so the lookup returned
// undefined and the call threw inside an onclick, where nothing surfaces it.
//
// The button rendered correctly, was the right size, was in the right place, and
// did nothing. Reported from play as "it didn't let me press close" on the sheet
// that says a ledger needs two columns — the one sheet a player meets before
// their first game, and the one place a dead button traps them entirely, since
// the sheet is modal and there is nothing else to press.
//
// The reason it survived: the other binder, for the buttons under the board,
// defensively strips a trailing `()`. So the same string worked in one half of
// the interface and was fatal in the other, and neither half said so.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../ui.js', import.meta.url)), 'utf8');

// The registry the two binders look names up in.
const registry = src.match(/const ACTIONS = \{([\s\S]*?)\n\};/);
const known = new Set(
  (registry ? registry[1] : '')
    .split(/[,\n]/).map(s => s.trim().replace(/:.*$/, ''))
    .filter(s => /^[A-Za-z_$][\w$]*$/.test(s))
);

test('the action registry was found and is not empty', () => {
  assert.ok(registry, 'const ACTIONS = { ... } is no longer shaped as this test expects');
  assert.ok(known.size > 20, `only ${known.size} actions parsed — the parse is wrong, not the file`);
});

// The argument list of every btns(...) call, found by matching brackets rather
// than by regex. A looser scan for ['label', 'action'] anywhere in the file also
// matched the default player names and the On/Off options, and reported Hale as
// a missing action — a test that fails on the wrong thing is worse than none.
function buttonBlocks() {
  const out = [];
  for (const m of src.matchAll(/\bbtns\(/g)) {
    let i = m.index + m[0].length, depth = 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      i++;
    }
    out.push(src.slice(m.index, i));
  }
  return out;
}

// Two ways a button names its action: a literal data-fn attribute, and the
// second element of a btns([...]) row. Both end up in the same attribute.
function namesInSource() {
  const found = [];
  // data-fn="something" — skipping any containing a template expression, whose
  // literal prefix is still checked below.
  for (const m of src.matchAll(/data-fn="([^"]*)"/g)) {
    const raw = m[1];
    if (raw.includes('${fn}')) continue;              // the btns helper itself
    const head = raw.split('|')[0];
    if (!head || head.includes('${')) continue;
    found.push({ name: head, where: 'data-fn' });
  }
  for (const block of buttonBlocks()) {
    for (const m of block.matchAll(/\[\s*(?:`[^`]*`|'[^']*')\s*,\s*'([^']+)'/g)) {
      const head = m[1].split('|')[0];
      if (!head || head.includes('${')) continue;
      found.push({ name: head, where: 'btns row' });
    }
  }
  return found;
}

test('the button scan actually finds the buttons', () => {
  const found = namesInSource();
  assert.ok(buttonBlocks().length > 10,
    `only ${buttonBlocks().length} btns() calls found — the bracket match is wrong`);
  assert.ok(found.some(f => f.name === 'closeSheet'),
    'closeSheet is on half the sheets in the file; not finding it means finding nothing');
  assert.ok(found.length > 40, `only ${found.length} buttons scanned`);
});

test('every button names an action that exists', () => {
  const missing = namesInSource().filter(f => !known.has(f.name));
  assert.deepEqual(missing, [],
    'these buttons render, size and place correctly and do nothing when pressed: ' +
    missing.map(f => `${f.name} (${f.where})`).join(', '));
});

// The specific shape of the defect, held separately so the message says what to
// do about it. bindSheet does not strip these; the action bar's binder does.
test('no button carries a call rather than a name', () => {
  const called = [...src.matchAll(/data-fn="([^"]*\(\))"/g)].map(m => m[1]);
  const inRows = [...src.matchAll(/\[\s*(?:`[^`]*`|'[^']*')\s*,\s*'([^']*\(\))'/g)].map(m => m[1]);
  assert.deepEqual([...called, ...inRows], [],
    'data-fn is a key into ACTIONS, not an expression — write closeSheet, not closeSheet()');
});
