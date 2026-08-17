// What should the sound follow?
//
// An instrument, not a check. It exists to answer one question before any audio is
// written: which number in this box tracks "how much is happening" well enough to
// drive a score, and which numbers only look as though they do.
//
// Four candidates, all of which are already computed or nearly free:
//
//   mix      the box's mixing temperature — total heat energy over total heat
//            capacity. `roomLoss` already gathers exactly this every tick when the
//            room is Neutral, measured at 0.126ms, so on Neutral it costs nothing
//            and on the other six settings it costs one multiply-add per cell.
//   above    the same number minus AMBIENT. Identical arithmetic to the heat
//            *excess* per unit capacity, since mix − AMBIENT = Σ(t−AMBIENT)·p / Σp.
//   alight   cells actually burning. Not cells that are hot: `MATCHBOX.md` records
//            counting the two as the same making a lid of ice read as feeding the
//            fire under it, so this uses the page's own condition — fuel left, over
//            the ignition point, and charred for long enough.
//   peak     the hottest cell in the box, which is what the gauge already shows.
//
// The scenarios are chosen to break them rather than to flatter them. Three empty
// boxes at three room settings are the control: nothing is happening in any of them,
// so a signal that reports a large number for an empty oven is a signal that has
// mistaken the room dial for an event.
//
// Run:  node test/signal.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const PAGE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '..', 'matchbox.html');
const VIEWPORT = { width: 430, height: 900 };   // the sim suite's board, so the figures compare

// 60 ticks to the second: STEPS is 1 and the frame loop runs at 60Hz.
const SEC = 60;

const HARNESS = `
  window.__step  = n => { for (let k=0;k<n;k++) simTick(); };
  window.__count = t => { let n=0; for (let i=0;i<type.length;i++) if (type[i]===t) n++; return n; };
  window.__wipe  = () => { type.fill(0); temp.fill(AMBIENT); fuel.fill(0); life.fill(0); vel.fill(0); };
  window.__floor = () => { const f = H-6; for (let x=0;x<W;x++) for (let y=f;y<H;y++) put(x,y,STONE); return f; };
  window.__flame = (x,y,r) => {
    const t0 = tool, b0 = brush, m0 = matchLit;
    tool = 'match'; brush = r; matchLit = 99;
    paintAt(x,y);
    tool = t0; brush = b0; matchLit = m0;
  };
  window.__hold = (x,y,r,ticks) => { for (let k=0;k<ticks;k++){ __flame(x,y,r); __step(1); } };
  window.__room  = n => { const i = ROOMS.findIndex(r => r.n === n);
    if (i < 0) throw new Error('no room called ' + n); setRoom(i); return i; };
  window.__scene = n => SCENES.find(s => s.name === n);
  window.__edge  = (t, pick) => { let best = null;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){
      if (type[idx(x,y)] !== t) continue;
      if (!best || (pick==='top' ? y<best[1] : x<best[0])) best = [x,y];
    }
    return best; };

  /* The four candidates, read in one pass so the cost quoted below is the real cost of
     asking for all of them rather than the sum of four sweeps.

     \`alight\` is the page's own definition and not a copy of it in spirit only: a cell
     is burning when it has fuel left, is over its own ignition point, and has charred
     for at least its own \`char\`. That is what separates a log with a match on it from
     a log that has caught. */
  window.__signals = () => {
    let heat = 0, cap = 0, alight = 0, peak = -1e9, fire = 0;
    for (let i=0; i<type.length; i++){
      const t = type[i], m = M[t];
      const p = CAPS[t];
      heat += temp[i] * p; cap += p;
      if (temp[i] > peak) peak = temp[i];
      if (t === FIRE) fire++;
      if (m.fuel > 0 && fuel[i] > 0 && m.ig !== undefined && temp[i] >= m.ig
          && life[i] >= (m.char !== undefined ? m.char : CHAR)) alight++;
    }
    const mix = heat / cap;
    return { mix, above: mix - AMBIENT, alight, fire, peak, amb: AMBIENT };
  };
  setRoom(ROOMS.findIndex(r => r.n === 'Normal'));
`;

const scenarios = [
  // The controls. Nothing is happening in any of these.
  ['empty · Normal',    async p => p.evaluate(() => { __room('Neutral');   __wipe(); }), 60],
  ['empty · Oven',      async p => p.evaluate(() => { __room('Oven');     __wipe(); }), 60],
  ['empty · Freezing',  async p => p.evaluate(() => { __room('Freezing'); __wipe(); }), 60],

  // A box with something in it and nothing happening to it — the second control, and
  // the harder one: the Garden is busy with life and cold throughout.
  ['Garden · alone',    async p => p.evaluate(() => { __room('Neutral'); loadScene(__scene('Garden')); }), 120],

  // Fires, smallest to largest.
  ['Chandler · lit',    async p => p.evaluate(() => { __room('Neutral'); loadScene(__scene('Chandler'));
                          const w = __edge(FUSE,'top'); __hold(w[0], w[1], 2, 120); }), 120],
  ['opening · lit',     async p => p.evaluate(() => { __room('Neutral'); __wipe(); seed();
                          const o = __edge(OIL,'left'); __hold(o[0], o[1], 2, 90); }), 120],
  ['Forge · lit',       async p => p.evaluate(() => { __room('Neutral'); loadScene(__scene('Forge'));
                          const f = __edge(FUSE,'left'); __hold(f[0], f[1], 2, 150); }), 150],
  ['Volcano · alone',   async p => p.evaluate(() => { __room('Neutral'); loadScene(__scene('Volcano')); }), 150],

  // The cold end, which the same number has to reach if it is to drive anything.
  ['nitrogen · splash', async p => p.evaluate(() => { __room('Neutral'); __wipe(); const f = __floor();
                          for (let y=f-18; y<f; y++) for (let x=(W*0.35)|0; x<(W*0.55)|0; x++) put(x,y,NITRO); }), 60],
  ['ice · packed',      async p => p.evaluate(() => { __room('Neutral'); __wipe(); const f = __floor();
                          for (let y=0; y<f; y++) for (let x=0; x<W; x++) put(x,y,ICE); }), 120],
];

const browser = await chromium.launch();
const rows = [];

for (const [name, build, secs] of scenarios) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.route(u => /^https?:/.test(u.href), r => r.abort());
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof W !== 'undefined' && W > 40);
  await page.evaluate(HARNESS);
  await build(page);

  const series = await page.evaluate(n => {
    const out = [];
    out.push(__signals());
    for (let s = 0; s < n; s++){ __step(60); out.push(__signals()); }
    return out;
  }, secs);

  const cost = await page.evaluate(() => {
    const t0 = performance.now();
    for (let k = 0; k < 200; k++) __signals();
    return (performance.now() - t0) / 200;
  });

  const peakOf = k => series.reduce((a, s) => Math.max(a, s[k]), -1e9);
  const meanOf = k => series.reduce((a, s) => a + s[k], 0) / series.length;

  rows.push({ name, secs, cost,
    mixPeak: peakOf('mix'), mixMean: meanOf('mix'),
    abovePeak: peakOf('above'), aboveMin: series.reduce((a,s)=>Math.min(a,s.above), 1e9),
    alightPeak: peakOf('alight'), alightMean: meanOf('alight'),
    firePeak: peakOf('fire'),
    peakT: peakOf('peak'), ambEnd: series[series.length-1].amb,
    ambPeak: peakOf('amb'), ambMin: series.reduce((a,x)=>Math.min(a,x.amb), 1e9),
    series });
  await page.close();
}
await browser.close();

const f = (n, d=1) => (Math.round(n * 10**d) / 10**d).toFixed(d);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

console.log('\nEach scenario run for the seconds shown, sampled once a second.\n');
console.log(pad('scenario', 20) + rpad('secs', 5) + rpad('alight peak', 13)
          + rpad('ROOM hottest', 14) + rpad('ROOM coldest', 14) + rpad('room end', 10));
console.log('-'.repeat(76));
for (const r of rows)
  console.log(pad(r.name, 20) + rpad(r.secs, 5) + rpad(r.alightPeak, 13)
            + rpad(f(r.ambPeak), 14) + rpad(f(r.ambMin), 14) + rpad(f(r.ambEnd), 10));

/* Scaled by the largest *magnitude* in the series, not by its maximum.
   The first version of this used `Math.max(1, peak)`, and every cold scenario has a
   peak at or below zero — so the divisor fell back to 1 and a run that never left
   −33°C rendered as a solid saturated bar. Three of the ten rows were unreadable and
   the two that mattered most for the cold end were among them. The table beside them
   was right the whole time, which is what made it easy to miss. */
const spark = (series, key, signed, floor) => {
  const step = Math.max(1, Math.floor(series.length / 44));
  const bars = ' .:-=+*#%@';
  /* And the scale needs a floor as well as a maximum, which is the same bug twice.
     An empty box's `above` is float noise around zero — mix − AMBIENT comes out at
     −1.4e-14 rather than 0 — and a scale derived only from the row's own contents
     divides that noise by itself and renders it at full amplitude. Three flat rows
     drew as solid bars. A signal below the floor is not a small signal, it is no
     signal, and it should look like one. */
  const hi = Math.max(series.reduce((a, s) => Math.max(a, Math.abs(s[key])), 0), floor);
  return series.filter((_, i) => i % step === 0).map(s => {
    const c = bars[Math.max(0, Math.min(9, Math.round(Math.abs(s[key]) / hi * 9)))];
    // Cold reads in lower case, so a sign change is visible rather than implied.
    return signed && s[key] < 0 ? c.replace('@','w').replace('%','v').replace('#','u')
                                   .replace('*','o').replace('+','c').replace('=','~') : c;
  }).join('');
};

console.log('\nShape over time — the ROOM reading, which is the number on the gauge:\n');
for (const r of rows)
  console.log(pad(r.name, 20) + '|' + spark(r.series, 'amb', true, 2) + '|  '
            + f(r.ambMin) + ' to ' + f(r.ambPeak));

console.log('\nShape over time — `above` (mixing temperature less the room).');
console.log('Scaled per row to its own largest swing. Cold samples use the second glyph set.\n');
for (const r of rows)
  console.log(pad(r.name, 20) + '|' + spark(r.series, 'above', true, 2) + '|  '
            + f(r.abovePeak) + ' hottest, ' + f(r.aboveMin) + ' coldest');

console.log('\nShape over time — `alight` (cells actually burning):\n');
for (const r of rows)
  console.log(pad(r.name, 20) + '|' + spark(r.series, 'alight', false, 3) + '|  peak ' + r.alightPeak);

/* The one that decides whether `above` can carry a score on its own. On Neutral the
   room chases the box, so a signal defined as "how far the box is from the room" is
   being actively cancelled by the thing it is measured against. */
console.log('\nThe box against the room it is drifting toward, on Neutral:\n');
for (const r of rows) {
  if (r.name !== 'ice · packed') continue;
  console.log(pad('  seconds', 12) + rpad('mix', 9) + rpad('room', 9) + rpad('above', 9));
  r.series.forEach((s, i) => { if (i % 15) return;
    console.log(pad('  ' + i + 's', 12) + rpad(f(s.mix), 9) + rpad(f(s.amb), 9) + rpad(f(s.above), 9)); });
}

console.log('\nCost of reading all four in one pass, per call:');
for (const r of rows) console.log('  ' + pad(r.name, 20) + f(r.cost, 3) + 'ms');
console.log('');
