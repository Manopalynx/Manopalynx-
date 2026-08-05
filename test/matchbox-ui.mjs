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

console.log('\n— the box itself —');

await check('resizing does not destroy the scene', async p => {
  // Build something recognisable, then move the goalposts the way a phone does when
  // its address bar slides away or it is turned on its side.
  await p.evaluate(() => {
    for (let x=20;x<40;x++) for (let y=20;y<30;y++) put(x,y,9);   // a slab of coal
  });
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
    if (b.height < 24) return `${label} is only ${Math.round(b.height)}px tall — under a fingertip`;
  }
  const strip = await p.locator('#strip').boundingBox();
  if (strip.height < 40) return `the striking strip is only ${Math.round(strip.height)}px tall`;
  return null;
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
