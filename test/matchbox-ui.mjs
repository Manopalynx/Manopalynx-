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
//     you had built.
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

await check('Clear asks before it wipes the scene', async p => {
  const before = await p.evaluate(() => __cells());
  if (before < 100) return 'the opening scene is empty, so there is nothing to wipe';
  const clear = p.locator('.chip', { hasText: /^Clear/ }).first();
  await clear.click();
  const mid = await p.evaluate(() => __cells());
  if (mid !== before) return `one tap wiped ${before - mid} cells with no confirmation and no undo`;
  await clear.click();
  const after = await p.evaluate(() => __cells());
  if (after !== 0) return `the second tap left ${after} cells — confirming did not clear`;
  return null;
});

await check('a Clear left unconfirmed goes back to being harmless', async p => {
  const before = await p.evaluate(() => __cells());
  const clear = p.locator('.chip', { hasText: /^Clear/ }).first();
  await clear.click();
  await p.waitForTimeout(3200);                  // longer than the window to confirm
  await clear.click();                           // this must ask again, not wipe
  const after = await p.evaluate(() => __cells());
  if (after !== before) return `${before - after} cells went after the confirmation should have lapsed`;
  return null;
});

await check('picking a material does not put the hint back over the scene', async p => {
  const s = await stageBox(p);
  await p.mouse.click(s.x + s.width*0.5, s.y + s.height*0.5);   // start drawing: hint goes
  await p.waitForTimeout(700);                                  // the fade is .5s
  const gone = await p.locator('#hint').evaluate(el => getComputedStyle(el).opacity);
  if (gone !== '0') return `the hint did not fade when drawing started (opacity ${gone})`;
  await p.locator('.chip', { hasText: 'STRAW' }).first().click();
  await p.waitForTimeout(120);
  const back = await p.locator('#hint').evaluate(el => getComputedStyle(el).opacity);
  if (back !== '0') return `changing material put the overlay back over the scene (opacity ${back})`;
  return null;
});

await check('the readout says what the tool is before you have touched anything', async p => {
  const ro = (await p.locator('#ro').textContent()).trim();
  if (!ro || ro === '—') return `the readout reads "${ro}" on a device with no hover, until you drag`;
  await p.locator('.chip', { hasText: 'COAL' }).first().click();
  const after = (await p.locator('#ro').textContent()).trim();
  if (!/coal/i.test(after)) return `after picking Coal the readout still reads "${after}"`;
  return null;
});

console.log('\n— shapes —');

// Press, drag, release. Drawing a straight wall freehand with a thumb is miserable,
// and a tank, a fuse and a floor are all straight edges.
const wipe = p => p.evaluate(() => { type.fill(0); temp.fill(AMBIENT); fuel.fill(0); life.fill(0); vel.fill(0); });
const pick = (p, name) => p.locator('.chip', { hasText: new RegExp('^' + name + '$', 'i') }).first().click();

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
  await pick(p, 'stone'); await pick(p, 'box');
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
  await pick(p, 'fuse'); await pick(p, 'line');
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
  await pick(p, 'stone'); await pick(p, 'box');
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

await check('the heat view shows the field without touching it', async p => {
  const before = await p.evaluate(() => {
    let sum = 0; for (let i=0;i<type.length;i++) sum += type[i]*7 + Math.round(temp[i]);
    return sum;
  });
  await p.locator('.chip', { hasText: /^heat$/i }).first().click();
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
  // powder: dropped in mid-air it is still falling when the resize crops the grid,
  // and a bottom-anchored crop is supposed to lose what is above the new ceiling.
  // Asserting otherwise would be asserting against the anchoring, not the scene.
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
  for (const label of ['WOOD','SAND','ERASE','CLEAR','RAIN']) {
    const el = p.locator('.chip', { hasText: new RegExp('^' + label, 'i') }).first();
    const b = await el.boundingBox();
    if (!b) return `${label} has no box at all`;
    if (b.y + b.height > box.y + box.height + 1) return `${label} falls ${Math.round(b.y + b.height - box.y - box.height)}px below the box`;
    if (b.height < 30) return `${label} is only ${Math.round(b.height)}px tall — under a fingertip`;
  }
  const strip = await p.locator('#strip').boundingBox();
  if (strip.height < 40) return `the striking strip is only ${Math.round(strip.height)}px tall`;
  return null;
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
