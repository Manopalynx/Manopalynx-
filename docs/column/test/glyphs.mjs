// ARE THE GLYPHS LEGIBLE AT THE SIZE THEY ARE ACTUALLY DRAWN?
//
// A drawing that reads on a laptop and not on a 25pt counter is worse than the
// letter it replaced. So this renders each unit at BOTH real sizes, on a sheet
// the width of Sam's phone, with nothing scaled up for inspection:
//
//   · counter size — inside its real class shape, at 3.92pt per field unit,
//     which is what a 393x852 phone gives a viewBox of 100x140
//   · card size    — the mark on a deck card, where there is sixteen times the
//     area and the detail strokes are drawn too
//
// The row order is by CLASS, because that is the only comparison that matters:
// the outer shape already tells you heavy from light, so a glyph only has to be
// distinct from the three others in its own row.
//
// Run:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node docs/column/test/glyphs.mjs

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve as rp } from 'path';
import { chromium } from 'playwright';
import { UNITS, BY_ID } from '../data.js';
import { glyph } from '../glyphs.js';
import { shape, SIDE } from '../render.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PT = Math.min(393 / 100, 549 / 140);          // points per field unit
const SIZE = { heavy: 3.7, medium: 3.2, light: 2.9 };  // counter radii, field units

// A counter, drawn at exactly the points it occupies in the game.
function counter(u, side = 0) {
  const r = SIZE[u.w], px = r * PT, box = px * 2 + 10;
  const c = SIDE[side];
  return `<svg width="${box}" height="${box}" viewBox="${-r - 1.3} ${-r - 1.3} ${r * 2 + 2.6} ${r * 2 + 2.6}">
    ${shape(u.w, 0, 0, r, c.fill, c.line)}
    ${glyph(u.id, 0, 0, r * 0.62, c.ink, 1.15)}
  </svg>`;
}

// The same mark on a card face: 72pt, detail strokes on.
function art(u) {
  return `<svg width="72" height="72" viewBox="-6 -6 12 12">
    ${glyph(u.id, 0, 0, 5, '#3a2f1e', 0.62, true)}
  </svg>`;
}

const rows = ['heavy', 'medium', 'light'].map(w => {
  const list = UNITS.filter(u => u.w === w);
  return `<h2>${w} — ${list.length} cards, ${{ heavy: 1, medium: 2, light: 3 }[w]} ${w === 'heavy' ? 'body' : 'bodies'} each
    &middot; counter ${(SIZE[w] * 2 * PT).toFixed(0)}pt across</h2>
    <div class="row">${list.map(u => `<div class="cell">
      <div class="ctr">${counter(u, 0)}${counter(u, 1)}</div>
      <div class="card">${art(u)}<b>${u.n}</b></div>
    </div>`).join('')}</div>`;
}).join('');

const html = `<style>
 body{margin:0;background:#0b1017;color:#c8d4e2;font:13px -apple-system,system-ui,sans-serif;
   width:393px;padding:14px}
 h1{font-size:15px;letter-spacing:1.6px;text-transform:uppercase;margin:2px 0 2px}
 .note{font-size:11px;color:#7f8fa2;margin-bottom:10px}
 h2{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#7f8fa2;
   margin:16px 0 6px;font-weight:600}
 .row{display:flex;gap:6px}
 .cell{flex:1;text-align:center}
 .ctr{background:#0e1620;border-radius:8px;padding:6px 0;display:flex;justify-content:center;gap:2px}
 .card{margin-top:5px;background:#f2e2c4;border-radius:10px;padding:6px 2px 7px;
   box-shadow:inset 0 -8px 0 #dcc9a6;color:#3a2f1e}
 .card b{display:block;font-size:10px;margin-top:1px;line-height:1.1}
</style>
<h1>The Column · unit marks</h1>
<div class="note">Top row of each pair: the counter at its real size on a 393pt field,
both sides. Below: the same mark on a card face at 72pt with its detail strokes.
Nothing here is magnified.</div>
${rows}`;

const file = rp(HERE, 'glyphs.html');
writeFileSync(file, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 3 });
await page.goto('file://' + file);
await page.screenshot({ path: rp(HERE, 'glyphs.png'), fullPage: true });
await browser.close();
console.log(`counter marks drawn at ${(SIZE.heavy * 2 * PT).toFixed(0)}/${(SIZE.medium * 2 * PT).toFixed(0)}/${(SIZE.light * 2 * PT).toFixed(0)}pt, card marks at 72pt`);
console.log('written: docs/column/test/glyphs.png');
