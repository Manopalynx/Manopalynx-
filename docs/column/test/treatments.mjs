// HOW SHOULD A CARD SHOW THAT IT HAS LOST BODIES? — four treatments, one moment.
//
// Sam's note 23. A counter is one CARD, and 9 of the 15 cards field more than one
// body, so a counter is usually several things standing together. Until turn 1 of
// this session the only thing that moved when one of them died was a 2.3pt digit;
// the strength bar divided by the survivors and stayed pinned at full. The bar is
// honest now. The question this file asks is whether a bar is ENOUGH, or whether
// the counter should show the loss in its own body.
//
//   A  NOW          what ships: one shape, the glyph, an honest strength bar and
//                   the survivor digit. The control, drawn by the REAL renderer
//                   rather than a copy of it -- a mock baseline flatters every
//                   alternative sitting next to it.
//   B  SEGMENTS     the rim broken into one tick per body, unlit as they die.
//                   One shape, one glyph, nothing moves; the loss is read off the
//                   edge. Costs no legibility because nothing inside changes.
//   C  SUB-MARKS    Sam's own suggestion: `count` small shapes filling the same
//                   footprint, disappearing one at a time. The most literal
//                   reading of "shows the unit losing a unit".
//   D  SUB-MARKS +  the same, with the dead left as hollow outlines. C alone
//      GHOSTS       cannot tell a one-body card from a swarm cut down to one --
//                   both draw a single small mark. The ghosts say which.
//
// EVERY TREATMENT USES THE SAME GEOMETRY AND THE SAME GROUPING as the shipped
// renderer -- groupByCard, the same SIZE table, the same colours -- so the only
// variable is the encoding. And every panel is drawn at TRUE PHONE SCALE, because
// the whole question is whether a thing 23pt across can carry the information; a
// treatment judged at four times the size is a treatment judged on a screen
// nobody owns. The magnified strip underneath is for reading the construction,
// not for choosing.
//
// Run:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node docs/column/test/treatments.mjs
// Writes docs/column/test/treat-bodies.png

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve as resolvePath } from 'path';
import { chromium } from 'playwright';
import { BY_ID, FIELD } from '../data.js';
import { resolve } from '../engine.js';
import { draw, groupByCard, shape, SIDE, flipY } from '../render.js';
import { glyph } from '../glyphs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 393, H = 560;
const SIZE = { heavy: 3.7, medium: 3.2, light: 2.9 };

/* ---------------------------------------------------------- the alternatives */
// Each returns the SVG for one counter, given the group the shipped renderer
// would have drawn. `n` bodies still standing out of `spec.count`.

// B -- one tick a body around the rim, unlit when that body is gone. Placed on a
// circle whether the counter is a square, a diamond or a circle, because the rim
// of the three shapes is not the same curve and a tick that hugs each one would
// be three rules instead of one.
const segments = (g, spec, s, c) => {
  const out = [];
  const r = s + 0.85, span = 300 / spec.count, gap = span * 0.3;
  for (let i = 0; i < spec.count; i++) {
    const a0 = -150 + i * span + gap / 2, a1 = -150 + (i + 1) * span - gap / 2;
    const rad = d => (d - 90) * Math.PI / 180;
    const x0 = g.x + r * Math.cos(rad(a0)), y0 = g.y + r * Math.sin(rad(a0));
    const x1 = g.x + r * Math.cos(rad(a1)), y1 = g.y + r * Math.sin(rad(a1));
    const alive = i < g.n;
    out.push(`<path d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}"
      fill="none" stroke="${alive ? c.line : '#000'}" stroke-opacity="${alive ? 0.95 : 0.5}"
      stroke-width="${alive ? 0.5 : 0.35}" stroke-linecap="round"/>`);
  }
  return out.join('');
};

// C and D -- `count` small shapes on a ring inside the counter's own footprint,
// so the tap target and the space the counter occupies do not change. The glyph
// sits over the cluster at the size it always was: identity is by glyph, and a
// treatment that shrinks the glyph to fit its own idea has traded the thing that
// works for the thing being tried.
const cluster = (g, spec, s, c, ghosts) => {
  const n = spec.count;
  const sub = n === 1 ? s : s * (n === 2 ? 0.62 : n === 3 ? 0.55 : 0.38);
  const ring = n === 1 ? 0 : s - sub;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = g.x + ring * Math.cos(a), y = g.y + ring * Math.sin(a);
    if (i < g.n) out.push(shape(spec.w, x, y, sub, c.fill, c.line));
    else if (ghosts) out.push(shape(spec.w, x, y, sub, 'none', c.line, 0)
      .replace('stroke-width="0.45"', 'stroke-width="0.3" stroke-opacity="0.35" stroke-dasharray="0.7 0.7"'));
  }
  return out.join('');
};

// The shipped counter's furniture, so every treatment carries the same bar and
// the same glyph and differs only where it is meant to.
const furniture = (g, spec, s, c, digit) =>
  `<rect x="${g.x - s}" y="${g.y + s + 0.6}" width="${s * 2}" height="0.9" fill="#000" fill-opacity="0.55"/>` +
  `<rect x="${g.x - s}" y="${g.y + s + 0.6}" width="${(s * 2 * Math.max(0, Math.min(1, g.hp / (spec.count * g.per || g.max)))).toFixed(2)}" height="0.9" fill="${c.line}"/>` +
  glyph(g.id, g.x, g.y, s * 0.62, c.ink, 1.15) +
  (digit && spec.count > 1
    ? `<text x="${g.x + s + 0.4}" y="${g.y - s + 1.8}" font-size="2.3" fill="${c.line}"
         font-family="system-ui,sans-serif">${g.n}</text>` : '');

// E -- a pip a body under the bar, hollow when that body is gone. The counter
// itself is untouched: one shape, the glyph at full size, nothing overlapping.
// It is the only treatment here that adds the information without spending any
// of the legibility the glyph-and-shape system was built to protect.
const pips = (g, spec, s, c) => {
  if (spec.count < 2) return '';
  const gapx = Math.min(1.0, (s * 2) / spec.count), r = Math.min(0.34, gapx * 0.34);
  const x0 = g.x - (gapx * (spec.count - 1)) / 2, y = g.y + s + 2.6;
  return Array.from({ length: spec.count }, (_, i) =>
    `<circle cx="${(x0 + i * gapx).toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}"
       fill="${i < g.n ? c.line : 'none'}" stroke="${c.line}" stroke-width="0.22"
       stroke-opacity="${i < g.n ? 1 : 0.45}"/>`).join('');
};

const TREATMENTS = {
  A: { n: 'A · now', d: 'one shape · honest bar · survivor digit',
       f: (g, spec, s, c) => shape(spec.w, g.x, g.y, s, c.fill, c.line) + furniture(g, spec, s, c, true) },
  B: { n: 'B · segments', d: 'one tick a body round the rim, unlit as they die',
       f: (g, spec, s, c) => shape(spec.w, g.x, g.y, s, c.fill, c.line)
          + segments(g, spec, s, c) + furniture(g, spec, s, c, false) },
  C: { n: 'C · sub-marks', d: 'one small shape a body, gone when it dies',
       f: (g, spec, s, c) => cluster(g, spec, s, c, false) + furniture(g, spec, s, c, false) },
  D: { n: 'D · sub-marks + ghosts', d: 'the dead left as hollow outlines',
       f: (g, spec, s, c) => cluster(g, spec, s, c, true) + furniture(g, spec, s, c, false) },
  E: { n: 'E · pips', d: 'a pip a body under the bar · the counter untouched',
       f: (g, spec, s, c) => shape(spec.w, g.x, g.y, s, c.fill, c.line)
          + furniture(g, spec, s, c, false) + pips(g, spec, s, c) }
};

const paint = (live, key) => groupByCard(live).map(g => {
  const spec = BY_ID[g.id], c = SIDE[g.side], s = SIZE[spec.w];
  const gg = { ...g, y: flipY(g.y) };
  return `<g>${TREATMENTS[key].f(gg, spec, s, c)}</g>`;
}).join('');

/* --------------------------------------------- a real moment, mid-engagement */
// Chosen by MEASUREMENT rather than by eye: the tick where the most cards are
// part-strength, because a frame where nothing has died yet cannot show the
// difference between any of these treatments -- which is exactly why look.png
// never contained the bar defect that turn 1 fixed.
const A_ARMY = ['swarm', 'line', 'neurite', 'deflector', 'acid', 'walker', 'karkinos', 'volt', 'fireship'];
const B_ARMY = ['brute', 'ultra', 'amabie', 'line', 'swarm', 'neurite', 'acid', 'karkinos', 'walker'];
let best = null, bestScore = -1;
resolve(A_ARMY, B_ARMY, 4242, false, (t, live) => {
  const partial = groupByCard(live).filter(g => g.n < (BY_ID[g.id].count || 1)).length;
  if (partial > bestScore) { bestScore = partial; best = live; }
});

/* ---------------------------------------------------------- specimens, big */
// One card at every survivor count, drawn large. Not for choosing -- for seeing
// what the encoding IS once you have chosen it off the phone-sized panel.
const specimen = (id, key) => {
  const spec = BY_ID[id], s = SIZE[spec.w], c = SIDE[0];
  const cells = [];
  for (let alive = spec.count; alive >= 1; alive--) {
    const g = { id, side: 0, n: alive, hp: spec.hp * alive, max: spec.hp * alive,
                per: spec.hp, lvl: 0, x: 8, y: 8, key: 'x' };
    cells.push(`<svg viewBox="0 0 16 18" width="72" height="81">${TREATMENTS[key].f(g, spec, s, c)}</svg>`);
  }
  return `<div class="spec"><i>${spec.n} · ${spec.count} bodies</i><div>${cells.join('')}</div></div>`;
};

const panel = key => {
  const t = TREATMENTS[key];
  return `<div class="col">
    <div class="phone"><svg class="field" viewBox="0 0 ${FIELD.w} ${FIELD.d}">
      <rect width="${FIELD.w}" height="${FIELD.d}" fill="#0f141b"/>${paint(best, key)}</svg></div>
    <div class="label">${t.n}</div><div class="sub">${t.d}</div>
    ${specimen('swarm', key)}${specimen('deflector', key)}${specimen('adarnas', key)}
  </div>`;
};

const html = `<style>
 body{margin:0;background:#0a0d12;font:13px -apple-system,system-ui,sans-serif;
   display:flex;gap:16px;padding:16px;align-items:flex-start}
 .col{width:${W}px}
 .phone{width:${W}px;height:${H}px;background:#0f141b;border-radius:22px;overflow:hidden;
   box-shadow:0 0 0 2px #222c38}
 .field{width:100%;height:100%;display:block}
 .label{font-size:13px;color:#e7eef7;font-weight:600;margin-top:10px}
 .sub{font-size:11px;color:#7f8fa2;margin-bottom:8px}
 .spec{margin-top:6px}
 .spec i{font-size:10px;color:#5f7085;font-style:normal;letter-spacing:.4px}
 .spec div{display:flex;gap:2px;background:#0f141b;border-radius:8px;padding:2px 4px;margin-top:2px}
 .spec svg{display:block}
</style>` + ['A', 'B', 'C', 'D', 'E'].map(panel).join('');

const file = resolvePath(HERE, 'treatments.html');
writeFileSync(file, html);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: (W + 16) * 5 + 16, height: H + 300 }, deviceScaleFactor: 2 });
await page.goto('file://' + file);
await page.screenshot({ path: resolvePath(HERE, 'treat-bodies.png'), fullPage: true });
await browser.close();

const groups = groupByCard(best);
const multi = groups.filter(g => (BY_ID[g.id].count || 1) > 1);
console.log(`the moment: ${groups.length} cards on the field, ${bestScore} of them part-strength`);
console.log(`multi-body cards drawn: ${multi.map(g => `${BY_ID[g.id].n} ${g.n}/${BY_ID[g.id].count}`).join(', ')}`);
console.log(`written: docs/column/test/treat-bodies.png`);
