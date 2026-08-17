// Why does `the brush reaches into a tank` fail about one run in three?
//
// It failed a full suite run with "three taps put 1 cells of a worm inside a tank of
// water" against a bar of 3, and passed the run before and the run after. The same
// fixture run forty times in a fresh page never went below seven:
//
//     fish  min 8  median 13  max 21     0/40 under the bar
//     sand  min 72 median 80  max 85     0/40
//     worm  min 7  median 13  max 21     0/40
//
// Three taps of a brush-3 disc is about 87 chances at the worm's `sparse` of 0.16, so
// the expected count is 14 and the measured median is 13. **One is not the tail of that
// distribution, it is a different experiment** — so the count is a symptom and the fault
// is upstream of the dice.
//
// Two hypotheses were killed by arithmetic before this was written, which is worth
// recording so nobody pays for them twice:
//
//   "the worm is sparser than the fish, and the fix was tuned on the fish"
//       No. The worm is 0.16 against the fish's 0.14 — it should place MORE.
//   "the grid came up short, so most of the tank is off the top"
//       No. `build()` floors the grid at 40×40, and even at the floor the tank is 40
//       wide and the three discs land inside it with all ~87 cells eligible.
//
// So this reproduces the suite's conditions exactly rather than approximately — the
// same rAF stub installed before boot, the same blocked network, the same
// `domcontentloaded` and `W > 40` wait, and the suite's own HARNESS read out of the
// suite file rather than copied — and prints what the check cannot see: the grid it got,
// the tank it actually built, and how many cells of that tank were eligible to be
// painted at the moment the brush went in.
//
// Run:  node test/brush-rate.mjs [runs]

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = 'file://' + resolve(here, '..', 'matchbox.html');
const RUNS = Number(process.argv[2] || 30);

/* The suite's harness, read out of the suite rather than restated here. A probe that
   reimplements the thing it is investigating agrees with itself long after it has
   stopped agreeing with the thing — which is the note the suite itself carries at the
   top of this very string. */
const suite = readFileSync(resolve(here, 'matchbox-sim.mjs'), 'utf8');
const m = suite.match(/const HARNESS = `([\s\S]*?)\n`;/);
if (!m) { console.error('could not find HARNESS in matchbox-sim.mjs — it has been renamed or reshaped'); process.exit(1); }
const HARNESS = m[1];
const VIEWPORT = { width: 430, height: 900 };   // the suite's own board

const browser = await chromium.launch();
const rows = [];

for (let run = 0; run < RUNS; run++) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.setDefaultTimeout(20000);
  const problems = [];
  page.on('pageerror', e => problems.push('uncaught: ' + e.message));
  page.on('console', c => { if (c.type() === 'error' && !/Failed to load resource/.test(c.text())) problems.push('console: ' + c.text()); });
  await page.route(u => /^https?:/.test(u.href), r => r.abort());
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof W !== 'undefined' && W > 40);
  await page.evaluate(HARNESS);

  const r = await page.evaluate(() => {
    const cx = (W/2)|0;
    const out = { W, H, amb: AMBIENT, room: ROOMS[roomAt] && ROOMS[roomAt].n, got: {}, tank: {}, eligible: {} };
    const into = (name, t) => {
      __wipe(); const f = __floor();
      __slab(cx-20, f-30, cx+20, f-1, WATER);
      // What the tank actually came out as, and how much of what the brush is about to
      // cover is eligible at all. `yields` is the gate paintCell applies: air, gas or
      // liquid. If this is 87 the dice are the only thing left; if it is small, the
      // scene was never the scene the check believes it built.
      let water = 0;
      for (let i=0;i<type.length;i++) if (type[i]===WATER) water++;
      let elig = 0;
      for (const ox of [-8, 0, 8])
        for (let dy=-3; dy<=3; dy++) for (let dx=-3; dx<=3; dx++){
          if (dx*dx+dy*dy > 9) continue;
          const x = cx+ox+dx, y = f-15+dy;
          if (!inb(x,y)) continue;
          if (yields(type[idx(x,y)])) elig++;
        }
      out.tank[name] = water; out.eligible[name] = elig;
      const before = __count(t);
      const t0 = tool, b0 = brush;
      tool = t; brush = 3;
      paintAt(cx-8, f-15); paintAt(cx, f-15); paintAt(cx+8, f-15);
      tool = t0; brush = b0;
      out.got[name] = __count(t) - before;
    };
    into('fish', FISH); into('sand', SAND); into('worm', WORM);
    return out;
  });
  r.problems = problems;
  rows.push(r);
  await page.close();
  process.stdout.write(r.got.worm < 3 || r.got.fish < 3 || r.got.sand < 3 ? '!' : '.');
}
await browser.close();
console.log('');

const col = k => rows.map(r => r.got[k]);
const stat = k => { const v = col(k).slice().sort((a,b)=>a-b);
  return { min: v[0], med: v[(v.length/2)|0], max: v[v.length-1], under: v.filter(x=>x<3).length }; };

console.log(`\n${RUNS} fresh pages, each set up exactly as the suite sets one up.\n`);
console.log('        min  median  max   under the bar of 3');
console.log('-'.repeat(46));
for (const k of ['fish','sand','worm']) {
  const s = stat(k);
  console.log(k.padEnd(7) + String(s.min).padStart(4) + String(s.med).padStart(8)
            + String(s.max).padStart(5) + String(s.under).padStart(11) + ` of ${RUNS}`);
}

const grids = new Set(rows.map(r => r.W + '×' + r.H));
const tanks = new Set(rows.map(r => r.tank.worm));
const eligs = new Set(rows.map(r => r.eligible.worm));
const rooms = new Set(rows.map(r => r.room + ' ' + r.amb));
console.log(`\ngrid          ${[...grids].join(', ')}`);
console.log(`tank cells    ${[...tanks].sort((a,b)=>a-b).join(', ')}`);
console.log(`eligible      ${[...eligs].sort((a,b)=>a-b).join(', ')}   (87 is the whole of three discs)`);
console.log(`room          ${[...rooms].join(', ')}`);

const bad = rows.filter(r => r.got.worm < 3 || r.got.fish < 3 || r.got.sand < 3);
if (bad.length) {
  console.log(`\n${bad.length} run(s) under the bar, in full:\n`);
  for (const r of bad) console.log('  ' + JSON.stringify(r));
} else {
  console.log('\nNothing under the bar in this batch.');
}
const noisy = rows.filter(r => r.problems.length);
if (noisy.length) console.log(`\n${noisy.length} run(s) logged a page error: ${noisy[0].problems[0]}`);
console.log('');
