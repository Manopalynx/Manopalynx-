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
  // The page's own definition of a tick, not a copy of it. A harness that spells the
  // passes out agrees with itself long after it has stopped agreeing with the page —
  // add a fifth pass and every check here quietly measures a world without it.
  window.__step  = n => { for (let k=0;k<n;k++) simTick(); };
  window.__count = t => { let n=0; for (let i=0;i<type.length;i++) if (type[i]===t) n++; return n; };
  window.__hot   = (t,T) => { let n=0; for (let i=0;i<type.length;i++) if (type[i]===t && temp[i]>=T) n++; return n; };
  // Actually alight, which is not the same as being over the ignition point: a cell
  // has to char for a while first. Counting "hot enough" as "burning" made the ice
  // and water checks report on cells that were being warmed, not cells on fire.
  window.__alight = t => { const m = M[t], c = m.char !== undefined ? m.char : CHAR;
    let n=0; for (let i=0;i<type.length;i++)
      if (type[i]===t && fuel[i]>0 && temp[i]>=m.ig && life[i]>=c) n++;
    return n; };
  window.__maxT  = () => { let m=-1e9; for (let i=0;i<temp.length;i++) if (temp[i]>m) m=temp[i]; return m; };
  window.__nan   = () => { for (let i=0;i<temp.length;i++) if (!Number.isFinite(temp[i])) return true; return false; };
  window.__wipe  = () => { type.fill(0); temp.fill(AMBIENT); fuel.fill(0); life.fill(0); vel.fill(0); };
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
  // Measured up to the moment the flame goes out, not at some tick long afterwards.
  // The wick goes on smouldering once the candle is over, so a count taken at the end
  // of a fixed run reports on the remains rather than on the candle.
  // A flame flickers: FIRE cells are transient and spawned on a dice roll, so a
  // single tick with none of them is a gap and not the end of the candle. Breaking
  // on the first gap reported anywhere between 327 and 1200 ticks for the same
  // scene — the variance was in the measurement, not the candle.
  let alight = 0, dark = 0, wickAtEnd = __count(FUSE);
  for (let k=0;k<3000;k++){
    __step(1);
    if (__count(FIRE) > 0){ alight++; dark = 0; wickAtEnd = __count(FUSE); }
    else if (++dark > 90) break;
  }

  // 800. It measures 1106-1204 and ends when the wick is finally spent, having eaten
  // about fifty cells of wax.
  //
  // It used to be ~1800, and that figure was inflated: the candle was living on heat
  // from flames that were only that hot because convection was leaking upward without
  // limit — the same bug that put a lava scene at 3774°C against a 1650°C ceiling.
  // Bounding it cost the candle a third of its life, honestly.
  if (alight < 800) return `the flame survived ${alight} of 3000 ticks after the match left`;

  const melted = wax0 - __count(WAX);
  if (melted < 20) return `it burned but consumed almost no wax (${melted} of ${wax0} cells)`;
  // The wax consumption is what proves it is drawing. Eight cells of wick hold 1200
  // ticks of fuel between them and several burn at once, so a string on its own is
  // good for a few hundred ticks and no wax at all. Asserting the wick is still
  // whole was the wrong test — a real wick is consumed slowly too, which is why you
  // trim them.
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
  if (wet.flames > dry.flames * 0.15) return `flames right after the splash: ${wet.flames} against ${dry.flames} left alone`;
  // Measures 35 against 24. Not a rout, and it should not be: the water sits on top
  // of the pile and the rows underneath it are not touching any.
  if (wet.wood < dry.wood * 1.25) return `wood still standing ten seconds later: ${wet.wood} after a dousing against ${dry.wood} left alone`;
  return null;
});

// Was: 600 ticks of rain over a fire and burning cells went 45 -> 81.
await check(browser, 'rain drowns a fire it falls on', () => {
  __wipe(); const f = __floor();
  __slab(10, f-5, 59, f-1, WOOD);
  __hold(20, f-2, 3, 200);
  const before = __alight(WOOD);
  // RAIN_TICKS, not a number picked here: this has to be the shower the button
  // actually delivers, or the check is about a downpour nobody can summon.
  let raining = RAIN_TICKS;
  for (let k=0;k<1400;k++){
    if (raining-- > 0) for (let j=0;j<Math.ceil(W/22);j++){
      const x = (Math.random()*W)|0; if (type[idx(x,0)]===E) put(x, 0, WATER);
    }
    __step(1);
  }
  const after = __alight(WOOD);
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

// Against a control, and counting wood rather than flames. A lid of ice leaves more
// of the pile standing, which means more of what is left is alight — so the count of
// burning cells goes UP while the fire is losing, and reading that number alone says
// the ice fed the fire. It is the same trap as the water check.
await check(browser, 'a lid of ice slows a fire under it', () => {
  const run = (lid) => {
    __wipe(); const f = __floor();
    __slab(20, f-9, 49, f-1, WOOD);
    __hold(30, f-4, 3, 250);
    if (lid) __slab(20, f-14, 49, f-10, ICE);
    for (let k=0;k<800;k++) __step(1);
    return { wood: __count(WOOD), melted: __count(WATER) };
  };
  const bare = run(false), iced = run(true);
  if (bare.wood > 100) return `the control barely burned (${bare.wood} cells left), so there is nothing to compare against`;
  if (iced.wood < bare.wood * 1.12) return `${iced.wood} wood cells left under a lid of ice against ${bare.wood} with none`;
  if (iced.melted < 4) return `only ${iced.melted} cells of the ice melted over a fire — it is not paying for the cooling it is doing`;
  return null;
});

console.log('\n— the match —');

// The match is hotter than every ignition point in the table, so on temperature alone
// it lights everything the instant it touches it and the tray is fourteen names for
// one material. What separates them is how long they have to be held over the line
// before they catch — see "catching" in react(). This asserts the two ends of that:
// straw goes up from a touch, green wants the match held on it.
await check(browser, 'the tray has an ignition gradient, not a switch', () => {
  const consumed = (mat, ticks) => {
    __wipe(); const f = __floor();
    __slab(30, f-8, 69, f-1, mat);
    const n0 = __count(mat);
    __hold(40, f-4, 2, ticks);
    for (let k=0;k<1500;k++) __step(1);
    return n0 - __count(mat);
  };
  const strawDab = consumed(STRAW, 20);
  if (strawDab < 8) return `a touch of the match on straw consumed ${strawDab} cells — straw is meant to be the easy one`;

  // Green chars under the match either way — a patch the size of the brush is not a
  // fire. What has to differ is whether it goes anywhere afterwards.
  const greenDab = consumed(GREEN, 20);
  const greenHeld = consumed(GREEN, 600);
  if (greenHeld < 40) return `green would not take even with the match held on it for ten seconds (${greenHeld} cells)`;
  if (greenDab * 3 > greenHeld) return `a touch took ${greenDab} cells of green against ${greenHeld} for a long hold — nothing in the tray is any harder to light than anything else`;
  return null;
});

console.log('\n— things that are only made, never placed —');

// Stone, steel, sand and ash could not become anything at all before this: no fuel,
// no melting point, nothing. The entire top of the temperature range had nothing to
// do with itself. These are the checks that it now does.

await check(browser, 'lava left alone crusts over into stone', () => {
  __wipe(); const f = __floor();
  __slab(30, f-6, 59, f-1, LAVA);
  const n0 = __count(LAVA);
  if (n0 < 100) return `only ${n0} cells of lava were placed`;
  if (temp[idx(45,f-3)] < 900) return `lava was placed at ${Math.round(temp[idx(45,f-3)])}°C — it is meant to arrive molten`;
  for (let k=0;k<4000;k++) __step(1);
  const stone = __count(STONE), lava = __count(LAVA);
  if (stone < n0 * 0.5) return `${n0} cells of lava left ${stone} of stone and ${lava} still molten`;
  return null;
});

await check(browser, 'lava quenched in water makes obsidian', () => {
  __wipe(); const f = __floor();
  __slab(20, f-1, 79, f-1, STONE);
  __slab(30, f-10, 59, f-5, WATER);
  __slab(30, f-20, 59, f-16, LAVA);
  for (let k=0;k<1200;k++) __step(1);
  const ob = __count(OBSIDIAN);
  if (ob < 10) return `lava met water and made ${ob} cells of obsidian`;
  if (__count(STEAM) + __count(WATER) === 0) return 'the water vanished without a trace of steam';
  return null;
});

// Sand dropped into a pool of lava, which is the thing anybody would actually try.
// The first version of this check laid a thin sheet of lava over sand on a cold stone
// floor and got one cell of glass — and I spent three rounds tuning melting points
// and densities against it before measuring that the scene was the problem, not the
// model. A shallow pour on a cold floor has its heat drunk by the floor. Sand into a
// pool works every time, and always did.
await check(browser, 'sand melts into glass', () => {
  __wipe();
  const f = H-4;
  __slab(0, f, W-1, H-1, STONE);
  for (let d=0; d<3; d++) __slab(24+d, f-30, 24+d, f-1, STONE), __slab(76+d, f-30, 76+d, f-1, STONE);
  __slab(27, f-22, 75, f-1, LAVA);       // a deep pool
  __slab(40, f-26, 59, f-26, SAND);      // sprinkled in from above
  for (let k=0;k<2500;k++) __step(1);
  const glass = __count(GLASS);
  if (glass < 5) return `${glass} cells of glass — lava at 1180°C could not take sand past its melting point of ${M[SAND].melt}`;

  // ...and the other end of that figure: the match is at 780°C, and a dab of it on a
  // beach must not produce glass.
  __wipe(); const f2 = __floor();
  __slab(20, f2-6, 79, f2-1, SAND);
  __hold(50, f2-3, 3, 240);
  for (let k=0;k<600;k++) __step(1);
  if (__count(GLASS) > 0) return `${__count(GLASS)} cells of glass from holding a match on sand — the melting point is under what the match hands out`;
  return null;
});

await check(browser, 'molten steel sets back into steel', () => {
  __wipe(); const f = __floor();
  __slab(20, f-1, 79, f-1, STONE);
  __slab(40, f-8, 59, f-2, MOLTEN);
  const n0 = __count(MOLTEN);
  for (let k=0;k<5000;k++) __step(1);
  const steel = __count(STEEL);
  if (steel < n0 * 0.5) return `${n0} cells of molten steel left ${steel} of steel and ${__count(MOLTEN)} still liquid`;
  return null;
});

// ...but not before it has had a chance to be liquid, which is the half the check above
// cannot see. It waits 5000 ticks and asks what is left, so molten steel that set in a
// fifth of a second passed it for as long as the material has existed.
//
// Measured on the figures this replaces: one cell in open air fell 1500→1268 in five
// ticks and had set by tick nine. A pool of 150 was half set by tick thirteen. Lava,
// after its own fix, takes 1274 — molten steel was the faster of the two by a hundred
// times, and it is the one that is supposed to run somewhere.
//
// A single cell is the measurement rather than the pool, because a pool also spreads,
// and a spreading pool changes how much of it touches cold floor. One cell in still air
// is the same scene every run.
await check(browser, 'molten steel stays liquid long enough to run somewhere', () => {
  __wipe();
  put(64, 60, MOLTEN);
  let gone = -1;
  for (let k=1;k<=600;k++){
    __step(1);
    if (__count(MOLTEN) === 0){ gone = k; break; }
  }
  if (gone < 0) return null;                 // still liquid after ten seconds is not this defect
  if (gone < 40) return `a molten steel cell in open air set after ${gone} ticks (${(gone/60).toFixed(2)}s) — that is hot gravel, not a pour`;

  // And a pool, which is what a cut actually produces. Not the same claim: a cell can
  // last while a pool still flash-freezes against the floor it lands on.
  __wipe(); const f = __floor();
  __slab(50, f-5, 79, f-1, MOLTEN);
  const n0 = __count(MOLTEN);
  let half = -1;
  for (let k=1;k<=600;k++){
    __step(1);
    if (half < 0 && __count(MOLTEN) <= n0*0.5){ half = k; break; }
  }
  // 120, and the threshold is worth a word because the first attempt at it was 60 and
  // the measurement was 54-58 — a check placed exactly on top of the number it was
  // measuring, which failed on two runs out of three and told me nothing when it did.
  // The figures either side are 13 ticks before the fix and ~185 after, so anything
  // from about 40 to 150 separates them; 120 sits in the middle of that with room on
  // both sides rather than balancing on the current value.
  if (half >= 0 && half < 120) return `half a ${n0}-cell pool of molten steel was solid after ${half} ticks (${(half/60).toFixed(2)}s)`;
  return null;
});

// The rule this protects is the one that makes a cut a cut: a hot liquid sinks into a
// solid it can melt, and only while it is hotter than that solid's melting point plus
// MELT_THRU. Molten steel used to be born at 1500 against a threshold of 1460, so it
// had forty degrees of headroom while shedding forty-six a tick. Counted directly: at
// tick 0, 150 of 150 cells could melt steel; by tick 10, none could. The melt-through
// branch was live code that never once ran, and every test of it passed anyway.
//
// Deliberately not generalised over the table. Lava is born at 1180 and stone melts at
// 1250, so lava cannot melt through stone and is not meant to — the same claim written
// for every liquid would fail on the one pair where the answer is correctly no.
await check(browser, 'molten steel is born hot enough to actually melt steel', () => {
  const need = M[STEEL].melt + MELT_THRU;
  const have = M[MOLTEN].t0;
  if (have <= need) return `molten steel appears at ${have}°C and needs ${need}°C to sink into steel, so it can never cut`;
  if (have - need < 100) return `only ${have - need}°C of headroom over the ${need}°C needed to cut steel — it loses that in a couple of ticks`;
  return null;
});

await check(browser, 'lava sets fire to what it runs into', () => {
  __wipe(); const f = __floor();
  __slab(20, f-1, 79, f-1, STONE);
  __slab(50, f-9, 74, f-2, WOOD);
  const wood0 = __count(WOOD);
  __slab(30, f-9, 46, f-2, LAVA);
  for (let k=0;k<3000;k++) __step(1);
  const gone = wood0 - __count(WOOD);
  if (gone < 8) return `lava sat against a wood pile and consumed ${gone} of ${wood0} cells`;
  return null;
});

// The trap this whole table could hide: a reaction that reads perfectly well and can
// never happen, because nothing in the box gets hot enough to trigger it. Green wood
// was exactly that for the entire life of the file.
await check(browser, 'every melting point in the table is reachable by something', () => {
  const hottest = Math.max(...[LAVA, MOLTEN].map(t => M[t].t0));
  const unreachable = [];
  for (let t=0; t<M.length; t++){
    const m = M[t];
    if (!m || m.melt === undefined || m.into === undefined) continue;
    // ...either something can be placed that is already hotter, or a fire gets there
    if (m.melt > hottest && m.melt > 1250) unreachable.push(`${m.n} melts at ${m.melt}, hotter than anything that exists`);
  }
  if (unreachable.length) return unreachable.join('; ');
  if (MAX_T < Math.max(...[STEEL, STONE, SAND].map(t => M[t].melt))) {
    return `the ceiling is ${MAX_T}°C but something in the table melts above it`;
  }
  return null;
});

console.log('\n— the five that were added for a verb nothing else had —');

// Each of these exists because of a gap. The check is that the gap is actually
// closed: a material that reads well and cannot do its one job is the defect this
// file has had more than any other.

await check(browser, 'a match will not light thermite, and magnesium will', () => {
  const run = (withRibbon) => {
    __wipe(); const f = __floor();
    __slab(40, f-6, 59, f-1, THERMITE);
    if (withRibbon) __slab(44, f-8, 51, f-7, MAGNES);
    __hold(47, withRibbon ? f-7 : f-3, 3, 300);
    for (let k=0;k<1500;k++) __step(1);
    return { thermite: __count(THERMITE), molten: __count(MOLTEN) };
  };
  const alone = run(false);
  if (alone.thermite < 100) return `a match on its own consumed ${120-alone.thermite} cells of thermite — it is meant to need more than 780°C`;
  const lit = run(true);
  if (lit.thermite > 60) return `with a magnesium ribbon on top, ${lit.thermite} of 120 cells of thermite were left`;
  return null;
});

// Counting steel cells is no good here: what thermite leaves behind is molten iron,
// which cools and sets into steel, so a burn can end with more steel in the box than
// it started with. Measured that way it scored minus 71. The question is whether the
// plate was breached.
//
// The depth limit is the other half of the claim, and it is not arbitrary: a hot
// liquid sinks into a solid it is hot enough to melt, and stops as soon as it has
// given away enough heat to fall below that melting point. So a charge has a reach.
// Without that rule thermite was a spectacle and nothing else — it burns at 2538°C
// and the plate underneath came through completely untouched, because the melt had
// nowhere to go and froze back into the dent it had made.
await check(browser, 'thermite cuts through a steel plate, and thick steel defeats it', () => {
  const run = (deep, chargeDeep, useThermite) => {
    __wipe();
    const f = H-4;
    __slab(0, f, W-1, f, STONE);                       // a tray, well below
    const pt = f-12, pb = pt+deep-1;
    __slab(30, pt, 69, pb, STEEL);
    if (useThermite){
      __slab(44, pt-chargeDeep, 55, pt-1, THERMITE);   // sitting directly on the plate
      __slab(46, pt-chargeDeep-2, 53, pt-chargeDeep-1, MAGNES);
      __hold(50, pt-chargeDeep-1, 3, 300);
    } else {
      __hold(50, pt-1, 3, 300);
    }
    for (let k=0;k<3000;k++) __step(1);
    // Molten counts as unbreached as well as steel. A column plugged with liquid metal
    // is not a hole — it is a hole that is about to fill itself in, which is exactly
    // the failure this check exists to catch. It happens to read the same at tick 3000
    // because everything has set by then, but only counting STEEL made that an accident
    // of when the tape measure came out.
    let breached = 0;
    for (let x=44; x<=55; x++){
      let solid = 0;
      for (let y=pt; y<=pb; y++){ const t = type[idx(x,y)]; if (t===STEEL || t===MOLTEN) solid++; }
      if (solid === 0) breached++;
    }
    return breached;
  };
  const match = run(3, 6, false);
  if (match > 0) return `a match alone breached ${match} of 12 columns, so this proves nothing about thermite`;

  const cut = run(3, 6, true);
  if (cut < 5) return `thermite on a three-deep plate breached ${cut} of 12 columns`;

  // Eight deep, and compared against a fixed bound rather than against `cut`.
  //
  // This was `run(6, ...)` tested as `thick >= cut`, and it was flaky: two random draws
  // compared with each other fails whenever the tail of one crosses the median of the
  // other. It went off once in a full-suite run reporting 8 breached columns on a
  // six-deep plate, then passed twelve times in a row on the same scene, which is the
  // worst way for a check to behave — it is noise wearing the clothes of a finding.
  //
  // Measured reach with this charge: three and four deep always breach, six and eight
  // never do across five runs each, and five deep is genuinely bimodal (0, 9, 0, 0, 11)
  // — a plate exactly at the limit either gets opened or holds, which is the right
  // behaviour to have and the wrong thing to assert on. So the check stands on the two
  // ends that do not move, and leaves the interesting middle alone.
  const thick = run(8, 6, true);
  if (thick > 2) return `the same charge breached ${thick} of 12 columns of an eight-deep plate against ${cut} of a three-deep — depth means nothing`;
  return null;
});

// The trap, and the whole point of it: everything else in the box teaches that water
// puts fires out.
await check(browser, 'water makes burning magnesium worse, not better', () => {
  const run = (douse) => {
    __wipe(); const f = __floor();
    __slab(20, f-1, 79, f-1, STONE);
    __slab(40, f-7, 59, f-2, MAGNES);
    __hold(50, f-4, 3, 250);
    if (douse) __slab(40, f-12, 59, f-9, WATER);
    let peak = 0;
    for (let k=0;k<900;k++){ __step(1); if (__maxT() > peak) peak = __maxT(); }
    return { peak: Math.round(peak), water: __count(WATER) };
  };
  const dry = run(false), wet = run(true);
  // Temperature is the claim. Counting cells consumed is not: measured, the wet run
  // burns a shade slower at the start because the water displaces some of it before
  // it catches, and both runs get through the lot either way. What water changes is
  // how hot it gets — 2213°C dry against 2600 wet, which is the ceiling.
  if (wet.peak <= dry.peak + 150) return `peak with water ${wet.peak}°C against ${dry.peak}°C dry — the water did nothing`;
  if (wet.water > 0) return `${wet.water} cells of water survived being poured on burning magnesium`;
  return null;
});

// Nothing else carries fire downward: burning cells do not move, so fire has only
// ever gone up and sideways.
await check(browser, 'burning rubber drips and lights what is underneath', () => {
  __wipe(); const f = __floor();
  __slab(20, f-1, 79, f-1, STONE);
  __slab(44, f-30, 55, f-25, RUBBER);
  __slab(40, f-4, 59, f-2, STRAW);      // well below, with a gap between
  const straw0 = __count(STRAW);
  __hold(50, f-28, 3, 400);
  for (let k=0;k<3000;k++) __step(1);
  const gone = straw0 - __count(STRAW);
  if (gone < 8) return `the rubber burned above it and the straw lost ${gone} of ${straw0} cells — nothing dripped`;
  return null;
});

await check(browser, 'acid eats through solids, wears out, and glass holds it', () => {
  __wipe(); const f = __floor();
  __slab(20, f-1, 79, f-1, STONE);
  __slab(30, f-10, 49, f-2, STEEL);
  const steel0 = __count(STEEL);
  __slab(30, f-16, 49, f-12, ACID);
  for (let k=0;k<2500;k++) __step(1);
  const eaten = steel0 - __count(STEEL);
  if (eaten < 10) return `acid sat on a steel plate and removed ${eaten} of ${steel0} cells`;

  // Wearing out is a budget, not a timer: a cell spends itself only on what it
  // actually eats, so a splash beside nothing stays a splash. Give a little acid far
  // more than it can manage and it should run out and vanish.
  __wipe(); const f3 = __floor();
  __slab(0, f3-1, W-1, f3-1, STONE);
  __slab(20, f3-40, 79, f3-2, COAL);
  __slab(46, f3-44, 53, f3-42, ACID);
  const acid0 = __count(ACID);
  for (let k=0;k<4000;k++) __step(1);
  if (__count(ACID) > acid0 * 0.15) return `${__count(ACID)} of ${acid0} cells of acid survived eating into a solid block — it never runs out`;

  // ...and a tank you can actually keep it in
  __wipe(); const f2 = __floor();
  __slab(30, f2-1, 49, f2-1, GLASS);
  for (let y=f2-12; y<f2-1; y++){ put(30,y,GLASS); put(49,y,GLASS); }
  const glass0 = __count(GLASS);
  __slab(32, f2-10, 47, f2-3, ACID);
  for (let k=0;k<2500;k++) __step(1);
  if (__count(GLASS) < glass0) return `acid ate ${glass0 - __count(GLASS)} cells of the glass holding it`;
  return null;
});

/* The chamber here used to be forty cells tall with four rows of gas in it, and it was
   that shape because gas used to halve itself while rising: by the time it had gathered,
   what was left was a plausible cloud. Now that a shut-in gas keeps, the same scene is all
   160 cells spread through 2,300 — a 7% mixture, too lean to carry a front, and it
   measured 105 of 160 left unburned.

   That is not the model being wrong, it is the scene no longer being a cloud. Retuned to
   the proportions the Gas preset uses, which are measured to work: a room 26 deep with ten
   rows of gas in it. A lean mixture failing to go off all at once is behaviour worth
   having; it is just not what this check is about. */
await check(browser, 'gas gathers overhead and goes off all at once', () => {
  __wipe(); const f = __floor();
  __slab(0, f, W-1, H-1, STONE);
  const cx = (W/2)|0, lid = f-26;
  __slab(cx-20, lid, cx+19, lid, STONE);             // a lid, so it pools
  for (let y=lid; y<f; y++){ put(cx-20, y, STONE); put(cx+19, y, STONE); }
  __slab(cx-18, f-12, cx+17, f-2, GAS);
  const placed = __count(GAS);
  for (let k=0;k<300;k++) __step(1);                 // let it rise and gather
  const pooled = __count(GAS);
  if (pooled < placed * 0.9) return `${placed-pooled} of ${placed} cells of gas went missing inside a sealed room`;
  let high = 0;
  for (let i=0;i<type.length;i++) if (type[i]===GAS && (i/W|0) < f-13) high++;
  if (high < pooled * 0.5) return `${high} of ${pooled} cells reached the upper half — gas is meant to rise`;

  // The middle of the cloud, which is where a finger goes. Lighting the first cell found
  // instead put the spark in a corner against a wall and measured a fizzle.
  let sx=0, sy=0, n=0;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (type[idx(x,y)]===GAS){ sx+=x; sy+=y; n++; }
  __hold(Math.round(sx/n), Math.round(sy/n), 3, 12);  // a spark, briefly
  let peakFire = 0;
  for (let k=0;k<200;k++){ __step(1); peakFire = Math.max(peakFire, __count(FIRE)); }
  if (peakFire < 40) return `lighting a pool of ${pooled} cells of gas made ${peakFire} flames — that is a candle, not a bang`;
  if (__count(GAS) > pooled * 0.4) return `${__count(GAS)} of ${pooled} cells of gas were left unburned`;
  return null;
});

/* Reported from the phone: gas vanished in a few seconds even sealed in, so there was
   nothing you could build with it. It was fading on the same clock as smoke — 900 ticks
   spread 0.6-1.4×, so nine to twenty-one seconds — with nowhere for it to have gone.

   Both halves of this are the check. A gas that keeps forever wherever you put it is the
   other way to get this wrong, so the open box has to still empty. And smoke and steam
   have to go on fading, because they are events rather than materials and that clock is
   correct for them. */
await check(browser, 'gas keeps when it is shut in and drifts off when it is not', () => {
  const bad = [];
  const room = (lidded) => {
    __wipe();
    const f = __floor(); const cx = (W/2)|0;
    if (lidded){
      const lid = f-26;
      __slab(cx-20, lid, cx+19, lid, STONE);
      for (let y=lid; y<f; y++){ put(cx-20, y, STONE); put(cx+19, y, STONE); }
    }
    __slab(cx-18, f-12, cx+17, f-2, GAS);
    return __count(GAS);
  };

  const sealed0 = room(true);
  for (let k=0;k<3600;k++) __step(1);
  const sealed = __count(GAS);
  if (sealed < sealed0 * 0.95) bad.push(`a sealed room lost ${sealed0-sealed} of ${sealed0} cells of gas in a minute with nowhere for them to go`);

  const open0 = room(false);
  for (let k=0;k<3600;k++) __step(1);
  if (__count(GAS) > open0 * 0.05) bad.push(`an open box still held ${__count(GAS)} of ${open0} cells of gas after a minute — it should rise out`);

  // The clock is right for the things that are made rather than placed.
  for (const t of [SMOKE, STEAM]){
    __wipe(); const f = __floor(); const cx = (W/2)|0;
    __slab(cx-10, f-20, cx+10, f-10, t);
    const n0 = __count(t);
    for (let k=0;k<600;k++) __step(1);
    if (__count(t) > n0 * 0.1) bad.push(`${M[t].n} did not fade: ${__count(t)} of ${n0} left after ten seconds`);
  }
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— falling —');

// Was: a 98-cell drop took exactly 98 ticks for sand in air, sand in water, coal in
// water and ash in water alike. Nothing accelerated and nothing was slowed by
// anything, because there was no speed in the model at all — a grain either moved a
// cell in a tick or it did not.
await check(browser, 'things fall slower through a liquid than through air', () => {
  const drop = (medium, mat) => {
    __wipe();
    const top = 18, bottom = 116;
    if (medium !== null) __slab(38, top+2, 61, bottom+4, medium);
    put(50, top, mat);
    for (let k=1;k<=1500;k++){
      __step(1);
      let y = -1;
      for (let yy=0;yy<H;yy++) for (let xx=44;xx<56;xx++) if (type[idx(xx,yy)]===mat) y = Math.max(y,yy);
      if (y >= bottom-2) return k;
      if (y < 0) return null;                       // melted, burned or otherwise gone
    }
    return Infinity;
  };
  const air = drop(null, SAND), wet = drop(WATER, SAND);
  if (!air || !wet) return 'the grain vanished mid-drop, so this measured nothing';
  if (wet < air * 2) return `the same drop took ${air} ticks through air and ${wet} through water`;
  return null;
});

await check(browser, 'a falling grain speeds up', () => {
  __wipe();
  put(50, 8, SAND);
  const rowOf = () => { for (let y=H-1;y>=0;y--) for (let x=46;x<55;x++) if (type[idx(x,y)]===SAND) return y; return -1; };
  __step(20); const a = rowOf();
  __step(20); const b = rowOf();
  __step(20); const c = rowOf();
  if (a < 0 || c < 0) return 'lost the grain';
  const first = a - 8, later = c - b;
  if (later <= first) return `it covered ${first} cells in the first 20 ticks and ${later} in the third 20 — it is not accelerating`;
  return null;
});

// Density, which used to be a rule about phases: powders sink through liquids, full
// stop, and liquids ignored each other completely. Oil and water simply stayed
// wherever they were put.
await check(browser, 'oil floats, sand sinks, ice bobs up', () => {
  const meanRow = t => { let sum=0, n=0; for (let i=0;i<type.length;i++) if (type[i]===t){ sum += (i/W)|0; n++; } return n ? sum/n : null; };
  const pool = () => {
    __wipe();
    const f = H-4;
    __slab(0, f, W-1, H-1, STONE);
    __slab(20, f-24, 79, f-1, WATER);
    return f;
  };

  let f = pool(); __slab(44, f-30, 55, f-27, OIL);
  for (let k=0;k<900;k++) __step(1);
  if (meanRow(OIL) === null) return 'the oil disappeared';
  if (meanRow(OIL) >= meanRow(WATER)) return `oil settled at row ${meanRow(OIL).toFixed(1)} against water at ${meanRow(WATER).toFixed(1)} — it did not float`;

  f = pool(); __slab(44, f-30, 55, f-27, SAND);
  for (let k=0;k<900;k++) __step(1);
  if (meanRow(SAND) <= meanRow(WATER)) return `sand settled at row ${meanRow(SAND).toFixed(1)} against water at ${meanRow(WATER).toFixed(1)} — it did not sink`;

  f = pool(); __slab(46, f-14, 53, f-9, ICE);
  const before = meanRow(ICE);
  for (let k=0;k<400;k++) __step(1);
  const after = meanRow(ICE);
  if (after === null) return 'the ice melted before it could float, so this measured nothing';
  if (after >= before) return `ice sat at row ${before.toFixed(1)} and was at ${after.toFixed(1)} 400 ticks later — it did not rise`;
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
  if (__maxT() > MAX_T + 1) return `peak temperature ${Math.round(__maxT())}°C against a stated ceiling of ${MAX_T}`;

  // The seeded scene as well, because the ceiling was breached there and not here: a
  // cell with burning neighbours on several sides collects from all of them, and the
  // pile in this check is too thin to surround one. It reached 2089°C — past the top
  // of the colour ramp, so it did not even look wrong.
  __wipe(); seed();
  const f2 = H-3;
  __hold((W*0.45)|0, f2-5, 3, 200);
  for (let k=0;k<900;k++) __step(1);
  if (__maxT() > MAX_T + 1) return `the opening scene reached ${Math.round(__maxT())}°C against a stated ceiling of ${MAX_T}`;
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

console.log('\n— the room, and the vent —');

/* The room is the number the whole box relaxes toward, so turning it up has to actually
   set things alight rather than just recolour the readout. The ladder is the point: what
   goes at 230 is not what goes at 480. */
await check(browser, 'turning the room up lights things that nothing touched', () => {
  const bad = [];
  // The room is set FIRST, before anything is built. `__wipe` fills the field with the
  // current AMBIENT and `put` gives a material with no `t0` the current AMBIENT too, so
  // setting it afterwards leaves the floor at whatever the previous run used — measured,
  // it left a stone floor at −30 under a 20°C room and froze five cells of the water
  // standing on it, which reads exactly like the page freezing water at room temperature.
  const run = (i) => {
    roomAt = i; AMBIENT = ROOMS[i].t;
    __wipe();
    const f = __floor(); const cx = (W/2)|0;
    __slab(cx-12, f-9, cx+11, f-1, PAPER);
    __slab(cx+16, f-5, cx+26, f-1, WATER);
    const paper0 = __count(PAPER), water0 = __count(WATER);
    for (let k=0;k<2400;k++) __step(1);
    return { paperGone: paper0 - __count(PAPER), water: __count(WATER), ice: __count(ICE),
             water0, nan: __nan() };
  };
  const cold = run(0);                                   // Freezing, -30
  if (cold.nan) bad.push('a freezing room produced a NaN temperature');
  if (cold.ice < cold.water0 * 0.5) bad.push(`Freezing froze ${cold.ice} of ${cold.water0} water cells — the label says it freezes`);
  if (cold.paperGone) bad.push(`${cold.paperGone} paper cells burned in a freezing room`);

  const room = run(2);                                   // Room, 20
  if (room.paperGone) bad.push(`${room.paperGone} paper cells burned at room temperature with nothing touching them`);
  if (room.ice) bad.push(`${room.ice} cells of ice appeared at 20°C`);

  const oven = run(4);                                   // Oven, 230
  if (oven.paperGone < 100) bad.push(`an oven burned ${oven.paperGone} of ${room.water0 && ''}${216} paper cells`);
  if (oven.water) bad.push(`${oven.water} water cells survived an oven`);
  if (oven.nan) bad.push('an oven produced a NaN temperature');

  // Put it back, so a check that runs after this one gets the room it expects.
  roomAt = 2; AMBIENT = ROOMS[2].t;
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'every room setting says something true about itself', () => {
  const bad = [];
  if (ROOMS[roomAt].t !== AMBIENT) bad.push(`the readout would say ${ROOMS[roomAt].t}° while the box is at ${AMBIENT}°`);
  // The tells name materials and thresholds; this checks the two that are checkable
  // against the table rather than against a simulation run.
  for (const r of ROOMS){
    if (/water freezes/.test(r.tell) && !(r.t <= M[WATER].cool))
      bad.push(`"${r.n}" claims water freezes at ${r.t}°, and water freezes at ${M[WATER].cool}°`);
    if (/wax runs/.test(r.tell) && !(r.t >= M[WAX].melt))
      bad.push(`"${r.n}" claims wax runs at ${r.t}°, and wax melts at ${M[WAX].melt}°`);
  }
  // Nothing may sit above the ceiling, and the hottest room must leave headroom for a
  // fire on top of it or the whole model flattens.
  if (ROOMS[ROOMS.length-1].t >= FLAME_PEAK)
    bad.push(`the hottest room is ${ROOMS[ROOMS.length-1].t}°, at or above the ${FLAME_PEAK}° a flame can reach`);
  return bad.length ? bad.join('; ') : null;
});

/* The vent, and the rule it exists to satisfy: it has to keep pouring.

   The first version filled an empty neighbour and nothing else, and produced exactly
   three cells before stopping forever — it collided with the one-deep-film rule in
   moveFalling, which stops a lone cell of liquid from creeping anywhere, so its own
   output sat against it and capped it. That failure looked like a working vent for about
   a second, which is why the count here is taken late rather than early. */
await check(browser, 'a vent keeps pouring, and pours what it was given', () => {
  const bad = [];
  const pour = (mat, ticks) => {
    __wipe();
    const f = __floor(); const cx = (W/2)|0;
    setTool(VENT); setTool(mat);               // tap the vent, then answer with a material
    put(cx, f-1, VENT);
    if (feed[idx(cx, f-1)] !== mat) bad.push(`a vent told to pour ${M[mat].n} holds ${M[feed[idx(cx,f-1)]].n}`);
    for (let k=0;k<ticks;k++) __step(1);
    return __count(mat);
  };
  const lava = pour(LAVA, 1800);
  if (lava < 40) bad.push(`a lava vent made ${lava} cells of lava in 30 seconds`);
  const water = pour(WATER, 900);
  if (water < 20) bad.push(`a water vent made ${water} cells of water — it is meant to be general`);
  if (__count(LAVA)) bad.push(`a water vent produced ${__count(LAVA)} cells of lava`);

  // ...and it must not be a tap that cannot be turned off. Sealed in, it stops.
  __wipe();
  const f = __floor(); const cx = (W/2)|0;
  setTool(VENT); setTool(LAVA);
  put(cx, f-3, VENT);
  for (const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]) put(cx+dx, f-3+dy, STONE);
  for (let k=0;k<1200;k++) __step(1);
  if (__count(LAVA)) bad.push(`a vent sealed in stone still made ${__count(LAVA)} cells of lava`);
  if (__maxT() > MAX_T) bad.push(`a vent drove the box to ${Math.round(__maxT())}°C, over the ${MAX_T}° ceiling`);
  return bad.length ? bad.join('; ') : null;
});

// The thing the vent was actually asked for. A cone is not "some lava exists" — it is
// lava that ran somewhere and set, so this counts the stone that was not there before.
await check(browser, 'a vent under a shaft builds a volcano out of its own lava', () => {
  __wipe();
  const f = __floor(); const cx = (W/2)|0;
  for (let d=0; d<18; d++){
    for (let t=0;t<3;t++){
      if (inb(cx-4-d+t, f-1-d)) put(cx-4-d+t, f-1-d, STONE);
      if (inb(cx+4+d-t, f-1-d)) put(cx+4+d-t, f-1-d, STONE);
    }
  }
  setTool(VENT); setTool(LAVA);
  __slab(cx-1, f-1, cx+1, f-1, VENT);
  const stone0 = __count(STONE);
  for (let k=0;k<3000;k++) __step(1);
  const made = __count(STONE) - stone0;
  if (__count(LAVA) < 100) return `the shaft held ${__count(LAVA)} cells of lava after 50 seconds`;
  if (made < 30) return `the pour left ${made} new cells of stone — a volcano is the cone, not the lava`;
  return null;
});

/* The count in the corner is the denominator of a progress bar, so the list behind it has
   to be the real list. There used to be two derivations of it — this table, and the label
   written out again at each `found()` call site — with nothing comparing them. If they had
   drifted the box would have promised discoveries that did not exist, or hidden ones that
   did, and the only symptom would have been a number. */
await check(browser, 'every discovery a scene can raise is in the table behind the counter', () => {
  const bad = [];
  const keys = new Set(FINDS.map(f => f.key));
  if (keys.size !== FINDS.length) bad.push(`${FINDS.length} entries but only ${keys.size} distinct keys`);
  for (const f of FINDS){
    if (!f.label) bad.push(`${f.key} has no label`);
    if (!M[f.t]) bad.push(`${f.key} names material ${f.t}, which does not exist`);
    if (FIND_LABEL.get(f.key) !== f.label) bad.push(`${f.key} is missing from the label lookup`);
  }

  // Now the other direction, which is the one that matters: play a handful of scenes and
  // check every key they actually raise is one the table knows about.
  const scenes = [
    () => { const f = __floor(); __slab(20, f-8, 44, f-1, LAVA); __slab(50, f-8, 60, f-1, WAX);
            __slab(50, f-12, 60, f-10, WATER); },
    () => { const f = __floor(); __slab(20, f-8, 44, f-1, ACID); __slab(50, f-8, 60, f-1, STEEL);
            __slab(46, f-8, 49, f-1, ACID); },
    () => { const f = __floor(); __slab(20, f-6, 60, f-1, SAND);
            __slab(20, f-14, 60, f-8, LAVA); },
    () => { const f = __floor(); __slab(30, f-10, 60, f-1, ICE); __slab(20, f-4, 28, f-1, OIL); },
  ];
  for (const build of scenes){
    __wipe(); build();
    __hold(40, H-10, 3, 200);
    for (let k=0;k<2000;k++) __step(1);
  }
  for (const k of finds) if (!keys.has(k)) bad.push(`a scene raised "${k}", which is not in the table`);
  if (finds.size === 0) bad.push('four scenes and a match raised no discoveries at all, so this proves nothing');
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— the first thing that is alive —');

await check(browser, 'a bug falls to a surface, stays on it, and stays one bug', () => {
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-30, BUG);
  for (let k=0;k<600;k++) __step(1);
  if (__count(BUG) !== 1) return `one bug became ${__count(BUG)}`;
  let at = -1;
  for (let i=0;i<type.length;i++) if (type[i]===BUG) at = i;
  const y = (at / W) | 0;
  if (y !== f-1) return `it settled at row ${y} instead of on the floor at ${f-1}`;

  // Twenty of them, left alone: a fixed population is fixed in both directions.
  __wipe(); __floor();
  for (let k=0;k<20;k++) put(10+k*5, f-1, BUG);
  const n0 = __count(BUG);
  for (let k=0;k<3000;k++) __step(1);
  if (__count(BUG) !== n0) return `${n0} bugs became ${__count(BUG)} in fifty seconds with nothing happening to them`;
  return null;
});

/* The trap this pass exists to avoid, stated as a speed limit.

   `react()` walks x ascending, so anything that steps right lands on a cell the loop has
   not reached yet and gets another go — and another. Measured before `moveLife` took its
   list of who is alive before anybody moved, and before the step throttle stopped keying
   on the cell index: one bug crossed seventy-one cells in a hundred ticks against the
   fourteen it should manage. It read as a bug that was simply quick. */
await check(browser, 'a bug is moved once a tick, not once per cell it lands on', () => {
  const bad = [];
  const ticks = 600;
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-1, BUG);
  let far = 0, last = cx;
  for (let k=0;k<ticks;k++){
    __step(1);
    for (let i=0;i<type.length;i++) if (type[i]===BUG){ const x = i%W; far += Math.abs(x-last); last = x; }
  }
  // The most it may travel is one cell every BUG_STEP ticks, with room for the dice.
  const ceiling = ticks / BUG_STEP * 1.6;
  if (far > ceiling) bad.push(`a calm bug covered ${far} cells in ${ticks} ticks, against a walking pace of about ${Math.round(ticks/BUG_STEP)}`);
  if (far < 10) bad.push(`it covered ${far} cells — it is not walking at all, so the limit proves nothing`);
  return bad.length ? bad.join('; ') : null;
});

/* On the floor of the box itself, which is the case every check here had missed.

   Every scene in this suite stands its bugs on a stone floor six rows up, where there is
   always a real cell underneath them. Clear the box and tap, which is what anybody
   actually does, and they land on the last row of the grid — and a step needs footing
   ahead-and-below, which off the bottom of the grid `inb` refuses to grant. So they could
   not take a single step. Thirty seconds of sitting still, reported from the phone, with a
   full suite of passing checks behind it. */
await check(browser, 'bugs walk on the floor of the box, not only on things put in it', () => {
  __wipe();                                   // deliberately no floor: the bare grid
  const cx = (W/2)|0;
  for (let k=0;k<12;k++) put(cx-30+k*5, H-1, BUG);
  const xs = () => { const o=[]; for (let i=0;i<type.length;i++) if (type[i]===BUG) o.push(i%W); return o; };
  const before = xs();
  const span0 = Math.max(...before) - Math.min(...before);
  for (let k=0;k<1800;k++) __step(1);
  const after = xs();
  if (after.length !== before.length) return `${before.length} bugs on the box floor became ${after.length}`;
  const span1 = Math.max(...after) - Math.min(...after);
  if (span1 <= span0 + 4) return `they spanned ${span0} cells and after thirty seconds span ${span1} — nothing standing on the floor of the box is walking`;
  return null;
});

/* Wandering, as distinct from travelling, and the difference is the whole of whether it
   reads as a creature.

   Reported from the phone: they do not move around unless there is a flame. They were in
   fact moving the whole time — 163 cells in twenty seconds — but a bug kept whatever
   heading it started with until something got in the way, so it **turned exactly once**
   in those twenty seconds: off to the wall, back again. A thing that only ever slides one
   way does not look alive, and next to a panicking one it looks like heat is the only
   thing that moves them.

   So this counts changes of mind, not distance. Distance was never the problem. */
await check(browser, 'a bug with nothing wrong wanders rather than commuting', () => {
  const bad = [];
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-1, BUG);
  let last = cx, lastDir = 0, turns = 0, walked = 0;
  const seen = new Set([cx]);
  for (let k=0;k<1200;k++){                     // twenty seconds
    __step(1);
    let at = -1;
    for (let i=0;i<type.length;i++) if (type[i]===BUG) at = i;
    if (at < 0){ bad.push('it died on a bare floor'); break; }
    const x = at % W;
    if (x !== last){
      const d = Math.sign(x - last);
      if (lastDir && d !== lastDir) turns++;
      lastDir = d; walked += Math.abs(x - last); last = x;
    }
    seen.add(last);
  }
  if (walked < 60) bad.push(`it covered ${walked} cells in twenty seconds — it is barely walking`);
  if (turns < 6) bad.push(`it changed direction ${turns} times in twenty seconds — that is a patrol, not a wander`);
  // ...and having changed its mind, it should be somewhere near where it started rather
  // than parked against a wall.
  if (seen.size > walked * 0.75) bad.push(`it visited ${seen.size} distinct cells while walking ${walked} — it is going in a straight line`);
  return bad.length ? bad.join('; ') : null;
});

/* The whole of what makes a cell read as alive: it notices, and it leaves.
   Tested against a gradient held by hand rather than a fire, because a fire measures how
   hot the fire was. A first attempt held a 520°C wall fourteen cells away for 900 ticks
   and cooked ten of the twelve bugs, which says nothing about which way they ran. */
await check(browser, 'a bug runs away from heat rather than wandering into it', () => {
  const bad = [];
  const trial = (hotter) => {
    __wipe(); const f = __floor();
    const cx = (W/2)|0;
    put(cx, f-1, BUG);
    for (let k=0;k<120;k++){
      let at = -1;
      for (let i=0;i<type.length;i++) if (type[i]===BUG) at = i;
      if (at < 0) return 'died';
      const x = at % W, y = (at / W) | 0;
      temp[at] = 200;                       // hot enough to panic, held there
      life[at] = 0;                         // ...and not allowed to char while we watch
      for (let d=1; d<=6; d++){
        if (inb(x-d,y)) temp[idx(x-d,y)] = hotter < 0 ? 400 : 30;
        if (inb(x+d,y)) temp[idx(x+d,y)] = hotter > 0 ? 400 : 30;
      }
      __step(1);
    }
    let at = -1;
    for (let i=0;i<type.length;i++) if (type[i]===BUG) at = i;
    return at < 0 ? 'died' : (at % W) - cx;
  };
  const fromLeft = trial(-1), fromRight = trial(1);
  if (typeof fromLeft !== 'number' || fromLeft < 15) bad.push(`with the heat on its left it moved ${fromLeft} — it should be well to the right`);
  if (typeof fromRight !== 'number' || fromRight > -15) bad.push(`with the heat on its right it moved ${fromRight} — it should be well to the left`);

  // And it only panics when it is actually hot: cold, it should not be sprinting anywhere.
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-1, BUG);
  for (let k=0;k<120;k++) __step(1);
  let at = -1;
  for (let i=0;i<type.length;i++) if (type[i]===BUG) at = i;
  if (at >= 0 && Math.abs((at % W) - cx) > 40) bad.push(`a bug with nothing wrong covered ${Math.abs((at%W)-cx)} cells in 120 ticks`);
  return bad.length ? bad.join('; ') : null;
});

/* The argument for a creature being a cell, stated as a check: it dies of the things the
   box already does, and not one line of that is creature code. */
await check(browser, 'the box kills bugs with what it already had', () => {
  const bad = [];
  const f0 = H-6;

  // Fire, through the same ignition it uses on straw, tested where it cannot run: walled
  // in on both sides with a lid over it. Holding a match near a bug that is free to leave
  // measures the running, not the burning.
  __wipe(); __floor();
  const bx = (W/2)|0;
  put(bx-1, f0-1, STONE); put(bx+1, f0-1, STONE); put(bx, f0-2, STONE);
  put(bx, f0-1, BUG);
  const ash0 = __count(ASH);
  __hold(bx, f0-1, 2, 150);
  for (let k=0;k<300;k++) __step(1);
  if (__count(BUG)) bad.push('a bug walled in with a match held on it did not burn');
  if (__count(ASH) <= ash0) bad.push('a burned bug left nothing behind');

  /* ...and given somewhere to run, most of them take it. Stated as survivors rather than
     as a death count on purpose: measured across five runs of the identical scene, deaths
     ranged from one to five, so a threshold on deaths sits on the noise. The claim worth
     making is that a fire at one end of a floor does not clear the floor. */
  __wipe(); __floor();
  __slab(6, f0-5, 26, f0-1, STRAW);
  for (let k=0;k<16;k++) put(28+k*5, f0-1, BUG);
  __hold(8, f0-2, 2, 40);
  for (let k=0;k<2400;k++) __step(1);
  if (__count(BUG) < 9) bad.push(`only ${__count(BUG)} of 16 got away from a fire at one end of the floor`);

  // The same floor with no fire on it, so the number above means something.
  __wipe(); __floor();
  for (let k=0;k<16;k++) put(34+k*5, f0-1, BUG);
  for (let k=0;k<2400;k++) __step(1);
  if (__count(BUG) !== 16) bad.push(`${16-__count(BUG)} bugs died on a bare floor with nothing happening`);

  // Water, through a `meets` row — one line in the table, and it registers as a find.
  __wipe(); __floor();
  for (let k=0;k<10;k++) put(40+k*2, f0-1, BUG);
  const wet0 = __count(BUG);
  __slab(38, f0-4, 60, f0-2, WATER);
  for (let k=0;k<600;k++) __step(1);
  if (__count(BUG) > wet0*0.2) bad.push(`${__count(BUG)} of ${wet0} bugs survived being poured on`);
  if (![...finds].some(k => k.startsWith(BUG + ':meets'))) bad.push('drowning did not register as a discovery');

  // Acid, because acid eats cells and a bug is a cell.
  __wipe(); __floor();
  for (let k=0;k<10;k++) put(40+k*2, f0-1, BUG);
  const acid0 = __count(BUG);
  __slab(38, f0-4, 60, f0-2, ACID);
  for (let k=0;k<900;k++) __step(1);
  if (__count(BUG) >= acid0) bad.push(`acid poured over ${acid0} bugs left ${__count(BUG)}`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'a moth flies, and does not fall out of the air', () => {
  __wipe(); __floor();
  const cx = (W/2)|0;
  put(cx, 40, MOTH);
  const at = () => { for (let i=0;i<type.length;i++) if (type[i]===MOTH) return [i%W,(i/W)|0]; return null; };
  const start = at();
  let lowest = start[1], moved = 0, last = start;
  for (let k=0;k<900;k++){
    __step(1);
    const p = at(); if (!p) return 'it died in an empty box';
    if (p[0]!==last[0] || p[1]!==last[1]) moved++;
    lowest = Math.max(lowest, p[1]);
    last = p;
  }
  if (!moved) return 'it never moved at all';
  if (lowest >= H-8) return `it sank to row ${lowest} — a moth that ends up on the floor is not flying`;
  return null;
});

/* The check that matters for this creature, and it is the control rather than the claim.

   The first version of the moth gave each one a seven-cell look around itself. Air
   conducts badly on purpose, so it could not find a candle it was not already touching —
   and it *still* drifted across the box, because twelve fluttering things spread out. Lit,
   they reached a mean x of 37; unlit, 44. Reading the lit number on its own would have
   shipped a moth that was not attracted to anything. */
await check(browser, 'a moth crosses the box to a flame, and does not without one', () => {
  const bad = [];
  const run = (light) => {
    __wipe(); const f = __floor();
    __slab(14, f-16, 21, f-1, WAX);
    for (let y=f-22; y<f-14; y++) put(18, y, FUSE);
    for (let k=0;k<12;k++) put(90+k*3, 40, MOTH);
    if (light) __hold(18, f-21, 2, 120);
    for (let k=0;k<1200;k++) __step(1);
    const at = [];
    for (let i=0;i<type.length;i++) if (type[i]===MOTH) at.push(i%W);
    return { left: at.length, meanX: at.length ? Math.round(at.reduce((a,c)=>a+c,0)/at.length) : null };
  };
  /* Deaths are the discriminator, not position. Twelve fluttering things spread across a
     box on their own, so where they end up is drift as much as attraction — measured, the
     unlit control wanders to a mean x of 39 to 62 all by itself, which overlaps a candle at
     18 closely enough to prove nothing. Nothing about drift kills them. */
  const dark = run(false);
  if (dark.left < 10) bad.push(`${12-dark.left} of 12 moths died in a room with nothing lit in it`);

  const lit = run(true);
  if (lit.left > 3) bad.push(`${lit.left} of 12 moths survived a lit candle — they are not going to it`);
  if (lit.left && lit.meanX > 45) bad.push(`the survivors are at x=${lit.meanX}, nowhere near the candle at 18`);
  if (dark.left - lit.left < 6) bad.push(`a lit candle killed ${12-lit.left} and an unlit one killed ${12-dark.left} — that is not attraction`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the box kills moths with what it already had', () => {
  const bad = [];
  const f0 = H-6;
  // Fire, walled in so it cannot fly off — the same shape of test the bug gets.
  __wipe(); __floor();
  const mx = (W/2)|0;
  __slab(mx-1, f0-3, mx+1, f0-3, STONE);
  put(mx-1, f0-2, STONE); put(mx+1, f0-2, STONE);
  put(mx, f0-2, MOTH);
  const ash0 = __count(ASH);
  __hold(mx, f0-2, 2, 150);
  for (let k=0;k<300;k++) __step(1);
  if (__count(MOTH)) bad.push('a moth walled in with a match held on it did not burn');
  if (__count(ASH) <= ash0) bad.push('a burned moth left nothing behind');

  /* Water, through its own `meets` row, which also earns it a discovery.
     Poured *beside* them rather than over them: `put` replaces whatever is in the cell, so
     slabbing water across where the moths are standing deletes them without any reaction
     happening at all — which measured as ten dead moths and no discovery, and looked for
     all the world like the reaction being broken. */
  __wipe(); __floor();
  let wet0 = 0;
  for (let k=0;k<10;k++){
    const x = 40 + k*6;
    put(x, f0-6, MOTH); wet0++;
    put(x-1, f0-6, WATER); put(x+1, f0-6, WATER); put(x, f0-7, WATER);
  }
  for (let k=0;k<600;k++) __step(1);
  if (__count(MOTH) > wet0*0.3) bad.push(`${__count(MOTH)} of ${wet0} moths survived being surrounded by water`);
  if (![...finds].some(k => k.startsWith(MOTH + ':meets'))) bad.push('drowning did not register as a discovery');
  return bad.length ? bad.join('; ') : null;
});

// Moths are the expensive ones: each looks at every beacon in the box, and the beacons
// themselves are a full pass over the grid. Both are bounded — one pass however many
// moths there are, and the beacons are capped by dicing the box into blocks — but bounded
// is a claim and this is the measurement.
await check(browser, 'a box full of living things still costs less than a frame', () => {
  const bad = [];
  const bench = (t, n) => {
    __wipe(); const f = __floor();
    __slab(10, f-14, 40, f-1, STRAW);              // something alight, so there are beacons
    __hold(12, f-2, 2, 60);
    for (let k=0;k<n;k++) put(4+(k%120), f-20-((k/120)|0), t);
    for (let k=0;k<60;k++) __step(1);
    const t0 = performance.now();
    for (let k=0;k<200;k++) moveLife();
    return (performance.now() - t0) / 200;
  };
  const bugs = bench(BUG, 500);
  if (bugs > 1) bad.push(`${bugs.toFixed(2)}ms a tick for 500 bugs`);
  const moths = bench(MOTH, 500);
  if (moths > 2) bad.push(`${moths.toFixed(2)}ms a tick for 500 moths with a fire lit`);
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— scenes, and getting them back —');

/* The reason this table exists at all, and it is a trap that was live before anything
   was written against it: two pairs of materials share a display name. WAX and MELT are
   both 'Wax'; RUBBER and MRUBBER are both 'Rubber'. A save format keyed on `M[t].n` —
   which is the obvious way to write "store names, not indices" — would have loaded every
   puddle of molten wax back as a solid block of it. Nothing throws, nothing warns, and
   the scene is merely slightly wrong.

   So the keys are their own table, and this is what holds them to being a file format:
   complete, unique, and free to disagree with whatever the tray calls things. */
await check(browser, 'every material has a save key and no two share one', () => {
  const bad = [], seen = new Map();
  for (let t=0; t<M.length; t++){
    if (!M[t]) continue;
    const k = SAVE_KEY[t];
    if (!k){ bad.push(`${M[t].n} (index ${t}) has no save key`); continue; }
    if (seen.has(k)) bad.push(`${M[t].n} and ${seen.get(k)} both save as "${k}"`);
    seen.set(k, M[t].n);
  }
  if (TYPE_OF_KEY.size !== seen.size) bad.push(`the reverse lookup has ${TYPE_OF_KEY.size} entries for ${seen.size} keys`);
  return bad.length ? bad.join('; ') : null;
});

/* The room is part of what was built, not part of the app around it. Leaving it out of
   the save was a defect: a volcano built in a Furnace and loaded back at Normal is a
   different scene doing different things, and nothing about it looks wrong. */
await check(browser, 'a save carries the room it was built in', () => {
  const bad = [];
  const hot = ROOMS.findIndex(r => r.n === 'Oven');
  const cold = ROOMS.findIndex(r => r.n === 'Freezing');
  setRoom(hot);
  __wipe(); const f = __floor();
  __slab(30, f-6, 60, f-1, WOOD);
  const text = JSON.stringify(encodeScene());
  setRoom(cold);
  decodeScene(JSON.parse(text));
  if (roomAt !== hot) bad.push(`saved in ${ROOMS[hot].n} and loaded as ${ROOMS[roomAt].n}`);
  if (AMBIENT !== ROOMS[hot].t) bad.push(`the room reads ${ROOMS[roomAt].n} but AMBIENT is ${AMBIENT}`);

  // The order matters and is easy to get wrong: the field is filled with the current
  // AMBIENT and put() hands a material with no `t0` the current AMBIENT, so the room has
  // to be set before the scene is laid down. Measured wrong once, in this suite's own
  // scene: a stone floor left at −30 froze the water standing on it in a 20°C room.
  let coldest = Infinity;
  for (let i=0;i<temp.length;i++) if (temp[i] < coldest) coldest = temp[i];
  if (coldest < ROOMS[hot].t - 1) bad.push(`something came back at ${Math.round(coldest)}°C in a ${ROOMS[hot].t}°C room`);

  // A save from before the room was stored keeps whatever is set rather than guessing.
  setRoom(cold);
  const old = JSON.parse(text); delete old.room; old.v = 2;
  decodeScene(old);
  if (roomAt !== cold) bad.push(`a save with no room in it moved the room to ${ROOMS[roomAt].n}`);

  setRoom(ROOMS.findIndex(r => r.n === 'Normal'));
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'a saved scene comes back cell for cell', () => {
  const bad = [];
  for (const s of SCENES){
    loadScene(s);
    const snap = Uint8Array.from(type);
    // Through JSON both ways, because that is what a real save is. Handing the object
    // straight back would not notice a value that cannot survive being stringified.
    const text = JSON.stringify(encodeScene());
    __wipe();
    const missing = decodeScene(JSON.parse(text));
    if (missing.length){ bad.push(`${s.name}: ${missing.join(', ')} could not be placed`); continue; }
    let diff = 0;
    for (let i=0;i<type.length;i++) if (type[i] !== snap[i]) diff++;
    if (diff) bad.push(`${s.name}: ${diff} cells came back different`);
    if (text.length > 200000) bad.push(`${s.name}: ${(text.length/1024|0)}kB is too big to keep in localStorage`);
  }
  return bad.length ? bad.join('; ') : null;
});

// A save is a string in storage that anything could have written — an older build, a
// newer one, or a text editor. None of those may take the page down, and none of them
// may load as a scene that quietly is not what was saved.
await check(browser, 'a damaged or foreign save is survived and reported', () => {
  const bad = [];
  const tryLoad = (label, obj) => {
    try { return decodeScene(obj); }
    catch (e){ bad.push(`${label} threw: ${e.message}`); return null; }
  };
  // A material this build has never heard of. Its cells must go, and it must say so.
  const m = tryLoad('an unknown material', { v:1, w:8, h:8, keys:['no-such-thing'], runs:[64,0] });
  if (m && !m.includes('no-such-thing')) bad.push(`an unknown material was not reported: ${JSON.stringify(m)}`);
  if (m && __count(E) !== type.length) bad.push('an unknown material left something in the box');

  // Run lengths that claim far more cells than the grid holds.
  tryLoad('an overlong run', { v:1, w:4, h:4, keys:['wood'], runs:[9999999,0] });
  // A run pointing at a palette entry that is not there.
  tryLoad('a dangling palette index', { v:1, w:4, h:4, keys:['wood'], runs:[16,7] });
  // An odd number of run values, so the last pair is incomplete.
  tryLoad('a truncated run list', { v:1, w:4, h:4, keys:['wood'], runs:[4,0,4] });
  if (__nan()) bad.push('a damaged save left NaN in the temperature field');

  // A save from a bigger screen: it must lose the top, never the floor. Stone on the
  // bottom row of the save has to still be on the bottom row after loading.
  __wipe();
  __slab(0, H-2, W-1, H-1, STONE);
  const tall = encodeScene();
  tall.h += 40; tall.runs.unshift(40 * tall.w, tall.keys.indexOf('air'));
  tryLoad('a save from a taller screen', tall);
  let floorHeld = true;
  for (let x=0;x<W;x++) if (type[idx(x,H-1)] !== STONE) floorHeld = false;
  if (!floorHeld) bad.push('a save from a taller screen did not keep its floor on the floor');
  return bad.length ? bad.join('; ') : null;
});

/* Every preset is a scenario the suite already measures somewhere above, and this is
   what stops that from being a claim. A preset is a promise on a button: geometry that
   is a few cells out — a wick that does not reach the wax, a plate with no air under it
   — produces a scene that builds perfectly and cannot be made to do the thing its own
   label says.

   The match goes to the middle of what it is lighting, because that is where a finger
   goes. Aiming at the first matching cell instead put it in a corner against a wall and
   measured the gas room as a fizzle, 33 flames against the 80 it actually makes. */
await check(browser, 'every preset pays off when you do what its label says', () => {
  const bad = [];
  const middle = t => { let sx=0, sy=0, n=0;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (type[idx(x,y)]===t){ sx+=x; sy+=y; n++; }
    return n ? [Math.round(sx/n), Math.round(sy/n)] : null; };
  const edge = (t, pick) => { let best = null;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){
      if (type[idx(x,y)] !== t) continue;
      if (!best || (pick==='top' ? y<best[1] : x<best[0])) best = [x,y];
    }
    return best; };
  const scene = n => SCENES.find(s => s.name === n);

  // Candle — one touch of the wick tip, then it is on its own.
  loadScene(scene('Candle'));
  { const w = edge(FUSE,'top');
    if (!w) bad.push('Candle has no wick'); else {
      __hold(w[0], w[1], 2, 120);
      let alight=0, dark=0;
      for (let k=0;k<2600;k++){ __step(1); if (__count(FIRE)>0){ alight++; dark=0; } else if (++dark>90) break; }
      if (alight < 600) bad.push(`Candle stayed lit ${alight} ticks`);
    } }

  // Fuse — the far end, and it must take its time getting there.
  loadScene(scene('Fuse'));
  { const e = edge(FUSE,'left'); const charge = __count(POWDER);
    if (!e || !charge) bad.push('Fuse is missing its cord or its charge'); else {
      __hold(e[0], e[1], 2, 90);
      let firedAt = -1;
      for (let k=0;k<4000;k++){ __step(1); if (__count(POWDER) < charge*0.9){ firedAt=k; break; } }
      if (firedAt < 0) bad.push(`Fuse never reached the charge (${__count(POWDER)}/${charge} left)`);
      else if (firedAt < 200) bad.push(`Fuse fired after ${firedAt} ticks — that is a wire`);
    } }

  // Cut — the ribbon, not the thermite, and the plate ends up open.
  loadScene(scene('Cut'));
  { const m = edge(MAGNES,'top');
    const cols = new Map();
    for (let i=0;i<type.length;i++) if (type[i]===STEEL){ const x=i%W; (cols.get(x) || cols.set(x,[]).get(x)).push((i/W)|0); }
    if (!m || !cols.size) bad.push('Cut is missing its ribbon or its plate'); else {
      __hold(m[0], m[1], 2, 300);
      for (let k=0;k<2600;k++) __step(1);
      let breached = 0;
      for (const [x, ys] of cols){
        let solid = 0;
        for (const y of ys){ const t = type[idx(x,y)]; if (t===STEEL||t===MOLTEN) solid++; }
        if (!solid) breached++;
      }
      if (breached < 3) bad.push(`Cut breached ${breached} of ${cols.size} columns`);
    } }

  // Acid — it eats what is standing in it, and the tank holds.
  loadScene(scene('Acid'));
  { const steel0 = __count(STEEL), glass0 = __count(GLASS);
    for (let k=0;k<2600;k++) __step(1);
    if (steel0 - __count(STEEL) < 20) bad.push(`Acid ate ${steel0-__count(STEEL)} of ${steel0} steel cells`);
    if (glass0 - __count(GLASS) > 0) bad.push(`Acid ate ${glass0-__count(GLASS)} of its own glass tank`); }

  // Lava — a pour you have time to do something with.
  loadScene(scene('Lava'));
  { const n0 = __count(LAVA); let half = -1;
    for (let k=1;k<=1200;k++){ __step(1); if (__count(LAVA) <= n0*0.5){ half=k; break; } }
    if (half >= 0 && half < 600) bad.push(`Lava was half set after ${half} ticks`); }

  // Gas — gathers, then goes off properly rather than fizzling.
  loadScene(scene('Gas'));
  { __step(120);
    const pooled = __count(GAS);
    const g = middle(GAS);
    if (!g) bad.push('Gas dispersed before it could be lit'); else {
      __hold(g[0], g[1], 3, 12);
      let peakFire = 0;
      for (let k=0;k<200;k++){ __step(1); peakFire = Math.max(peakFire, __count(FIRE)); }
      if (peakFire < 40) bad.push(`Gas made ${peakFire} flames — that is a candle, not a bang`);
      if (__count(GAS) > pooled*0.4) bad.push(`Gas left ${__count(GAS)} of ${pooled} cells unburned`);
    } }

  return bad.length ? bad.join('; ') : null;
});

console.log('\n— it has to stay playable —');

await check(browser, 'a busy scene costs less than a frame', () => {
  __wipe(); seed();
  const f = H-3;
  __hold((W*0.45)|0, f-5, 3, 200);
  for (let k=0;k<200;k++) __step(1);
  // What a frame actually costs: STEPS ticks of simulation and one draw. Timing a
  // single tick plus a draw measured something the page does not do.
  const t0 = performance.now();
  for (let k=0;k<120;k++){
    for (let s=0; s<STEPS; s++) simTick();
    draw();
  }
  const ms = (performance.now() - t0) / 120;
  // 16.7ms is one frame at 60Hz. The budget is half of it, which leaves room for the
  // browser to do its own work — and the device this is played on measured faster
  // than the machine the suite runs on, so the margin is real rather than hopeful.
  if (ms > 8) return `${ms.toFixed(2)}ms per frame on ${W}x${H} = ${W*H} cells, ${STEPS} ticks a frame`;
  return null;
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
