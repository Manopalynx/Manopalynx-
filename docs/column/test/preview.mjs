// What does a round actually LOOK like on Sam's phone?
//
// Not a mockup and not a drawing: this renders real positions out of the real
// resolver at 393x852, which is an iPhone 16 in portrait. Sam asked how this
// would look and play on his phone, and the honest answer was that nobody had
// looked — the engine had a spatial model nothing had ever drawn.
//
// Blocks, not art. The point is to answer three questions that only a picture
// can answer: how crowded is the field, can you tell heavy from light at a
// glance, and can you see what beat what.
//
// Run:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node docs/column/test/preview.mjs
// Writes docs/column/test/preview-*.png

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve as resolvePath } from 'path';
import { chromium } from 'playwright';
import { UNITS, BY_ID, FIELD, WEIGHT } from '../data.js';
import { resolve, rng, offer } from '../engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 393, H = 852;

// The field gets the middle of the screen; the rest is the cards, the hearts
// and the timer, sized from Sam's own screenshots.
const TOP = 96, BOT = 250;
const FH = H - TOP - BOT;

const COLOUR = {
  walker: '#c94f3d', brute: '#8e3b2f', ultra: '#5b6b7c', amabie: '#b98b2e',
  karkinos: '#4a9d7c', deflector: '#3f7fa8', volt: '#7d5ba6', acid: '#6d9a3a',
  line: '#5ecfc8', swarm: '#c0603f', neurite: '#9a5fb0', fireship: '#d4913a'
};
// Heavy reads as a big shape, light as a small one. If a player cannot tell the
// classes apart at a glance, the counters are unlearnable.
const RADIUS = { heavy: 13, medium: 9, light: 6 };

function frame(units, label, sub) {
  const sx = x => (x / FIELD.w) * W;
  const sy = y => TOP + (y / FIELD.d) * FH;
  const dots = units.map(u => {
    const spec = BY_ID[u.id];
    const r = RADIUS[spec.w];
    const hurt = u.hp / u.max;
    return `<circle cx="${sx(u.x).toFixed(1)}" cy="${sy(u.y).toFixed(1)}" r="${r}"
      fill="${COLOUR[u.id]}" fill-opacity="${(0.35 + 0.65 * hurt).toFixed(2)}"
      stroke="${u.side === 0 ? '#dfe9f5' : '#2b1c22'}" stroke-width="1.6"/>`;
  }).join('');

  return `<div class="phone">
    <div class="chrome top">
      <div class="hearts">${'♥'.repeat(4)}<span class="dim">♥</span></div>
      <div class="who">THE COLUMN · round 4</div>
      <div class="hearts right"><span class="dim">♥♥</span>${'♥'.repeat(3)}</div>
    </div>
    <svg width="${W}" height="${H}" class="field">
      <rect x="0" y="${TOP}" width="${W}" height="${FH}" fill="#141a22"/>
      <line x1="0" y1="${TOP + FH / 2}" x2="${W}" y2="${TOP + FH / 2}" stroke="#243040" stroke-width="1"/>
      ${dots}
    </svg>
    <div class="chrome bottom">
      <div class="label">${label}</div>
      <div class="sub">${sub}</div>
      <div class="cards">
        <div class="card"><b>+1 Walker</b><i>heavy</i></div>
        <div class="card up"><b>Swarm UP!</b><i>upgrade</i></div>
        <div class="card"><b>+3 Line</b><i>light</i></div>
      </div>
      <div class="timer">2 / 3</div>
    </div>
  </div>`;
}

const rand = rng(20260828);
// A round-four army: twelve cards a side, which is what match.mjs says the
// middle of a match actually looks like.
const a = [], b = [];
for (let k = 0; k < 12; k++) { a.push(offer(rand, 1)[0]); b.push(offer(rand, 1)[0]); }

const shots = [];
const want = new Set();
let peak = 0;
resolve(a, b, 99, false, (t, live) => { peak = Math.max(peak, live.length); });
// Sample the opening, the collision, and the decision.
const marks = [0, 40, 110];
resolve(a, b, 99, false, (t, live) => { if (marks.includes(t)) shots.push([t, live]); });

const bodies = cards => cards.reduce((n, id) => n + BY_ID[id].count, 0);
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
   align-items:center;justify-content:center;gap:4px;box-shadow:inset 0 -14px 0 #dcc9a6}
 .card.up{background:#cde9c2;box-shadow:inset 0 -14px 0 #b3d6a4}
 .card b{font-size:13px}
 .card i{font-size:10px;opacity:.65;font-style:normal;letter-spacing:1px;text-transform:uppercase}
 .timer{margin-top:10px;text-align:center;color:#7f8fa2;font-size:12px}
</style>` + shots.map(([t, live]) =>
  frame(live, `t = ${(t / 10).toFixed(1)}s · ${live.length} bodies on screen`,
        `12 cards a side · ${bodies(a)} v ${bodies(b)} bodies deployed · peak ${peak}`)).join('');

const file = resolvePath(HERE, 'preview.html');
writeFileSync(file, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W * 3 + 80, height: H + 40 }, deviceScaleFactor: 2 });
await page.goto('file://' + file);
await page.screenshot({ path: resolvePath(HERE, 'preview-round4.png') });
await browser.close();

console.log(`12 cards a side -> ${bodies(a)} v ${bodies(b)} bodies, peak ${peak} on screen at once`);
console.log(`area per body at peak: ${(W * FH / peak).toFixed(0)}pt² ≈ ${Math.sqrt(W * FH / peak).toFixed(0)}pt square`);
console.log(`written: docs/column/test/preview-round4.png`);
