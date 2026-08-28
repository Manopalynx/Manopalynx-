// WHAT SHOULD THE FIELD LOOK LIKE? — three treatments of one real moment.
//
// preview.mjs asks how crowded the field is. This asks a different question and
// it is Sam's: can it look like a tactical map with the units as markers rather
// than coloured dots? The answer is that the engine has no opinion — it emits
// { id, side, c, lvl, x, y, hp, max } and has never heard of a pixel — so the
// renderer is free, and the way to choose is to draw the same tick three ways
// and look at it on a phone-sized frame.
//
//   A  DOTS        what preview.mjs already draws: one circle per body, hue per
//                  unit type, size per weight class. An instrument, not a design.
//   B  MARKERS     tactical map: one marker per body, shape by weight class,
//                  letter by unit, colour by SIDE rather than by type. Identity
//                  is read from the glyph, which is the only thing that still
//                  works at twelve units — twelve hues do not.
//   C  COUNTERS    tactical map: one marker per CARD, at the centroid of its
//                  surviving bodies, with strength as a bar and the survivor
//                  count on it. Same battle, a quarter of the marks.
//
// SAM CHOSE C, and the game now draws it — which means panel C is mirrored (you
// at the bottom, by his note 3) while A and B are not. That is the record of a
// decision rather than a live comparison; do not read the three as a like-for-
// like any more.
//
// This is the readability layer from Sam's design point 7, which is not the same
// thing as art: telling heavy from light, seeing what is engaging what, and
// knowing how much of a card is left are all things the game has to do whatever
// it ends up looking like.
//
// Run:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node docs/column/test/look.mjs
// Writes docs/column/test/look.png

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve as resolvePath } from 'path';
import { chromium } from 'playwright';
import { BY_ID, FIELD } from '../data.js';
import { resolve, rng, offer, armyFrom } from '../engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 393, H = 852;
const TOP = 96, BOT = 250;
const FH = H - TOP - BOT;
const sx = x => (x / FIELD.w) * W;
const sy = y => TOP + (y / FIELD.d) * FH;

// One letter a unit. Identity by glyph, not by hue — a tactical map stays
// readable at twelve unit types and a palette does not.
const CODE = {
  walker: 'W', brute: 'B', ultra: 'U', amabie: 'A', karkinos: 'K', deflector: 'D',
  volt: 'V', acid: 'C', line: 'L', swarm: 'S', neurite: 'N', fireship: 'F'
};
const HUE = {
  walker: '#c94f3d', brute: '#8e3b2f', ultra: '#5b6b7c', amabie: '#b98b2e',
  karkinos: '#4a9d7c', deflector: '#3f7fa8', volt: '#7d5ba6', acid: '#6d9a3a',
  line: '#5ecfc8', swarm: '#c0603f', neurite: '#9a5fb0', fireship: '#d4913a'
};
const RADIUS = { heavy: 13, medium: 9, light: 6 };
const SIDE = [{ fill: '#1b3a52', line: '#6fc6f5', ink: '#dff1ff' },
              { fill: '#4a2418', line: '#f2955c', ink: '#ffe6d6' }];

/* --------------------------------------------------------------- treatments */
const dots = live => live.map(u => {
  const r = RADIUS[BY_ID[u.id].w];
  return `<circle cx="${sx(u.x).toFixed(1)}" cy="${sy(u.y).toFixed(1)}" r="${r}"
    fill="${HUE[u.id]}" fill-opacity="${(0.35 + 0.65 * u.hp / u.max).toFixed(2)}"
    stroke="${u.side === 0 ? '#dfe9f5' : '#2b1c22'}" stroke-width="1.6"/>`;
}).join('');

// Shape carries the weight class, so a player learns "square is heavy" once and
// it holds for every unit in the class — which is what makes counters learnable.
function shape(w, x, y, s, fill, line, o = 1) {
  if (w === 'heavy')                       // square: it holds ground
    return `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" rx="2"
      fill="${fill}" fill-opacity="${o}" stroke="${line}" stroke-width="1.6"/>`;
  if (w === 'medium')                      // diamond: it does one job
    return `<path d="M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z"
      fill="${fill}" fill-opacity="${o}" stroke="${line}" stroke-width="1.6"/>`;
  return `<circle cx="${x}" cy="${y}" r="${s}" fill="${fill}" fill-opacity="${o}" stroke="${line}" stroke-width="1.4"/>`;
}

const markers = live => live.map(u => {
  const spec = BY_ID[u.id], c = SIDE[u.side];
  const x = sx(u.x), y = sy(u.y), s = { heavy: 12, medium: 9.5, light: 8 }[spec.w];
  const hurt = u.hp / u.max;
  // Health as the marker FADING. A bar beside a 16pt counter is two pixels and
  // reads as noise; an overlay rectangle does not follow the shape and turns a
  // hurt diamond into a diamond with a box drawn through it.
  return shape(spec.w, x, y, s, c.fill, c.line, 0.35 + 0.65 * hurt) +
    `<text x="${x}" y="${y + s * 0.36}" text-anchor="middle" font-size="${(s * 1.05).toFixed(1)}"
       font-weight="700" fill="${c.ink}">${CODE[u.id]}</text>`;
}).join('');

// One marker a CARD. Bodies still exist and still die one at a time — the
// renderer aggregates, the engine does not.
function counters(live) {
  const by = new Map();
  for (const u of live) {
    const k = u.side + ':' + u.c;
    const g = by.get(k) || { id: u.id, side: u.side, lvl: u.lvl, x: 0, y: 0, hp: 0, max: 0, n: 0 };
    g.x += u.x; g.y += u.y; g.hp += u.hp; g.max += u.max; g.n++;
    by.set(k, g);
  }
  return [...by.values()].map(g => {
    const spec = BY_ID[g.id], c = SIDE[g.side];
    const x = sx(g.x / g.n), y = sy(g.y / g.n);
    const s = { heavy: 14, medium: 12, light: 11 }[spec.w];
    const hurt = g.hp / g.max;
    return shape(spec.w, x, y, s, c.fill, c.line) +
      `<rect x="${x - s}" y="${y + s + 2}" width="${s * 2}" height="3" fill="#000" fill-opacity="0.5"/>` +
      `<rect x="${x - s}" y="${y + s + 2}" width="${(s * 2 * hurt).toFixed(1)}" height="3" fill="${c.line}"/>` +
      `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="13" font-weight="700" fill="${c.ink}">${CODE[g.id]}</text>` +
      (spec.count > 1 ? `<text x="${x + s + 1}" y="${y - s + 6}" font-size="9" fill="${c.line}">${g.n}</text>` : '') +
      (g.lvl ? `<text x="${x - s - 8}" y="${y + 4}" font-size="10" fill="#ffd479">${'^'.repeat(g.lvl)}</text>` : '');
  }).join('');
}

/* -------------------------------------------------------------------- frame */
function frame(live, treatment, title, sub, ground) {
  return `<div class="phone">
    <div class="chrome top">
      <div class="hearts">${'&#9829;'.repeat(4)}<span class="dim">&#9829;</span></div>
      <div class="who">THE COLUMN &middot; round 4</div>
      <div class="hearts right"><span class="dim">&#9829;&#9829;</span>${'&#9829;'.repeat(3)}</div>
    </div>
    <svg width="${W}" height="${H}" class="field">
      ${ground}
      ${treatment(live)}
    </svg>
    <div class="chrome bottom">
      <div class="label">${title}</div>
      <div class="sub">${sub}</div>
      <div class="cards">
        <div class="card"><b>+1 Walker</b><i>heavy &middot; 1 body</i></div>
        <div class="card up"><b>Swarm UP!</b><i>upgrade &middot; +35%</i></div>
        <div class="card"><b>+3 Line</b><i>light &middot; 3 bodies</i></div>
      </div>
      <div class="timer">pick 2 of 3</div>
    </div>
  </div>`;
}

const PLAIN = `<rect x="0" y="${TOP}" width="${W}" height="${FH}" fill="#141a22"/>
  <line x1="0" y1="${TOP + FH / 2}" x2="${W}" y2="${TOP + FH / 2}" stroke="#243040" stroke-width="1"/>`;

// A map ground: grid, a centre line that reads as the line of contact, and the
// two deployment bands. No terrain, because the engine has none and drawing
// terrain the rules do not know about is the renderer disagreeing with the game.
const MAP = `<rect x="0" y="${TOP}" width="${W}" height="${FH}" fill="#0e1620"/>
  ${Array.from({ length: 9 }, (_, i) =>
    `<line x1="${(i + 1) * W / 10}" y1="${TOP}" x2="${(i + 1) * W / 10}" y2="${TOP + FH}" stroke="#16222f" stroke-width="1"/>`).join('')}
  ${Array.from({ length: 13 }, (_, i) =>
    `<line x1="0" y1="${TOP + (i + 1) * FH / 14}" x2="${W}" y2="${TOP + (i + 1) * FH / 14}" stroke="#16222f" stroke-width="1"/>`).join('')}
  <rect x="0" y="${TOP}" width="${W}" height="${FH * 0.16}" fill="#6fc6f5" fill-opacity="0.05"/>
  <rect x="0" y="${TOP + FH * 0.84}" width="${W}" height="${FH * 0.16}" fill="#f2955c" fill-opacity="0.05"/>
  <line x1="0" y1="${TOP + FH / 2}" x2="${W}" y2="${TOP + FH / 2}" stroke="#2c3f54" stroke-width="1" stroke-dasharray="6 6"/>`;

/* --------------------------------------------------- one real battle moment */
const rand = rng(20260828);
const a = [], b = [];
for (let k = 0; k < 12; k++) { a.push(offer(rand, 1)[0]); b.push(offer(rand, 1)[0]); }

const MARK = 40;                       // the collision, in ticks
let shot = null, peak = 0;
resolve(a, b, 99, false, (t, live) => {
  peak = Math.max(peak, live.length);
  if (t === MARK) shot = live;
});

const cards = live => new Set(live.map(u => u.side + ':' + u.c)).size;
const html = `<style>
 body{margin:0;background:#0a0d12;font:13px -apple-system,system-ui,sans-serif;display:flex;gap:18px;padding:18px}
 .phone{width:${W}px;height:${H}px;position:relative;background:#0f141b;border-radius:26px;overflow:hidden;box-shadow:0 0 0 2px #222c38}
 .field{position:absolute;inset:0}
 .chrome{position:absolute;left:0;right:0;color:#c8d4e2;z-index:2}
 .top{top:0;height:${TOP}px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:linear-gradient(#171f29,#0f141b)}
 .hearts{color:#e05a6a;font-size:17px;letter-spacing:2px}
 .dim{color:#3a2630}
 .who{font-size:11px;letter-spacing:1.4px;color:#7f8fa2}
 .bottom{bottom:0;height:${BOT}px;background:linear-gradient(#0f141b,#171f29);padding:10px 14px}
 .label{font-size:12px;color:#e7eef7;font-weight:600}
 .sub{font-size:11px;color:#7f8fa2;margin-bottom:10px}
 .cards{display:flex;gap:8px}
 .card{flex:1;height:104px;border-radius:12px;background:#f2e2c4;color:#3a2f1e;display:flex;flex-direction:column;
   align-items:center;justify-content:center;gap:4px;box-shadow:inset 0 -14px 0 #dcc9a6;text-align:center}
 .card.up{background:#cde9c2;box-shadow:inset 0 -14px 0 #b3d6a4}
 .card b{font-size:13px}
 .card i{font-size:9.5px;opacity:.65;font-style:normal;letter-spacing:.5px;text-transform:uppercase}
 .timer{margin-top:10px;text-align:center;color:#7f8fa2;font-size:12px}
</style>` +
  frame(shot, dots, 'A · dots — what the instrument draws',
        `${shot.length} bodies · hue per unit type · size per class`, PLAIN) +
  frame(shot, markers, 'B · markers — one per body',
        `${shot.length} marks · shape = class, letter = unit, colour = side`, MAP) +
  frame(shot, counters, 'C · counters — one per card',
        `${cards(shot)} marks for the same ${shot.length} bodies · bar = strength left`, MAP);

const file = resolvePath(HERE, 'look.html');
writeFileSync(file, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W * 3 + 80, height: H + 40 }, deviceScaleFactor: 2 });
await page.goto('file://' + file);
await page.screenshot({ path: resolvePath(HERE, 'look.png') });
await browser.close();

console.log(`t = ${(MARK / 10).toFixed(1)}s · ${shot.length} bodies · ${cards(shot)} cards · peak ${peak} bodies`);
console.log(`A and B draw ${shot.length} marks, C draws ${cards(shot)} — ${(shot.length / cards(shot)).toFixed(1)}x fewer`);
console.log(`written: docs/column/test/look.png`);
