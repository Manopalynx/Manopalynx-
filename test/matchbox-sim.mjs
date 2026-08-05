// Simulation harness for matchbox.html
//
// The interesting claims this file makes are all about heat: that a fuse runs, that a
// candle burns, that water puts a fire out, that stone does not. None of those are
// visible by reading the source — the material table reads perfectly well in every
// case that was measured broken. So each check below builds a scene in the real page,
// steps the simulation a fixed number of ticks, and counts cells.
//
// Two kinds of check, and both matter:
//
//   CAN     — a thing the box is supposed to be able to do. Every one of these was
//             measured failing before the heat model was reworked: a fuse laid on the
//             floor never travelled, a candle went out, green could not be lit at all,
//             burning oil could not light the log it was touching (96°C against an
//             ignition point of 300).
//   CANNOT  — a thing it must never do. Stone does not burn, a scene does not detonate
//             on its own, temperatures do not run away or go NaN. Without these, every
//             CAN check can be satisfied by making everything catch fire instantly.
//
// The energy check is the one that guards the rewrite itself: with combustion out of
// the picture, diffusion must not invent or destroy heat. The model this replaced did
// both — it gave heat away at a rate set by the giver and took it at a rate set by the
// taker, so every boundary between two materials was a small energy leak.
//
// Run:  npm i playwright  &&  node test/matchbox-sim.mjs
// Chromium only, and it needs no server — the page is loaded over file://.

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const PAGE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '..', 'matchbox.html');

// Pinned, not inherited. The grid is derived from the element's pixel size, so the
// viewport decides how many cells a scene has to cross and every distance below is
// quoted in cells. A suite that picked its width up from the runner default would be
// measuring a different board.
const VIEWPORT = { width: 430, height: 900 };   // a large phone, held upright

// Helpers injected into the page. `step` runs the simulation without drawing, so a
// thousand ticks costs milliseconds; `flame` is exactly what paintAt does with the
// match selected, so "held the match here" in a check means what it means in the hand.
const HARNESS = `
  window.__step  = n => { for (let k=0;k<n;k++){ moveFalling(); moveRising(); diffuse(); react(); } };
  window.__count = t => { let n=0; for (let i=0;i<type.length;i++) if (type[i]===t) n++; return n; };
  window.__hot   = (t,T) => { let n=0; for (let i=0;i<type.length;i++) if (type[i]===t && temp[i]>=T) n++; return n; };
  window.__maxT  = () => { let m=-1e9; for (let i=0;i<temp.length;i++) if (temp[i]>m) m=temp[i]; return m; };
  window.__nan   = () => { for (let i=0;i<temp.length;i++) if (!Number.isFinite(temp[i])) return true; return false; };
  window.__wipe  = () => { type.fill(0); temp.fill(AMBIENT); fuel.fill(0); life.fill(0); };
  window.__floor = () => { const f = H-6; for (let x=0;x<W;x++) for (let y=f;y<H;y++) put(x,y,STONE); return f; };
  window.__slab  = (x0,y0,x1,y1,t) => { for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++) put(x,y,t); };
  // Deliberately the page's own paintAt rather than a copy of it. A harness that
  // reimplements the thing it is testing will agree with itself long after it has
  // stopped agreeing with the page.
  window.__flame = (x,y,r) => {
    const t0 = tool, b0 = brush, m0 = matchLit;
    tool = 'match'; brush = r; matchLit = 99;   // a lit match, since paintAt checks
    paintAt(x,y);
    tool = t0; brush = b0; matchLit = m0;
  };
  // Hold the match at a spot for n ticks, then let the scene get on with it.
  window.__hold = (x,y,r,ticks) => { for (let k=0;k<ticks;k++){ __flame(x,y,r); __step(1); } };
  window.__energy = () => { let e=0; for (let i=0;i<temp.length;i++){ const m=M[type[i]];
    e += temp[i] * (m.cap !== undefined ? m.cap : AIR_CAP); } return e; };
`;

let passed = 0, failed = 0;
const only = process.argv[2];   // optional substring filter, for working on one check

async function check(browser, name, body) {
  if (only && !name.includes(only)) return;
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.setDefaultTimeout(20000);
  const problems = [];
  page.on('pageerror', e => problems.push('uncaught: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  // The webfont is the only remote request. Blocking the network keeps the suite
  // honest offline and stops the load event waiting on a font.
  await page.route(u => /^https?:/.test(u.href), r => r.abort());

  // Freeze the animation loop before the page ever boots, rather than adding a pause
  // flag to the file for the tests' benefit. Every check steps the simulation itself,
  // so a scene must not advance by an unknown number of frames while Playwright is
  // talking to the page over the wire.
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });

  const fails = [];
  try {
    await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof W !== 'undefined' && W > 40);
    await page.evaluate(HARNESS);
    const out = await page.evaluate(body);
    if (out) fails.push(out);
    if (await page.evaluate(() => __nan())) fails.push('a temperature went NaN');
    if (problems.length) fails.unshift(problems[0]);
  } catch (err) {
    fails.push('harness error: ' + String(err.message).split('\n')[0]);
  }
  if (fails.length) { failed++; console.log(`FAIL  ${name}`); fails.forEach(f => console.log(`        · ${f}`)); }
  else { passed++; console.log(` ok   ${name}`); }
  await page.close();
}

const browser = await chromium.launch();

/* ------------------------------------------------------------------ CAN
   Each of these is a thing somebody would sit down and build. Every one was
   measured failing on the model this replaced; the numbers in the comments are
   what it did then. */

console.log('\n— things the box has to be able to do —');

// Was: fuse burns 6 cells, stops, and the charge is untouched 27 seconds later.
await check(browser, 'a fuse laid on the floor carries fire to a powder charge', () => {
  __wipe(); const f = __floor();
  __slab(70, f-8, 84, f-1, POWDER);
  for (let x=25;x<70;x++) put(x, f-1, FUSE);
  const charge = __count(POWDER);
  __hold(26, f-1, 2, 90);
  let firedAt = -1;
  for (let k=0;k<4000;k++){ __step(1); if (firedAt<0 && __count(POWDER) < charge*0.9) { firedAt = k; break; } }
  if (firedAt < 0) return `the charge never went off: ${__count(POWDER)}/${charge} powder left, fuse ${__count(FUSE)} cells`;
  if (firedAt < 200) return `the charge went off after ${firedAt} ticks — that is not a fuse, that is a wire`;
  return null;
});

// Was: wick alight for 115 frames after the match left, then out, 128/158 wax untouched.
await check(browser, 'a candle stays lit and eats its own wax', () => {
  __wipe(); const f = __floor();
  __slab(48, f-20, 55, f-1, WAX);
  for (let y=f-26; y<f-18; y++) put(52, y, FUSE);
  const wax0 = __count(WAX);
  __hold(52, f-25, 2, 120);
  let alight = 0;
  for (let k=0;k<3000;k++){ __step(1); if (__count(FIRE) > 0) alight++; }
  if (alight < 1500) return `the flame survived ${alight} of 3000 ticks after the match left`;
  const melted = wax0 - __count(WAX);
  if (melted < 20) return `it burned but consumed almost no wax (${melted} of ${wax0} cells)`;
  return null;
});

// Was: the wood it was touching peaked at 96°C against an ignition point of 300.
await check(browser, 'burning oil lights the wood it is running into', () => {
  __wipe(); const f = __floor();
  for (let x=20;x<60;x++) put(x, f-1, OIL);
  __slab(60, f-8, 74, f-1, WOOD);
  const wood0 = __count(WOOD);
  __hold(22, f-1, 2, 60);
  for (let k=0;k<2500;k++) __step(1);
  const burnt = wood0 - __count(WOOD);
  if (burnt < 8) return `the oil burned out and left the pile alone: ${burnt} of ${wood0} wood cells consumed`;
  return null;
});

// Was: 300 cells, 120 ticks of held flame, 0 consumed, 0 fire, ever.
await check(browser, 'green wood can be burned, but only with help', () => {
  const run = ticks => {
    __wipe(); const f = __floor();
    __slab(20, f-6, 69, f-1, GREEN);
    const n0 = __count(GREEN);
    __hold(24, f-3, 3, ticks);
    for (let k=0;k<2000;k++) __step(1);
    return n0 - __count(GREEN);
  };
  const brief = run(60), sustained = run(600);
  if (sustained < 6) return `held for 600 ticks and green still would not burn (${sustained} cells consumed)`;
  if (brief >= sustained) return `a 60-tick touch did as well as a 600-tick one (${brief} vs ${sustained}) — green is not the hard case it is meant to be`;
  return null;
});

// The opening scene is the only thing every single person who opens the file sees,
// and the obvious thing to do with it is put the match to the end of the oil. It used
// to be three unrelated piles with the oil stopping six cells short of the wood, under
// a comment describing it as a puddle running toward the stack.
await check(browser, 'the opening scene works: light the oil and the stack catches', () => {
  __wipe(); seed();
  const f = H-3;
  const wood0 = __count(WOOD);
  __hold((W*0.84)|0, f-1, 2, 90);            // the far end of the trail
  for (let k=0;k<2500;k++) __step(1);
  const burnt = wood0 - __count(WOOD);
  if (burnt < 10) return `the fire ran along the oil and stopped: ${burnt} of ${wood0} wood cells consumed`;
  return null;
});

console.log('\n— water —');

// Was: the water arrived at 539-652°C, flashed to steam, and burning cells went 45 -> 51.
//
// Against a control, because the obvious version of this check passes for the wrong
// reason. Left alone, a burning pile ends up with nothing burning on it either — it
// has been consumed. "The fire went out" and "the fire finished" look identical in a
// cell count taken at one moment, so the question has to be how much wood is left
// standing, measured against the same scene with no water thrown at it.
// Against a control, and measured on two things at two moments, because the obvious
// version of this check passes for the wrong reason. Left alone, a burning pile also
// ends up with nothing alight on it — it has been consumed. "The fire went out" and
// "the fire finished" are the same cell count at one instant, so the questions have
// to be asked separately: are the flames out now, and is there more wood left later.
await check(browser, 'water thrown on a fire puts the flames out and buys the wood time', () => {
  const run = (douse) => {
    __wipe(); const f = __floor();
    __slab(12, f-5, 28, f-1, WOOD);
    __hold(20, f-2, 3, 200);
    if (douse){
      for (let dy=-5;dy<=5;dy++) for (let dx=-5;dx<=5;dx++){
        if (dx*dx+dy*dy > 25) continue;
        const x=20+dx, y=f-8+dy; if (!inb(x,y)) continue;
        const i = idx(x,y);
        if (type[i]===E || M[type[i]].ph===0) put(x, y, WATER);
      }
    }
    for (let k=0;k<150;k++) __step(1);
    const flames = __count(FIRE);
    for (let k=0;k<450;k++) __step(1);
    return { flames, wood: __count(WOOD) };
  };
  const dry = run(false), wet = run(true);
  if (dry.flames < 20) return `the control was barely alight (${dry.flames} flames), so there is nothing to compare against`;
  if (wet.flames > dry.flames * 0.3) return `flames right after the splash: ${wet.flames} against ${dry.flames} left alone`;
  if (wet.wood < dry.wood * 2.5) return `wood still standing ten seconds later: ${wet.wood} after a dousing against ${dry.wood} left alone`;
  return null;
});

// Was: 600 ticks of rain over a fire and burning cells went 45 -> 81.
await check(browser, 'rain drowns a fire it falls on', () => {
  __wipe(); const f = __floor();
  __slab(10, f-5, 59, f-1, WOOD);
  __hold(20, f-2, 3, 200);
  const before = __hot(WOOD, M[WOOD].ig);
  // RAIN_TICKS, not a number picked here: this has to be the shower the button
  // actually delivers, or the check is about a downpour nobody can summon.
  let raining = RAIN_TICKS;
  for (let k=0;k<1400;k++){
    if (raining-- > 0) for (let j=0;j<Math.ceil(W/22);j++){
      const x = (Math.random()*W)|0; if (type[idx(x,0)]===E) put(x, 0, WATER);
    }
    __step(1);
  }
  const after = __hot(WOOD, M[WOOD].ig);
  if (after >= before) return `burning cells ${before} -> ${after} through 400 ticks of rain`;
  return null;
});

// Was: 600 ice cells placed, 0 left one tick later, and the cell temperature read 20°C.
await check(browser, 'ice arrives cold and takes time to melt', () => {
  __wipe();
  // A ten-by-ten block. Only the outside of a block can melt — the middle is
  // surrounded by ice — so a big slab would be asserting about its own
  // surface-to-volume ratio rather than about the model.
  __slab(20, 20, 29, 29, ICE);
  const n0 = __count(ICE);
  const t0 = temp[idx(24,24)];
  if (t0 > 0) return `ice was placed at ${Math.round(t0)}°C — it melts at ${M[ICE].melt}°C, so it is water before you lift your finger`;
  __step(1);
  if (__count(ICE) < n0 * 0.95) return `${n0 - __count(ICE)} of ${n0} cells melted in a single tick`;
  for (let k=0;k<600;k++) __step(1);
  if (__count(ICE) < n0 * 0.9) return `${n0 - __count(ICE)} of ${n0} cells were gone within ten seconds`;
  // It does have to melt in the end, though. A block of ice that lasts forever is
  // the same defect as one that lasts a single tick, just harder to notice.
  for (let k=0;k<5000;k++) __step(1);
  const left = __count(ICE);
  if (left === n0) return 'ice left in a warm room never melted at all';
  if (left > n0 * 0.9) return `after 90 seconds only ${n0 - left} of ${n0} cells had melted`;
  return null;
});

await check(browser, 'ice chills what it is packed against', () => {
  __wipe(); const f = __floor();
  __slab(20, f-9, 49, f-1, WOOD);
  __hold(30, f-4, 3, 250);
  const alight = __hot(WOOD, M[WOOD].ig);
  if (alight < 6) return `scene not alight (${alight})`;
  __slab(20, f-14, 49, f-10, ICE);
  for (let k=0;k<600;k++) __step(1);
  const after = __hot(WOOD, M[WOOD].ig);
  if (after >= alight) return `burning cells ${alight} -> ${after} with a block of ice sitting on the fire`;
  return null;
});

console.log('\n— the match —');

await check(browser, 'a held match lights wood; a dab is a gamble', () => {
  const trials = (ticks) => {
    let caught = 0;
    for (let t=0;t<8;t++){
      __wipe(); const f = __floor();
      __slab(30, f-8, 69, f-1, WOOD);
      __hold(40, f-4, 2, ticks);
      for (let k=0;k<900;k++) __step(1);
      if (__count(FIRE) > 0 || __hot(WOOD, M[WOOD].ig) > 0) caught++;
    }
    return caught;
  };
  const held = trials(240);
  if (held < 7) return `holding the match on a wood pile for 4 seconds lit it ${held}/8 times`;
  // A dab must be able to fail. It must also be able to work — 0/8 is the defect this
  // check was written for, and 8/8 would mean nothing can ever fail to catch.
  const dab = trials(20);
  if (dab === 0) return 'a quick dab of the match never lit wood in 8 attempts — you cannot fail to catch, you can only fail to try';
  return null;
});

/* --------------------------------------------------------------- CANNOT
   Without these, everything above can be passed by setting fire to the world. */

console.log('\n— things it must never do —');

await check(browser, 'stone, steel and sand do not burn', () => {
  for (const t of [STONE, STEEL, SAND]) {
    __wipe(); const f = __floor();
    __slab(20, f-8, 69, f-1, t);
    const n0 = __count(t);
    __hold(40, f-4, 3, 600);
    for (let k=0;k<600;k++) __step(1);
    if (__count(t) !== n0) return `${M[t].n}: ${n0 - __count(t)} of ${n0} cells were consumed by fire`;
  }
  return null;
});

await check(browser, 'a lit scene does not run away', () => {
  __wipe(); const f = __floor();
  __slab(10, f-10, 99, f-1, WOOD);
  const n0 = __count(WOOD);
  __hold(15, f-5, 2, 120);
  for (let k=0;k<600;k++) __step(1);
  const gone = n0 - __count(WOOD);
  // 600 ticks is ten seconds. A whole pile in ten seconds is a petrol fire, not wood.
  if (gone > n0 * 0.55) return `${gone} of ${n0} wood cells gone in 600 ticks — the fire is a fuse`;
  if (__maxT() > 1400) return `peak temperature ${Math.round(__maxT())}°C — hotter than the model's own ceiling`;
  return null;
});

await check(browser, 'nothing ignites without a source', () => {
  __wipe(); const f = __floor();
  __slab(20, f-6, 40, f-1, POWDER);
  __slab(45, f-6, 60, f-1, OIL);
  __slab(65, f-6, 80, f-1, PAPER);
  const before = [__count(POWDER), __count(OIL), __count(PAPER)];
  for (let k=0;k<1200;k++) __step(1);
  const after = [__count(POWDER), __count(OIL), __count(PAPER)];
  if (after[0] !== before[0] || after[2] !== before[2]) return `left alone, the scene lit itself: powder ${before[0]}->${after[0]}, paper ${before[2]}->${after[2]}`;
  return null;
});

await check(browser, 'an empty box sits at room temperature', () => {
  __wipe();
  for (let k=0;k<600;k++) __step(1);
  const m = __maxT();
  if (Math.abs(m - AMBIENT) > 1) return `an empty box drifted to ${m.toFixed(2)}°C from an ambient of ${AMBIENT}`;
  return null;
});

// The guard on the rewrite itself. Heat moved between two materials must leave one
// cell exactly as it enters the other; the model this replaced scaled the give and the
// take by different numbers, so every material boundary quietly leaked.
await check(browser, 'diffusion moves heat without inventing or destroying it', () => {
  __wipe();
  const f = __floor();
  __slab(10, f-20, 39, f-1, WOOD);
  __slab(40, f-20, 59, f-1, STEEL);
  __slab(60, f-20, 89, f-1, WATER);
  __slab(10, f-30, 89, f-21, STONE);
  for (let i=0;i<temp.length;i++) temp[i] = AMBIENT + (i % 37) * 12;   // a lumpy field
  const before = __energy();
  // conduct(), not diffuse(): convection and room loss are deliberately not
  // conservative — one moves heat upward against the gradient and the other is the
  // box giving heat back to the room. Conduction is the part that has to balance.
  for (let k=0;k<300;k++) conduct();
  const after = __energy();
  const drift = Math.abs(after - before) / before;
  if (drift > 0.02) return `total heat moved ${(drift*100).toFixed(1)}% in 300 ticks of diffusion with no fire and no room loss`;
  return null;
});

await check(browser, 'heat flows from hot to cold, never the other way', () => {
  __wipe();
  __slab(10, 20, 49, 60, STEEL);
  for (let i=0;i<temp.length;i++) temp[i] = AMBIENT;
  const hi = idx(20, 40), lo = idx(40, 40);
  temp[hi] = 900;
  const loStart = temp[lo];
  for (let k=0;k<200;k++) diffuse();
  if (temp[lo] <= loStart) return 'the cold end of a steel bar never warmed';
  if (temp[hi] < temp[lo]) return `the hot end (${Math.round(temp[hi])}°C) ended up colder than the far end (${Math.round(temp[lo])}°C)`;
  return null;
});

console.log('\n— every material in the tray —');

// The sweep. Instance-proofing: if a future change makes any listed fuel unlightable,
// or any listed inert material combustible, this fails by name rather than by feel.
await check(browser, 'every fuel in the tray can be lit, every inert one cannot', () => {
  const fuels  = [WOOD, PAPER, STRAW, OIL, POWDER, FUSE, COAL, GREEN, EMBER];
  const inerts = [STONE, STEEL, SAND, ASH];
  const bad = [];
  for (const t of fuels.concat(inerts)) {
    __wipe(); const f = __floor();
    __slab(20, f-8, 69, f-1, t);
    const n0 = __count(t);
    __hold(40, f-4, 3, 600);
    for (let k=0;k<1200;k++) __step(1);
    const gone = n0 - __count(t);
    const isFuel = fuels.includes(t);
    if (isFuel && gone < 4)  bad.push(`${M[t].n} could not be lit at all`);
    if (!isFuel && gone > 0) bad.push(`${M[t].n} burned (${gone} cells)`);
  }
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— it has to stay playable —');

await check(browser, 'a busy scene costs less than a frame', () => {
  __wipe(); seed();
  const f = H-3;
  __hold((W*0.45)|0, f-5, 3, 200);
  for (let k=0;k<200;k++) __step(1);
  const t0 = performance.now();
  for (let k=0;k<120;k++){ moveFalling(); moveRising(); diffuse(); react(); draw(); }
  const ms = (performance.now() - t0) / 120;
  // 16.7ms is one frame at 60Hz on this machine; a phone is several times slower, so
  // the budget here is a quarter of it.
  if (ms > 4) return `${ms.toFixed(2)}ms per frame on ${W}x${H} = ${W*H} cells`;
  return null;
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
