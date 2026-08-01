// Keeps the build string in data.js and the cache name in sw.js from drifting.
//
// The menu shows BUILD so that a screenshot from a phone answers "are you even
// on the new version?", which is otherwise unanswerable — a stale service
// worker looks exactly like a current one. That only works while the string the
// menu prints is the string the cache is actually keyed on. If the two drift,
// nothing crashes and nothing warns: the menu simply reports a build that is
// not the one running, which is worse than printing nothing at all.
//
// This is the same class as the three Contingency cards that named one square
// and sent you to another. Anything written twice will disagree eventually, so
// the agreement is asserted rather than assumed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { BUILD } from '../data.js';

const sw = readFileSync(fileURLToPath(new URL('../sw.js', import.meta.url)), 'utf8');

test('sw.js declares a CACHE this test can find', () => {
  assert.match(sw, /^const CACHE = '[^']+';$/m,
    'CACHE is no longer a single-quoted top-level const — update this test with it');
});

test('the cache name in sw.js matches BUILD in data.js', () => {
  const cache = sw.match(/^const CACHE = '([^']+)';$/m)[1];
  assert.equal(cache, BUILD,
    `sw.js caches as "${cache}" but the menu would tell the player "${BUILD}". ` +
    'Bump both, or the build shown on screen is a lie.');
});

test('BUILD is versioned so two builds cannot share a name', () => {
  assert.match(BUILD, /^grandiose-v\d+$/,
    'BUILD must end in a number that goes up, or a changed build reuses a cache entry');
});

// The seed is printed beside the build for the same reason: it is the only
// thing that makes a reported game reproducible here. If it ever stopped being
// carried on the game object, the menu would print "undefined" and the bug
// reports would quietly stop being replayable.
test('a new game carries a numeric seed for the menu to print', async () => {
  const { createGame } = await import('../engine.js');
  const G = createGame({ seats: [{ name: 'A', kind: 'human' }, { name: 'B', kind: 'human' }], seed: 12345 });
  assert.equal(typeof G.seed, 'number');
  assert.equal(G.seed, 12345);
});

test('the seed survives a save and reload, so a resumed game is still replayable', async () => {
  const { createGame, serialize, deserialize } = await import('../engine.js');
  const G = createGame({ seats: [{ name: 'A', kind: 'human' }, { name: 'B', kind: 'human' }], seed: 987654321 });
  const back = deserialize(serialize(G));
  assert.ok(back, 'save/load round trip returned nothing');
  assert.equal(back.seed, 987654321);
});
