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
  window.__minT  = () => { let m= 1e9; for (let i=0;i<temp.length;i++) if (temp[i]<m) m=temp[i]; return m; };
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
  // By name, because the settings are a list that grows and an index is a fact about
  // where a thing happens to sit today. Adding Neutral at the front shifted every one
  // of them by one, and a check that says setRoom(0) would have gone on passing while
  // measuring a different room than the one it names in its own failure message.
  window.__room  = n => { const i = ROOMS.findIndex(r => r.n === n);
    if (i < 0) throw new Error('no room called ' + n); setRoom(i); return i; };
  /* And every check starts in a fixed room, whatever the app defaults to.

     The app now opens on Neutral, where the room drifts with what is in the box. That is
     the point of it, and it is the wrong ground to measure anything else from: a check
     about how long a candle burns would quietly become a check about how long a candle
     burns in a room the candle is warming. The Neutral checks turn it back on for
     themselves. */
  setRoom(ROOMS.findIndex(r => r.n === 'Normal'));
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
  // limit — the same worm that put a lava scene at 3774°C against a 1650°C ceiling.
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
  /* The page's own weather, not a copy of it here. This used to spell the rain loop out —
     the rate, the clock, the lot — and a harness that reimplements the thing it is testing
     agrees with itself long after it has stopped agreeing with the page. It did: rain moved
     into `weatherTick()` with the other three kinds, and this check went looking for a
     constant that no longer existed. Now it presses the button the player presses. */
  sky = SKY_RAIN; skyLeft = RAIN_LEFT;
  for (let k=0;k<1400;k++){
    if (skyLeft > 0){ skyLeft--; weatherTick(); }
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

/* The complement of the check above, and the one that was missing. That one asks whether
   every melting point can be reached; this one asks whether everything *has* a way out at
   all — because a material with no ignition point and no melting point and `proof` against
   acid is indestructible, and nothing in the table looks wrong when you read it.

   Reported from the phone as thermite not cutting glass. It was not thermite: Glass and
   Obsidian could not be destroyed by anything, at any temperature, ever. Measured at 2600°C
   with 0 of 102 cells removed for each.

   A table read rather than a sweep, deliberately. Firing thermite, lava, molten steel, acid,
   a match and a furnace at all twenty-four materials is four hundred thousand ticks and
   several minutes; the property is decidable from the row. */
await check(browser, 'nothing in the tray is indestructible except the thing that is meant to be', () => {
  // The vent is the exception and it is a design decision, written down: a source you can
  // destroy with what it pours is not a source.
  const spared = new Set([VENT]);
  const bad = [];
  for (const g of GROUPS){
    if (!Array.isArray(g.items)) continue;
    for (const t of g.items){
      const m = M[t];
      if (spared.has(t) || m.alive) continue;
      const burns  = m.fuel > 0 && m.ig < 9e9;
      const melts  = m.melt !== undefined && m.into !== undefined;
      const boils  = m.boil !== undefined && m.into !== undefined;
      const eaten  = !m.proof;
      const reacts = !!m.meets;
      if (!(burns || melts || boils || eaten || reacts))
        bad.push(`${m.n} cannot be burned, melted, boiled, eaten by acid or reacted away — nothing in the box can remove it`);
    }
  }
  return bad.length ? bad.join('; ') : null;
});

/* And the behaviour behind it, because a melting point in the table is a claim about the
   table and not about the box. Thermite is lit with a magnesium ribbon rather than a match,
   which is the whole of why this was reported as broken. */
/* Reported from the phone with pictures of the same charge on steel and on wood: through
   the steel in a clean plume, and on the wood just sitting there setting light to it and
   waiting for the fire to do the work.

   A liquid could sink into anything it could *melt* and nothing it could *burn*, and wood
   has no melting point, so it was outside the rule entirely. Molten iron at 2500°C does not
   wait for a wooden floor.

   Depth over time rather than a breach flag, because a breach flag says nothing about the
   difference between cutting and smouldering — and because the first version of this probe
   started its clock after the 300-tick hold and reported "breached at tick 1" for everything
   that worked. */
await check(browser, 'a charge cuts down through what it can burn, not only what it can melt', () => {
  const bad = [];
  const cx = (W/2)|0, THICK = 16;
  const cut = (t) => {
    __wipe(); const f = H-46;
    __slab(cx-20, f, cx+20, f+THICK-1, t);
    __slab(cx-6, f-6, cx+6, f-1, THERMITE);
    __slab(cx-4, f-8, cx+3, f-7, MAGNES);
    const depth = () => {
      let best = 0;
      for (let x=cx-20;x<=cx+20;x++){
        let d = 0;
        for (let y=f;y<f+THICK;y++){ if (type[idx(x,y)] === t) break; d++; }
        if (d > best) best = d;
      }
      return best;
    };
    let k = 0;
    const run = (n) => { for (let j=0;j<n;j++){ if (k < 150) __flame(cx-1, f-7, 3); __step(1); k++; } };
    run(600);  const at10 = depth();
    run(1800); return { at10, at40: depth() };
  };
  // Measured 16 of 16 by ten seconds for both, against 0 and 0 before the rule existed.
  for (const t of [WOOD, GREEN]){
    const r = cut(t);
    if (r.at10 < THICK)
      bad.push(`a lit charge on ${M[t].n} was ${r.at10} of ${THICK} cells deep after ten seconds`);
  }
  /* The other half, and it is the half that keeps the rule honest: thick steel still
     defeats it. The cut is self-limiting because the liquid cools as it works, and a rule
     that went through everything would have taken that away. */
  const steel = cut(STEEL);
  if (steel.at40 >= THICK) bad.push(`a charge went clean through ${THICK} cells of steel — thick steel is meant to defeat it`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'thermite cuts glass and obsidian, once it is actually lit', () => {
  const bad = [];
  const cx = (W/2)|0;
  const cut = (t, light) => {
    __wipe(); const f = __floor();
    __slab(cx-8, f-6, cx+8, f-1, t);
    const inSlab = () => { let n=0;
      for (let y=f-6;y<=f-1;y++) for (let x=cx-8;x<=cx+8;x++) if (type[idx(x,y)]===t) n++; return n; };
    const n0 = inSlab();
    __slab(cx-8, f-11, cx+8, f-7, THERMITE);
    if (light) __slab(cx-5, f-13, cx+2, f-12, MAGNES);
    __hold(light ? cx-2 : cx, light ? f-12 : f-11, 3, 300);
    let peak = 0;
    for (let k=0;k<2500;k++){ __step(1); const q = __maxT(); if (q > peak) peak = q; }
    return { n0, left: inSlab(), peak: Math.round(peak) };
  };
  for (const t of [GLASS, OBSIDIAN]){
    const lit = cut(t, true);
    if (lit.peak < 2000) bad.push(`the charge on ${M[t].n} only reached ${lit.peak}°C — it did not go off`);
    else if (lit.left > lit.n0 * 0.4)
      bad.push(`a lit charge on ${M[t].n} left ${lit.left} of ${lit.n0} cells at ${lit.peak}°C`);
  }
  // ...and the half of it that is deliberate: a match alone will not do it.
  const cold = cut(GLASS, false);
  if (cold.peak > 1200) bad.push(`a match alone drove the charge to ${cold.peak}°C — it is meant to need magnesium`);
  if (cold.left < cold.n0) bad.push(`a match alone cut ${cold.n0 - cold.left} cells of glass`);
  return bad.length ? bad.join('; ') : null;
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
await check(browser, 'oil floats, sand sinks, snow bobs up, ice does neither', () => {
  let bad0 = null;
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

  /* Snow bobs up, and this leg used to be ice doing it. Ice was a powder with a flag on it
     that stopped it slumping sideways — the flag never stopped it falling, whatever the notes
     said, and it left ice floating up through ponds and being carried around by ants. Snow is
     the powder now and it inherits the buoyancy, which it earns at `dens` 0.35 against water's
     1.0 rather than ice's 0.92 squeaking under. */
  f = pool(); __room('Freezing');
  __slab(46, f-14, 53, f-9, SNOW);
  const before = meanRow(SNOW);
  for (let k=0;k<400;k++) __step(1);
  const after = meanRow(SNOW);
  __room('Normal');
  if (after === null) return 'the snow melted before it could float, so this measured nothing';
  if (after >= before) return `snow sat at row ${before.toFixed(1)} and was at ${after.toFixed(1)} 400 ticks later — it did not rise`;

  /* And ice does not, because ice is a block. Drawn in mid-air it hangs there like stone and
     wood do; drawn in a pond it stays put. Measured before the change: a block thirty rows up
     came down to the floor, and eight ants hauled it about for 4,733 cell-ticks between them,
     because what an ant may lift is any powder that is not alive. */
  __wipe(); const ff = __floor();
  __room('Freezing');
  __slab(30, 40, 40, 50, ICE);
  const air0 = meanRow(ICE);
  for (let k=0;k<900;k++) __step(1);
  if (Math.abs(meanRow(ICE) - air0) > 0.5)
    bad0 = `a block of ice drawn at row ${air0.toFixed(1)} was at ${meanRow(ICE).toFixed(1)} fifteen seconds later`;

  __wipe(); const f3 = __floor();
  for (let x=40;x<70;x++) put(x, f3-1, ICE);
  for (let k=0;k<8;k++) put(44+k*3, f3-3, ANT);
  let hauled = 0;
  for (let k=0;k<2000;k++){
    __step(1);
    for (let i=0;i<type.length;i++) if (type[i]===ANT && feed[i]===ICE) hauled++;
  }
  __room('Normal');
  if (hauled) return `an ant carried a block of ice for ${hauled} cell-ticks`;
  return bad0 || null;
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
  // By name. This said run(0), run(2), run(4) and meant Freezing, Normal, Oven — until
  // Neutral went in at the front of the list and they meant Neutral, Cold and Warm. The
  // check went on running and went on being about the room; it was simply about three
  // different rooms than the ones it names in its own failure messages.
  const run = (name) => {
    __room(name);
    __wipe();
    const f = __floor(); const cx = (W/2)|0;
    __slab(cx-12, f-9, cx+11, f-1, PAPER);
    __slab(cx+16, f-5, cx+26, f-1, WATER);
    const paper0 = __count(PAPER), water0 = __count(WATER);
    for (let k=0;k<2400;k++) __step(1);
    return { paperGone: paper0 - __count(PAPER), water: __count(WATER), ice: __count(ICE),
             water0, nan: __nan() };
  };
  const cold = run('Freezing');
  if (cold.nan) bad.push('a freezing room produced a NaN temperature');
  if (cold.ice < cold.water0 * 0.5) bad.push(`Freezing froze ${cold.ice} of ${cold.water0} water cells — the label says it freezes`);
  if (cold.paperGone) bad.push(`${cold.paperGone} paper cells burned in a freezing room`);

  const room = run('Normal');
  if (room.paperGone) bad.push(`${room.paperGone} paper cells burned at room temperature with nothing touching them`);
  if (room.ice) bad.push(`${room.ice} cells of ice appeared at 20°C`);

  const oven = run('Oven');
  if (oven.paperGone < 100) bad.push(`an oven burned ${oven.paperGone} of ${room.water0 && ''}${216} paper cells`);
  if (oven.water) bad.push(`${oven.water} water cells survived an oven`);
  if (oven.nan) bad.push('an oven produced a NaN temperature');

  // Put it back, so a check that runs after this one gets the room it expects.
  __room('Normal');
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

/* Reported from the phone: "the vent only works for lava, molten and water while under any
   liquid". `ventPush` wrote into empty cells and nothing else, so a submerged vent was
   plugged — and the three that appeared to work were not exceptions to that, they were a
   vent shoving its own output up a column of itself, plus lava quenching into obsidian and
   steam and leaving gaps to push into.

   Counting the payload is what makes a working vent read as a dead one here: lava under
   water is obsidian within a tick and molten sets to steel. So this counts everything that
   is neither the pool, the floor, nor the vent — anything at all that was not there. */
await check(browser, 'a vent buried in a liquid still pours', () => {
  const bad = [];
  const cx = (W/2)|0;
  const pour = (payload, fill) => {
    __wipe();
    const f = H-6;
    __slab(0, f, W-1, H-1, GLASS);            // glass, not stone, so a stone vent counts
    __slab(cx-16, f-30, cx+16, f-1, fill);
    put(cx, f-1, VENT); feed[idx(cx, f-1)] = payload;
    for (let k=0;k<400;k++) __step(1);
    let made = 0;
    for (let i=0;i<type.length;i++){
      const t = type[i];
      if (t !== E && t !== VENT && t !== GLASS && t !== fill) made++;
    }
    return made;
  };
  /* One of each phase, because `yields` is a function of phase and nothing else — a
     powder, a solid, a gas, a liquid, a hot liquid that reacts with the pool it is in, and
     something alive. Naming twenty materials would measure the same five answers. */
  for (const t of [SAND, STONE, GAS, ACID, LAVA, WORM]){
    const n = M[t].n;
    for (const [where, fill] of [['water', WATER], ['oil', OIL]]){
      /* A payload the pool destroys on contact never accumulates: lava quenches to obsidian
         the moment it arrives, so what is standing at the end measures the vent's *rate*
         rather than its total. One bar tuned to the payloads that pile up was a coin flip
         for the ones that do not — measured across ten runs of the lava arm on the build
         before this comment: 4 5 4 5 4 5 4 6 4 4, against a threshold of 5. It then passed
         five times running while I was checking something else, which is exactly how a bad
         threshold survives. */
      const bar = M[t].meets ? 2 : 20;
      const made = pour(t, fill);
      if (made < bar)
        bad.push(`a vent pouring ${n} under ${where} made ${made} cells of anything in 400 ticks, under the ${bar} this payload needs`);
    }
  }

  /* And the other half, or "a vent pours into anything" is satisfied by a vent that eats
     walls. Sealed in stone it still stops, which is the plug the design asks for. */
  __wipe();
  const f = __floor();
  setTool(VENT); setTool(LAVA);
  put(cx, f-3, VENT);
  for (const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]) put(cx+dx, f-3+dy, STONE);
  const stone0 = __count(STONE);
  for (let k=0;k<1200;k++) __step(1);
  if (__count(LAVA)) bad.push(`a vent sealed in stone made ${__count(LAVA)} cells of lava`);
  if (__count(STONE) < stone0) bad.push(`a sealed vent ate ${stone0 - __count(STONE)} cells of its own plug`);
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

await check(browser, 'a worm falls to a surface, stays on it, and stays one worm', () => {
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-30, WORM);
  for (let k=0;k<600;k++) __step(1);
  if (__count(WORM) !== 1) return `one worm became ${__count(WORM)}`;
  let at = -1;
  for (let i=0;i<type.length;i++) if (type[i]===WORM) at = i;
  const y = (at / W) | 0;
  if (y !== f-1) return `it settled at row ${y} instead of on the floor at ${f-1}`;

  // Twenty of them, left alone: a fixed population is fixed in both directions.
  __wipe(); __floor();
  for (let k=0;k<20;k++) put(10+k*5, f-1, WORM);
  const n0 = __count(WORM);
  for (let k=0;k<3000;k++) __step(1);
  if (__count(WORM) !== n0) return `${n0} worms became ${__count(WORM)} in fifty seconds with nothing happening to them`;
  return null;
});

/* The trap this pass exists to avoid, stated as a speed limit.

   `react()` walks x ascending, so anything that steps right lands on a cell the loop has
   not reached yet and gets another go — and another. Measured before `moveLife` took its
   list of who is alive before anybody moved, and before the step throttle stopped keying
   on the cell index: one worm crossed seventy-one cells in a hundred ticks against the
   fourteen it should manage. It read as a worm that was simply quick. */
await check(browser, 'a worm is moved once a tick, not once per cell it lands on', () => {
  const bad = [];
  const ticks = 600;
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-1, WORM);
  let far = 0, last = cx;
  for (let k=0;k<ticks;k++){
    __step(1);
    for (let i=0;i<type.length;i++) if (type[i]===WORM){ const x = i%W; far += Math.abs(x-last); last = x; }
  }
  // The most it may travel is one cell every BUG_STEP ticks, with room for the dice.
  const ceiling = ticks / BUG_STEP * 1.6;
  if (far > ceiling) bad.push(`a calm worm covered ${far} cells in ${ticks} ticks, against a walking pace of about ${Math.round(ticks/BUG_STEP)}`);
  if (far < 10) bad.push(`it covered ${far} cells — it is not walking at all, so the limit proves nothing`);
  return bad.length ? bad.join('; ') : null;
});

/* On the floor of the box itself, which is the case every check here had missed.

   Every scene in this suite stands its worms on a stone floor six rows up, where there is
   always a real cell underneath them. Clear the box and tap, which is what anybody
   actually does, and they land on the last row of the grid — and a step needs footing
   ahead-and-below, which off the bottom of the grid `inb` refuses to grant. So they could
   not take a single step. Thirty seconds of sitting still, reported from the phone, with a
   full suite of passing checks behind it. */
await check(browser, 'worms walk on the floor of the box, not only on things put in it', () => {
  __wipe();                                   // deliberately no floor: the bare grid
  const cx = (W/2)|0;
  for (let k=0;k<12;k++) put(cx-30+k*5, H-1, WORM);
  const xs = () => { const o=[]; for (let i=0;i<type.length;i++) if (type[i]===WORM) o.push(i%W); return o; };
  const before = xs();
  const span0 = Math.max(...before) - Math.min(...before);
  for (let k=0;k<1800;k++) __step(1);
  const after = xs();
  if (after.length !== before.length) return `${before.length} worms on the box floor became ${after.length}`;
  const span1 = Math.max(...after) - Math.min(...after);
  if (span1 <= span0 + 4) return `they spanned ${span0} cells and after thirty seconds span ${span1} — nothing standing on the floor of the box is walking`;
  return null;
});

/* Wandering, as distinct from travelling, and the difference is the whole of whether it
   reads as a creature.

   Reported from the phone: they do not move around unless there is a flame. They were in
   fact moving the whole time — 163 cells in twenty seconds — but a worm kept whatever
   heading it started with until something got in the way, so it **turned exactly once**
   in those twenty seconds: off to the wall, back again. A thing that only ever slides one
   way does not look alive, and next to a panicking one it looks like heat is the only
   thing that moves them.

   So this counts changes of mind, not distance. Distance was never the problem. */
await check(browser, 'a worm with nothing wrong wanders rather than commuting', () => {
  const bad = [];
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-1, WORM);
  let last = cx, lastDir = 0, turns = 0, walked = 0;
  const seen = new Set([cx]);
  for (let k=0;k<1200;k++){                     // twenty seconds
    __step(1);
    let at = -1;
    for (let i=0;i<type.length;i++) if (type[i]===WORM) at = i;
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
   and cooked ten of the twelve worms, which says nothing about which way they ran. */
await check(browser, 'a worm runs away from heat rather than wandering into it', () => {
  const bad = [];
  const trial = (hotter) => {
    __wipe(); const f = __floor();
    const cx = (W/2)|0;
    put(cx, f-1, WORM);
    for (let k=0;k<120;k++){
      let at = -1;
      for (let i=0;i<type.length;i++) if (type[i]===WORM) at = i;
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
    for (let i=0;i<type.length;i++) if (type[i]===WORM) at = i;
    return at < 0 ? 'died' : (at % W) - cx;
  };
  const fromLeft = trial(-1), fromRight = trial(1);
  if (typeof fromLeft !== 'number' || fromLeft < 15) bad.push(`with the heat on its left it moved ${fromLeft} — it should be well to the right`);
  if (typeof fromRight !== 'number' || fromRight > -15) bad.push(`with the heat on its right it moved ${fromRight} — it should be well to the left`);

  // And it only panics when it is actually hot: cold, it should not be sprinting anywhere.
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-1, WORM);
  for (let k=0;k<120;k++) __step(1);
  let at = -1;
  for (let i=0;i<type.length;i++) if (type[i]===WORM) at = i;
  if (at >= 0 && Math.abs((at % W) - cx) > 40) bad.push(`a worm with nothing wrong covered ${Math.abs((at%W)-cx)} cells in 120 ticks`);
  return bad.length ? bad.join('; ') : null;
});

/* The argument for a creature being a cell, stated as a check: it dies of the things the
   box already does, and not one line of that is creature code. */
await check(browser, 'the box kills worms with what it already had', () => {
  const bad = [];
  const f0 = H-6;

  // Fire, through the same ignition it uses on straw, tested where it cannot run: walled
  // in on both sides with a lid over it. Holding a match near a worm that is free to leave
  // measures the running, not the burning.
  __wipe(); __floor();
  const bx = (W/2)|0;
  put(bx-1, f0-1, STONE); put(bx+1, f0-1, STONE); put(bx, f0-2, STONE);
  put(bx, f0-1, WORM);
  const ash0 = __count(ASH);
  __hold(bx, f0-1, 2, 150);
  for (let k=0;k<300;k++) __step(1);
  if (__count(WORM)) bad.push('a worm walled in with a match held on it did not burn');
  if (__count(ASH) <= ash0) bad.push('a burned worm left nothing behind');

  /* ...and given somewhere to run, most of them take it. Stated as survivors rather than
     as a death count on purpose: measured across five runs of the identical scene, deaths
     ranged from one to five, so a threshold on deaths sits on the noise. The claim worth
     making is that a fire at one end of a floor does not clear the floor. */
  __wipe(); __floor();
  __slab(6, f0-5, 26, f0-1, STRAW);
  for (let k=0;k<16;k++) put(28+k*5, f0-1, WORM);
  __hold(8, f0-2, 2, 40);
  for (let k=0;k<2400;k++) __step(1);
  if (__count(WORM) < 9) bad.push(`only ${__count(WORM)} of 16 got away from a fire at one end of the floor`);

  // The same floor with no fire on it, so the number above means something.
  __wipe(); __floor();
  for (let k=0;k<16;k++) put(34+k*5, f0-1, WORM);
  for (let k=0;k<2400;k++) __step(1);
  if (__count(WORM) !== 16) bad.push(`${16-__count(WORM)} worms died on a bare floor with nothing happening`);

  // Water, through a `meets` row — one line in the table, and it registers as a find.
  __wipe(); __floor();
  for (let k=0;k<10;k++) put(40+k*2, f0-1, WORM);
  const wet0 = __count(WORM);
  __slab(38, f0-4, 60, f0-2, WATER);
  for (let k=0;k<600;k++) __step(1);
  if (__count(WORM) > wet0*0.2) bad.push(`${__count(WORM)} of ${wet0} worms survived being poured on`);
  if (![...finds].some(k => k.startsWith(WORM + ':drown'))) bad.push('drowning did not register as a discovery');

  // Acid, because acid eats cells and a worm is a cell.
  __wipe(); __floor();
  for (let k=0;k<10;k++) put(40+k*2, f0-1, WORM);
  const acid0 = __count(WORM);
  __slab(38, f0-4, 60, f0-2, ACID);
  for (let k=0;k<900;k++) __step(1);
  if (__count(WORM) >= acid0) bad.push(`acid poured over ${acid0} worms left ${__count(WORM)}`);
  return bad.length ? bad.join('; ') : null;
});

/* This asked for the single deepest point the moth ever reached in fifteen seconds, and
   failed if that was ever the floor. It is one moth on a random walk against an absolute
   bar, which is the shape of every flaky check this suite has had: measured over forty
   runs the deepest point has a median of row 88 and a maximum of 200 against a bar of
   212, so it passes — and then a full-suite run turned up a 213 and failed on a moth that
   had brushed the ground once and flown off again, which is flying.

   What the check is actually about is whether the moth *stays* up, so it measures the
   share of its time spent in the bottom eight rows. Moth: 0.000 across all forty runs.
   The control is a grain of sand dropped from the same place — something that cannot fly
   by construction — which scores 0.88 and bottoms out at row 213 every single time. */
await check(browser, 'a moth flies, and does not fall out of the air', () => {
  __wipe(); __floor();
  const cx = (W/2)|0;
  put(cx, 40, MOTH);
  const at = () => { for (let i=0;i<type.length;i++) if (type[i]===MOTH) return [i%W,(i/W)|0]; return null; };
  let onFloor = 0, moved = 0, last = at();
  for (let k=0;k<900;k++){
    __step(1);
    const p = at(); if (!p) return 'it died in an empty box';
    if (p[0]!==last[0] || p[1]!==last[1]) moved++;
    if (p[1] >= H-8) onFloor++;
    last = p;
  }
  if (!moved) return 'it never moved at all';
  const grounded = onFloor / 900;
  if (grounded > 0.15)
    return `it spent ${(grounded*100).toFixed(0)}% of fifteen seconds on the floor — a grain of sand scores 88%`;
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
    // Within sight of the candle, which is a real limit now: a moth sees a light 60 cells
    // off and no further, because with no limit every moth in the box steers at the only
    // flame in it and two hundred of them arrive as a queue rather than a swarm.
    for (let k=0;k<12;k++) put(44+k*3, f-42, MOTH);
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
  /* The difference between the two rooms, and nothing about the lit one on its own.

     There used to be a second bar here — no more than three of twelve may survive the candle
     — and it was the same mistake as the ants and the worms in a third costume: an absolute
     threshold on a small count from a dice roll. Measured twelve times across two builds it
     came out 0 to 2, which looks like a comfortable margin against a bar of three, and then a
     full run turned up a 4 and went red on a build that had never touched moths.

     It also added nothing. The claim is that a flame is what kills them, and a claim about a
     difference is answered by the difference: twelve survive the dark room in every run ever
     measured, and the gap has come out 8 to 12. A build where moths ignored the flame, or one
     where they died of something else, moves the gap and not the absolute. */
  if (dark.left - lit.left < 6)
    bad.push(`a lit candle killed ${12-lit.left} and an unlit one killed ${12-dark.left} — that is not attraction`);
  return bad.length ? bad.join('; ') : null;
});

/* A swarm round a candle is a swarm, not a queue.

   Reported from the phone with pictures: two hundred moths over a lit candle collapsed
   into a solid vertical line above the wick and then burned upward like a fuse. Nothing
   was watching the *shape* of them, only how many were alive and roughly where, so every
   check passed on the build that did it.

   Measured on the reported scene, worst shape at any point: unlimited sight gave 14 cells
   wide by 110 tall with 39% of them stacked directly on another moth. The fix was not the
   steering but the premise — a moth sees a light near it, rather than every moth in the
   box steering at the only flame in it. */
await check(browser, 'a crowd of moths round one candle is a cloud, not a column', () => {
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  __slab(cx-3, f-16, cx+2, f-1, WAX);
  for (let y=f-22; y<f-14; y++) put(cx, y, FUSE);
  const t0 = tool, b0 = brush; tool = MOTH; brush = 3;
  for (let k=0;k<70;k++) paintAt(8 + ((k*13) % (W-16)), 12 + ((k*29) % 90));
  tool = t0; brush = b0;
  const placed = __count(MOTH);
  if (placed < 80) return `only ${placed} moths went in, so this is not a crowd`;

  __hold(cx, f-21, 2, 120);
  let worst = 0, worstAt = null, worstStack = 0;
  for (let k=0;k<1800;k++){
    __step(1);
    if (k % 60) continue;
    const o = [];
    for (let i=0;i<type.length;i++) if (type[i]===MOTH) o.push([i%W, (i/W)|0]);
    if (o.length < 20) continue;
    const xs = o.map(p=>p[0]), ys = o.map(p=>p[1]);
    const wide = Math.max(...xs)-Math.min(...xs)+1, tall = Math.max(...ys)-Math.min(...ys)+1;
    const set = new Set(o.map(p => p[1]*W + p[0]));
    let stacked = 0;
    for (const [x,y] of o) if (set.has((y-1)*W+x) || set.has((y+1)*W+x)) stacked++;
    const pct = Math.round(100*stacked/o.length);
    if (tall/wide > worst){ worst = tall/wide; worstAt = `${wide} wide by ${tall} tall`; worstStack = pct; }
  }
  if (worst > 4) return `they got to ${worstAt} (${worst.toFixed(1)} times taller than wide, ${worstStack}% stacked) — that is a queue`;
  if (worstStack > 25) return `${worstStack}% of them were stacked directly on another moth at ${worstAt}`;
  return null;
});

await check(browser, 'the box kills moths with what it already had', () => {
  const bad = [];
  const f0 = H-6;
  // Fire, walled in so it cannot fly off — the same shape of test the worm gets.
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

  /* Water, which takes a moment now rather than firing on contact, so the scene has to
     hold them in it: a sealed tank, and the moths placed into the water last.
     Two ways this scene has been wrong before. Slabbing water *across* standing moths
     deleted them outright — `put` replaces whatever is in the cell — which measured as ten
     dead moths and no discovery and looked exactly like the rule being broken. Then three
     water cells dabbed around each moth measured as ten *survivors*, because the water ran
     off down the floor within a tick and the moths simply flew away from it. */
  __wipe(); __floor();
  const tx = (W/2)|0;
  __slab(tx-16, f0-12, tx+16, f0-1, WATER);
  __slab(tx-17, f0-13, tx+17, f0-13, STONE);
  __slab(tx-17, f0-12, tx-17, f0-1, STONE);
  __slab(tx+17, f0-12, tx+17, f0-1, STONE);
  let wet0 = 0;
  for (let k=0;k<10;k++){ put(tx-14 + k*3, f0-6, MOTH); wet0++; }
  for (let k=0;k<600;k++) __step(1);
  if (__count(MOTH) > wet0*0.3) bad.push(`${__count(MOTH)} of ${wet0} moths survived being sealed into water`);
  if (![...finds].some(k => k.startsWith(MOTH + ':drown'))) bad.push('drowning did not register as a discovery');
  return bad.length ? bad.join('; ') : null;
});

// Moths are the expensive ones: each looks at every beacon in the box, and the beacons
// themselves are a full pass over the grid. Both are bounded — one pass however many
// moths there are, and the beacons are capped by dicing the box into blocks — but bounded
// is a claim and this is the measurement.
/* A fish lives inside a material rather than on top of one, which is the whole of what it
   adds — and the boundary is where that goes wrong, so the check is about the boundary. */
await check(browser, 'fish stay in the water, and spread through it', () => {
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  __slab(cx-30, f-26, cx-30, f-1, GLASS);
  __slab(cx+29, f-26, cx+29, f-1, GLASS);
  __slab(cx-29, f-24, cx+28, f-1, WATER);
  for (let k=0;k<12;k++) put(cx-24+k*4, f-12, FISH);
  const n0 = __count(FISH);
  const spread = () => {
    const o=[]; for (let i=0;i<type.length;i++) if (type[i]===FISH) o.push([i%W,(i/W)|0]);
    if (!o.length) return { n:0, tall:0 };
    const ys = o.map(p=>p[1]);
    return { n:o.length, tall: Math.max(...ys)-Math.min(...ys)+1 };
  };
  if (spread().tall !== 1) return 'they did not start in a line, so spreading proves nothing';
  for (let k=0;k<2400;k++) __step(1);
  const now = spread();
  if (now.n !== n0) return `${n0} fish in a sealed tank became ${now.n}`;
  if (now.tall < 8) return `they spread over ${now.tall} rows of a 24-row tank — they are not using it`;
  // ...and not one of them out in the air. A fish that can leave the water is not a fish.
  let dry = 0;
  for (let i=0;i<type.length;i++){
    if (type[i] !== FISH) continue;
    const x = i%W, y = (i/W)|0;
    let wet = 0;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])
      if (inb(x+dx,y+dy) && type[idx(x+dx,y+dy)]===WATER) wet++;
    if (!wet) dry++;
  }
  if (dry) return `${dry} fish ended up with no water touching them inside a full tank`;
  return null;
});

await check(browser, 'a fish out of water dies, and one in it does not', () => {
  const bad = [];
  __wipe(); const f = __floor();
  const cx = (W/2)|0;
  put(cx, f-1, FISH);
  let died = -1;
  for (let k=1;k<=900;k++){ __step(1); if (!__count(FISH)){ died = k; break; } }
  if (died < 0) bad.push('a fish left on dry stone was still alive after fifteen seconds');
  else if (died < 60) bad.push(`it died after ${died} ticks — that is not flopping, that is vanishing`);

  __wipe(); __floor();
  __slab(cx-10, f-10, cx+10, f-1, WATER);
  put(cx, f-5, FISH);
  for (let k=0;k<900;k++) __step(1);
  if (!__count(FISH)) bad.push('a fish in a pool of water died anyway');
  return bad.length ? bad.join('; ') : null;
});

/* The room dial is what a fish is really for, and neither of these needed a rule written
   for it. Hot water kills before it boils; a frozen tank kills because there is no water
   left to be in, which is the same clock as being dropped on the floor. */
await check(browser, 'the room can kill a tank of fish, hot or cold', () => {
  const bad = [];
  const tank = () => {
    __wipe(); const f = __floor();
    const cx = (W/2)|0;
    __slab(cx-11, f-12, cx-11, f-1, GLASS);
    __slab(cx+10, f-12, cx+10, f-1, GLASS);
    __slab(cx-10, f-10, cx+9, f-1, WATER);
    for (let k=0;k<8;k++) put(cx-8+k*2, f-5, FISH);
    return __count(FISH);
  };
  const setRoomTo = __room;      // its own copy of this once, which is one too many

  setRoomTo('Normal');
  const n0 = tank();
  for (let k=0;k<3600;k++) __step(1);
  if (__count(FISH) !== n0) bad.push(`${n0-__count(FISH)} of ${n0} fish died in a tank at room temperature`);

  setRoomTo('Normal'); tank(); setRoomTo('Oven');
  for (let k=0;k<3600;k++) __step(1);
  if (__count(FISH)) bad.push(`${__count(FISH)} fish survived an oven`);

  setRoomTo('Normal'); tank(); setRoomTo('Freezing');
  for (let k=0;k<6000;k++) __step(1);
  if (__count(FISH)) bad.push(`${__count(FISH)} fish survived a tank that froze solid`);
  if (__count(WATER)) bad.push(`the tank did not actually freeze — ${__count(WATER)} cells of water left`);

  setRoomTo('Normal');
  return bad.length ? bad.join('; ') : null;
});

/* Dying takes a moment, for all three of them, and that is the point of this check.

   Drowning used to be a `meets` row, which fires the instant two cells touch — so a worm
   that so much as brushed the surface of a puddle was gone with nothing to see, and a
   stranded fish lay perfectly still for three and a half seconds and then vanished.
   Reported from the phone as wanting a few seconds and some flapping, which is right: a
   creature is worth a moment. */
await check(browser, 'a creature somewhere it cannot live takes a moment about it', () => {
  const bad = [];
  const f = H-6, cx = (W/2)|0;

  // A stranded fish throws itself about rather than lying there.
  __wipe(); __floor();
  put(cx, f-1, FISH);
  let hops = 0, died = -1, last = null;
  const seen = new Set();
  for (let k=1;k<=900;k++){
    __step(1);
    let at = -1;
    for (let i=0;i<type.length;i++) if (type[i]===FISH) at = i;
    if (at < 0){ died = k; break; }
    const p = [at % W, (at / W) | 0];
    if (last && (p[0]!==last[0] || p[1]!==last[1])) hops++;
    seen.add(p[0] + ',' + p[1]);
    last = p;
  }
  if (died < 60) bad.push(`a stranded fish was gone in ${died} ticks`);
  if (died < 0) bad.push('a stranded fish never died at all');
  if (hops < 10) bad.push(`it moved ${hops} times in ${died} ticks — a fish on a floor flops, it does not lie still`);
  if (seen.size < 3) bad.push(`it flopped within ${seen.size} cells, which is twitching rather than flopping`);

  /* A worm and a moth in water last long enough to watch, and not the same length of time.
     The tank has a lid on purpose. A four-deep puddle measured as "a worm never drowns",
     because the worm walked up to the surface, drew a breath and started the clock again —
     which is the creature being sensible, not the rule being broken, and the scene not
     testing what it said it was. Sealed, there is nowhere to surface to. */
  const under = (t) => {
    __wipe(); const ff = __floor();
    __slab(cx-20, ff-10, cx+20, ff-1, WATER);
    __slab(cx-21, ff-11, cx+21, ff-11, STONE);              // lid
    __slab(cx-21, ff-10, cx-21, ff-1, STONE);               // and walls, so it stays a tank
    __slab(cx+21, ff-10, cx+21, ff-1, STONE);
    put(cx, ff-5, t);
    for (let k=1;k<=1200;k++){ __step(1); if (!__count(t)) return k; }
    return -1;
  };
  const worm = under(WORM), moth = under(MOTH);
  for (const [n, ticks] of [['A worm', worm], ['A moth', moth]]){
    if (ticks < 0) bad.push(`${n} held under water never drowned`);
    else if (ticks < 45) bad.push(`${n} was gone in ${ticks} ticks — that is instant, not drowning`);
  }
  if (worm > 0 && moth > 0 && worm <= moth) bad.push(`a worm lasted ${worm} ticks and a moth ${moth} — the flimsier one should go first`);

  // ...and brushing past water is not a death sentence.
  __wipe(); const f2 = __floor();
  __slab(cx-20, f2-2, cx+20, f2-1, WATER);
  for (let k=0;k<10;k++) put(cx+22+k*3, f2-3, WORM);
  for (let k=0;k<1800;k++) __step(1);
  if (__count(WORM) < 4) bad.push(`${10-__count(WORM)} of 10 worms wandering beside a shallow puddle died in it`);
  return bad.length ? bad.join('; ') : null;
});

/* Reported from the phone with pictures, and the only reason the drowning clock looked
   broken: eighty-four worms tipped into a tank sat in a neat pink raft on the surface and
   stayed there. `footing` counted anything that was not a gas, so water was something to
   stand on — and a worm standing on top of water never has water above it, so it never
   started drowning. Nothing here was visible by reading either half. */
await check(browser, 'a worm tipped into a pond goes under it rather than standing on it', () => {
  const bad = [];
  const cx = (W/2)|0;

  __wipe(); const f = __floor();
  __slab(cx-24, f-60, cx-24, f-1, GLASS);            // a tank, so it cannot run away
  __slab(cx+24, f-60, cx+24, f-1, GLASS);
  __slab(cx-23, f-56, cx+23, f-1, WATER);
  for (let y=0;y<6;y++) for (let x=cx-20;x<=cx+20;x+=3) put(x, f-62-y*2, WORM);
  const n = __count(WORM);
  if (n < 60) return `the scene only placed ${n} worms, so it is not the reported one`;
  for (let k=0;k<1200;k++) __step(1);
  if (__count(WORM)) bad.push(`${__count(WORM)} of ${n} worms were still afloat after twenty seconds`);

  // A film you can stand in the bottom of is a puddle to wade, not a drowning. Without
  // this, "worms sink" is satisfied by making all water lethal on contact again.
  __wipe(); const f2 = __floor();
  __slab(cx-20, f2-1, cx+20, f2-1, WATER);
  for (let k=0;k<10;k++) put(cx+22+k*3, f2-2, WORM);
  for (let k=0;k<1800;k++) __step(1);
  if (__count(WORM) < 8) bad.push(`${10-__count(WORM)} of 10 worms drowned wading a one-cell film of water`);

  /* ...and it goes down slowly. Also reported from the phone: once they sank, they sank at
     exactly the speed they fell through air, so the water may as well not have been there.
     A ratio rather than an absolute, because the absolute is a tuning number and the thing
     that has to hold is that a pool slows a creature the way it slows a grain. */
  const rate = (wet, n) => {
    __wipe(); const f = __floor();
    if (wet) __slab(cx-10, f-70, cx+10, f-1, WATER);
    put(cx, f-68, WORM);
    let at = -1;
    for (let i=0;i<type.length;i++) if (type[i]===WORM) at = i;
    const y0 = (at/W)|0;
    for (let k=0;k<n;k++) __step(1);
    at = -1;
    for (let i=0;i<type.length;i++) if (type[i]===WORM) at = i;
    if (at < 0) return null;                       // drowned inside the window
    return ((((at/W)|0) - y0)) / n;                // parenthesised: `|` binds looser than `-`
  };
  const air = rate(false, 20), wet = rate(true, 60);
  if (air === null || wet === null) bad.push('the fall-rate scene lost its worm before it could be timed');
  else {
    if (air < 0.9) bad.push(`a worm falls ${air.toFixed(2)} cells a tick through open air, which is not falling`);
    if (wet > air / 2.5) bad.push(`it sinks at ${wet.toFixed(2)} cells a tick against ${air.toFixed(2)} in air — the water is not slowing it`);
    if (wet < air / 12) bad.push(`it sinks at ${wet.toFixed(2)} cells a tick, which is hanging in the water rather than sinking through it`);
  }
  return bad.length ? bad.join('; ') : null;
});

/* You could build above a tank and never in one. `paintCell` wrote into empty cells and gas
   and nothing else, so a fish had to be dropped in from the top and a weight could not be
   put on the bottom of a pool — while the falling pass displaced that same water all day.
   A liquid gets out of the way of everything else in this box; the brush was the exception. */
await check(browser, 'the brush reaches into a tank, and still not through a wall', () => {
  const bad = [];
  const cx = (W/2)|0;
  /* Three taps, and a floor of three cells rather than one.

     A creature's brush is `sparse` — a fish lays down about one cell in seven of what it
     covers, because thirty fish in a heap is one lump and not thirty fish. One tap of a
     brush-3 disc is twenty-nine chances at 0.14, which comes up empty about once in seventy
     runs, and this check asked for at least one cell. It duly failed a full suite run with
     "a fish could not be placed inside a tank of water" on a build where the brush was
     perfect. An implicit bar of *at least one* on a sparse brush is the same fault as an
     absolute bar on a small count, which this file has now met five times. */
  const into = (t) => {
    __wipe(); const f = __floor();
    __slab(cx-20, f-30, cx+20, f-1, WATER);
    const before = __count(t);
    const t0 = tool, b0 = brush;
    tool = t; brush = 3;
    paintAt(cx-8, f-15); paintAt(cx, f-15); paintAt(cx+8, f-15);
    tool = t0; brush = b0;
    return __count(t) - before;
  };
  for (const [n, t] of [['a fish', FISH], ['sand', SAND], ['a worm', WORM]]){
    // Counted once. Calling it again inside the message re-runs the whole scene and prints a
    // number that is not the one that failed.
    const got = into(t);
    if (got < 3) bad.push(`three taps put ${got} cells of ${n} inside a tank of water`);
  }

  // The other half. Solids and powders still refuse, or the brush quietly becomes an
  // eraser and every wall in every scene is one stray thumb from a hole in it.
  __wipe(); __floor();
  __slab(cx-4, 20, cx+4, 40, STONE);
  const stone0 = __count(STONE);
  const t0 = tool, b0 = brush;
  tool = SAND; brush = 2; paintAt(cx, 30); tool = t0; brush = b0;
  if (__count(STONE) < stone0) bad.push(`the brush ate ${stone0 - __count(STONE)} cells of a stone wall`);
  return bad.length ? bad.join('; ') : null;
});

/* The fourth creature, and the first that takes material out of the box rather than
   reacting to it. What it leaves behind is the point — a log with galleries cut through it
   is a different thing to burn — so the shape of the hole is what this measures, not the
   count. A grub that ate a neat sphere out of the middle would satisfy "it eats wood". */
await check(browser, 'a grub cuts galleries through a log rather than a crater in it', () => {
  const bad = [];
  const cx = (W/2)|0;
  /* Grubs, pupae and moths together, because a grub that has eaten thirty cells is not a
     grub any more. Counting `GRUB` alone was right for exactly one day and then reported
     "8 of 8 grubs ate each other" about eight grubs that had simply grown up. */
  const living = () => __count(GRUB) + __count(PUPA) + __count(MOTH);
  const gnaw = (n, ticks) => {
    __wipe(); const f = __floor();
    __slab(cx-20, f-30, cx+20, f-1, WOOD);
    const w0 = __count(WOOD);
    for (let k=0;k<n;k++) put(cx-18+k*3, f-15, GRUB);
    for (let k=0;k<ticks;k++) __step(1);
    let x1=1e9,x2=-1e9,y1=1e9,y2=-1e9,holes=0;
    for (let y=f-30;y<=f-1;y++) for (let x=cx-20;x<=cx+20;x++)
      if (type[idx(x,y)] === E){ holes++; if(x<x1)x1=x; if(x>x2)x2=x; if(y<y1)y1=y; if(y>y2)y2=y; }
    return { eaten: w0 - __count(WOOD), alive: living(), holes,
             reach: holes ? Math.max(x2-x1+1, y2-y1+1) : 0 };
  };

  const one = gnaw(1, 1800);
  if (one.eaten < 12) bad.push(`one grub ate ${one.eaten} cells of a log in thirty seconds`);
  if (one.alive !== 1) bad.push(`one grub in a log became ${one.alive} living things`);
  /* A compact blob of area A spans about sqrt(A). A tunnel spans far more than that, and
     the ratio is the only way to say "gallery" rather than "hole" in a number. Measured at
     46 cells across 20 rows, which is 2.9× — the threshold is well under that on purpose,
     because the path is a random walk and a short one can double back on itself. */
  if (one.reach < 1.6 * Math.sqrt(one.holes))
    bad.push(`${one.holes} cells eaten reaching ${one.reach} — that is a crater, not a gallery`);

  /* The floor is read off the table, and it has to be, because four grubs cannot eat more
     than four times `pupa` before they stop being grubs — 4 × 30 = 120. The bar used to be
     the literal 120, which is the cap itself: measured twelve times on two builds it comes
     out at exactly 124 every run, so the check was passing on a four-cell margin over a
     number it could never exceed, and one run at 117 failed it. Three quarters of the cap
     leaves room and still catches a grub that has stopped eating. */
  const four = gnaw(4, 3600);
  const cap = 4 * M[GRUB].pupa;
  if (four.eaten < cap * 0.75)
    bad.push(`four grubs ate ${four.eaten} cells of a log in a minute, against a pupation cap of ${cap}`);
  if (four.eaten > 900) bad.push(`four grubs ate ${four.eaten} of a 1230-cell log in a minute — that is not a log any more`);

  /* It eats what would burn and nothing else, which is a property of the *food's* row
     rather than a list here. Stone, steel and glass are the ones that must survive it, and
     so must the other creatures — a grub that ate worms would be a population rule, and the
     population is meant to be whatever you put in the box. */
  for (const t of [STONE, STEEL, GLASS, OBSIDIAN, SAND]){
    __wipe(); const f = __floor();
    __slab(cx-14, f-20, cx+14, f-1, t);
    for (let k=0;k<6;k++) put(cx-8+k*3, f-10, GRUB);
    // After the grubs are placed, not before: `put` replaces the cell it lands in, so a
    // baseline taken first reports six cells eaten before a single tick has run — which is
    // exactly what it did, identically, for all five materials.
    const n0 = __count(t);
    for (let k=0;k<3000;k++) __step(1);
    if (__count(t) < n0) bad.push(`grubs ate ${n0 - __count(t)} cells of ${M[t].n}`);
  }
  __wipe(); const f = __floor();
  __slab(cx-14, f-20, cx+14, f-1, WOOD);
  for (let k=0;k<8;k++) put(cx-10+k*2, f-10, WORM);
  for (let k=0;k<8;k++) put(cx-10+k*2, f-12, GRUB);
  const bugs0 = __count(WORM), grubs0 = living();
  for (let k=0;k<3000;k++) __step(1);
  if (__count(WORM) < bugs0) bad.push(`${bugs0 - __count(WORM)} of ${bugs0} worms were eaten by the grubs beside them`);
  if (living() < grubs0) bad.push(`${grubs0 - living()} of ${grubs0} grubs ate each other`);

  // Out of the wood it is a creature like the others: it crawls, and it burns.
  __wipe(); const f2 = __floor();
  put(cx, f2-1, GRUB);
  const seen = new Set();
  for (let k=0;k<1200;k++){ __step(1); for (let i=0;i<type.length;i++) if (type[i]===GRUB) seen.add(i%W); }
  if (seen.size < 4) bad.push(`a grub on a bare floor visited ${seen.size} columns in twenty seconds — it is not crawling`);

  __wipe(); const f3 = __floor();
  __slab(cx-20, f3-20, cx+20, f3-1, WOOD);
  for (let k=0;k<8;k++) put(cx-10+k*3, f3-10, GRUB);
  const lit0 = living();
  __hold(cx, f3-21, 2, 250);
  for (let k=0;k<2500;k++) __step(1);
  // Living things of any stage: a grub that pupated and hatched on the way is still alive,
  // and counting grubs alone would have called that a death.
  if (living() > lit0 * 0.3) bad.push(`${living()} of ${lit0} grubs sat out a burning log`);
  if (![...finds].some(k => k.startsWith(GRUB + ':chew'))) bad.push('eating a log did not register as a discovery');
  return bad.length ? bad.join('; ') : null;
});

/* The grub and the moth turn out to be the same animal at two ages. Thirty cells eaten and
   it seals itself up; five seconds later a moth comes out and goes looking for a flame.

   The claim that matters is not that it happens but that it happens *once per grub*: the box
   has no way to make a creature, and this must not become one. So this counts the sum of
   the three forms rather than any one of them. */
await check(browser, 'a grub that has eaten enough becomes a pupa, and a pupa becomes a moth', () => {
  const bad = [];
  const cx = (W/2)|0;

  __wipe(); let f = __floor();
  __slab(cx-24, f-40, cx+24, f-1, WOOD);
  put(cx, f-20, GRUB);
  let pupatedAt = -1, hatchedAt = -1, most = 0;
  for (let k=1;k<=4000;k++){
    __step(1);
    const g = __count(GRUB), p = __count(PUPA), m = __count(MOTH);
    if (p && pupatedAt < 0) pupatedAt = k;
    if (m && hatchedAt < 0) hatchedAt = k;
    if (g + p + m > most) most = g + p + m;
    if (hatchedAt > 0) break;
  }
  if (pupatedAt < 0) bad.push('a grub left in a log for a minute never pupated');
  if (hatchedAt < 0) bad.push('nothing came out of the pupa');
  if (most > 1) bad.push(`one grub was ${most} living things at once`);
  // The hatch is a fixed clock, so it is worth stating rather than bounding loosely.
  if (pupatedAt > 0 && hatchedAt > 0 && Math.abs((hatchedAt - pupatedAt) - M[PUPA].hatch) > 3)
    bad.push(`the pupa took ${hatchedAt - pupatedAt} ticks to open against a hatch of ${M[PUPA].hatch}`);

  // Six in, six out. Not five, and emphatically not seven.
  __wipe(); f = __floor();
  __slab(cx-24, f-40, cx+24, f-1, WOOD);
  for (let k=0;k<6;k++) put(cx-15+k*6, f-20, GRUB);
  const n0 = __count(GRUB);
  for (let k=0;k<8000;k++) __step(1);
  const sum = __count(GRUB) + __count(PUPA) + __count(MOTH);
  if (sum !== n0) bad.push(`${n0} grubs became ${sum} living things — ${__count(GRUB)} grubs, ${__count(PUPA)} pupae, ${__count(MOTH)} moths`);
  if (!__count(MOTH)) bad.push(`${n0} grubs in a log for two minutes produced no moths at all`);

  // A grub with nothing to eat is a grub forever. Pupation is a reward for the tunnelling,
  // not a timer, and a timer would look identical for the first half-minute.
  __wipe(); f = __floor();
  for (let k=0;k<6;k++) put(cx-8+k*3, f-1, GRUB);
  const bare = __count(GRUB);
  for (let k=0;k<4000;k++) __step(1);
  if (__count(GRUB) !== bare) bad.push(`${bare} grubs on a bare floor became ${__count(GRUB)} — they pupated with nothing to eat`);
  if (__count(PUPA) || __count(MOTH)) bad.push('a grub that ate nothing still turned into something');

  // A sealed grub is the most helpless thing in the box, and must read that way.
  const kill = (how) => {
    __wipe(); const ff = __floor();
    __slab(cx-10, ff-12, cx+10, ff-1, how === 'fire' ? WOOD : E);
    for (let k=0;k<6;k++) put(cx-6+k*2, ff-6, PUPA);
    const p0 = __count(PUPA);
    if (how === 'fire') __hold(cx, ff-13, 2, 200);
    else __slab(cx-10, ff-10, cx+10, ff-1, WATER);
    for (let k=0;k<900;k++) __step(1);
    return { p0, left: __count(PUPA), moths: __count(MOTH) };
  };
  for (const how of ['fire', 'water']){
    const r = kill(how);
    if (r.left) bad.push(`${r.left} of ${r.p0} pupae survived ${how}`);
    if (r.moths) bad.push(`${r.moths} moths hatched out of pupae killed by ${how}`);
  }

  /* And grubs do not eat them, which is the reason `alive` exists as a field. It used to be
     `!M[t].sparse` — the same answer by accident, because every creature came out of a
     brush and so had a `sparse`. A pupa is made rather than placed and has none. */
  __wipe(); f = __floor();
  __slab(cx-14, f-16, cx+14, f-1, WOOD);
  for (let k=0;k<6;k++) put(cx-8+k*3, f-8, PUPA);
  for (let k=0;k<6;k++) put(cx-8+k*3, f-10, GRUB);
  const p0 = __count(PUPA);
  for (let k=0;k<250;k++) __step(1);      // short of the hatch clock, so any loss is teeth
  if (__count(PUPA) < p0) bad.push(`grubs ate ${p0 - __count(PUPA)} of ${p0} pupae beside them`);

  for (const t of [GRUB, PUPA])
    if (![...finds].some(k => k === t + ':becomes'))
      bad.push(`${M[t].n} turning into ${M[M[t].becomes].n} did not register as a discovery`);
  return bad.length ? bad.join('; ') : null;
});

/* Every fire in this box left a floor of ash and embers that nothing ever touched again.
   Measured before this existed: a scene with a log, a pond and one tap of each creature
   stopped changing after sixty seconds, and the ash from the first minute was still sitting
   there at three. An ash bug eats it.

   The claim worth checking is not that it eats ash — that is one line — but that it eats
   *what fire leaves* and nothing else, and that the list is derived rather than typed. */
await check(browser, 'an ash bug clears what a fire left, and only that', () => {
  const bad = [];
  const cx = (W/2)|0;

  const menu = [...LEFTOVER].map(t => M[t].n).sort().join(', ');
  if (menu !== 'Ash, Ember') bad.push(`the leftovers came out as "${menu}"`);
  // The three that must not be on it, and why each one is a different mistake: nothing at
  // all, a gas that is already gone, and thermite burning down to molten steel.
  for (const t of [E, SMOKE, MOLTEN])
    if (LEFTOVER.has(t)) bad.push(`${M[t].n} counts as something fire left behind`);

  // A cold ash field, and four of them, which is about one tap.
  __wipe(); let f = __floor();
  __slab(cx-25, f-6, cx+25, f-1, ASH);
  const a0 = __count(ASH);
  for (let k=0;k<4;k++) put(cx-15+k*6, f-7, ASHBUG);
  for (let k=0;k<3600;k++) __step(1);
  if (__count(ASH) > a0 * 0.15) bad.push(`four ash bugs left ${__count(ASH)} of ${a0} cells of ash after a minute`);
  if (__count(ASHBUG) !== 4) bad.push(`four ash bugs on cold ash became ${__count(ASHBUG)}`);

  // ...and everything that is not leftovers survives them.
  for (const t of [STONE, WOOD, SAND, COAL, STRAW]){
    __wipe(); f = __floor();
    __slab(cx-14, f-12, cx+14, f-1, t);
    for (let k=0;k<6;k++) put(cx-8+k*3, f-13, ASHBUG);
    const n0 = __count(t);
    for (let k=0;k<3000;k++) __step(1);
    if (__count(t) < n0) bad.push(`ash bugs ate ${n0 - __count(t)} cells of ${M[t].n}`);
  }

  /* The whole of the design, and none of it is written for it: an ember is hot, so a
     ash bug walking into a fresh burn panics and leaves on the worm's own machinery, and
     burns if it stays. It can only clear a fire once the fire has gone out. Two scenes, the
     same in every way but when the ash bugs arrive. */
  const sendIn = (wait) => {
    __wipe(); const ff = __floor();
    __slab(cx-20, ff-24, cx+20, ff-1, WOOD);
    __hold(cx, ff-25, 2, 250);
    for (let k=0;k<wait;k++) __step(1);
    const debris = __count(ASH) + __count(EMBER), hot = Math.round(__maxT());
    for (let k=0;k<8;k++) put(cx-10+k*3, ff-26, ASHBUG);
    for (let k=0;k<3600;k++) __step(1);
    return { hot, debris, lice: __count(ASHBUG), after: __count(ASH) + __count(EMBER) };
  };
  const early = sendIn(1800), late = sendIn(12000);
  if (early.lice > 2) bad.push(`${early.lice} of 8 ash bugs walked into a burn at ${early.hot}°C and lived`);
  if (early.after < early.debris) bad.push('ash bugs cleared a fire that was still going');
  if (late.lice < 6) bad.push(`only ${late.lice} of 8 survived a burn that had cooled to ${late.hot}°C`);
  if (late.after > late.debris * 0.4)
    bad.push(`they left ${late.after} of ${late.debris} cells of a cold burn after a minute`);

  if (![...finds].some(k => k === ASHBUG + ':graze')) bad.push('clearing up did not register as a discovery');
  return bad.length ? bad.join('; ') : null;
});

/* Eating debris and *looking* for debris are two different verbs, and for a day only one of
   them was written: reported from the phone as "they don't seem to seek the ash, or look
   like they do at least". They walked a worm's walk and ate whatever they bumped into.

   Both sides, and against a worm in the identical scene. One side alone passes on a creature
   that simply drifts one way — which is exactly what the first fix did, and it measured as
   working because the pile happened to be on the side it drifted toward. */
await check(browser, 'an ash bug goes to the ash rather than stumbling into it', () => {
  const bad = [];
  const mid = (t) => { let s=0,n=0; for (let i=0;i<type.length;i++) if (type[i]===t){ s+=i%W; n++; }
                       return n ? s/n : null; };
  const towards = (t, where) => {
    __wipe(); const f = __floor();
    if (where < 0) __slab(4, f-6, 28, f-1, ASH);
    else           __slab(W-29, f-6, W-5, f-1, ASH);
    for (let k=0;k<8;k++) put(((W/2)|0)-8+k*2, f-1, t);
    const start = mid(t);
    for (let k=0;k<2400;k++) __step(1);
    const end = mid(t);
    if (end === null) return null;
    return { moved: end - start, left: __count(t) };
  };
  const gain = {};
  for (const t of [ASHBUG, WORM]){
    let sum = 0;
    for (const where of [-1, 1]){
      const r = towards(t, where);
      if (!r){ bad.push(`the ${M[t].n.toLowerCase()}s all died on the way`); sum = null; break; }
      const toward = r.moved * where;                  // + is toward the pile, whichever side
      if (t === ASHBUG && toward < 15)
        bad.push(`ash on the ${where < 0 ? 'left' : 'right'} and the ash bugs moved ${Math.round(toward)} cells toward it — they are not looking for it`);
      sum += toward;
    }
    if (sum !== null) gain[t] = sum / 2;
  }
  /* Averaging the two sides is the point of running both. A random walk drifts, and one run
     of a worm drifted 35 cells — enough to beat the ash bug's 31 on that side and fail a
     comparison of magnitudes. Signed toward-the-pile and averaged, the drift cancels and
     only the seeking survives: measured 39 for an ash bug against 2 for a worm. */
  if (gain[ASHBUG] !== undefined && gain[WORM] !== undefined && gain[ASHBUG] < gain[WORM] + 12)
    bad.push(`ash bugs closed ${Math.round(gain[ASHBUG])} cells on the ash and worms closed ${Math.round(gain[WORM])} — that is the same walk`);
  return bad.length ? bad.join('; ') : null;
});

/* The rule is two lines and the behaviour is in neither of them: an ant lifts a grain more
   readily the fewer of its kind are around it, and puts one down more readily the more there
   are. Nothing says where a heap should be, or that heaps are wanted.

   So the check cannot look for heaps in particular places. It measures how clumped the
   grains are — the mean number of same-kind neighbours per grain — and compares the same
   scene with and without ants, because sand piles under gravity on its own and a bare
   "it ended up clumped" would be measuring gravity. */
await check(browser, 'ants gather scattered grains into heaps, and sort two kinds apart', () => {
  const bad = [];
  const clump = (t) => {
    let s=0, n=0;
    for (let i=0;i<type.length;i++) if (type[i]===t){
      const x=i%W, y=(i/W)|0; let k=0;
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])
        if (inb(x+dx,y+dy) && type[idx(x+dx,y+dy)]===t) k++;
      s+=k; n++;
    }
    return n ? s/n : 0;
  };
  // A fixed scatter, not a random one: the claim is about the ants, and two runs that start
  // from different rubble are not comparable.
  const scatter = () => {
    __wipe(); const f = __floor();
    let seed = 11;
    const rnd = () => (seed = (seed*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let x=8; x<W-8; x++) if (rnd() < .55) put(x, f-1, SAND);
    return f;
  };
  const run = (ants) => {
    const f = scatter();
    const n0 = __count(SAND), c0 = clump(SAND);
    for (let k=0;k<ants;k++) put(14+k*10, f-3, ANT);
    // Sampled through the run rather than read off the end of it — see below.
    let laden = 0, seen = 0;
    for (let k=0;k<7200;k++){
      __step(1);
      if (k % 50 === 0)
        for (let i=0;i<type.length;i++) if (type[i]===ANT){ seen++; if (feed[i]) laden++; }
    }
    let held = 0;
    for (let i=0;i<type.length;i++) if (type[i]===ANT && feed[i]) held++;
    return { c0, c1: clump(SAND), n0, n: __count(SAND), held, ants: __count(ANT),
             carrying: seen ? laden/seen : 0 };
  };
  const idle = run(0), busy = run(10);
  if (Math.abs(idle.c1 - idle.c0) > 0.15)
    bad.push(`the scatter clumped from ${idle.c0.toFixed(2)} to ${idle.c1.toFixed(2)} with no ants in it — that is gravity, not ants`);
  // Thresholds from the spread, not from one run. Five runs of this scene gained 0.66 to
  // 1.27; the control gained exactly 0.00 every time, which is what makes it a control.
  if (busy.c1 < busy.c0 + 0.4)
    bad.push(`ten ants took the scatter from ${busy.c0.toFixed(2)} to ${busy.c1.toFixed(2)} — nothing was heaped`);
  if (busy.ants !== 10) bad.push(`ten ants became ${busy.ants}`);

  /* And they must put things down again. At an earlier setting the heaps measured slightly
     better and most of the ants were permanently laden — the same fault wearing a good
     number, and invisible to a clumping measurement alone.

     This used to count the ants holding something at the final tick, and that was the wrong
     measurement twice over. Ten ants sampled once is ten coin flips: measured across eight
     runs it came out 2 3 3 3 4 4 4 5 against a bar of four, so the check failed about one
     run in eight for a build that was working perfectly. And it does not separate the
     thing it is looking for — an ant that never drops comes out at 3 to 8 on the same
     measurement, straight through the middle of the working range.

     The fraction of its time an ant spends laden, sampled every fifty ticks, does both.
     Working: 0.25 to 0.32 over sixteen runs. Never dropping: 0.64 to 0.72 over eight. The
     bar sits at 0.45, in the gap. (Never dropping does not reach 1.0 because `ANT_KEEP` is
     a floor under the drop chance — an ant that cannot find a spot eventually gives up and
     puts the thing down, which is why the box never deadlocks.) */
  if (busy.carrying > 0.45)
    bad.push(`the ants spent ${(100*busy.carrying).toFixed(0)}% of their time holding a grain — they are hoarding, not heaping`);
  if (busy.n + busy.held < busy.n0)
    bad.push(`${busy.n0} grains became ${busy.n} on the floor and ${busy.held} carried — ${busy.n0 - busy.n - busy.held} left the box`);

  /* Two kinds go into two heaps, because a grain is only ever counted against its own kind.

     Fourteen ants and five minutes, which is not padding: at eight ants and ninety seconds
     the sand's gain ranged 0.15 to 0.95 across five runs and this arm failed about one time
     in three. Sorting two kinds is slower than heaping one — every grain an ant passes is
     now half as likely to be the kind it is carrying. At this length the gain ran 0.92 to
     1.82 for sand and 1.43 to 2.50 for ash, so the bars below sit well under the worst run
     rather than near the average of a handful. */
  __wipe(); const f = __floor();
  let seed = 7;
  const rnd = () => (seed = (seed*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let x=10; x<W-10; x++){ const r = rnd(); if (r < .25) put(x, f-1, SAND); else if (r < .5) put(x, f-1, ASH); }
  for (let k=0;k<14;k++) put(16+k*7, f-3, ANT);
  const s0 = clump(SAND), a0 = clump(ASH);
  /* Averaged over the last three thousand ticks rather than read off the final one. A single
     sample of a scene this lively is noisier than the thing it is measuring: measured twelve
     times across two builds the end-of-run gain for sand ran **0.59 to 2.87**, and a full suite
     run turned up 0.47 against a bar of 0.5. The mean of seven samples over the same tail runs
     **0.91 to 1.65**, so the same bar now sits under the worst of a dozen rather than inside
     the spread. Fourth time this file has learned it. */
  for (let k=0;k<15000;k++) __step(1);
  const sTail = [], aTail = [];
  for (let k=0;k<3000;k++){ __step(1); if (k % 500 === 0){ sTail.push(clump(SAND)); aTail.push(clump(ASH)); } }
  const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
  const s1 = mean(sTail), a1 = mean(aTail);
  if (s1 < s0 + 0.5) bad.push(`sand went from ${s0.toFixed(2)} to ${s1.toFixed(2)} in a mixed scatter`);
  if (a1 < a0 + 0.7) bad.push(`ash went from ${a0.toFixed(2)} to ${a1.toFixed(2)} in a mixed scatter`);

  // Grains only. A creature that could carry a wall away is not an ant.
  for (const t of [STONE, WOOD, GLASS, WATER, STEEL]){
    __wipe(); const ff = __floor();
    __slab(((W/2)|0)-12, ff-10, ((W/2)|0)+12, ff-1, t);
    for (let k=0;k<6;k++) put(((W/2)|0)-8+k*3, ff-12, ANT);
    const n0 = __count(t);
    for (let k=0;k<3000;k++) __step(1);
    if (__count(t) < n0) bad.push(`ants carried off ${n0 - __count(t)} cells of ${M[t].n}`);
  }
  if (![...finds].some(k => k === ANT + ':carry')) bad.push('carrying did not register as a discovery');
  return bad.length ? bad.join('; ') : null;
});

/* Reported from the phone: the moth and the grub were near enough the same colour that a
   new player would wonder why a grub had started flying. Measuring it found worse — the moth
   was **dE 2.3** from Paper, which is the same colour by any standard anybody uses.

   CIE76 in Lab rather than distance in RGB, because the eye is far more sensitive to
   lightness than to blue and an RGB number says the opposite. Creatures are held further
   apart from each other than from materials, because every confusion reported so far has
   been one creature for another rather than a creature for a wall. */
/* Two checks on the palette, and they measure different things on purpose. This one reads
   the table. The one after it reads the pixels.

   The metric changed, because the old one was answering a question nobody asked. It was
   CIE76 on the table colours, and by that measure Dirt and Ash were 17.6 apart — a
   comfortable pass — while on the phone they were the thing Sam reported as looking the
   same. Two faults in one number:

   · **CIE76 overrates chroma.** Dirt and Ash differed almost entirely in yellowness, at low
     chroma, and CIE76 charges the full 17 for it. CIEDE2000 charges what the eye does.
   · **It ignored the grain.** Every cell is drawn with a tint added to all three channels,
     which is very nearly pure lightness, so a lightness difference smaller than the tint's
     own spread is not a difference you can see at one cell. Dirt and Ash sat at L* 38 and
     39 — the difference between them was a third of the variation inside either one.

   So `survives` shrinks the lightness difference by what the tint can hide and then asks
   CIEDE2000 what is left. On that metric the pair Sam reported came out at 11.7, and the
   worst pair in the box came out at 1.1: Stone and Ash, which the old check passed at a
   bar of 3 while calling itself the check for this. */
await check(browser, 'no two things in the box are the same colour, and creatures least of all', () => {
  const bad = [];
  const lab = ([R,G,B]) => {
    const f = v => { v/=255; return v > .04045 ? Math.pow((v+.055)/1.055, 2.4) : v/12.92; };
    const r=f(R), g=f(G), b=f(B);
    let x=(r*.4124+g*.3576+b*.1805)/.95047, y=r*.2126+g*.7152+b*.0722, z=(r*.0193+g*.1192+b*.9505)/1.08883;
    const k = v => v > .008856 ? Math.cbrt(v) : (7.787*v + 16/116);
    x=k(x); y=k(y); z=k(z);
    return [116*y-16, 500*(x-y), 200*(y-z)];
  };
  const d2000 = ([L1,a1,b1],[L2,a2,b2]) => {
    const C1 = Math.hypot(a1,b1), C2 = Math.hypot(a2,b2), Cb = (C1+C2)/2;
    const G = .5*(1 - Math.sqrt(Math.pow(Cb,7)/(Math.pow(Cb,7)+Math.pow(25,7))));
    const A1 = (1+G)*a1, A2 = (1+G)*a2;
    const Cp1 = Math.hypot(A1,b1), Cp2 = Math.hypot(A2,b2);
    const hf = (a,b) => { if (a===0 && b===0) return 0; const d = Math.atan2(b,a)*180/Math.PI; return d<0?d+360:d; };
    const h1 = hf(A1,b1), h2 = hf(A2,b2);
    const dL = L2-L1, dC = Cp2-Cp1;
    let dh = 0;
    if (Cp1*Cp2 !== 0){ dh = h2-h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
    const dH = 2*Math.sqrt(Cp1*Cp2)*Math.sin(dh*Math.PI/360);
    const Lb = (L1+L2)/2, Cpb = (Cp1+Cp2)/2;
    let hb;
    if (Cp1*Cp2 === 0) hb = h1+h2;
    else { hb = (h1+h2)/2; if (Math.abs(h1-h2) > 180) hb += (h1+h2 < 360) ? 180 : -180; }
    const T = 1 - .17*Math.cos((hb-30)*Math.PI/180) + .24*Math.cos(2*hb*Math.PI/180)
                + .32*Math.cos((3*hb+6)*Math.PI/180) - .20*Math.cos((4*hb-63)*Math.PI/180);
    const Sl = 1 + (.015*Math.pow(Lb-50,2))/Math.sqrt(20+Math.pow(Lb-50,2));
    const Sc = 1 + .045*Cpb, Sh = 1 + .015*Cpb*T;
    const dTh = 30*Math.exp(-Math.pow((hb-275)/25,2));
    const Rc = 2*Math.sqrt(Math.pow(Cpb,7)/(Math.pow(Cpb,7)+Math.pow(25,7)));
    const Rt = -Rc*Math.sin(2*dTh*Math.PI/180);
    return Math.sqrt(Math.pow(dL/Sl,2) + Math.pow(dC/Sc,2) + Math.pow(dH/Sh,2)
                     + Rt*(dC/Sc)*(dH/Sh));
  };
  // The tint reaches GRAIN either way, which is about six points of L* at these
  // lightnesses. Anything smaller than that is inside the noise, so it does not count.
  const HIDES = 6;
  const survives = (c1, c2) => {
    const A = lab(c1), B = lab(c2);
    const dL = B[0] - A[0];
    const kept = Math.sign(dL) * Math.max(0, Math.abs(dL) - HIDES);
    return d2000(A, [A[0] + kept, B[1], B[2]]);
  };

  /* Measured minima at the time of writing, which is where the bars come from rather than
     from taste: two creatures, 19.7 (Worm/Ant); a creature and a material, 9.2 (Lava/Pupa).
     A creature crosses everything in the box and cannot rely on where it is to say what it
     is, which is why it is held to more than a material is. */
  const CREATURES = 15, CREATURE_AND_THING = 8, TWO_THINGS = 6;

  /* Fourteen material pairs are under the bar and always have been. They are listed rather
     than legislated away with a lower number, because a list is a thing you can read and
     argue with, and a bar of 3 was just the old worst case wearing a uniform.

     Three families, and one pair on its own:
     · the near-blacks — coal, rubber, powder, smoke. Four things that are all "burnt".
     · the near-whites — paper, wax, steam, magnesium, sand.
     · fire and lava, which are the same orange because they are the same temperature; one
       of them flickers and rises and the other pools, which is how you tell.
     · powder and the vent, which is a device rather than a material.

     They are told apart by where they are and what they do, and nobody has reported
     confusing any of them. Anything NOT on this list has to clear the bar — that is the
     ratchet, and it is what would have caught Stone and Ash. */
  const KNOWN = [
    ['coal','rubber'], ['powder','rubber'], ['powder','coal'], ['powder','smoke'],
    ['coal','smoke'], ['smoke','rubber'], ['smoke','rubber-molten'],
    ['steam','magnesium'], ['paper','wax'], ['paper','wax-molten'], ['wax-molten','sand'],
    ['fire','lava'], ['powder','vent'], ['wood','thermite'],
  ].map(p => p.sort().join('|'));

  const shown = [];
  for (let t=1;t<M.length;t++) if (M[t] && M[t].col) shown.push(t);
  /* Every colour a material can be drawn in, not just the one in `col`. A flower comes up in
     one of three, and checking only the first would have let the other two in unmeasured —
     white and cream both fail against Wax, magenta against the worm, pale blue against the
     ash bug, and all four looked perfectly reasonable in a list. */
  const paints = t => M[t].blooms || [M[t].col];
  const spared = new Set();
  for (let i=0;i<shown.length;i++) for (let j=i+1;j<shown.length;j++){
    const a = shown[i], b = shown[j];
    let e = 1e9;
    for (const ca of paints(a)) for (const cb of paints(b)) e = Math.min(e, survives(ca, cb));
    const both = M[a].alive && M[b].alive, one = M[a].alive || M[b].alive;
    const floor = both ? CREATURES : one ? CREATURE_AND_THING : TWO_THINGS;
    // Named by save key, not by what the tray calls them: Wax and molten Wax share a
    // display name, so a list keyed on names cannot say which pair it is forgiving.
    const key = [SAVE_KEY[a], SAVE_KEY[b]].sort().join('|');
    if (e >= floor) continue;
    if (!both && !one && KNOWN.includes(key)){ spared.add(key); continue; }
    bad.push(`${M[a].n} and ${M[b].n} (${key}) are ${e.toFixed(1)} apart, under the ${floor} this pair needs`);
  }
  // A list that has stopped describing anything is worse than no list: it quietly forgives
  // a pair that has since moved, and the next collision hides behind the same entry.
  for (const k of KNOWN) if (!spared.has(k))
    bad.push(`${k} is on the list of pairs known to be too close, and is not too close any more — take it off`);
  return bad.length ? bad.join('; ') : null;
});

/* The same question asked of the pixels rather than the table, because the table does not
   know about the grain and the grain is now doing half the work.

   This is the check that would have caught what was reported. A field of stone with single
   cells of ash scattered through it: **every one of them was hidden**, in the sense that
   the field already contained cells of that exact colour. Every other pair of things that
   share a floor came out at nought. One number, 100 against 0, for a defect that read as
   "the check says 17.6, which is fine".

   Ash is pale now, and the grain and the fleck do the rest. Two fields of the same
   lightness can still be told apart if one of them is smooth and the other is coarse and
   speckled — but that only works for a field. A single cell has no texture, which is why
   this is measured one cell at a time and why the colours had to move as well. */
await check(browser, 'a single cell of anything is findable on a floor of anything else', () => {
  const bad = [];
  const lab = ([R,G,B]) => {
    const f = v => { v/=255; return v > .04045 ? Math.pow((v+.055)/1.055, 2.4) : v/12.92; };
    const r=f(R), g=f(G), b=f(B);
    let x=(r*.4124+g*.3576+b*.1805)/.95047, y=r*.2126+g*.7152+b*.0722, z=(r*.0193+g*.1192+b*.9505)/1.08883;
    const k = v => v > .008856 ? Math.cbrt(v) : (7.787*v + 16/116);
    x=k(x); y=k(y); z=k(z);
    return [116*y-16, 500*(x-y), 200*(y-z)];
  };
  const gap = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  const at = (data,x,y) => { const p = (y*W + x)*4; return [data[p], data[p+1], data[p+2]]; };

  // The things that end up on a floor together: what you build with, what a fire leaves,
  // what the worm makes out of it, and what you sprinkle on that. A seed you cannot see on
  // soil is a seed you cannot tell you have planted.
  const GROUND = [STONE, ASH, DIRT, RICH, SAND, WOOD, COAL, EMBER, SEED, SNOW];
  for (const bg of GROUND) for (const fg of GROUND){
    if (bg === fg) continue;
    __wipe();
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) put(x,y,bg);
    const spots = [];
    for (let n=0;n<40;n++){
      const x = 5 + (n*3) % (W-10), y = 5 + (n*7) % (H-10);
      put(x,y,fg); spots.push([x,y]);
    }
    draw();
    const data = ctx.getImageData(0,0,W,H).data;
    const field = [];
    for (let y=1;y<H-1;y+=2) for (let x=1;x<W-1;x+=2)
      if (type[idx(x,y)] === bg) field.push(lab(at(data,x,y)));
    /* Hidden means the field already contains cells that look like this one — not "far
       from the field's average", which is a different and wrong question. Soil is two
       browns and is wide by that measure, and a grey cell dropped in it is still perfectly
       obvious, because none of the browns is grey. */
    let hidden = 0;
    for (const [x,y] of spots) {
      const c = lab(at(data,x,y));
      if (field.some(v => gap(v,c) < 4)) hidden++;
    }
    if (hidden) bad.push(`${hidden} of ${spots.length} cells of ${M[fg].n} vanished into a field of ${M[bg].n}`);
  }

  /* And the grain and the fleck are real, rather than two fields nothing reads. This is
     not idle: the draw loop takes its colours out of arrays built once at load, so a
     material could declare either and be drawn without it, and the picture would still
     look plausible — just flat, and back to colour carrying everything on its own.

     Measured spread of the drawn brightness across a full field: Ash 2.7 against a plain
     material's 7.0, and Dirt 15.2. About 31% of a flecked material's cells come out nearer
     the fleck than the base, which is the one-in-four the tint is sliced into, plus the
     base cells that the tint has carried across the halfway line. */
  const spreadOf = t => {
    __wipe();
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) put(x,y,t);
    draw();
    const d = ctx.getImageData(0,0,W,H).data;
    const v = []; let toFleck = 0;
    for (let y=1;y<H-1;y+=2) for (let x=1;x<W-1;x+=2){
      const p = (y*W+x)*4, R=d[p], G=d[p+1], B=d[p+2];
      v.push((R+G+B)/3);
      const f = M[t].fleck, c = M[t].col;
      if (f && Math.hypot(R-f[0],G-f[1],B-f[2]) < Math.hypot(R-c[0],G-c[1],B-c[2])) toFleck++;
    }
    const mean = v.reduce((s,x)=>s+x,0)/v.length;
    return { sd: Math.sqrt(v.reduce((s,x)=>s+(x-mean)**2,0)/v.length), fleck: toFleck/v.length };
  };

  const plain = spreadOf(SAND).sd;                       // no grain, no fleck: the baseline
  for (let t=1;t<M.length;t++){
    if (!M[t] || !M[t].col) continue;
    if (M[t].grain === undefined && M[t].fleck === undefined) continue;
    const g = spreadOf(t);
    if (M[t].grain !== undefined && M[t].grain < 13 && !(g.sd < plain * .6))
      bad.push(`${M[t].n} asks for a fine grain of ${M[t].grain} and is drawn at ${g.sd.toFixed(1)} against a plain material's ${plain.toFixed(1)}`);
    if (M[t].fleck !== undefined && (g.fleck < .15 || g.fleck > .45))
      bad.push(`${M[t].n} declares a fleck and ${Math.round(100*g.fleck)}% of its cells came out nearer it — the loop is not drawing it`);
  }
  return bad.length ? bad.join('; ') : null;
});

/* The one creature that makes more of itself, which is the rule the other six exist inside.
   So the checks are mostly about what stops it: it needs a real surface, it needs water
   within reach, and both of those have to bind or the exception eats the box. */
await check(browser, 'moss creeps over damp surfaces, and will not grow without either', () => {
  const bad = [];
  const cx = (W/2)|0;

  // A wall standing in water. It should climb it, and nothing should end up in mid-air.
  __wipe(); let f = __floor();
  __slab(cx-30, f-2, cx+30, f-1, WATER);
  __slab(cx-1, f-16, cx+1, f-3, STONE);
  put(cx+2, f-4, MOSS);
  for (let k=0;k<12000;k++) __step(1);
  const grew = __count(MOSS);
  if (grew < 8) bad.push(`one cell of moss on a wet wall became ${grew} in three minutes`);
  /* A cushion two deep and no deeper. Stated as a distance to a real surface rather than by
     asking the page's own `rooted()`, which would only assert that the code agrees with
     itself — the claim is about the shape, and the shape is what was wrong twice.

     Counting no moss at all made it a film one cell thick, and on a wooden block the brush
     had already filled every cell that qualified, so it saturated at +22 and looked frozen.
     Counting any moss made it a fog: 1219 cells on a pillar of which 1175 touched nothing
     but each other. */
  const nearSurface = (x, y, r) => {
    for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++){
      if (!inb(x+dx,y+dy)) continue;
      const u = type[idx(x+dx,y+dy)];
      if (u!==E && u!==MOSS && M[u].ph!==0 && M[u].ph!==1) return true;
    }
    return false;
  };
  let adrift = 0, thick = 0;
  for (let i=0;i<type.length;i++) if (type[i]===MOSS){
    const x=i%W, y=(i/W)|0;
    if (!nearSurface(x, y, 2)) adrift++;      // further than a cushion from anything real
    else if (!nearSurface(x, y, 1)) thick++;  // the second layer, which is allowed
  }
  if (adrift) bad.push(`${adrift} of ${grew} cells of moss were more than two cells from any real surface`);

  /* A creature is not a surface. Reported from the phone with a picture of a heap of worms
     with moss growing all over them — a creature is `ph:3`, so it read as a wall. Measured
     on a stone shelf under a deep heap of worms: the moss climbed **35 rows** up the heap,
     1217 cells of it, 1093 of them nowhere near anything real. Two rows now, and none adrift.

     Three rules ask a version of this question — what a grub may eat, what an ant may lift,
     what moss may grow on — and the first two excluded `alive` from the day they were
     written. */
  __wipe(); const fs = __floor();
  __slab(cx-30, fs-3, cx+30, fs-1, WATER);
  __slab(cx-30, fs-9, cx+30, fs-4, STONE);
  const top = fs-9;
  for (let k=0;k<150;k++) put(cx-24 + (k % 49), top-1-((k/49)|0), WORM);
  for (let k=0;k<10;k++) put(cx-20+k*4, top-1, MOSS);
  for (let k=0;k<7200;k++) __step(1);
  let climbed = 0;
  for (let i=0;i<type.length;i++) if (type[i]===MOSS) climbed = Math.max(climbed, top - ((i/W)|0));
  if (climbed > 3)
    bad.push(`moss climbed ${climbed} rows above a stone shelf using a heap of worms as scaffolding`);
  if (thick > grew * 0.6) bad.push(`${thick} of ${grew} cells are second-layer — that is a bush, not a coating`);

  // The same wall, dry. Nothing at all should happen.
  __wipe(); f = __floor();
  __slab(cx-1, f-16, cx+1, f-1, STONE);
  put(cx+2, f-4, MOSS);
  for (let k=0;k<12000;k++) __step(1);
  if (__count(MOSS) !== 1) bad.push(`one cell of moss on a dry wall became ${__count(MOSS)}`);

  /* And it stays near the water rather than crossing the box. The pond is sunk into a
     hollow rather than poured onto an open floor: poured, it runs along the floor as water
     does, and it drowned the seeded cell about one run in two — moss with water on every
     side has no empty neighbour to grow into, so the arm failed reporting "made 1 cells"
     while the rule it was testing was fine. */
  __wipe(); f = __floor();
  // Sunk INTO the floor, which is rows f..H-1 — the first two attempts at this poured the
  // pond onto row f-1, which is air, so it ran along the surface and drowned the seed.
  __slab(20, f, 50, f+3, WATER);
  for (let k=0;k<600;k++) __step(1);                  // let the pond settle before seeding
  put(54, f-1, MOSS);
  for (let k=0;k<12000;k++) __step(1);
  let far = 0;
  for (let i=0;i<type.length;i++) if (type[i]===MOSS) far = Math.max(far, i%W);
  if (__count(MOSS) < 5) bad.push(`moss beside a pond made ${__count(MOSS)} cells in three minutes`);
  if (far > 50 + M[MOSS].damp + 12)
    bad.push(`moss reached column ${far} from a pond ending at 50, with damp ${M[MOSS].damp}`);

  // Heat kills it, well below anything catching light.
  __wipe(); f = __floor();
  __slab(20, f-8, 69, f-1, MOSS);
  const n0 = __count(MOSS);
  __hold(40, f-4, 3, 600);
  for (let k=0;k<1200;k++) __step(1);
  if (n0 - __count(MOSS) < 20) bad.push(`a match held in a slab of moss took out ${n0 - __count(MOSS)} of ${n0} cells`);
  if (![...finds].some(k => k === MOSS + ':wither')) bad.push('drying out did not register as a discovery');
  if (![...finds].some(k => k === MOSS + ':spread')) bad.push('spreading did not register as a discovery');
  return bad.length ? bad.join('; ') : null;
});

/* Moss used to burn like any other soft fuel, which made a loop nobody designed and nobody
   could see: moss burns down to ash, moss grows on ash, that moss burns. Reported from the
   phone as moss expanding with the ash and containing it.

   The number is the thing. **A fire cannot leave more ash than there was fuel to make it.**
   That is true of every material in the table and was quietly false of one — measured on a
   mossy build with one arm lit, 480 cells of wood burnt and 1714 cells of ash on the floor.
   The scene was manufacturing matter, and nothing in the suite would ever have said so. */
await check(browser, 'a fire cannot leave more ash behind than it had fuel', () => {
  const bad = [];
  const cx = (W/2)|0, f = H-4;
  __wipe();
  __slab(cx-14, f-70, cx+14, f, SAND);              // a tower, and two arms with water in
  __slab(cx-38, f-52, cx-18, f-6, WOOD);
  __slab(cx-34, f-48, cx-22, f-10, WATER);
  __slab(cx+18, f-58, cx+40, f-4, WOOD);
  __slab(cx+22, f-54, cx+36, f-8, WATER);
  for (let y=f-72; y<=f; y++) for (let x=2; x<W-2; x++)
    if (type[idx(x,y)] === E && rooted(x, y, MOSS) && damp(x, y, M[MOSS].damp)) put(x, y, MOSS);
  const moss0 = __count(MOSS), wood0 = __count(WOOD);
  if (moss0 < 300) return `the scene only grew ${moss0} cells of moss, so it is not the reported one`;
  __hold(cx-28, f-30, 3, 400);
  for (let k=0;k<9000;k++) __step(1);
  const burnt = wood0 - __count(WOOD), left = __count(ASH) + __count(EMBER);
  if (burnt < 100) return `only ${burnt} cells of wood burnt, so the scene proves nothing`;
  /* Wood leaves an ember or an ash for each cell and nothing else in this build leaves any,
     so the ceiling is the fuel itself with a little room for rounding. It came out at 3.5x
     the ceiling before moss stopped burning. */
  if (left > burnt * 1.2)
    bad.push(`${burnt} cells of wood burnt and left ${left} cells of ash — the scene made ${left - burnt} from nowhere`);
  return bad.length ? bad.join('; ') : null;
});

/* Two answers to "how do I get rid of ash", and they are deliberately different: the ash bug
   removes it, and these turn it into something. Fire → ash → dirt is the first half of a
   cycle; what grows in the dirt is the other half and comes later. */
await check(browser, 'wet ash becomes dirt, and a worm makes soil out of a burn', () => {
  const bad = [];
  const cx = (W/2)|0;

  // Rain on a burn. The water is absorbed rather than left behind, so it is a trade.
  __wipe(); let f = __floor();
  __slab(cx-25, f-4, cx+25, f-1, ASH);
  const ash0 = __count(ASH);
  __slab(cx-25, f-9, cx+25, f-6, WATER);
  const water0 = __count(WATER);
  for (let k=0;k<2000;k++) __step(1);
  const made = __count(DIRT), ateAsh = ash0 - __count(ASH), ateWater = water0 - __count(WATER);
  if (made < 20) bad.push(`water poured on ${ash0} cells of ash made ${made} of dirt`);
  // One cell of water per cell of ash. If water were left behind, one puddle would convert a
  // whole burnt-out box and the trade would not be a trade.
  if (Math.abs(ateWater - ateAsh) > Math.max(6, ateAsh * 0.15))
    bad.push(`${ateAsh} cells of ash became dirt but ${ateWater} cells of water went — those should match`);

  // Worms, and the control that says it is the worms doing it.
  const compost = (n, ticks) => {
    __wipe(); const ff = __floor();
    __slab(cx-25, ff-4, cx+25, ff-1, ASH);
    const a0 = __count(ASH);
    for (let k=0;k<n;k++) put(cx-18+k*6, ff-5, WORM);
    for (let k=0;k<ticks;k++) __step(1);
    return { a0, ash: __count(ASH), dirt: __count(DIRT), worms: __count(WORM) };
  };
  const idle = compost(0, 3600), busy = compost(6, 3600);
  if (idle.dirt) bad.push(`${idle.dirt} cells of dirt appeared in an ash field with no worms in it`);
  if (busy.dirt < 40) bad.push(`six worms made ${busy.dirt} cells of dirt from ${busy.a0} of ash in a minute`);
  if (busy.worms !== 6) bad.push(`six worms became ${busy.worms}`);
  if (busy.a0 - busy.ash !== busy.dirt)
    bad.push(`${busy.a0 - busy.ash} cells of ash went and ${busy.dirt} of dirt arrived — one turns into one`);

  /* And it keeps going. Before burrowing was made the thing a worm does when it has nothing
     to compost, six worms took the field to 86 cells of dirt in a minute and 79 in three —
     they had buried themselves in their own soil and were swimming about in it.

     Sampled twice inside ONE run, which the first version of this was not: it built the
     scene twice and compared a minute in one run against three minutes in another. Composting
     varies by about twenty cells run to run, so it was subtracting one noisy number from a
     different noisy number and calling the difference a stall — it failed reporting "120 in
     a minute and 89 in three" on two runs that were both perfectly healthy. */
  __wipe(); const ff = __floor();
  __slab(cx-25, ff-4, cx+25, ff-1, ASH);
  for (let k=0;k<6;k++) put(cx-18+k*6, ff-5, WORM);
  for (let k=0;k<3600;k++) __step(1);
  const atOneMinute = __count(DIRT);
  for (let k=0;k<7200;k++) __step(1);
  const atThree = __count(DIRT);
  if (atThree < atOneMinute)
    bad.push(`six worms had made ${atOneMinute} cells of dirt at a minute and ${atThree} at three — it went backwards`);

  // Through the soil, not eating it: a worm leaves the ground where it found it.
  __wipe(); f = __floor();
  __slab(cx-25, f-14, cx+25, f-1, DIRT);
  const soil0 = __count(DIRT);
  put(cx, f-16, WORM);
  const seen = new Set();
  for (let k=0;k<3600;k++){
    __step(1);
    for (let i=0;i<type.length;i++) if (type[i]===WORM) seen.add(i);
  }
  if (__count(DIRT) !== soil0) bad.push(`a worm in ${soil0} cells of soil left ${__count(DIRT)} — it is eating the ground`);
  if (seen.size < 40) bad.push(`a worm in soil visited ${seen.size} cells in a minute — it is not burrowing`);
  if (![...finds].some(k => k === WORM + ':till')) bad.push('composting did not register as a discovery');
  if (![...finds].some(k => k === ASH + ':meets0')) bad.push('wet ash did not register as a discovery');
  return bad.length ? bad.join('; ') : null;
});

/* Dirt is a material like any other and has to behave like one, or it is a green-flavoured
   hole in the table. It also has to stay destructible — soil that does not burn would be
   indestructible if it had no melting point, which is exactly the fault two sections up. */
await check(browser, 'dirt piles, does not burn, and can still be got rid of', () => {
  const bad = [];
  const cx = (W/2)|0;

  __wipe(); let f = __floor();
  __slab(cx-6, f-20, cx+6, f-10, DIRT);
  for (let k=0;k<900;k++) __step(1);
  let l=1e9, r=-1e9;
  for (let i=0;i<type.length;i++) if (type[i]===DIRT){ const x=i%W; if(x<l)l=x; if(x>r)r=x; }
  if (r-l+1 <= 13) bad.push(`a 13-wide column of dirt was still ${r-l+1} wide after fifteen seconds — it is not piling`);

  __wipe(); f = __floor();
  __slab(cx-10, f-6, cx+10, f-1, DIRT);
  const d0 = __count(DIRT);
  __hold(cx, f-4, 3, 600);
  for (let k=0;k<1200;k++) __step(1);
  if (__count(DIRT) < d0) bad.push(`${d0 - __count(DIRT)} cells of dirt burned`);

  __wipe(); f = __floor();
  __slab(cx-10, f-6, cx+10, f-1, DIRT);
  const a0 = __count(DIRT);
  __slab(cx-10, f-10, cx+10, f-7, ACID);
  for (let k=0;k<2500;k++) __step(1);
  if (__count(DIRT) >= a0) bad.push('acid poured on dirt removed none of it');
  return bad.length ? bad.join('; ') : null;
});

/* `breath` was never about water — it counts how long a cell has been somewhere it cannot
   breathe — so a gas that pools runs the same clock as a pond and only the wording differs.

   Which gases, though, is the half worth measuring. Smoke and steam were tried with the same
   field and changed nothing anywhere: a fire in a sealed room with worms in it came out 10
   of 10 alive either way, because smoke rises off a creature on a floor faster than the
   clock runs. Gas is the one that stays. */
await check(browser, 'a creature under a gas cloud suffocates, and a fire outside does not do it', () => {
  const bad = [];
  const cx = (W/2)|0;

  // A room with a lid, filled with gas, ten worms on the floor of it.
  __wipe(); let f = __floor();
  __slab(cx-20, f-20, cx+20, f-20, STONE);
  __slab(cx-21, f-20, cx-21, f-1, STONE);
  __slab(cx+21, f-20, cx+21, f-1, STONE);
  for (let n=0;n<10;n++) put(cx-16+n*4, f-1, WORM);
  /* Into the empty cells only, and *including* the row the worms are standing in.

     Two ways this scene has been wrong. `__slab` uses `put`, which replaces whatever is in
     a cell, so gassing across the worms deletes them — measured as "all gone at tick 1 with
     no discovery raised", which looks exactly like suffocation working perfectly. Then
     gassing only down to the row *above* them left clear air on both sides of each worm,
     which is a creature standing under a gas layer rather than in one, and it is right that
     it can breathe. */
  for (let y=f-19; y<=f-1; y++) for (let x=cx-20; x<=cx+20; x++)
    if (type[idx(x,y)] === E) put(x, y, GAS);
  const n0 = __count(WORM);
  let gone = -1;
  for (let k=1;k<=2400;k++){ __step(1); if (gone < 0 && !__count(WORM)) gone = k; }
  if (gone < 0) bad.push(`${__count(WORM)} of ${n0} worms sat in a sealed room of gas for forty seconds`);
  // On the breath clock, not instantly: a creature is worth a moment, same as drowning.
  else if (gone < M[WORM].drown) bad.push(`the room emptied in ${gone} ticks against a breath of ${M[WORM].drown}`);
  if (![...finds].some(k => k === WORM + ':choke')) bad.push('suffocating did not register as a discovery');

  /* Creatures standing on a ledge in a gassed box. This is the arm that catches the two
     things reported as "the gas only affects the moths".

     A gas has no surface, so one lookup upward is not enough: a creature makes its own
     pocket, because the gas above it rises away and its body blocks anything refilling from
     underneath. And `moveRising` could only ever move a gas up or diagonally up, so that
     pocket was permanent. With a sideways move for a gas that cannot rise, 3 to 4 of 12 go;
     without it, 12 of 12 sit there indefinitely — which is what the phone showed. */
  __wipe(); f = __floor();
  __slab(cx-4, f-12, cx+30, f-9, STONE);
  for (let n=0;n<12;n++) put(cx-2+n*2, f-13, WORM);
  const l0 = __count(WORM);
  for (let y=2; y<=f-1; y++) for (let x=2; x<W-2; x++)
    if (type[idx(x,y)] === E) put(x, y, GAS);
  /* Two minutes, and the bar is simply that somebody dies. Measured eight runs each way:
     with the drift, 7 to 10 of 12 left and a first death between ticks 645 and 1047, every
     run; without it, 12 of 12 left in seven runs of eight. A bar of "at least two die" sits
     exactly on the worst run with the drift, which is how thresholds get set on a lucky
     measurement — this one has margin instead. */
  for (let k=0;k<7200;k++) __step(1);
  if (__count(WORM) >= l0)
    bad.push(`all ${l0} worms stood on a ledge in a box full of gas for two minutes`);

  /* And the cost, which is the reason smoke is not on the list. An ordinary wood fire with
     creatures on the floor beside it must not quietly become a gas chamber. */
  __wipe(); f = __floor();
  __slab(cx-30, f-12, cx-10, f-1, WOOD);
  for (let n=0;n<16;n++) put(cx+4+n*3, f-1, WORM);
  const w0 = __count(WORM);
  __hold(cx-20, f-13, 3, 250);
  for (let k=0;k<4000;k++) __step(1);
  if (__count(WORM) < w0 * 0.7)
    bad.push(`${w0 - __count(WORM)} of ${w0} worms died on a floor beside a wood fire they never touched`);

  // A creature in clear air is not on a clock at all.
  __wipe(); f = __floor();
  for (let n=0;n<10;n++) put(cx-16+n*4, f-1, WORM);
  const c0 = __count(WORM);
  for (let k=0;k<3000;k++) __step(1);
  if (__count(WORM) !== c0) bad.push(`${c0} worms in an empty box became ${__count(WORM)}`);
  return bad.length ? bad.join('; ') : null;
});

/* Clear is three answers now, and the two new ones are only worth having if they are
   surgical. A Fire that also took the logs, or a Life that also took the pond, is just a
   slower Everything, and the failure would be invisible in the moment you asked for it —
   you tapped a thing called Clear and something got cleared.

   Driven through the chips rather than by calling the code behind them, because the chips
   are the feature. A picker that offers three options and wires two of them to the same
   handler would pass everything written against the model. */
await check(browser, 'Clear takes what it was asked for and leaves the rest', () => {
  const bad = [];
  const cx = (W/2)|0;
  const ask = what => {
    showDrawer(TOOLS_DRAWER);
    document.querySelector('[data-act="clear"]').click();
    const b = document.querySelector('[data-act="clear-' + what + '"]');
    if (!b) throw new Error('no Clear option called ' + what);
    b.click();
  };
  const living = () => { let n=0; for (let i=0;i<type.length;i++) if (type[i]!==E && M[type[i]].alive) n++; return n; };
  const fumes  = () => { let n=0; for (let i=0;i<type.length;i++) if (FUMES.has(type[i])) n++; return n; };

  // What counts as the fire's own leavings is derived from the tray rather than listed,
  // so the derivation is read back rather than trusted: the gases the box makes and you
  // cannot place. If a placeable gas ever falls into this set, Fire starts deleting
  // material somebody put there by hand.
  const named = [...FUMES].map(t => M[t].n).sort().join(', ');
  // Cold fog joined this set when nitrogen did, and belongs by the rule above rather than
  // by anyone deciding it should: it is a gas the box makes and you cannot place. Clear →
  // Fire putting a nitrogen cloud away with the smoke is consistent with the rest of what
  // that button does, which is to set every cell back to resting — it undoes the chill in
  // the same breath, so leaving the cloud behind would be the odd half.
  if (named !== 'Cold fog, Fire, Smoke, Steam') bad.push(`the fire's leavings derived as [${named}]`);

  // A log pile alight, a pond with fish in it, worms on the woodpile, well apart.
  const build = () => {
    __wipe(); const f = __floor();
    __slab(cx-24, f-9, cx-8, f-1, WOOD);
    __slab(cx+4, f-7, cx+20, f-1, WATER);
    for (let n=0;n<6;n++) put(cx+6+n*2, f-3, FISH);
    for (let n=0;n<8;n++) put(cx-22+n*2, f-10, WORM);
    return f;
  };

  let f = build();
  __hold(cx-16, f-10, 3, 300);
  for (let k=0;k<400;k++) __step(1);
  if (!__alight(WOOD)) return 'the woodpile never caught, so nothing here is being put out';
  const wood0 = __count(WOOD), water0 = __count(WATER), fish0 = __count(FISH), life0 = living();

  ask('fire');
  if (fumes()) bad.push(`${fumes()} cells of flame and smoke survived the fire being put out`);
  if (__alight(WOOD)) bad.push(`${__alight(WOOD)} cells of wood were still alight afterwards`);
  if (__maxT() > AMBIENT + 1) bad.push(`the hottest cell left was ${Math.round(__maxT())}°C`);
  if (__count(WOOD) !== wood0) bad.push(`${wood0 - __count(WOOD)} cells of wood went with the fire`);
  if (__count(WATER) !== water0) bad.push(`${water0 - __count(WATER)} cells of water went with the fire`);
  if (living() !== life0) bad.push(`${life0 - living()} living things went with the fire`);

  // And it stays out, in the only scene where staying out is in doubt: a heat source
  // that is still there afterwards. Lava is not a fire and Fire is not a way of turning
  // it off, so the wood does catch again — but it has to do it from cold, the whole way
  // round the ignition path. Measured: 66 ticks to first light, 71-74 to relight. A
  // build that cooled nothing, or that left the charring banked, would flare in one or
  // two, and putting the fire out would look broken.
  for (let k=0;k<900;k++) __step(1);
  if (__alight(WOOD)) bad.push(`the fire restarted with no heat source: ${__alight(WOOD)} cells alight`);

  __wipe(); f = __floor();
  __slab(cx-6, f-14, cx+6, f-1, WOOD);
  __slab(cx-14, f-4, cx-7, f-1, LAVA);
  let lit = -1;
  for (let k=1;k<=1500;k++){ __step(1); if (__alight(WOOD)){ lit = k; break; } }
  if (lit < 0) bad.push('wood against lava never caught at all');
  else {
    ask('fire');
    if (__alight(WOOD)) bad.push('the wood was still alight the moment the fire was put out');
    let again = -1;
    for (let k=1;k<=1500;k++){ __step(1); if (__alight(WOOD)){ again = k; break; } }
    if (again < 0) bad.push(`lava stopped setting light to wood after a Fire — it caught at ${lit} the first time and never again`);
    else if (again < 40) bad.push(`the fire came back after ${again} ticks against ${lit} to light it cold — it was smouldering, not out`);
  }

  // Life, on a scene that is still burning, to be sure it is taking creatures rather
  // than taking everything that is not stone.
  f = build();
  __hold(cx-16, f-10, 3, 300);
  for (let k=0;k<400;k++) __step(1);
  const wood1 = __count(WOOD), water1 = __count(WATER), alight1 = __alight(WOOD);
  if (!living()) return 'nothing was alive by the time Life was asked for';
  if (!alight1) return 'the second woodpile never caught, so this leg proves nothing';

  ask('life');
  if (living()) bad.push(`${living()} living things survived Life`);
  if (__count(FISH) || __count(WORM)) bad.push('a fish or a worm came through Life');
  if (__count(WOOD) !== wood1) bad.push(`${wood1 - __count(WOOD)} cells of wood went with the creatures`);
  if (__count(WATER) !== water1) bad.push(`${water1 - __count(WATER)} cells of water went with the creatures`);
  if (!__alight(WOOD)) bad.push('Life put the fire out as well, which is the other option');

  // Back, which has to be the answer that does nothing at all.
  const held = __count(WOOD) + __count(WATER);
  ask('none');
  if (__count(WOOD) + __count(WATER) !== held) bad.push('Back removed something');

  ask('all');
  let left = 0;
  for (let i=0;i<type.length;i++) if (type[i]!==E) left++;
  if (left) bad.push(`Everything left ${left} cells behind`);

  if (fish0 < 4) bad.push(`the pond only held ${fish0} fish, so the Life leg was thin`);
  return bad.length ? bad.join('; ') : null;
});

/* Seeds, and the two things one turns into. The claim is not "plants appear" — it is that
   they appear **where they can and nowhere else**, which is the half a screenshot cannot
   tell you. A box that grew flowers on a stone floor would look just as green. */
await check(browser, 'a seed comes up on damp soil, and sits there on anything else', () => {
  const bad = [];
  const stalks = () => {                       // how many columns have a plant in them
    let n = 0;
    for (let x=0;x<W;x++){
      let got = false;
      for (let y=0;y<H;y++){ const t = type[idx(x,y)]; if (t===STEM || t===FLOWER) got = true; }
      if (got) n++;
    }
    return n;
  };
  const plants = () => __count(SEED) + __count(STEM) + __count(FLOWER) + __count(GRASS);
  const tallest = () => {
    let m = 0;
    for (let x=0;x<W;x++){
      let h = 0;
      for (let y=0;y<H;y++){ const t = type[idx(x,y)]; if (t===STEM || t===FLOWER) h++; }
      if (h > m) m = h;
    }
    return m;
  };

  /* Three beds, one difference each. Soil and water; soil and no water; water and no soil.
     Sown the same way and given the same time, so the only thing that can explain a
     difference between them is the rule. */
  const sow = (ground, wet) => {
    __wipe(); const f = __floor();
    __slab(6, f-6, 60, f-1, ground);
    if (wet) __slab(6, f-9, 12, f-7, WATER);
    let n = 0;
    for (let k=0;k<12;k++){ put(16 + k*3, f-8, SEED); n++; }
    return { f, n };
  };

  const damp = sow(DIRT, true);
  for (let k=0;k<3000;k++) __step(1);
  const grew = __count(FLOWER), up = stalks(), high = tallest();
  /* Height first, and before the bail below, because the way a height cap breaks is that
     stalks climb forever and never open — so the flower count goes to nought and every
     assertion written after "did anything grow" stops running. Tried it: with the cap
     removed this check failed with "nothing came up on damp soil", which is true and is
     not the fault. */
  if (high > M[STEM].tall)
    bad.push(`a stalk reached ${high} against a stated height of ${M[STEM].tall}`);
  if (!grew) return (bad.length ? bad.join('; ') + '; ' : '') +
    `nothing opened on damp soil — ${__count(STEM)} cells of stem, ${__count(SEED)} seeds left`;
  if (grew < damp.n * 0.6)
    bad.push(`${damp.n} seeds on damp soil gave ${grew} flowers`);
  /* No claim here about how many seeds are left. There was one — that the seeds still lying
     about must be the ones that have not come up yet — and self-seeding made it false: a
     flower sows seeds of its own, so the count goes up as well as down and "seeds remaining"
     stops meaning "seeds that failed". The two beds below still make the claim, because
     nothing flowers on either of them and so nothing sows. */
  // One head per stalk. A stalk that opened twice would read as "it grew" and be wrong.
  if (grew !== up) bad.push(`${up} stalks carry ${grew} flowers between them — that is not one each`);

  const dry = sow(DIRT, false);
  for (let k=0;k<3000;k++) __step(1);
  if (__count(STEM) + __count(FLOWER))
    bad.push(`${__count(STEM) + __count(FLOWER)} cells of plant came up on soil with no water anywhere`);
  if (__count(SEED) !== dry.n) bad.push(`${dry.n - __count(SEED)} seeds went missing on dry soil`);

  const rock = sow(STONE, true);
  for (let k=0;k<3000;k++) __step(1);
  if (__count(STEM) + __count(FLOWER))
    bad.push(`${__count(STEM) + __count(FLOWER)} cells of plant came up on wet stone`);
  if (__count(SEED) !== rock.n) bad.push(`${rock.n - __count(SEED)} seeds went missing on stone`);

  /* And a meadow burns, which is the other half of why it is here at all. This is the choice
     moss did not make: moss withers rather than burns, because moss grows on what a fire
     leaves behind and grew back on its own ash. A plant comes from a seed you placed, so
     there is no loop.

     What a match does to a meadow, measured nine times across three spacings: it takes
     **27% to 48% of it** and then goes out, and the spacing makes no difference — the
     hypothesis going in was that gaps between stalks would stop the fire, and they do not,
     because what stops it is a thin stalk with ten fuel in it losing heat to the air faster
     than the next one can catch. So the claim is a patch, not a field, and the bar is under
     the worst run rather than near the average of a lucky one. */
  const f = sow(DIRT, true).f;
  for (let k=0;k<3000;k++) __step(1);
  // Everything that burns down to ash, not just the standing stalks. Seeds and grass have
  // an `ash` of their own, and leaving them out of the accounting reported 24 cells of ash
  // from 22 cells of plant — the two missing kinds, read as matter being manufactured.
  const standing = plants();
  if (standing < 12) return (bad.length ? bad.join('; ') + '; ' : '') +
    `only ${standing} cells of plant grew, so the burn leg proves nothing`;
  const ash0 = __count(ASH);
  /* Counted as cells that went from being a plant to being ash, one tick at a time, rather
     than by subtracting the two ends. Two goes at the cheap version were both wrong, and both
     were wrong because **the meadow grows while it burns**:

     · net loss over the window said 17 cells of plant left 18 cells of ash, which reads as
       matter being manufactured and was two cells growing while eighteen burnt;
     · adding up the per-tick drops said 0 cells lost against 26 of ash, because a tick that
       burns two and sows two has no drop in it at all.

     Nothing short of watching the cells themselves gets this right, so that is what this
     does. A plant cell can only become ash by burning: ash is a powder, and a powder cannot
     displace a solid, so no ash ever falls into a cell that had a plant in it. */
  const wasPlant = new Uint8Array(type.length);
  const mark = () => { for (let i=0;i<type.length;i++){
    const t = type[i];
    wasPlant[i] = (t===SEED || t===STEM || t===FLOWER || t===GRASS) ? 1 : 0; } };
  mark();
  /* The match is held inside the counted loop rather than by `__hold` before it, which is the
     third thing this leg got wrong: `__hold` runs its own two hundred ticks, most of the
     burning happens in them, and counting only afterwards found nought transitions against
     twenty-odd cells of ash. This is what `__hold` does, unrolled so the counting can see it. */
  let burnt = 0;
  for (let k=0;k<3200;k++){
    if (k < 200) __flame(20, f-10, 4);
    __step(1);
    for (let i=0;i<type.length;i++) if (wasPlant[i] && type[i]===ASH) burnt++;
    mark();
  }
  /* A count, not a fraction. The fraction was tried and it is the wrong shape: measured seven
     times it came out 12, 23, 26, 28, 31, 40 and 47 per cent, so any bar drawn inside that
     spread is a bar drawn inside the working distribution — which is the mistake three other
     checks in this suite have already made. The failure this is looking for is plants that do
     not burn, and that is exactly nought every time. Seven to thirty-four cells burnt across
     those runs, so five is in a gap with nothing in it. */
  if (burnt < 5)
    bad.push(`a fire held in the middle of ${standing} cells of plant burnt ${burnt} of them`);
  const made = __count(ASH) - ash0;
  if (made > burnt)
    bad.push(`${burnt} cells of plant burnt and left ${made} cells of ash — the meadow is making matter`);
  return bad.length ? bad.join('; ') : null;
});

/* The other end of the same rule. Growth is gated on water, but a gate on growth is not a
   gate on staying alive — a meadow that had drunk once and then stood there forever would
   make a pond a thing you need for a minute rather than a thing the scene is built around.
   `thirst` is what makes taking the water away mean something.

   Measured: the water goes, and 78 cells of plant are gone within about forty seconds. */
/* Reported from the phone with pictures: a fire ate the bank out from under a meadow and the
   flowers, stems and grass stayed where they were, hanging over the water.

   They are `ph:3` — static solids, like stone and wood — so the falling pass never looks at
   them, and nothing else was asking whether they still had anything underneath. Moss had the
   same hole from the day it was written, and hid it well: it refuses to be painted in mid-air
   and refuses to spread there, so the only way to see it was to take the wall away afterwards,
   which no check did. */
await check(browser, 'nothing green stays in the air when the ground under it goes', () => {
  const bad = [];
  const KINDS = [STEM, FLOWER, GRASS, MOSS];

  // The simplest possible statement of it: one cell of each, dropped into empty air.
  __wipe(); let f = __floor();
  __slab(4, f-10, W-5, f-1, WATER);
  KINDS.forEach((t,k) => put(10 + k*10, f-30, t));
  put(60, f-30, SEED);
  for (let k=0;k<600;k++) __step(1);
  for (const t of KINDS)
    if (__count(t)) bad.push(`${M[t].n} was still hanging in mid-air after ten seconds`);
  // A seed is a powder and is supposed to fall rather than come apart, which is the other
  // half: this is a rule about things that cannot fall, not a rule about everything green.
  if (!__count(SEED)) bad.push('the seed came apart in mid-air as well — it should have fallen');

  /* And the case as it was reported: a grown meadow with the bank taken out from under half
     of it. The half over ground stays, the half over nothing does not — which is the pair of
     claims, because a rule that killed the lot would also pass the check above. */
  /* On stone, not on water. The first go built the bank straight onto a sea and it sank
     without being touched — dirt is denser than water, so a bank floating on one is not a
     scene, it is a countdown. Nine cells of plant grew before it went under. */
  __wipe(); f = __floor();
  __slab(4, f-8, W-5, f-1, DIRT);
  for (let y=f-7; y<f-1; y++) for (let x=60; x<70; x++) put(x, y, WATER);
  for (let k=0;k<8;k++) put(24 + k*4, f-10, SEED);
  for (let k=0;k<9000;k++) __step(1);
  const green = () => __count(STEM) + __count(FLOWER) + __count(GRASS);
  const grown = green();
  if (grown < 10) return `only ${grown} cells of plant grew, so nothing below can be concluded`;
  const cut = (W>>1);
  let overCut = 0;
  for (let x=cut; x<W-5; x++) for (let y=0; y<H; y++){
    const t = type[idx(x,y)];
    if (t===STEM || t===FLOWER || t===GRASS) overCut++;
  }
  // Dig the bed out from under the right-hand half, the way a fire would.
  for (let y=f-8; y<=f-1; y++) for (let x=cut; x<W-5; x++) put(x, y, E);
  for (let k=0;k<1200;k++) __step(1);

  let left = 0, hanging = 0;
  for (let x=0;x<W;x++) for (let y=0;y<H-1;y++){
    const t = type[idx(x,y)];
    if (t!==STEM && t!==FLOWER && t!==GRASS) continue;
    if (x >= cut) left++;
    const u = type[idx(x,y+1)];
    if (u === E) hanging++;
  }
  if (hanging) bad.push(`${hanging} cells of plant were left hanging over nothing`);
  if (overCut && left > overCut * 0.25)
    bad.push(`${left} of ${overCut} cells of plant over the dug half survived having no ground`);
  if (green() < grown * 0.25)
    bad.push(`digging half the bank away took ${grown - green()} of ${grown} cells of plant — it killed the lot`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'plants die when the water goes, and not while it is there', () => {
  const bad = [];
  const bed = () => {
    __wipe(); const f = __floor();
    __slab(6, f-6, 60, f-1, DIRT);
    __slab(6, f-9, 12, f-7, WATER);
    for (let k=0;k<12;k++) put(16 + k*3, f-8, SEED);
    for (let k=0;k<3000;k++) __step(1);
    return __count(STEM) + __count(FLOWER);
  };

  // Left alone, with the pond still there.
  const kept = bed();
  if (kept < 12) return `only ${kept} cells of plant grew, so this proves nothing`;
  for (let k=0;k<4000;k++) __step(1);
  const still = __count(STEM) + __count(FLOWER);
  if (still < kept * 0.8)
    bad.push(`${kept} cells of plant became ${still} with the pond untouched — they are dying of something else`);

  // And the same bed with the water taken out from under them.
  const grown = bed();
  for (let i=0;i<type.length;i++) if (type[i]===WATER || type[i]===ICE || type[i]===STEAM) put(i%W, (i/W)|0, E);
  for (let k=0;k<4000;k++) __step(1);
  const left = __count(STEM) + __count(FLOWER);
  if (left) bad.push(`${left} of ${grown} cells of plant were still alive long after the water went`);
  if (!finds.has(STEM + ':thirst') && !finds.has(FLOWER + ':thirst'))
    bad.push('nothing reported dying of thirst, so they went some other way');
  return bad.length ? bad.join('; ') : null;
});

/* One seed becomes a meadow, and then the meadow stops.

   The stopping is the half worth checking. Moss is the precedent and it is not a happy one:
   one spreading rule, and it made a 1219-cell fog on a pillar before it was bounded. This is
   two rules feeding each other — a flower enriches the ground, rich ground lets a flower sow
   — which is the shape of a thing that runs away. Nothing tells it to stop. It stops because
   a flower can only enrich what it can reach, only sows onto bare ground standing on soil,
   and will not sow shoulder to shoulder with a stalk that is already there.

   Measured on the bed below: it climbs for about two and a half minutes and is then flat to
   the tick — 14 flowers, 162 rich, 17 grass at 160s and the same at 400s. */
await check(browser, 'one seed becomes a meadow, and the meadow stops', () => {
  const bad = [];
  const census = () => ({ seed: __count(SEED), stem: __count(STEM), flower: __count(FLOWER),
                          rich: __count(RICH), grass: __count(GRASS), dirt: __count(DIRT) });

  __wipe(); const f = __floor();
  __slab(4, f-8, W-5, f-1, DIRT);
  for (let y=f-7; y<f-1; y++) for (let x=60; x<70; x++) put(x, y, WATER);   // a trench in it
  const dirt0 = __count(DIRT);
  put(40, f-10, SEED);

  /* Two samples, and the early one is the interesting half. A flower may only sow onto ground
     that has already been fed, and feeding is the slow step — `enrich` 400 against `sows` 200
     — so the meadow is paced by the soil rather than by the flowers. Measured five times, it
     has **1 to 5 flowers** at this point. A build where sowing takes any soil it likes has
     **18 or 19** and is already finished, which is what makes this a gate rather than a
     sentence in a comment. The first version of the rule only asked that there be rich soil
     somewhere in reach, and that was unfalsifiable: a flower feeds faster than it sows, so it
     was true within seconds of the flower opening and removing it changed nothing. */
  for (let k=0;k<4000;k++) __step(1);
  const early = census();
  if (early.flower > 9)
    bad.push(`${early.flower} flowers a minute in — the meadow is not waiting for the ground`);

  for (let k=0;k<14000;k++) __step(1);
  const grown = census();
  // Measured five times at this point: 14-15 flowers, 135-167 cells of rich soil, 16-17
  // blades of grass. The bars sit well under the worst of those.
  if (grown.flower < 8)
    return `one seed gave ${grown.flower} flowers in five minutes — nothing below can be concluded`;
  if (grown.rich < 80) bad.push(`${grown.flower} flowers fed only ${grown.rich} cells of soil`);
  if (grown.grass < 6) bad.push(`${grown.rich} cells of rich soil put up ${grown.grass} blades of grass`);

  // It stops. Two samples a long way apart, on the same run rather than on two runs, because
  // "it grew this much" and "it grew this much and then stopped" are the same number once.
  for (let k=0;k<6000;k++) __step(1);
  const mid = census();
  for (let k=0;k<6000;k++) __step(1);
  const late = census();
  for (const k of ['flower','rich','grass']){
    if (late[k] > mid[k] * 1.08 + 2)
      bad.push(`${k} went ${mid[k]} → ${late[k]} between two and a half minutes apart — it is still going`);
  }

  /* Nothing is manufactured. Rich soil is made out of dirt and out of nothing else, so the
     two together have to be exactly what the dirt was. This is the cheapest possible guard
     against the failure moss had, where a thing that grew on what fire left behind grew back
     on its own ash and the scene ended up with more matter in it than it started with. */
  if (late.dirt + late.rich !== dirt0)
    bad.push(`${dirt0} cells of dirt became ${late.dirt} dirt and ${late.rich} rich soil — ` +
             `${late.dirt + late.rich - dirt0} cells appeared from nowhere`);

  /* And it stayed near the water. Measured four times on this bed, which is 134 cells wide
     with the trench at 60..69 and the seed at 40: the meadow spans **22 to 58** every time,
     within a cell or two. So the ends of the bed must still be bare, and a runaway would
     have to cross sixty cells of dry dirt to trip this. The first version of this line put
     the boundary at 20 and 110, which is a guess rather than a measurement — it sat one cell
     outside the real extent and failed one run and passed the next.

     It reaches further left than the flat `damp` 30 would suggest, and the reason is worth
     knowing: dirt is denser than water, so the row of soil capping the trench sinks into it
     and the water comes up to the surface, where it spreads. Nothing says that anywhere. It
     falls out of a powder being heavier than a liquid. */
  let far = 0;
  for (let x=4; x<W-5; x++){
    if (x > 12 && x < 100) continue;
    for (let y=0; y<H; y++){
      const t = type[idx(x,y)];
      if (t===RICH || t===GRASS || t===STEM || t===FLOWER) far++;
    }
  }
  if (far) bad.push(`${far} cells of meadow reached the ends of the bed, sixty cells past where it settles`);
  return bad.length ? bad.join('; ') : null;
});

/* The two halves of what rich soil is *for*, each measured against a bed that is missing the
   other half. A colour that only looked richer would pass neither. */
await check(browser, 'rich soil is what grass grows on and what lets a flower sow', () => {
  const bad = [];

  /* Grass, on a bed of rich soil laid down by hand with no flowers anywhere. If grass needed
     a flower nearby it would be the flower's rule wearing the soil's name. */
  __wipe(); let f = __floor();
  __slab(6, f-6, 60, f-1, RICH);
  __slab(6, f-10, 12, f-7, WATER);
  for (let k=0;k<6000;k++) __step(1);
  const blades = __count(GRASS);
  if (!blades) return 'bare rich soil beside water put up no grass at all';
  // One blade per exposed cell and no more: grass does not stack up or creep sideways off
  // the soil, so it cannot outnumber the surface it is standing on.
  let surface = 0;
  for (let x=0;x<W;x++) for (let y=1;y<H;y++)
    if (type[idx(x,y)]===RICH && (type[idx(x,y-1)]===E || type[idx(x,y-1)]===GRASS)) surface++;
  if (blades > surface)
    bad.push(`${blades} blades of grass on ${surface} exposed cells of rich soil`);

  // Dry rich soil puts up nothing, the same rule everything green in this box lives under.
  __wipe(); f = __floor();
  __slab(6, f-6, 60, f-1, RICH);
  for (let k=0;k<6000;k++) __step(1);
  if (__count(GRASS)) bad.push(`${__count(GRASS)} blades came up on rich soil with no water anywhere`);

  /* And sowing, asked the way round that can be answered. A seed on a bed that is already
     rich can spread at once; the same seed on plain dirt has to wait for the ground to be fed
     first, and feeding is the slow step. Two beds rather than one, because a flower left alone
     makes its own rich soil eventually — the arc is the point, and it is also what hides the
     gate if you only ever watch one bed to the end. */
  const bed = (ground) => {
    __wipe(); const ff = __floor();
    __slab(6, ff-6, 60, ff-1, ground);
    __slab(6, ff-10, 12, ff-7, WATER);
    put(20, ff-8, SEED);
    for (let k=0;k<5000;k++) __step(1);
    return __count(FLOWER);
  };
  const onRich = bed(RICH), onDirt = bed(DIRT);
  if (onRich < 3) bad.push(`a seed on ready-made rich soil gave ${onRich} flowers — it did not spread at all`);
  if (onDirt >= onRich) bad.push(`a seed spread as fast on plain dirt (${onDirt}) as on rich soil (${onRich}) — ` +
                                 `the ground is not pacing anything`);
  return bad.length ? bad.join('; ') : null;
});

/* Weather, and the reason there is more than one kind of it.

   Rain is the fire-fighting tool and it is meant to be a downpour — but one press leaves
   **2,202 cells of water standing seventeen rows deep across the floor**, and nothing but
   boiling ever takes water out again, so a box you have rained on stays a lake. That is fine
   for putting a fire out and useless for watering a garden.

   Mist is the other end: it is not material at all, just a state of the air that `damp()`
   reads, plus the occasional drop beading on something. So the claim worth checking is the
   pair — that mist grows a meadow, and that it does it without filling the box. */
await check(browser, 'mist waters what is growing, and rain drowns the box', () => {
  const bad = [];
  const bed = () => {
    __wipe(); const f = __floor();
    __slab(6, f-6, 100, f-1, DIRT);
    for (let k=0;k<10;k++) put(20 + k*6, f-8, SEED);
    return f;
  };
  // The frame runs the weather and then a tick; the harness has to do the same.
  const run = (kind, ticks, n) => {
    sky = kind; skyLeft = ticks;
    for (let k=0;k<n;k++){ if (skyLeft > 0){ skyLeft--; weatherTick(); } __step(1); }
  };

  // Nothing at all: the control. Ten seeds on dry soil are ten seeds on dry soil.
  bed(); run(0, 0, 4000);
  const idle = { flower: __count(FLOWER), seed: __count(SEED) };
  if (idle.flower) return `${idle.flower} flowers came up on dry soil with no weather — the control is wet`;

  // Mist: measured at 16 flowers and 45 stems from ten seeds, with 56 cells of water left.
  bed(); run(SKY_MIST, MIST_LEFT, 4000);
  const mist = { flower: __count(FLOWER), water: __count(WATER) };
  if (mist.flower < 4) bad.push(`a mist over ten seeds gave ${mist.flower} flowers`);
  if (mist.water > 300) bad.push(`a mist left ${mist.water} cells of water — that is a shower, not a mist`);

  // Rain on the same bed, for the number that makes the two different tools.
  bed(); run(SKY_RAIN, RAIN_LEFT, 4000);
  const rain = __count(WATER);
  if (rain < 1200) bad.push(`a rainstorm left only ${rain} cells of water — it is not the downpour it is for`);
  if (rain < mist.water * 4)
    bad.push(`rain left ${rain} and mist left ${mist.water} — they are the same weather with two names`);

  /* And mist has to still be there afterwards, in the sense that matters: the meadow it grew
     must not die the moment it stops. The first version of mist had no dew in it at all and
     every plant was dead within seconds of the mist ending, because `thirst` starts running
     the instant `damp` goes false and mist left nothing behind. */
  bed(); run(SKY_MIST, MIST_LEFT, 4000);
  const stood = __count(FLOWER) + __count(STEM) + __count(GRASS);
  for (let k=0;k<3000;k++) __step(1);                    // long after the mist has gone
  const after = __count(FLOWER) + __count(STEM) + __count(GRASS);
  if (stood && after < stood * 0.3)
    bad.push(`${stood} cells of plant grew under a mist and ${after} were alive a minute after it stopped`);
  return bad.length ? bad.join('; ') : null;
});

/* Snow is the one that has to earn its place, and its whole case is that it does two things a
   shower does not: it lies, and it chills. Both of those are answers to what the room is set
   to, which is what makes it different from rain rather than colder rain. */
/* --------------------------------------------------------------- nitrogen

   Thermite's opposite, and the frame is worth keeping because it is what the material is
   for: thermite is the one thing a match cannot light and water cannot put out, and
   nitrogen is the one thing that can make the box colder than the room. Nothing else could
   — the fixed rooms are a floor you choose, and ice only ever reaches its own −14.

   Two pieces of shared code had to change for it and both were water's numbers wearing a
   general name. `spend` clamped at AMBIENT, so the coldest thing in the box could chill a
   stone floor to 20°C and not one degree past it; and the boil path set the vapour to a
   flat 100°C, which would have had nitrogen *heat* the box it is meant to freeze. */
await check(browser, 'nitrogen freezes what water only wets', () => {
  const bad = [];
  const pond = () => {
    __wipe(); const f = __floor();
    __slab(40, f-8, 90, f-1, WATER);
    return { f, n: __count(WATER) };
  };

  // Water on water is water. The control, and it is the one that would have passed on its
  // own the whole time `spend` was clamped at room temperature.
  let { f, n } = pond();
  __slab(50, f-16, 80, f-9, WATER);
  for (let k=0;k<900;k++) __step(1);
  if (__count(ICE)) bad.push(`${__count(ICE)} cells of ice appeared from pouring water on water`);

  // Measured: 154 of 408 frozen, and the coldest cell in the box below the Freezing room's
  // own −30 while the room is set to Normal.
  ({ f, n } = pond());
  let coldest = 1e9;
  __slab(50, f-16, 80, f-9, NITRO);
  for (let k=0;k<900;k++){ __step(1); const m = __minT(); if (m < coldest) coldest = m; }
  if (__count(ICE) < 40) bad.push(`nitrogen poured on ${n} cells of water froze ${__count(ICE)} of them`);
  if (coldest > 0) bad.push(`the coldest cell in the box was ${Math.round(coldest)}°C — nitrogen never got it below freezing`);
  return bad.length ? bad.join('; ') : null;
});

/* It is not a fire extinguisher, and that is the discovery rather than a shortfall. It
   flashes off against a flame and the cold goes up with the fog, so it slows a fire and
   does not stop one — which is what keeps water's job water's. Both numbers are needed:
   "nitrogen damped the fire" is true of doing nothing at all if you only look at one. */
await check(browser, 'nitrogen slows a fire where water puts it out', () => {
  const burn = (t) => {
    __wipe(); const f = __floor();
    __slab(20, f-16, 100, f-1, WOOD);
    __hold(60, f-8, 4, 90);
    for (let k=0;k<240;k++) __step(1);
    const lit = __count(FIRE);
    if (t !== null) __slab(48, f-20, 72, f-9, t);
    for (let k=0;k<600;k++) __step(1);
    return { lit, left: __count(FIRE) };
  };
  const bad = [];
  const alone = burn(null), wet = burn(WATER), cold = burn(NITRO);
  if (!alone.left) return `the control fire went out on its own (${alone.lit} → 0), so nothing here measures anything`;
  if (wet.left) bad.push(`water left ${wet.left} cells of fire burning`);
  if (!cold.left) bad.push(`nitrogen put the fire out completely — that is water's job, not its own`);
  if (cold.left >= alone.left)
    bad.push(`a fire left alone came to ${alone.left} and one drenched in nitrogen to ${cold.left} — it did nothing at all`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'a splash of nitrogen can be seen before it goes, and leaves nothing', () => {
  const bad = [];
  __wipe(); const f = __floor();
  __slab(60, f-14, 78, f-1, NITRO);
  const n0 = __count(NITRO);
  let seen = 0, fog = 0;
  for (let k=1;k<=900;k++){
    __step(1);
    if (__count(NITRO)) seen = k;
    if (__count(FOG) > fog) fog = __count(FOG);
  }
  /* A second and a half is the whole reason it arrives at −196 and boils at −180. Boiling
     is instant the moment a cell is over its threshold — melting soaks up `lat` first and
     boiling does not — so a liquid that arrived at its own boiling point flashed off on
     tick one and there was nothing on screen to see. Measured at 2.3s. */
  if (seen < 60) bad.push(`the liquid was gone in ${seen} ticks — you never see it`);
  if (seen > 600) bad.push(`the liquid was still there after ${seen} ticks — it is not flashing off, it is a pool`);
  if (fog < 30) bad.push(`boiling ${n0} cells of nitrogen made only ${fog} cells of fog`);
  if (__count(NITRO) || __count(FOG))
    bad.push(`${__count(NITRO)} liquid and ${__count(FOG)} fog were still in the box fifteen seconds later`);
  return bad.length ? bad.join('; ') : null;
});

/* The floor, which is the same claim MAX_T makes at the other end and which the file did
   not make until there was something cold enough to test it. Nothing in the box could go
   below the room before nitrogen, so an unbounded bottom cost nothing and was invisible. */
await check(browser, 'nothing in the box gets colder than the floor', () => {
  __wipe(); const f = __floor();
  // Everything, wall to wall, in the coldest room there is — the worst case there is.
  __room('Freezing');
  for (let y=8;y<f;y++) for (let x=4;x<W-4;x++) put(x,y,NITRO);
  let coldest = 1e9;
  for (let k=0;k<3600;k++){ __step(1); const m = __minT(); if (m < coldest) coldest = m; }
  __room('Normal');
  if (coldest < MIN_T) return `a cell reached ${Math.round(coldest)}°C against a floor of ${MIN_T}`;
  if (__nan()) return 'a temperature went to nothing';
  return null;
});

await check(browser, 'snow lies where it is cold and becomes water where it is not', () => {
  const bad = [];
  const fall = (room, n) => {
    __wipe(); __room(room);
    const f = __floor();
    __slab(6, f-4, W-7, f-1, STONE);
    sky = SKY_SNOW; skyLeft = SNOW_LEFT;
    let most = 0;
    for (let k=0;k<n;k++){
      if (skyLeft > 0){ skyLeft--; weatherTick(); }
      __step(1);
      if (__count(SNOW) > most) most = __count(SNOW);
    }
    return { most, lying: __count(SNOW), water: __count(WATER) };
  };

  /* Measured over forty seconds. Freezing: 440 fall and 440 are still there. Normal: it
     settles to 179 and is down to 41 by the end, having left 428 cells of water. The number
     in the middle is `lat` 200 and it took three goes to find — at 120 a flake melts on the
     way down and the most ever on screen is 59, at 400 the drift chills the box enough to
     stop its own thaw and 382 of it is still lying there. */
  const cold = fall('Freezing', 2400);
  if (cold.lying < 150) bad.push(`only ${cold.lying} cells of snow were left lying in a freezing room`);
  if (cold.water) bad.push(`${cold.water} cells of water appeared in a freezing room`);

  const warm = fall('Normal', 2400);
  __room('Normal');
  if (warm.most < 60) bad.push(`the most snow ever on screen in a normal room was ${warm.most} — you cannot see it fall`);
  if (warm.lying > warm.most * 0.6)
    bad.push(`${warm.lying} of a peak ${warm.most} was still lying in a normal room — it is not melting`);
  if (warm.water < 150) bad.push(`a snowfall in a normal room left ${warm.water} cells of water`);
  // And not so much of it that it is a rainstorm in a hat: the first rate tried melted down
  // to 2,075 cells, which is what a press of Rain leaves.
  if (warm.water > 900) bad.push(`a snowfall melted down to ${warm.water} cells of water — that is a rainstorm`);

  // It floats, because it is lighter than water. A powder that sank would just be gravel.
  __wipe(); const f = __floor();
  __slab(20, f-20, 80, f-1, WATER);
  for (let k=0;k<30;k++) put(30 + k, f-24, SNOW);
  __room('Freezing');
  for (let k=0;k<600;k++) __step(1);
  __room('Normal');
  let onTop = 0, sunk = 0;
  for (let x=0;x<W;x++) for (let y=0;y<H-1;y++){
    if (type[idx(x,y)] !== SNOW) continue;
    if (type[idx(x,y+1)] === WATER) onTop++;
    let below = false;
    for (let k=y-1;k>=0;k--) if (type[idx(x,k)] === WATER) below = true;
    if (below) sunk++;
  }
  if (!onTop) bad.push('no snow was left floating on the pond');
  if (sunk > onTop) bad.push(`${sunk} cells of snow sank under the water and ${onTop} floated`);
  return bad.length ? bad.join('; ') : null;
});

/* A storm is the only thing in the box that starts a fire without you. It is also the only
   thing that puts 1500°C into a cell from nowhere, so the second half of the check is that an
   empty box survives being struck — a weather that cooked the room every time you tried it
   would be a weather nobody uses twice. */
await check(browser, 'a storm sets fire to things, and an empty box lives through it', () => {
  const bad = [];
  // Returns the hottest it ever got, not the hottest it is at the end. Thermite burns out
  // and cools, so a reading taken afterwards says nothing about whether it went off — the
  // first version of this check asked exactly that and reported a storm doing nothing to a
  // bed that had reached 2,454°C in the middle of it.
  const storm = (n) => {
    sky = SKY_STORM; skyLeft = STORM_LEFT;
    let peak = 0;
    for (let k=0;k<n;k++){
      if (skyLeft > 0){ skyLeft--; weatherTick(); }
      __step(1);
      if (__maxT() > peak) peak = __maxT();
    }
    return peak;
  };

  __wipe(); let f = __floor();
  __slab(6, f-10, W-7, f-1, WOOD);
  const wood0 = __count(WOOD);
  const woodPeak = storm(2400);
  if (!__count(ASH) && !__alight(WOOD) && __count(WOOD) === wood0)
    bad.push(`a storm over a field of wood set light to none of it (peak ${Math.round(woodPeak)}°C)`);

  /* Thermite is the point of 1500 rather than a match's 780: a match cannot light it at all,
     and the sky can. This is the discovery the weather is worth having for. */
  __wipe(); f = __floor();
  __slab(20, f-6, 90, f-1, THERMITE);
  // Thermite's own ash is molten steel, not ash, so what it leaves is the wrong thing to
  // count. It burns at 2,450°C and nothing else in this scene can reach that.
  const hot = storm(3000);
  if (hot < 1600)
    bad.push(`a storm over a bed of thermite peaked at ${Math.round(hot)}°C — it never went off, ` +
             `which is the one thing lightning can do that a match cannot`);

  // And an empty box. Struck twenty times over forty seconds, it has to come back to a room.
  __wipe(); __floor();
  storm(2400);
  for (let k=0;k<1800;k++) __step(1);
  if (__maxT() > AMBIENT + 40)
    bad.push(`an empty box was still at ${Math.round(__maxT())}°C half a minute after the storm`);
  if (__nan()) bad.push('a temperature went to nothing during a storm');
  return bad.length ? bad.join('; ') : null;
});

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
  const worms = bench(WORM, 500);
  if (worms > 1) bad.push(`${worms.toFixed(2)}ms a tick for 500 worms`);
  const moths = bench(MOTH, 500);
  if (moths > 2) bad.push(`${moths.toFixed(2)}ms a tick for 500 moths with a fire lit`);
  // Fish need water to be in, so they get their own scene rather than the shared one.
  __wipe(); const f2 = __floor();
  __slab(4, f2-40, W-5, f2-1, WATER);
  for (let k=0;k<500;k++) put(6+(k%120), f2-30-((k/120)|0), FISH);
  for (let k=0;k<60;k++) __step(1);
  const t1 = performance.now();
  for (let k=0;k<200;k++) moveLife();
  const fish = (performance.now() - t1) / 200;
  if (fish > 1) bad.push(`${fish.toFixed(2)}ms a tick for ${__count(FISH)} fish`);
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
await check(browser, 'every material has a save key, no two share one, and a rename does not break a save', () => {
  const bad = [], seen = new Map();
  for (let t=0; t<M.length; t++){
    if (!M[t]) continue;
    const k = SAVE_KEY[t];
    if (!k){ bad.push(`${M[t].n} (index ${t}) has no save key`); continue; }
    if (seen.has(k)) bad.push(`${M[t].n} and ${seen.get(k)} both save as "${k}"`);
    seen.set(k, M[t].n);
  }
  if (TYPE_OF_KEY.size !== seen.size) bad.push(`the reverse lookup has ${TYPE_OF_KEY.size} entries for ${seen.size} keys`);

  /* A key is allowed to disagree with the label — that is the entire reason this table is
     separate — but a *save* must round-trip whatever either of them says. One creature has
     been a Woodlouse and then an Ash bug, and the original is now a Worm. So: write one cell
     of everything, read it back, and compare **types rather than names**. That is the
     assertion that survives the keys themselves being tidied, which is what happened once it
     was clear no save anybody minded losing existed yet. */
  __wipe();
  const all = [];
  for (let t=1; t<M.length; t++) if (M[t] && SAVE_KEY[t]) all.push(t);
  const spot = (k) => idx(2 + (k % (W-4)), 2 + ((k / (W-4)) | 0));
  all.forEach((t, k) => { const i = spot(k); put(i % W, (i / W) | 0, t); });
  const before = all.map((t, k) => type[spot(k)]);
  const text = JSON.stringify(encodeScene());
  __wipe();
  const missing = decodeScene(JSON.parse(text));
  if (missing.length) bad.push(`${missing.join(', ')} could not be placed on the way back`);
  all.forEach((t, k) => {
    const was = before[k], now = type[spot(k)];
    if (was !== now)
      bad.push(`${M[was].n} saved as "${SAVE_KEY[was]}" and came back as ${M[now] ? M[now].n : now}`);
  });
  return bad.length ? bad.join('; ') : null;
});

/* The room is part of what was built, not part of the app around it. Leaving it out of
   the save was a defect: a volcano built in a Furnace and loaded back at Normal is a
   different scene doing different things, and nothing about it looks wrong. */
/* --------------------------------------------------------------- the room that answers

   Every other setting is an infinite reservoir. Neutral is the box's own temperature fed
   back into the walls, and it is the only part of the heat model that can be driven by
   what the player builds — so it is the only part that can be driven somewhere it cannot
   come back from. These four checks are the ones that would have caught the two versions
   of it that did not work.

   Version one simply followed the box. Measured, a big fire drove the room to 400°C and it
   stayed there for good, because a hot room reheats the box which keeps the room hot.
   Version two bounded that with a hard clamp, which stopped the number running away and
   changed nothing else: the room sat pinned at the clamp a hundred and fifty seconds after
   the fire was out, and a small fire and a large fire both read exactly the ceiling. */
await check(browser, 'an empty box on Neutral stays where it is', () => {
  __room('Neutral');
  __wipe(); __floor();
  for (let k=0;k<3600;k++) __step(1);
  // The one thing Neutral must never do is have an opinion about nothing. Any asymmetry
  // between the way it reads the box and the way the box relaxes toward it shows up here
  // first, as a room that wanders off with an empty box in front of it.
  if (Math.abs(AMBIENT - 20) > 0.5)
    return `sixty seconds with an empty box took the room from 20°C to ${AMBIENT.toFixed(2)}`;
  return null;
});

await check(browser, 'ice makes the room cold and fire makes it warm', () => {
  const bad = [];
  // Measured: a forty-row slab of ice takes the room to 4.8°C in a minute, and a box packed
  // with ice to −1.8. A room that answers ice at all is the whole reason this exists.
  __room('Neutral');
  __wipe(); let f = __floor();
  __slab(4, f-40, W-5, f-1, ICE);
  for (let k=0;k<3600;k++) __step(1);
  const iced = AMBIENT;
  if (iced > 10) bad.push(`a forty-row slab of ice left the room at ${iced.toFixed(1)}°C`);

  /* And the other direction, with the gradation that the clamped version did not have.
     A small fire reads 28 and a large one 63, so the two are not the same event: measured
     against the clamped version, which read 31.6 and 39.9 and could not tell them apart. */
  __room('Neutral');
  __wipe(); f = __floor();
  __slab(60, f-10, 76, f-1, WOOD);
  __hold(68, f-5, 3, 120);
  let small = -1e9;
  for (let k=0;k<2400;k++){ __step(1); if (AMBIENT > small) small = AMBIENT; }

  __room('Neutral');
  __wipe(); f = __floor();
  __slab(6, f-30, W-7, f-1, WOOD);
  for (let x=14; x<W-14; x+=18) __hold(x, f-16, 4, 40);
  let large = -1e9;
  for (let k=0;k<3600;k++){ __step(1); if (AMBIENT > large) large = AMBIENT; }

  if (small < 22) bad.push(`a small fire moved the room to ${small.toFixed(1)}°C, which is nothing`);
  if (large < 45) bad.push(`a large fire moved the room to ${large.toFixed(1)}°C`);
  if (large < small + 20)
    bad.push(`a small fire read ${small.toFixed(1)} and a large one ${large.toFixed(1)} — the room cannot tell them apart`);
  // Neither may reach the span, or the reading is the rail and not a measurement.
  if (large > 20 + N_SPAN_HOT - 1)
    bad.push(`a large fire pinned the room at ${large.toFixed(1)} against a span of ${N_SPAN_HOT}`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the room comes back, and cannot be driven somewhere it cannot', () => {
  const bad = [];

  /* The failure this is really about: a fire that leaves the room hot for good. Version one
     of Neutral ended at 400°C and stayed; version two sat on its clamp for the full 150
     seconds measured. What has to be true is that the room is *falling* — the box after a
     big fire is genuinely 150°C of hot stone and ash and takes minutes to shed it, so this
     asks for a decline rather than a return to 20. */
  __room('Neutral');
  __wipe(); let f = __floor();
  __slab(6, f-30, W-7, f-1, WOOD);
  for (let x=14; x<W-14; x+=18) __hold(x, f-16, 4, 40);
  for (let k=0;k<2400;k++) __step(1);
  const hot = AMBIENT;
  for (let i=0;i<type.length;i++){                       // put it out
    const t = type[i];
    if (t===FIRE || t===EMBER || (M[t].fuel && fuel[i]>0 && life[i]>0)){
      type[i]=E; fuel[i]=0; life[i]=0; temp[i]=Math.min(temp[i], 200);
    }
  }
  for (let k=0;k<9000;k++) __step(1);                    // 150 seconds
  if (hot < 40) return `the fire only took the room to ${hot.toFixed(1)}°C, so the recovery proves nothing`;
  if (AMBIENT > hot - 12)
    bad.push(`the room was ${hot.toFixed(1)}°C when the fire went out and ${AMBIENT.toFixed(1)} two and a half minutes later`);

  /* And the cold side all the way back, which it can do because ice leaves nothing behind
     the way a fire leaves hot ash. Measured at 73 seconds to within two degrees of 20. */
  __room('Neutral');
  __wipe(); f = __floor();
  __slab(4, f-40, W-5, f-1, ICE);
  for (let k=0;k<3600;k++) __step(1);
  const cold = AMBIENT;
  for (let i=0;i<type.length;i++) if (type[i]===ICE || type[i]===WATER){ type[i]=E; temp[i]=AMBIENT; }
  for (let k=0;k<7200;k++) __step(1);                    // two minutes
  if (cold > 10) return `the ice only took the room to ${cold.toFixed(1)}°C, so the recovery proves nothing`;
  if (Math.abs(AMBIENT - 20) > 2)
    bad.push(`the room was ${cold.toFixed(1)}°C under the ice and ${AMBIENT.toFixed(1)} two minutes after it went`);

  /* The runaway, stated directly: light everything, twice, and the room may not end past
     its own span. Version one failed this at 400°C against a stated ceiling of 400. */
  __room('Neutral');
  __wipe(); f = __floor();
  __slab(4, 20, W-5, f-1, WOOD);
  for (let x=10; x<W-10; x+=12) __hold(x, 40, 5, 30);
  for (let k=0;k<7200;k++) __step(1);
  for (let x=10; x<W-10; x+=12) __hold(x, 60, 5, 30);
  for (let k=0;k<7200;k++) __step(1);
  if (AMBIENT > 20 + N_SPAN_HOT)
    bad.push(`burning the whole box twice put the room at ${AMBIENT.toFixed(1)}°C, past its span of ${N_SPAN_HOT}`);
  if (!Number.isFinite(AMBIENT)) bad.push('the room went to nothing');
  return bad.length ? bad.join('; ') : null;
});

/* A save has to carry the number, not just the name. On every other setting the name is the
   number; on Neutral it is wherever the box had driven it, and a scene saved at −1.8°C under
   a slab of ice that came back at 20 would melt its way to the reading it was already at. */
await check(browser, 'a save carries a drifted room, and a fixed one ignores a stale number', () => {
  const bad = [];
  __room('Neutral');
  __wipe(); const f = __floor();
  __slab(4, f-40, W-5, f-1, ICE);
  for (let k=0;k<3600;k++) __step(1);
  const at = AMBIENT;
  if (at > 10) return `the ice only took the room to ${at.toFixed(1)}°C, so this measures nothing`;
  const text = JSON.stringify(encodeScene());

  __room('Oven');
  decodeScene(JSON.parse(text));
  if (ROOMS[roomAt].n !== 'Neutral') bad.push(`saved on Neutral and loaded as ${ROOMS[roomAt].n}`);
  if (Math.abs(AMBIENT - at) > 0.5)
    bad.push(`saved with the room at ${at.toFixed(1)}°C and it came back at ${AMBIENT.toFixed(1)}`);

  /* ...and the other way, which is the part that is easy to get wrong: a fixed room's number
     comes from its name, so a save carrying `at` from some other setting must not be allowed
     to contradict it. Written by hand here because only a corrupted or hand-edited save has
     this shape, and it is exactly the shape that would put a Furnace at −1.8°C. */
  const forged = JSON.parse(text);
  forged.room = 'Furnace'; forged.at = -1.8;
  __room('Normal');
  decodeScene(forged);
  const furnace = ROOMS.find(r => r.n === 'Furnace').t;
  if (AMBIENT !== furnace)
    bad.push(`a save claiming Furnace at −1.8°C loaded as ${AMBIENT}°C rather than ${furnace}`);

  __room('Normal');
  return bad.length ? bad.join('; ') : null;
});

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

  __room('Normal');
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
