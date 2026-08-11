// Interaction harness for matchbox.html
//
// Everything here is about the hand rather than the heat. The simulation suite next
// door builds scenes and counts cells; this one drives the page the way a thumb does
// and asserts on what the box did in response.
//
// The defects it was written for were all silent. None threw, none looked wrong in a
// screenshot, and the worst of them only happens if you keep your finger down for
// twenty-six seconds:
//
//   · the match burning out mid-drag switched the tool to Wood, so a finger that was
//     applying flame started laying logs. Measured at 267 cells, without the finger
//     ever leaving the glass.
//   · Clear wiped the scene on one tap, with no confirmation and no undo, sitting the
//     same size and colour as Erase and Rain in the same row.
//   · any resize rebuilt the grid and reseeded it, so rotating the phone erased what
//     you had built. Fixed once, and then only most of the way: the rebuild still threw
//     away everything above the new ceiling, so rotating a phone and rotating it back
//     deleted 912 cells of paper and 1112 of wood off the top of a test scene. The check
//     written the first time passed, because it had been written to accept that.
//   · Clear wiped everything you could see and left what you could not, so turning the
//     phone handed it back.
//   · a drawer that wrapped to two rows made the tray taller and moved the scene, and
//     Clear growing into "Clear — sure?" did it between the tap that asks and the tap
//     that confirms.
//
// One thing this harness cannot see, and it has already been caught out by it once:
// **it blocks the network, so the page is laid out in a fallback monospace while a
// phone gets Space Mono, which is wider.** A one-row check written here passed on a
// build that was visibly wrapping in the hand. Assert what is true in any font — that
// nothing moves, that widths within a row match — and never that a particular label
// fits.
//
// Run:  npm i playwright  &&  node test/matchbox-ui.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const PAGE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '..', 'matchbox.html');
const VIEWPORT = { width: 390, height: 844 };   // a phone, held upright

let passed = 0, failed = 0;

async function check(name, body) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.setDefaultTimeout(20000);
  const problems = [];
  page.on('pageerror', e => problems.push('uncaught: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  await page.route(u => /^https?:/.test(u.href), r => r.abort());

  const fails = [];
  try {
    await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof W !== 'undefined' && W > 40);
    await page.evaluate(() => {
      window.__cells = () => { let n=0; for (let i=0;i<type.length;i++) if (type[i]!==0) n++; return n; };
      window.__count = t => { let n=0; for (let i=0;i<type.length;i++) if (type[i]===t) n++; return n; };
      window.__stage = () => document.querySelector('.stage').getBoundingClientRect();
    });
    const out = await body(page);
    if (out) fails.push(out);
    if (problems.length) fails.unshift(problems[0]);
  } catch (err) {
    fails.push('harness error: ' + String(err.message).split('\n')[0]);
  }
  if (fails.length) { failed++; console.log(`FAIL  ${name}`); fails.forEach(f => console.log(`        · ${f}`)); }
  else { passed++; console.log(` ok   ${name}`); }
  await browser.close();
}

const stageBox = p => p.locator('.stage').boundingBox();

// Chip labels live in their own span, and two of them change what they say while they
// are asking a question, so the text is read from the span rather than the button.
const labelOf = chip => chip.locator('.lb').textContent();

// Opens the drawer a button lives in and hands back its locator WITHOUT clicking it, for
// the checks that need to measure something before the tap. `press` clicks; this does not.
// Hunting for the drawer rather than naming it is what stopped Save moving from Tools to
// Scene from being a silent breakage — it was not silent, but only because of this.
async function reveal(p, act) {
  const sel = `[data-act="${act}"]`;
  const tabs = await p.locator('.tab').count();
  for (let i = 0; i < tabs; i++) {
    await p.locator('.tab').nth(i).click();
    const chip = p.locator(sel);
    if (await chip.count() && await chip.isVisible()) return chip;
  }
  throw new Error(`no button with data-act="${act}" in any drawer`);
}

// Materials live in drawers now, so reaching one means opening the right drawer
// first — exactly as a thumb would. Hunting for the chip rather than hard-coding
// which tab holds it means moving a material between drawers cannot break the suite
// without also breaking the box.
async function pick(p, name) {
  const re = new RegExp('^' + name + '$', 'i');
  const tabs = await p.locator('.tab').count();
  for (let i = 0; i < tabs; i++) {
    await p.locator('.tab').nth(i).click();
    const chip = p.locator('#mats .chip', { hasText: re }).first();
    if (await chip.count() && await chip.isVisible()) { await chip.click(); return; }
  }
  throw new Error(`no chip called ${name} in any drawer`);
}

// Shape modes are not in a drawer — they sit with the brush, because they change how
// you draw rather than what you draw with.
const pickShape = (p, name) =>
  p.locator('#shapes .chip', { hasText: new RegExp('^' + name + '$', 'i') }).first().click();

console.log('\n— the match —');

await check('the match going out mid-drag does not start drawing wood', async p => {
  await p.locator('#strip').click();
  await p.evaluate(() => { matchLit = 1.0; });          // about to go out
  const s = await stageBox(p);
  const wood0 = await p.evaluate(() => __count(1));
  await p.mouse.move(s.x + s.width*0.2, s.y + s.height*0.35);
  await p.mouse.down();
  // keep dragging across the dark for well past the moment the match dies
  for (let i=0;i<40;i++){
    await p.mouse.move(s.x + s.width*(0.2 + 0.015*i), s.y + s.height*0.35);
    await p.waitForTimeout(50);
  }
  await p.mouse.up();
  const laid = await p.evaluate(() => __count(1)) - wood0;
  if (laid > 0) return `${laid} cells of wood were drawn into the scene by a finger that was applying flame`;
  const lit = await p.evaluate(() => matchLit);
  if (lit > 0) return 'the match never went out, so this check proved nothing';
  return null;
});

await check('striking again while lit gives you a fresh match', async p => {
  await p.locator('#strip').click();
  await p.evaluate(() => { matchLit = 3; });
  await p.locator('#strip').click();
  const lit = await p.evaluate(() => matchLit);
  if (lit <= 3.5) return `a second strike left ${lit.toFixed(1)}s on the match — the tap did nothing`;
  return null;
});

await check('the match tool cannot be selected when there is no match', async p => {
  const tool = await p.evaluate(() => { setTool('match'); return String(tool); });
  if (tool === 'match') return 'the flame tool was selectable with no match lit';
  return null;
});

console.log('\n— the tray —');

await check('Clear asks what to clear before it wipes anything', async p => {
  const before = await p.evaluate(() => __cells());
  if (before < 100) return 'the opening scene is empty, so there is nothing to wipe';
  // Located by data-act, not by the word on it: the words in this row are the thing
  // under test, and a locator that hunts for them stops resolving when they change.
  await (await reveal(p, 'clear')).click();
  const mid = await p.evaluate(() => __cells());
  if (mid !== before) return `one tap wiped ${before - mid} cells with no question asked`;
  const asked = await p.locator('#mats .chip').evaluateAll(cs => cs.map(c => c.dataset.act));
  for (const want of ['clear-none', 'clear-fire', 'clear-life', 'clear-all'])
    if (!asked.includes(want)) return `the question left out ${want}: it offered ${asked.join(', ')}`;
  await p.locator('[data-act="clear-all"]').click();
  const after = await p.evaluate(() => __cells());
  if (after !== 0) return `answering Everything left ${after} cells`;
  return null;
});

await check('Weather asks which one, and Back changes nothing', async p => {
  const bad = [];
  const before = await p.evaluate(() => __cells());
  await (await reveal(p, 'weather')).click();
  const asked = await p.locator('#mats .chip').evaluateAll(cs => cs.map(c => c.dataset.act));
  for (const want of ['weather-none', 'weather-rain', 'weather-mist', 'weather-snow', 'weather-storm'])
    if (!asked.includes(want)) bad.push(`the weather picker left out ${want}: it offered ${asked.join(', ')}`);
  await p.locator('[data-act="weather-none"]').click();
  await p.waitForTimeout(400);
  if (await p.evaluate(() => __cells()) !== before) bad.push('Back set the weather going anyway');
  if (await p.evaluate(() => skyLeft) > 0) bad.push('Back left something falling out of the sky');

  // And one that does something. Mist is the one that puts no material in the box, so the
  // cell count is the wrong thing to watch — the clock is the thing that says it started.
  await (await reveal(p, 'weather')).click();
  await p.locator('[data-act="weather-mist"]').click();
  if (!await p.evaluate(() => skyLeft > 0 && sky === SKY_MIST)) bad.push('Mist did not start');
  // Picking another closes the first: one sky, one clock.
  await (await reveal(p, 'weather')).click();
  await p.locator('[data-act="weather-snow"]').click();
  if (!await p.evaluate(() => sky === SKY_SNOW)) bad.push('Snow did not replace the mist');
  return bad.length ? bad.join('; ') : null;
});

await check('leaving the Clear question alone destroys nothing', async p => {
  const before = await p.evaluate(() => __cells());

  // Back, which is the answer the row is there to make possible.
  await (await reveal(p, 'clear')).click();
  await p.locator('[data-act="clear-none"]').click();
  const afterBack = await p.evaluate(() => __cells());
  if (afterBack !== before) return `Back took ${before - afterBack} cells with it`;

  // And walking away from it by tapping a tab, which is the other way out. The row has
  // to come back as it was: the chips are moved rather than rebuilt, so a drawer that
  // forgets to hand them back loses the buttons entirely.
  await (await reveal(p, 'clear')).click();
  await p.locator('.tab').first().click();
  const afterLeaving = await p.evaluate(() => __cells());
  if (afterLeaving !== before) return `${before - afterLeaving} cells went while walking away from the question`;
  const stranded = await p.locator('#mats [data-act^="clear-"]').count();
  if (stranded) return `${stranded} of the Clear options were still in the tray after leaving`;
  const again = await reveal(p, 'clear');
  if (!await again.count()) return 'Clear did not come back after its own drawer was left';
  await again.click();
  if (!await p.locator('[data-act="clear-all"]').count()) return 'Clear stopped asking the second time round';
  return null;
});

await check('picking a material does not put the hint back over the scene', async p => {
  const s = await stageBox(p);
  await p.mouse.click(s.x + s.width*0.5, s.y + s.height*0.5);   // start drawing: hint goes
  await p.waitForTimeout(700);                                  // the fade is .5s
  const gone = await p.locator('#hint').evaluate(el => getComputedStyle(el).opacity);
  if (gone !== '0') return `the hint did not fade when drawing started (opacity ${gone})`;
  await pick(p, 'straw');
  await p.waitForTimeout(120);
  const back = await p.locator('#hint').evaluate(el => getComputedStyle(el).opacity);
  if (back !== '0') return `changing material put the overlay back over the scene (opacity ${back})`;
  return null;
});

await check('the readout says what the tool is before you have touched anything', async p => {
  const ro = (await p.locator('#ro').textContent()).trim();
  if (!ro || ro === '—') return `the readout reads "${ro}" on a device with no hover, until you drag`;
  await pick(p, 'coal');
  const after = (await p.locator('#ro').textContent()).trim();
  if (!/coal/i.test(after)) return `after picking Coal the readout still reads "${after}"`;
  return null;
});

console.log('\n— shapes —');

// Press, drag, release. Drawing a straight wall freehand with a thumb is miserable,
// and a tank, a fuse and a floor are all straight edges.
const wipe = p => p.evaluate(() => { type.fill(0); temp.fill(AMBIENT); fuel.fill(0); life.fill(0); vel.fill(0); });

async function dragOn(p, ax, ay, bx, by, hold) {
  const s = await stageBox(p);
  const at = (fx,fy) => [s.x + s.width*fx, s.y + s.height*fy];
  const [x0,y0] = at(ax,ay), [x1,y1] = at(bx,by);
  await p.mouse.move(x0,y0); await p.mouse.down();
  await p.mouse.move((x0+x1)/2, (y0+y1)/2); await p.mouse.move(x1,y1);
  if (hold) await hold();
  await p.mouse.up();
}

await check('a dragged box fills a rectangle, and only on release', async p => {
  await wipe(p);
  await pick(p, 'stone'); await pickShape(p, 'box');
  let during = null;
  await dragOn(p, 0.2, 0.3, 0.7, 0.6, async () => {
    during = await p.evaluate(() => __count(11));
  });
  // The ghost outline is drawn over the scene, not into it. A shape that landed while
  // you were still choosing where to put it would be a shape you could not aim.
  if (during !== 0) return `${during} cells of stone were already in the scene mid-drag, before letting go`;
  const after = await p.evaluate(() => __count(11));
  if (after < 200) return `only ${after} cells landed — that is not a rectangle`;
  // and it should be a rectangle, not a blob
  const shape = await p.evaluate(() => {
    let x0=1e9,x1=-1,y0=1e9,y1=-1,n=0;
    for (let i=0;i<type.length;i++) if (type[i]===11){ const x=i%W, y=(i/W)|0;
      x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); n++; }
    return { n, area: (x1-x0+1)*(y1-y0+1) };
  });
  if (shape.n < shape.area * 0.98) return `${shape.n} cells inside a ${shape.area}-cell bounding box — it has holes`;
  return null;
});

await check('a dragged line is one cell wide at brush 1', async p => {
  await wipe(p);
  await p.evaluate(() => { brush = 1; document.getElementById('brush').value = 1; });
  await pick(p, 'fuse'); await pickShape(p, 'line');
  await dragOn(p, 0.2, 0.35, 0.8, 0.35);
  const r = await p.evaluate(() => {
    let n = 0, cols = new Set(), rows = new Set();
    for (let i=0;i<type.length;i++) if (type[i]===8){ n++; cols.add(i%W); rows.add((i/W)|0); }
    return { n, cols: cols.size, rows: rows.size };
  });
  if (r.n < 20) return `the line laid ${r.n} cells`;
  // A fuse has to be able to be one cell thick, or it is a wall
  if (r.rows > 2) return `a brush-1 horizontal line came out ${r.rows} cells thick`;
  if (r.n > r.cols * 2) return `${r.n} cells across ${r.cols} columns — thicker than it should be`;
  return null;
});

await check('shapes obey the same rules as the brush', async p => {
  await wipe(p);
  // Stone first, then try to draw wood straight over it: the brush refuses to paint
  // into occupied cells and a box must refuse in exactly the same way, or a shape
  // becomes a way to overwrite a scene the brush cannot touch.
  await pick(p, 'stone'); await pickShape(p, 'box');
  await dragOn(p, 0.25, 0.35, 0.65, 0.55);
  const stone = await p.evaluate(() => __count(11));
  await pick(p, 'wood');
  await dragOn(p, 0.25, 0.35, 0.65, 0.55);
  const after = await p.evaluate(() => ({ stone: __count(11), wood: __count(1) }));
  if (after.stone < stone * 0.98) return `a box of wood ate ${stone - after.stone} cells of stone`;
  if (after.wood > 0) return `${after.wood} cells of wood landed inside solid stone`;
  return null;
});

console.log('\n— the box itself —');

/* Reported from the phone: a box filled edge to edge with ice reads 20°C.

   The gauge averages the empty cells and calls it "air", and with no empty cells it fell back
   to AMBIENT — printing the room's own setting as though it were a measurement. The box was at
   −10°C at the time. It says what it measured now, and says what it measured it from.

   The other half of what was reported — that the room line does not move either — was a fault,
   and is fixed elsewhere: the room is a reading now on Neutral, which is what the app opens on.
   See roomTarget(). What is still true and is not a fault: the cold does not spread far from
   the ice, because cold air sinks and ice on the floor is already at the bottom. Measured air
   above a slab of ice: 14.5°C for three rows, then 19.8, then 20. Two goes at making cold
   travel — a mirror of the hot-air convection, and a third of the room coupling — moved that
   14.5 to 14.5 and 10.6 respectively. */
await check('a box with no air in it does not report the room as a measurement', async p => {
  const line = () => p.locator('#gauge').innerText();
  await p.evaluate(() => { for (let i=0;i<type.length;i++) put(i%W, (i/W)|0, ICE); });
  await p.waitForTimeout(4000);
  const packed = (await line()).split('\n')[0];
  const boxT = await p.evaluate(() => {
    let s = 0; for (let i=0;i<temp.length;i++) s += temp[i]; return s/temp.length;
  });
  if (boxT > 0) return `the ice did not chill the box (${boxT.toFixed(1)}°C), so this proves nothing`;
  if (/air/i.test(packed)) return `a box with no air in it reads "${packed}" while the box is at ${boxT.toFixed(1)}°C`;
  const shown = Number((packed.match(/-?\d+/) || [999])[0]);
  if (Math.abs(shown - boxT) > 3)
    return `the gauge says ${shown}°C and the box is at ${boxT.toFixed(1)}°C`;

  // and with air in it, it is still an air reading
  await p.evaluate(() => wipeAll());
  await p.waitForTimeout(800);
  const empty = (await line()).split('\n')[0];
  if (!/air/i.test(empty)) return `an empty box reads "${empty}" rather than an air temperature`;
  return null;
});

await check('the heat view shows the field without touching it', async p => {
  const before = await p.evaluate(() => {
    let sum = 0; for (let i=0;i<type.length;i++) sum += type[i]*7 + Math.round(temp[i]);
    return sum;
  });
  await p.locator('.tab', { hasText: /^tools$/i }).click();
  await p.locator('#mats .chip', { hasText: /^heat$/i }).first().click();
  const on = await p.evaluate(() => heatView);
  if (!on) return 'the Heat chip did not turn the view on';
  const after = await p.evaluate(() => {
    let sum = 0; for (let i=0;i<type.length;i++) sum += type[i]*7 + Math.round(temp[i]);
    return sum;
  });
  // A few ticks of simulation will have run between the two reads, so this is not an
  // equality check — it is "the view did not tip a bucket of heat into the scene".
  if (Math.abs(after - before) > Math.abs(before) * 0.25 + 500) {
    return `the scene changed by ${after - before} when the view was toggled`;
  }
  return null;
});

await check('folding the tray away gives the stage the room', async p => {
  const before = await p.locator('.stage').boundingBox();
  await p.evaluate(() => { for (let x=10;x<40;x++) for (let y=H-9;y<H-4;y++) put(x,y,11); });
  await p.waitForTimeout(400);
  const cells = await p.evaluate(() => __count(11));
  await p.locator('#fold').click();
  await p.waitForTimeout(400);
  const after = await p.locator('.stage').boundingBox();
  if (after.height < before.height * 1.15) {
    return `the stage went from ${Math.round(before.height)}px to ${Math.round(after.height)}px — folding bought almost nothing`;
  }
  const kept = await p.evaluate(() => __count(11));
  if (kept < cells * 0.9) return `${cells} cells of stone became ${kept} when the tray folded`;
  await p.locator('#fold').click();
  await p.waitForTimeout(400);
  const back = await p.locator('.stage').boundingBox();
  if (Math.abs(back.height - before.height) > 2) return `unfolding did not put the tray back (${Math.round(back.height)}px against ${Math.round(before.height)}px)`;
  return null;
});

await check('resizing does not destroy the scene', async p => {
  // Build something recognisable, then move the goalposts the way a phone does when
  // its address bar slides away or it is turned on its side.
  // Built on the floor and left to settle, which is where a scene lives. Coal is a
  // powder, and one dropped in mid-air is still falling when the resize crops the grid.
  // What is above the new ceiling goes to the attic rather than being lost — the check
  // below is the one that says so; this one only asks that the floor stays put.
  await p.evaluate(() => {
    for (let x=20;x<40;x++) for (let y=H-14;y<H-4;y++) put(x,y,9);   // a slab of coal
  });
  await p.waitForTimeout(600);
  const before = await p.evaluate(() => __count(9));
  await p.setViewportSize({ width: 390, height: 700 });
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => __count(9));
  if (after === 0) return `the scene was wiped: ${before} cells of coal became ${after}`;
  if (after < before * 0.5) return `${before} cells of coal became ${after} across a resize`;
  return null;
});

/* Reported from the phone, with pictures: build a tower, turn the phone on its side, turn
   it back, and the top of the tower has been deleted. Portrait is 131×153 and landscape is
   173×51, so rotating takes a hundred rows off the top, and rotating back takes forty
   columns off the right.

   The check above did not catch it because it was written to accept it — its own comment
   said a bottom-anchored crop "is supposed to lose what is above the new ceiling", which
   was true of the code and not true of what anybody wants. A check can only be as good as
   the thing it decided to be relaxed about.

   Measured before the fix, on this exact scene: 912 cells of paper and 1112 of wood gone,
   and no way to get them back. */
await check('turning the phone over and back does not delete what was off the screen', async p => {
  const PORTRAIT  = { width: 390, height: 844 };
  const LANDSCAPE = { width: 844, height: 390 };
  const settle = () => p.waitForTimeout(700);          // the resize handler is debounced
  const census = () => p.evaluate(() => {
    const n = {};
    for (let i=0;i<type.length;i++) if (type[i]!==0) n[M[type[i]].n] = (n[M[type[i]].n]||0) + 1;
    return n;
  });
  const shape = () => p.evaluate(() => `${W}×${H}`);
  const bad = [];

  // One thing against each edge the rebuild can clip: a tower up to the ceiling, a shelf
  // across the top, and a floor that should never move.
  await p.evaluate(() => {
    type.fill(0); temp.fill(AMBIENT); fuel.fill(0); life.fill(0); vel.fill(0);
    for (let y=H-40; y<H; y++) for (let x=0;x<W;x++) put(x,y,STONE);
    for (let y=6; y<H-40; y++) for (let x=4;x<12;x++) put(x,y,WOOD);
    for (let y=6; y<14; y++) for (let x=12;x<W-4;x++) put(x,y,PAPER);
    for (let n=0;n<10;n++) put(20 + n*4, 20, WORM);
  });
  const before = await census(), wasPortrait = await shape();

  await p.setViewportSize(LANDSCAPE); await settle();
  const side = await census(), wasLandscape = await shape();
  if (wasLandscape === wasPortrait) return `the viewport changed and the grid did not (${wasPortrait})`;
  if ((side.Paper || 0) >= (before.Paper || 0))
    return 'nothing left the screen on rotating, so this proves nothing about getting it back';

  await p.setViewportSize(PORTRAIT); await settle();
  const after = await census();
  for (const k of Object.keys(before))
    if ((after[k] || 0) < (before[k] || 0))
      bad.push(`${(before[k]) - (after[k] || 0)} of ${before[k]} cells of ${k} were lost turning the phone over and back`);

  // The other axis: something built in landscape, out past where portrait can show it.
  await p.setViewportSize(LANDSCAPE); await settle();
  const far = await p.evaluate(() => {
    let n = 0;
    for (let y=H-30; y<H-24; y++) for (let x=W-14;x<W-2;x++){ put(x,y,COAL); n++; }
    return n;
  });
  await p.setViewportSize(PORTRAIT); await settle();
  await p.setViewportSize(LANDSCAPE); await settle();
  const coal = (await census()).Coal || 0;
  if (coal < far) bad.push(`${far - coal} of ${far} cells built off the right in landscape did not come back`);

  /* And the attic is not a place things hide from Clear. The wipe has to happen while
     something is actually up there — wiping in portrait proves nothing, because a portrait
     window covers the whole attic and there is nothing above it to forget. That version of
     this leg passed against a build with the forgetting taken out. */
  await p.setViewportSize(PORTRAIT); await settle();
  await p.evaluate(() => {
    for (let y=8; y<20; y++) for (let x=20;x<60;x++) put(x,y,STRAW);   // high up, off the
  });                                                                  // screen in landscape
  await p.setViewportSize(LANDSCAPE); await settle();
  if (await p.evaluate(() => __count(STRAW)) !== 0)
    bad.push('the straw was still on screen in landscape, so nothing was in the attic to forget');
  await (await reveal(p, 'clear')).click();
  await p.locator('[data-act="clear-all"]').click();
  if (await p.evaluate(() => __cells()) !== 0) bad.push('Clear did not clear, so the rest proves nothing');
  await p.setViewportSize(PORTRAIT); await settle();
  const ghosts = await p.evaluate(() => __cells());
  if (ghosts) bad.push(`${ghosts} cells came back out of the attic after the box was cleared`);

  return bad.length ? bad.join('; ') : null;
});

await check('clearing the life reaches the part of the box that is off the screen', async p => {
  const PORTRAIT  = { width: 390, height: 844 };
  const LANDSCAPE = { width: 844, height: 390 };
  const settle = () => p.waitForTimeout(700);
  const worms = () => p.evaluate(() => __count(WORM));

  await p.evaluate(() => {
    type.fill(0); temp.fill(AMBIENT); fuel.fill(0); life.fill(0); vel.fill(0);
    for (let y=H-8; y<H; y++) for (let x=0;x<W;x++) put(x,y,STONE);
    for (let y=10; y<16; y++) for (let x=10;x<W-10;x+=3) put(x,y,WORM);   // high up
  });
  const before = await worms();
  if (before < 10) return `only ${before} worms were placed, so this proves nothing`;

  await p.setViewportSize(LANDSCAPE); await settle();
  if (await worms() !== 0) return 'the worms were still on screen in landscape, so nothing was in the attic';
  await (await reveal(p, 'clear')).click();
  await p.locator('[data-act="clear-life"]').click();
  await p.setViewportSize(PORTRAIT); await settle();
  const left = await worms();
  if (left) return `${left} of ${before} worms came back out of the attic after Life was cleared`;
  return null;
});

await check('a fire survives being resized', async p => {
  await p.evaluate(() => {
    const f = H-3;
    for (let k=0;k<160;k++){
      const t0=tool, b0=brush, m0=matchLit;
      tool='match'; brush=3; matchLit=99;        // a lit match, since paintAt checks
      paintAt((W*0.45)|0, f-5);
      tool=t0; brush=b0; matchLit=m0;
      moveFalling(); moveRising(); diffuse(); react();
    }
  });
  const before = await p.evaluate(() => __count(16) + __count(19));
  if (before < 3) return `nothing was alight to begin with (${before})`;
  await p.setViewportSize({ width: 390, height: 760 });
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => __count(16) + __count(19));
  if (after === 0) return `the fire went out across a resize: ${before} hot cells became ${after}`;
  return null;
});

await check('the whole tray is reachable without scrolling', async p => {
  const box = await p.locator('.box').boundingBox();
  // Every drawer, every chip in it, plus the tabs themselves — a drawer whose
  // contents fall off the bottom of the box is a drawer you cannot open.
  const tabs = await p.locator('.tab').count();
  if (tabs < 2) return `only ${tabs} drawers — the tray is not grouped`;
  for (let i = 0; i < tabs; i++) {
    const tab = p.locator('.tab').nth(i);
    const tb = await tab.boundingBox();
    if (tb.height < 24) return `a drawer tab is only ${Math.round(tb.height)}px tall`;
    await tab.click();
    const chips = p.locator('#mats .chip');
    const n = await chips.count();
    if (!n) return `drawer ${i} is empty`;
    for (let j = 0; j < n; j++) {
      const b = await chips.nth(j).boundingBox();
      const label = (await chips.nth(j).textContent()).trim();
      if (!b) return `${label} has no box at all`;
      if (b.y + b.height > box.y + box.height + 1) return `${label} falls ${Math.round(b.y + b.height - box.y - box.height)}px below the box`;
      if (b.height < 30) return `${label} is only ${Math.round(b.height)}px tall — under a fingertip`;
      if (b.width < 28) return `${label} is only ${Math.round(b.width)}px wide — under a fingertip`;
    }
  }
  const strip = await p.locator('#strip').boundingBox();
  if (strip.height < 40) return `the striking strip is only ${Math.round(strip.height)}px tall`;
  return null;
});

/* The whole reason the tray is in drawers: one row each, so the tray keeps a fixed
   height however much goes into it and the stage keeps its room.
   Both ways of breaking it were reported from the phone rather than found here — the
   Fuel drawer pushing Rubber onto a line of its own and stretching it the full width,
   and Clear growing into "Clear — sure?" mid-confirm, which reflowed the row, wrapped
   Load onto a second line and lifted the whole scene by ~86px between the tap that
   asked and the tap that answered. */
await check('no drawer needs a second row', async p => {
  const bad = [];
  const tabs = await p.locator('.tab').count();
  for (let i = 0; i < tabs; i++) {
    await p.locator('.tab').nth(i).click();
    const row = await p.evaluate(() => {
      const name = document.querySelector('.tab[aria-pressed="true"]').textContent;
      const chips = [...document.querySelectorAll('#mats .chip')];
      const tops = new Set(chips.map(c => Math.round(c.getBoundingClientRect().top)));
      const widths = new Set(chips.map(c => Math.round(c.getBoundingClientRect().width)));
      return { name, chips: chips.length, rows: tops.size, widths: [...widths] };
    });
    if (row.rows > 1) bad.push(`${row.name} wraps its ${row.chips} chips onto ${row.rows} rows`);
    // Equal widths are what makes a label safe to change: a chip sized to its content
    // is a chip that resizes the row when its text does.
    if (row.widths.length > 1) bad.push(`${row.name} has chips of ${row.widths.length} different widths (${row.widths.join(', ')})`);
  }
  return bad.length ? bad.join('; ') : null;
});

/* Same rule, the other way in: changing drawers must not move the scene either.
   Reported from the phone, with the cause correctly guessed from the screenshots —
   material chips carry a 6px colour swatch and the gap under it, and the Scene and
   Tools chips had no swatch at all, so those two drawers were shorter than the other
   four. A shorter tray is a taller stage, and the whole box slid down on the way into
   Tools and back up on the way out.
   This is measured across every drawer rather than against a fixed number, because the
   claim is that they agree with each other, not that they are any particular height. */
await check('changing drawers does not move the scene', async p => {
  const geom = () => p.evaluate(() => {
    const r = e => { const b = document.querySelector(e).getBoundingClientRect();
                     return [Math.round(b.top), Math.round(b.height)]; };
    return { name: document.querySelector('.tab[aria-pressed="true"]').textContent,
             mats: r('#mats'), stage: r('.stage'), tray: r('.tray'), strip: r('#strip') };
  });
  const seen = [];
  const tabs = await p.locator('.tab').count();
  for (let i = 0; i < tabs; i++) {
    await p.locator('.tab').nth(i).click();
    seen.push(await geom());
  }
  const shape = g => JSON.stringify({ mats:g.mats, stage:g.stage, tray:g.tray, strip:g.strip });
  const odd = seen.filter(g => shape(g) !== shape(seen[0]));
  if (odd.length) {
    return `${odd.map(g => g.name.trim()).join(', ')} sit differently from ${seen[0].name.trim()}: ` +
           odd.map(g => `${g.name.trim()} ${shape(g)}`).join(' | ') + ` vs ${shape(seen[0])}`;
  }
  return null;
});

/* The defect above, stated as the thing that actually hurt: a button that asks a
   question must not move the scene while asking it. Sam tapped Clear, the row reflowed,
   and the box jumped — so the second tap, the one that confirms, landed somewhere
   different from where the first one did.

   Note what this does NOT depend on: how wide the text is. The suite blocks the network
   to stay offline and therefore lays the tray out in a fallback monospace, while a phone
   gets Space Mono, which is wider — which is exactly how the wrap above survived a check
   written to catch it. Asserting that nothing moves is true in any font. Asserting that
   a particular label fits would not be. */
await check('a button that asks a question does not move the scene while asking', async p => {
  const geom = () => p.evaluate(() => {
    const r = e => { const b = document.querySelector(e).getBoundingClientRect();
                     return [Math.round(b.top), Math.round(b.height)]; };
    return { stage: r('.stage'), tray: r('.tray'), strip: r('#strip') };
  });
  const bad = [];

  // Save still asks on the chip itself, by changing its own label.
  const save = await reveal(p, 'save');
  const beforeSave = await geom();
  await save.click();                               // first save fills the slot
  await save.click();                               // this one asks
  const label = await labelOf(save);
  if (JSON.stringify(beforeSave) !== JSON.stringify(await geom()))
    bad.push(`save asking ("${label}") moved the page`);
  if (await save.getAttribute('aria-pressed') !== 'true') bad.push('save did not arm');

  // Clear asks by borrowing the drawer row for four chips, which is a bigger change to
  // the tray than a one-word relabel and therefore the more likely of the two to move
  // something. The row is fixed-height and the chips are equal-width whatever is in
  // them, so it must not — and that is the whole reason the row is built that way.
  const clear = await reveal(p, 'clear');
  const beforeClear = await geom();
  await clear.click();
  const shown = await p.locator('#mats .chip').count();
  if (JSON.stringify(beforeClear) !== JSON.stringify(await geom()))
    bad.push(`clear asking (${shown} chips) moved the page: ${JSON.stringify(beforeClear)} -> ${JSON.stringify(await geom())}`);
  if (!shown) bad.push('clear did not ask anything');

  return bad.length ? bad.join('; ') : null;
});

console.log('\n— scenes and saves —');

// `pick` finds material chips; presets and the save buttons are action chips in their
// own drawers, so they need the same hunt rather than a hard-coded tab index.
// Presets and the save buttons are located by their data-act rather than their label,
// because two of them change what they say: Clear becomes "Sure?" and Save becomes
// "Replace?" while they are asking. A locator built from the words on a button cannot
// follow a button whose words are the thing under test.
async function press(p, act) {
  const sel = `[data-act="${act}"]`;
  const tabs = await p.locator('.tab').count();
  for (let i = 0; i < tabs; i++) {
    await p.locator('.tab').nth(i).click();
    const chip = p.locator(sel);
    if (await chip.count() && await chip.isVisible()) { await chip.click(); return chip; }
  }
  throw new Error(`no button with data-act="${act}" in any drawer`);
}

await check('a preset puts a scene in the box and takes the hint away', async p => {
  // The box does not start empty — there is an opening scene — so the claim is that
  // the preset replaces it, not that it fills a void.
  const before = await p.evaluate(() => ({ n: __cells(), wax: __count(WAX) }));
  await press(p, 'scene-candle');
  const after = await p.evaluate(() => ({ n: __cells(), wax: __count(WAX) }));
  if (after.n < 200) return `the Candle preset left ${after.n} cells in the box`;
  if (!after.wax) return 'the Candle preset put no wax in the box';
  if (before.wax === after.wax) return 'the box looks the same as it did before, so nothing was loaded';
  // The hint sits over the middle of the scene, which is where the candle is. The fade
  // is a CSS transition, so this waits it out rather than reading mid-animation and
  // calling a hint that is on its way out a hint that never left.
  await p.waitForTimeout(700);
  const op = await p.evaluate(() => getComputedStyle(document.getElementById('hint')).opacity);
  if (Number(op) > 0.01) return `the hint is still showing at opacity ${op} over the scene`;
  const said = await p.locator('#ro').textContent();
  if (!/wick/i.test(said)) return `the readout says "${said}" and never mentions what to do`;
  return null;
});

await check('every preset is reachable and none of them leaves the box empty', async p => {
  const names = await p.evaluate(() => SCENES.map(s => s.name.toLowerCase()));
  if (names.length < 4) return `only ${names.length} presets`;
  for (const n of names) {
    await press(p, 'scene-' + n);
    const cells = await p.evaluate(() => __cells());
    if (cells < 200) return `${n} put ${cells} cells in the box`;
  }
  return null;
});

// Saving into an empty slot cannot lose anything, so it just saves. Replacing a save
// destroys something that cannot be got back, so it asks — the same two-tap rule Clear
// uses, and for the same reason.
await check('Save asks before it replaces a save, but not before the first one', async p => {
  await press(p, 'scene-candle');
  const first = await press(p, 'save');
  if (/replace/i.test(await labelOf(first))) return 'the very first save asked to replace something';
  if (!await p.evaluate(() => !!localStorage.getItem(STORE_KEY))) return 'nothing was written';

  await press(p, 'scene-cut');
  const again = await press(p, 'save');
  if (!/replace/i.test(await labelOf(again))) return `a second save went straight through, reading "${await labelOf(again)}"`;
  if (await again.getAttribute('aria-pressed') !== 'true') return 'the armed Save is not styled as the danger it is';
  return null;
});

/* Candle rather than Cut, and the snapshot is taken after the save rather than before.
   Unlike the simulation suite, this harness leaves the box running, so the scene is
   free to move between one line of the check and the next — and Cut's thermite is a
   powder, so its pile slumps at the edges. That measured as "24 cells came back
   different" and looked exactly like a broken save format. A candle is wax, wick and
   stone, all static, so the only thing that can change it is the load. */
await check('a scene saved and loaded through the buttons comes back', async p => {
  await press(p, 'scene-candle');
  await press(p, 'save');
  const saved = await p.evaluate(() => Array.from(type));
  await p.waitForTimeout(400);
  const drift = await p.evaluate(a => { let d=0;
    for (let i=0;i<type.length;i++) if (type[i]!==a[i]) d++; return d; }, saved);
  if (drift) return `the scene moved ${drift} cells on its own, so nothing can be concluded from a comparison`;

  await press(p, 'scene-cut');                          // something else entirely
  const between = await p.evaluate(() => __count(WAX));
  if (between) return `${between} cells of wax survived loading a different preset, so this proves nothing`;
  await press(p, 'load');
  const back = await p.evaluate(a => {
    let diff = 0;
    for (let i=0;i<type.length;i++) if (type[i] !== a[i]) diff++;
    return { diff, ro: document.getElementById('ro').textContent };
  }, saved);
  if (back.diff) return `${back.diff} cells came back different`;
  if (!/loaded/i.test(back.ro)) return `the readout says "${back.ro}" rather than confirming the load`;
  return null;
});

await check('Load with nothing saved says so instead of wiping the scene', async p => {
  await press(p, 'scene-candle');
  const before = await p.evaluate(() => __cells());
  await press(p, 'load');
  const after = await p.evaluate(() => __cells());
  if (after !== before) return `Load with an empty slot changed the box from ${before} to ${after} cells`;
  const said = await p.locator('#ro').textContent();
  if (!/nothing saved/i.test(said)) return `the readout says "${said}"`;
  return null;
});

/* The one that cannot be found by using the page on this machine: a browser that
   refuses to store. iOS private browsing and file:// in some browsers both throw on
   `localStorage`, and the throw is on access, not on a missing object — so a check for
   whether it exists passes and the next line takes the page down.
   This is the failure the ledger in this repository already shipped once. */
await check('a browser that refuses to store says so rather than breaking', async p => {
  await p.evaluate(() => {
    storeOK = null;                              // forget any earlier answer
    const boom = () => { throw new DOMException('denied', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: boom });
  });
  await press(p, 'scene-candle');
  const before = await p.evaluate(() => __cells());
  await press(p, 'save');
  const afterSave = await p.locator('#ro').textContent();
  if (!/not store/i.test(afterSave)) return `Save said "${afterSave}"`;
  await press(p, 'load');
  const afterLoad = await p.locator('#ro').textContent();
  if (!/not store/i.test(afterLoad)) return `Load said "${afterLoad}"`;
  if (await p.evaluate(() => __cells()) !== before) return 'the scene was disturbed by a save that could not happen';
  return null;
});

console.log('\n— the room and the vent —');

/* Tapping Room must show the settings rather than step to the next one, and it must do
   it in the row the tray already has — the picker is not allowed to be the one thing
   that moves the scene after three rounds of stopping everything else from doing it. */
await check('tapping Room offers the settings instead of stepping through them', async p => {
  const geom = () => p.evaluate(() => {
    const r = e => { const b = document.querySelector(e).getBoundingClientRect();
                     return [Math.round(b.top), Math.round(b.height)]; };
    return JSON.stringify({ mats:r('#mats'), stage:r('.stage'), tray:r('.tray'), strip:r('#strip') });
  });
  const labels = () => p.evaluate(() =>
    [...document.querySelectorAll('#mats .chip')].map(c => c.querySelector('.lb').textContent));

  const base = await geom();
  // Within a degree rather than exactly, because the app opens on Neutral and the room
  // is free to have answered the opening scene by the time the check gets here.
  const opened = await p.evaluate(() => AMBIENT);
  if (Math.abs(opened - 20) > 1) return `the box started at ${opened.toFixed(1)}°C, not 20`;

  await press(p, 'room');
  const offered = await labels();
  const want = await p.evaluate(() => ROOMS.map(r => r.n));
  if (offered.join('|') !== want.join('|')) return `the picker offered ${offered.join(', ')} rather than ${want.join(', ')}`;
  if (await geom() !== base) return 'opening the picker moved the page';

  // One tap on any of them, from anywhere in the list — not a walk to get there.
  await p.locator('[data-act="room-furnace"]').click();
  const at = await p.evaluate(() => AMBIENT);
  const hottest = await p.evaluate(() => ROOMS[ROOMS.length-1].t);
  if (at !== hottest) return `one tap on the last setting left the room at ${at}°C, not ${hottest}`;
  if (await geom() !== base) return 'choosing a setting moved the page';

  // ...and it hands the row back rather than staying open.
  const after = await labels();
  if (after.join('|') === want.join('|')) return 'the picker stayed open after a choice was made';
  if (!after.some(l => /room/i.test(l))) return `it returned to ${after.join(', ')} rather than the drawer Room lives in`;

  // Reopening shows where you are.
  await press(p, 'room');
  const ticked = await p.evaluate(() => [...document.querySelectorAll('#mats .chip[data-room]')]
    .filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.querySelector('.lb').textContent));
  if (ticked.length !== 1 || ticked[0] !== 'Furnace') return `reopening ticked ${JSON.stringify(ticked)}`;

  // Leaving by a tab has to give the buttons back, not lose them.
  await p.locator('.tab', { hasText: /^fuel$/i }).click();
  await p.locator('.tab', { hasText: /^tools$/i }).click();
  const back = await labels();
  if (!back.some(l => /^room$/i.test(l))) return `Tools came back as ${back.join(', ')}`;
  return null;
});

/* The app opens on Neutral, where the room is a reading rather than a setting. That is a
   change to what the box does before you touch it, so it is worth one check on its own —
   and the readable half of Neutral is the gauge, which is the only place the number shows. */
await check('the app opens on a room that answers the box', async p => {
  const opens = await p.evaluate(() => ROOMS[roomAt].n);
  if (opens !== 'Neutral') return `the app opened on ${opens}`;

  // Fill it with ice and the gauge's room line has to move. Before Neutral it could not:
  // reported from the phone as a box packed with ice leaving the room at 20°C, which it did.
  await p.evaluate(() => { for (let i=0;i<type.length;i++) put(i%W, (i/W)|0, ICE); });
  await p.waitForTimeout(5000);
  const at = await p.evaluate(() => AMBIENT);
  if (at > 12) return `a box packed with ice left the room at ${at.toFixed(1)}°C`;

  const g = await p.locator('#gauge').innerText();
  const line = g.split('\n').find(l => /room/i.test(l)) || '';
  if (!/neutral/i.test(line)) return `the gauge's room line reads "${line}"`;
  // Whole degrees. The raw float went on the gauge once and it read room Neutral -1.7724609375°C.
  if (/\d\.\d/.test(line)) return `the gauge is printing a fraction: "${line}"`;
  const shown = Number((line.match(/-?\d+(?=°)/) || [999])[0]);
  if (Math.abs(shown - at) > 1) return `the gauge says ${shown}°C and the room is at ${at.toFixed(1)}`;

  // ...and picking a fixed setting stops it answering anything.
  await press(p, 'room');
  await p.locator('[data-act="room-normal"]').click();
  const held = await p.evaluate(async () => {
    const before = AMBIENT;
    await new Promise(r => setTimeout(r, 3000));
    return [before, AMBIENT];
  });
  if (held[1] !== 20) return `Normal drifted from ${held[0]} to ${held[1]} with a box full of ice`;
  return null;
});

await check('the gauge says what the room is set to, not just what the air is', async p => {
  await press(p, 'room');                                  // off the default, so it shows
  await p.waitForTimeout(1200);                            // the gauge refreshes on a timer
  const g = await p.locator('#gauge').textContent();
  // Rounded on both sides: on Neutral AMBIENT is a drifting float and the gauge prints a
  // whole number, so String(AMBIENT) would be looking for "19.8734" in "room Neutral 20°C".
  const at = Math.round(await p.evaluate(() => AMBIENT));
  if (!/room/i.test(g)) return `the gauge reads "${g}" and never mentions the room`;
  if (!g.includes(String(at))) return `the gauge reads "${g}" with the room at ${at}°C`;
  return null;
});

/* The vent takes its payload from whatever material was picked before it, which is the
   whole interface for it — so the thing to check is that picking through the actual
   chips, in two different drawers, sets it. */
/* Tapping Vent has to *show* you the choice.

   Two versions before this did not. The first took the payload from whatever had been
   selected before it, which is the same two taps backwards with nothing on screen to say
   the first one counted. The second put the tray into a waiting state and said so in the
   readout — small grey text in the corner of the scene, which was reported back as
   exactly what it is: an invisible mode with a caption on it.

   So the panel is the check. It is over the stage rather than in the tray, because
   twenty-odd materials are not a row and the tray is not allowed to change height. */
await check('tapping Vent opens a panel of everything it can pour', async p => {
  const geom = () => p.evaluate(() => {
    const r = e => { const b = document.querySelector(e).getBoundingClientRect();
                     return [Math.round(b.top), Math.round(b.height)]; };
    return JSON.stringify({ stage:r('.stage'), tray:r('.tray'), strip:r('#strip'), mats:r('#mats') });
  });
  const base = await geom();
  const panel = () => p.evaluate(() => getComputedStyle(document.getElementById('ventPick')).display !== 'none');

  if (await panel()) return 'the panel was already open before anything was tapped';
  await pick(p, 'vent');
  if (!await panel()) return 'tapping Vent did not show anything';
  if (await geom() !== base) return 'opening the panel moved the page';

  // Every material in the tray, and nothing that is not one.
  const shown = await p.evaluate(() =>
    [...document.querySelectorAll('#ventGrid button')].map(b => Number(b.dataset.pour)));
  const want = await p.evaluate(() => {
    const out = [];
    for (const g of GROUPS){ if (typeof g.items === 'string') continue;
      for (const t of g.items) if (t !== VENT) out.push(t); }
    return out;
  });
  if (shown.join() !== want.join()) return `the panel offers ${shown.length} of the ${want.length} materials in the tray`;
  if (await p.evaluate(() => document.querySelector('#ventPick h2').textContent).then(t => !/pour/i.test(t)))
    return 'the panel does not say what it is asking';

  // What it is holding is ticked, so it answers "what is it set to?" as well as "change it".
  const ticked = await p.evaluate(() =>
    [...document.querySelectorAll('#ventGrid button[aria-pressed="true"]')].map(b => b.querySelector('.lb').textContent));
  if (ticked.length !== 1 || ticked[0] !== 'Lava') return `the panel ticked ${JSON.stringify(ticked)} rather than the Lava it holds`;

  // Choosing closes it and sets the payload.
  await p.locator('#ventGrid button', { hasText: /^water$/i }).click();
  const after = await p.evaluate(() => ({ feed: M[ventFeed].n, asking: ventAsking, isVent: tool === VENT,
                                          ro: document.getElementById('ro').textContent }));
  if (await panel()) return 'the panel stayed open after a choice';
  if (after.feed !== 'Water') return `choosing Water left the vent holding ${after.feed}`;
  if (!after.isVent) return 'choosing left the tool as something other than the vent';
  if (!/water/i.test(after.ro)) return `the readout says "${after.ro}"`;
  if (await geom() !== base) return 'choosing moved the page';

  // Reopening shows the new answer ticked.
  await pick(p, 'vent');
  const t2 = await p.evaluate(() =>
    [...document.querySelectorAll('#ventGrid button[aria-pressed="true"]')].map(b => b.querySelector('.lb').textContent));
  if (t2.join() !== 'Water') return `reopening ticked ${JSON.stringify(t2)}`;
  return null;
});

await check('the vent panel can be left without choosing, three ways', async p => {
  const panel = () => p.evaluate(() => getComputedStyle(document.getElementById('ventPick')).display !== 'none');
  const feed  = () => p.evaluate(() => M[ventFeed].n);
  const was = await feed();

  // Cancel.
  await pick(p, 'vent');
  await p.locator('#ventCancel').click();
  if (await panel()) return 'Cancel did not close the panel';
  if (await feed() !== was) return `Cancel changed the payload to ${await feed()}`;

  // The dark around it, the way a sheet on a phone behaves.
  await pick(p, 'vent');
  const b = await p.locator('#ventPick').boundingBox();
  await p.mouse.click(b.x + b.width - 12, b.y + b.height - 12);
  if (await panel()) return 'tapping the backdrop did not close the panel';
  if (await feed() !== was) return `tapping the backdrop changed the payload to ${await feed()}`;

  // Tapping Vent again.
  await pick(p, 'vent');
  await pick(p, 'vent');
  if (await panel()) return 'tapping Vent twice did not close the panel';
  if (await feed() !== was) return `tapping Vent twice changed the payload to ${await feed()}`;
  return null;
});

/* On a small screen the options do not all fit and the panel scrolls, and that is the
   case where the way out can disappear. Measured at 320×568 with the real font: 24
   options are 415px of content in a 348px panel, and with Cancel at the end of the list
   it sat below the fold — with no backdrop left showing to tap either, so the only way
   out was the Escape key, on a device that has none. The harness's own viewport is too
   roomy to catch that, so this check goes and finds the small screen. */
await check('the way out of the vent panel survives a screen too small for it', async p => {
  await p.setViewportSize({ width: 320, height: 568 });
  await p.waitForTimeout(150);
  await pick(p, 'vent');
  const r = await p.evaluate(() => {
    const panel = document.getElementById('ventPick');
    const cancel = document.getElementById('ventCancel');
    const pb = panel.getBoundingClientRect(), cb = cancel.getBoundingClientRect();
    return { scrolls: panel.scrollHeight > panel.clientHeight + 1,
             inView: cb.top >= pb.top - 1 && cb.bottom <= pb.bottom + 1,
             tall: Math.round(cb.height) };
  });
  if (!r.scrolls) return 'the panel did not overflow at 320×568, so this proves nothing';
  if (!r.inView) return 'Cancel is outside the visible panel on a screen that has to scroll';
  if (r.tall < 30) return `Cancel is ${r.tall}px tall — that is not a fingertip`;
  await p.locator('#ventCancel').click();
  if (await p.evaluate(() => getComputedStyle(document.getElementById('ventPick')).display !== 'none'))
    return 'Cancel did not close the panel';
  return null;
});

// The panel covers the scene, not the tray, so the drawers stay live underneath it.
// Answering from there has to work too, or the two halves of the screen disagree.
await check('the tray still answers while the vent panel is open', async p => {
  await pick(p, 'vent');
  await pick(p, 'oil');
  const r = await p.evaluate(() => ({ feed: M[ventFeed].n, asking: ventAsking, isVent: tool === VENT,
                                      open: getComputedStyle(document.getElementById('ventPick')).display !== 'none' }));
  if (r.feed !== 'Oil') return `answering from the tray left the vent holding ${r.feed}`;
  if (r.open) return 'the panel stayed open after being answered from the tray';
  if (!r.isVent) return 'answering from the tray left the tool as the material';
  return null;
});

await check('a vent drawn on the stage actually pours', async p => {
  await pick(p, 'vent');
  await pick(p, 'lava');
  await p.evaluate(() => { wipeAll(); const f = H-6;
    for (let x=0;x<W;x++) for (let y=f;y<H;y++) put(x,y,STONE); });
  const s = await stageBox(p);
  await p.mouse.click(s.x + s.width*0.5, s.y + s.height*0.82);
  const vents = await p.evaluate(() => __count(VENT));
  if (!vents) return 'the tap did not put a vent in the box';
  await p.waitForTimeout(4000);
  const made = await p.evaluate(() => __count(LAVA) + __count(STONE));
  const lava = await p.evaluate(() => __count(LAVA));
  if (!lava) return `${vents} vents poured nothing in four seconds`;
  return null;
});

console.log('\n— undo and the finds —');

/* The only way back from a stray drag across a finished build used to be Clear, which
   throws away the whole box: the recovery for a small mistake was a bigger one. */
await check('a stray stroke can be taken back', async p => {
  /* Stop the world first. This check compares a signature of the whole grid taken before the
     stroke against the one after undoing it, and the opening scene is *running* — a handful
     of ticks pass between the measurement and the mouse going down, so the two are of
     different worlds and the check fails for a reason that has nothing to do with undo.
     Rare rather than never: it failed about one run in a dozen and always looked like undo
     being wrong. Undo does not need a live page to be tested; it needs a still one. */
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await p.waitForTimeout(120);                       // let the frame already in flight land
  const sig = () => p.evaluate(() => { let h=0; for (let i=0;i<type.length;i++) h=(h*31+type[i])|0; return h; });
  await p.locator('.tab', { hasText: /^tools$/i }).click();
  const undoBtn = p.locator('[data-act="undo"]');
  if (!await undoBtn.isDisabled()) return 'Undo offered to undo something before anything had happened';

  await pick(p, 'stone');
  const before = await sig();
  const cells0 = await p.evaluate(() => __cells());
  const s = await stageBox(p);
  await p.mouse.move(s.x + s.width*0.2, s.y + s.height*0.5);
  await p.mouse.down();
  for (let i=0;i<20;i++) await p.mouse.move(s.x + s.width*(0.2+0.03*i), s.y + s.height*0.5);
  await p.mouse.up();
  const laid = await p.evaluate(() => __cells()) - cells0;
  if (laid < 50) return `the stroke only laid ${laid} cells, so there is nothing much to undo`;

  await p.locator('.tab', { hasText: /^tools$/i }).click();
  if (await undoBtn.isDisabled()) return 'Undo was still disabled after a stroke';
  await undoBtn.click();
  if (await sig() !== before) return `the scene did not come back — ${await p.evaluate(() => __cells())} cells against ${cells0}`;
  if (!await undoBtn.isDisabled()) return 'Undo stayed available after being used, so it is offering a second step it does not have';
  const said = await p.locator('#ro').textContent();
  if (!/undid/i.test(said)) return `the readout says "${said}"`;
  return null;
});

// The whole-box actions are where an accident costs the most, so they are the ones that
// most need taking back. Clear especially: it asks first, but asking is not undoing.
/* The whole-box actions are where an accident costs the most, so they are the ones that
   most need taking back. Clear especially: it asks first, but asking is not undoing.

   Everything here happens on a scene of nothing but stone, and that is not tidiness. The
   simulation keeps running in this harness, so a scene with anything mobile in it drifts
   between one line of the check and the next — measured, comparing against a signature
   taken before the opening scene had settled reported "the scene did not come back" for an
   undo that had worked perfectly. Stone does not move. */
await check('Clear, a preset and Load can all be taken back', async p => {
  const sig = () => p.evaluate(() => { let h=0; for (let i=0;i<type.length;i++) h=(h*31+type[i])|0; return h; });
  const stillness = async () => { const a = await sig(); await p.waitForTimeout(350); return a === await sig(); };
  await p.evaluate(() => {
    wipeAll();
    const f = H-6;
    for (let x=0;x<W;x++) for (let y=f;y<H;y++) put(x,y,STONE);
    for (let x=(W>>2); x<(W>>1); x++) for (let y=f-9;y<f;y++) put(x,y,STONE);
  });
  if (!await stillness()) return 'a scene of nothing but stone is not holding still, so nothing here can be concluded';

  const undoBtn = await reveal(p, 'undo');

  const beforeClear = await sig();
  const clear = await reveal(p, 'clear');
  await clear.click();
  await p.locator('[data-act="clear-all"]').click();
  if (await p.evaluate(() => __cells()) !== 0) return 'Clear did not clear, so this proves nothing';
  await (await reveal(p, 'undo')).click();
  if (await sig() !== beforeClear) return 'the scene did not come back after undoing a Clear';

  const beforePreset = await sig();
  await press(p, 'scene-candle');
  if (await sig() === beforePreset) return 'the preset changed nothing, so this proves nothing';
  await (await reveal(p, 'undo')).click();
  if (await sig() !== beforePreset) return 'the scene did not come back after undoing a preset';

  // Candle for this leg rather than Cut: Cut's thermite is a powder and its pile slumps,
  // so the scene drifts between taking the signature and undoing back to it. That measured
  // as "the scene did not come back after undoing a Load" for an undo that was working.
  await press(p, 'save');
  await press(p, 'scene-candle');
  if (!await stillness()) return 'the scene to be undone back to is still moving';
  const beforeLoad = await sig();
  await press(p, 'load');
  if (await sig() === beforeLoad) return 'Load changed nothing, so this proves nothing';
  await (await reveal(p, 'undo')).click();
  if (await sig() !== beforeLoad) return 'the scene did not come back after undoing a Load';
  return null;
});

/* The counter said "FOUND 3/27" and that was the whole of it: twenty-four things existed
   that the box would never name, mention again, or hint at. A progress bar for a task
   nobody has been told. */
await check('the finds panel lists everything, without giving the answers away', async p => {
  const geom = () => p.evaluate(() => {
    const r = e => { const b = document.querySelector(e).getBoundingClientRect();
                     return [Math.round(b.top), Math.round(b.height)]; };
    return JSON.stringify({ stage:r('.stage'), tray:r('.tray'), strip:r('#strip'), mats:r('#mats') });
  });
  const base = await geom();
  await press(p, 'finds');
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#findList .find')];
    return { rows: rows.length, total: FINDS.length,
             title: document.getElementById('findTitle').textContent,
             unfoundText: rows.filter(x => x.dataset.got !== 'true').map(x => x.querySelector('.lb').textContent),
             open: getComputedStyle(document.getElementById('findPick')).display !== 'none' };
  });
  if (!r.open) return 'the panel did not open';
  if (r.rows !== r.total) return `the panel listed ${r.rows} of the ${r.total} discoveries the counter promises`;
  if (!r.title.includes(String(r.total))) return `the heading reads "${r.title}" and never says how many there are`;
  if (await geom() !== base) return 'opening the panel moved the page';

  // An unfound row must say where to look and not what happens there.
  const leaks = r.unfoundText.filter(t => /→|\binto\b|through|goes off|burns down/.test(t));
  if (leaks.length) return `${leaks.length} unfound rows give the answer away, e.g. "${leaks[0]}"`;
  if (!r.unfoundText.every(t => /—\s*\?$/.test(t))) return `an unfound row reads "${r.unfoundText.find(t => !/—\s*\?$/.test(t))}"`;
  return null;
});

await check('finding something moves it into the list with its name on it', async p => {
  // A lava pool with water over it: it sets into stone, the water boils, and the two
  // touching makes obsidian. Three of the twenty-seven, without a match.
  await p.evaluate(() => {
    wipeAll(); const f = H-6;
    for (let x=0;x<W;x++) for (let y=f;y<H;y++) put(x,y,STONE);
    for (let x=20;x<44;x++) for (let y=f-8;y<f;y++) put(x,y,LAVA);
    for (let x=50;x<60;x++) for (let y=f-12;y<f-9;y++) put(x,y,WATER);
    for (let x=50;x<60;x++) for (let y=f-8;y<f;y++) put(x,y,WAX);
    for (let k=0;k<3000;k++){ moveFalling(); moveRising(); diffuse(); react(); }
  });
  await press(p, 'finds');
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#findList .find')];
    const got = rows.filter(x => x.dataset.got === 'true');
    return { got: got.map(x => x.querySelector('.lb').textContent),
             firstUnfound: rows.findIndex(x => x.dataset.got !== 'true'),
             gotCount: got.length, title: document.getElementById('findTitle').textContent,
             counter: document.getElementById('gauge').textContent };
  });
  if (!r.gotCount) return 'the scene found nothing, so this proves nothing';
  if (r.firstUnfound !== r.gotCount) return 'found and unfound rows are interleaved rather than found first';
  if (r.got.some(t => /—\s*\?$/.test(t))) return `a found row still reads as unknown: "${r.got.find(t => /—\s*\?$/.test(t))}"`;
  if (!r.title.includes(String(r.gotCount))) return `the heading "${r.title}" does not agree with the ${r.gotCount} rows ticked`;
  return null;
});

await check('the finds panel can be closed on a screen too small to show it all', async p => {
  await p.setViewportSize({ width: 320, height: 568 });
  await p.waitForTimeout(150);
  await press(p, 'finds');
  const r = await p.evaluate(() => {
    const panel = document.getElementById('findPick');
    const close = document.getElementById('findClose').getBoundingClientRect();
    const pb = panel.getBoundingClientRect();
    return { scrolls: panel.scrollHeight > panel.clientHeight + 1,
             inView: close.top >= pb.top - 1 && close.bottom <= pb.bottom + 1,
             tall: Math.round(close.height) };
  });
  if (!r.scrolls) return '27 rows fitted a 320×568 screen without scrolling, so this proves nothing';
  if (!r.inView) return 'Close is outside the visible panel on a screen that has to scroll';
  if (r.tall < 30) return `Close is ${r.tall}px tall — that is not a fingertip`;
  await p.locator('#findClose').click();
  if (await p.evaluate(() => getComputedStyle(document.getElementById('findPick')).display !== 'none'))
    return 'Close did not close the panel';
  return null;
});

console.log('\n— the first thing that is alive —');

await check('a worm drawn on the stage walks about on its own', async p => {
  // The tray label, not the code name: this creature is `WORM` in the source and Worm on the
  // chip, and a check that hunts by label has to follow the label.
  await pick(p, 'worm');
  // An empty box and a tap, which is what anybody does first — and deliberately without a
  // stone floor laid down for them. Worms landing on the last row of the grid could not
  // move at all until the bottom of the box counted as something to stand on, and this
  // check used to put a floor under them and so never saw it.
  await p.evaluate(() => wipeAll());
  const s = await stageBox(p);
  /* Three taps rather than one, and a floor under how few will do.

     `sparse` is 0.16, so a single tap puts down anything from one worm to eleven — measured
     across twelve runs of each, on this build and the one before it. With one worm the span
     is zero and stays zero, so this check failed about one run in three and had done since
     the day it was written; it only surfaced when the suite started being run repeatedly.
     A flaky check is worse than no check, because it teaches you to re-run rather than look. */
  for (const at of [0.42, 0.5, 0.58])
    await p.mouse.click(s.x + s.width*at, s.y + s.height*0.9);
  const placed = await p.evaluate(() => __count(WORM));
  if (placed < 5) return `three taps put ${placed} worms in the box, which is too few to measure`;

  /* The footprint: how many distinct cells the worms have stood in over the window.

     Two measurements were tried before this one and both were wrong in the same way — they
     asked where the worms *are* rather than where they have *been*, and a random walk is
     entitled to come back. The mean position sits almost exactly still while every one of
     them is walking: a clump that went from spanning 62-68 to spanning 9-97 moved its mean
     from 64.9 to 63.1. And the span itself, which replaced it, can shrink — eleven worms
     went from spanning 23 cells to 13 on a build that was working perfectly, because the
     two on the outside happened to wander inwards.

     A footprint only grows. Measured over six runs once they have landed: **5.5 to 9.1 cells
     per worm** in four seconds, against **exactly 1.0** for worms pinned in place with
     `BUG_STEP` turned up to nine billion. The bar is 2.0, in a gap with nothing in it. */
  const span = () => p.evaluate(() => {
    const o = []; for (let i=0;i<type.length;i++) if (type[i]===WORM) o.push(i%W);
    return o.length ? Math.max(...o) - Math.min(...o) : 0;
  });
  const first = await span();
  /* Let them land first. Tried without this and it made the measurement useless: the taps
     drop clumps from nine-tenths of the way down an empty box, so every worm falls about
     twenty cells before it does anything, and twenty cells of falling is a footprint of
     twenty whether it ever takes a step or not. Worms pinned in place with `BUG_STEP`
     turned up to nine billion passed the check. */
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    window.__seen = new Set();
    window.__watch = setInterval(() => {
      for (let i=0;i<type.length;i++) if (type[i]===WORM) __seen.add(i);
    }, 100);
  });
  await p.waitForTimeout(4000);
  const foot = await p.evaluate(() => { clearInterval(__watch); return __seen.size; });
  if (await p.evaluate(() => __count(WORM)) !== placed) return 'worms appeared or vanished while nothing was happening';
  const each = foot / placed;
  if (each < 2)
    return `${placed} worms stood in ${foot} cells between them over four seconds — ${each.toFixed(1)} each, ` +
           `and a clump that never moved would be 1.0. They span ${first} cells and now span ${await span()}.`;
  return null;
});

// A single chip must not stretch across the screen, which is the shape of the very first
// complaint about this tray: Rubber alone on a wrapped row, full width. The Life drawer
// has one thing in it and would have reproduced it at 377px.
/* A chip is the same size wherever you find it, and no label is cut off.

   This asked only that a drawer of fewer than three chips not stretch one across half the
   screen, which was the original complaint and is a much weaker claim than the one worth
   making. It passed the whole time Wet's four chips were **90px against 42 in Fuel** — more
   than double, reported from the phone, and invisible to a check watching for 50%.

   Both halves are measured together on purpose, because they pull against each other: the
   cap that makes every chip identical is the cap that clips Obsidian, Thermite, Magnesium,
   Freezing and Everything, and a check on either one alone can be passed by breaking the
   other. The pickers are in it too — Room, Clear and Weather borrow the same row without
   being drawers, and Clear was the one that had to give up a word to fit. */
await check('every chip is the same size, in every drawer, with no label cut off', async p => {
  const bad = [], seen = [];
  const look = async (where) => {
    const r = await p.evaluate(() => {
      const chips = [...document.querySelectorAll('#mats .chip')];
      const clipped = [...document.querySelectorAll('#mats .lb')]
        .filter(l => l.scrollWidth > l.clientWidth + 0.5).map(l => l.textContent.trim());
      return { n: chips.length, clipped,
               w: chips.map(c => Math.round(c.getBoundingClientRect().width)),
               row: Math.round(document.getElementById('mats').getBoundingClientRect().width) };
    });
    if (r.clipped.length) bad.push(`${where} cuts off ${r.clipped.join(', ')}`);
    if (new Set(r.w).size > 1) bad.push(`${where} has chips of ${[...new Set(r.w)].join(' and ')}px in one row`);
    seen.push({ where, n: r.n, w: r.w[0], row: r.row });
  };

  const tabs = await p.locator('.tab').count();
  for (let i = 0; i < tabs; i++){
    await p.locator('.tab').nth(i).click();
    await look((await p.locator('.tab').nth(i).textContent()).trim());
  }
  for (const act of ['room', 'clear', 'weather']){
    await p.locator('.tab', { hasText: /^tools$/i }).click();
    await p.locator(`[data-act="${act}"]`).click();
    await look(act);
  }

  // Across the whole tray, not within a row. Measured at 390px: 42px in the eight-chip
  // drawers and 49 everywhere else, a ratio of 1.17. It was 41 to 86 before, a ratio of 2.1.
  const w = seen.map(x => x.w), lo = Math.min(...w), hi = Math.max(...w);
  if (hi > lo * 1.25){
    const widest = seen.find(x => x.w === hi), narrow = seen.find(x => x.w === lo);
    bad.push(`${widest.where} has ${hi}px chips and ${narrow.where} has ${lo}px — the same chip in two sizes`);
  }

  /* And the chips that are not in the drawer row, which is where the first version of this
     check had its blind spot. Free, Line and Box sit beside the brush slider and size to
     their own labels rather than sharing a row's width, so the cap that keeps a drawer
     honest does not apply to them — and when the cap arrived it applied anyway, squeezed
     them to 49px, and took the E off Free. Reported from the phone. Everything above was
     green at the time, because everything above looks inside #mats.

     They are not held to one width, because they are deliberately not that kind of chip.
     They are held to fitting the word on them. */
  const shapes = await p.evaluate(() =>
    [...document.querySelectorAll('#shapes .chip')].map(c => {
      const l = c.querySelector('.lb') || c;
      return { t: l.textContent.trim(), w: Math.round(c.getBoundingClientRect().width),
               cut: l.scrollWidth > l.clientWidth + 0.5 };
    }));
  if (!shapes.length) bad.push('there are no shape chips at all');
  for (const sh of shapes){
    if (sh.cut) bad.push(`the ${sh.t} chip cuts off its own label at ${sh.w}px`);
    if (sh.w < 24) bad.push(`the ${sh.t} chip is ${sh.w}px wide`);
  }
  return bad.length ? bad.join('; ') : null;
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
