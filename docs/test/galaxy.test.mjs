// The background field — the universe the galaxy sits in.
//
// None of this can be checked by running it: galaxy.js needs a canvas, a
// window and requestAnimationFrame. What it can be checked for is the two
// decisions that make the difference between a starfield and a mistake, both
// read from source.
//
// The probe covers the rest — that the corners actually stop being a void, and
// that something out there twinkles — because those need pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../galaxy.js', import.meta.url)), 'utf8');
const num = name => {
  const m = src.match(new RegExp('const ' + name + ' = (\\d+)'));
  assert.ok(m, name + ' not found in galaxy.js');
  return +m[1];
};

test('some stars twinkle, not the sky', () => {
  const stars = num('BG_STARS'), tw = num('TWINKLERS');
  assert.ok(tw > 0, 'nothing twinkles');
  assert.ok(tw / stars < 0.12,
    `${tw} of ${stars} background stars twinkle — past about a tenth it stops being ` +
    'occasional and starts pulling the eye off the board it sits in the middle of');
});

// The panel redraws at 60fps for an hour at a time. Live-drawing the field
// measured 0.45ms a frame against 0.30ms for the disc alone — affordable once,
// and 216,000 times an hour is the thing the file's budget is actually about.
test('the field is pre-rendered rather than drawn every frame', () => {
  assert.match(src, /function buildField\(\)/, 'no offscreen build step');
  assert.match(src, /ctx\.drawImage\(field/, 'the field is not blitted in draw()');
  const draw = src.slice(src.indexOf('function draw('));
  const perFrame = draw.slice(0, draw.indexOf('// core glow'));
  assert.equal(/for \(const s of bg\)/.test(perFrame), false,
    'draw() iterates the whole background — that is the live path the blit replaces');
});

test('the field is rebuilt when the panel is resized', () => {
  const resize = src.slice(src.indexOf('function resize()'));
  assert.match(resize.slice(0, resize.indexOf('// ---- drawing')), /buildField\(\)/,
    'rotating the phone would leave the sky at the old size, or blank');
});

// Stars behind the turn name, the dice, the square name and the circuit line
// would cost legibility for nothing, and the core glow washes them out anyway.
test('the field thins where the panel carries text', () => {
  assert.match(src, /function clearOfDisc\(/, 'no fade toward the centre');
  assert.match(src, /clearOfDisc\(px, py\)/, 'the fade is computed but never applied');
});

test('the background does not follow the mood', () => {
  const build = src.slice(src.indexOf('function buildField()'));
  assert.equal(/getMood|TINTS/.test(build.slice(0, build.indexOf('// ---- drifting rock'))), false,
    'tinting the field means rebuilding the offscreen on every mood change — a cache to keep in step');
});
