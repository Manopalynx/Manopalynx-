// Where can a sound switch go?
//
// A one-question instrument. A score that cannot be turned off is not shippable on the
// device this is played on: in a Home Screen PWA the iPhone's ringer switch does not
// reliably silence a web page, which `docs/README.md` records the hard way. So the
// switch has to exist before the sound does, and the tray has no obvious room for it.
//
// Three candidate homes, measured rather than guessed:
//
//   Tools     a ninth chip in the fullest drawer. `MATCHBOX.md` says this drops the row
//             to 35px and cuts "Weather" even at the 6.5px type floor — measured before
//             Finds went in, so it is re-measured here rather than trusted.
//   bar       a fifth chip beside Free, Line, Box and Time. The bar took Time by taking
//             the width out of the brush slider, 186 → 133px at the narrowest. Whether
//             it can pay that twice is the question.
//   picker    a chip that borrows the drawer row, the way Room, Clear, Weather and Time
//             already do. Costs a chip somewhere, but the options themselves are free.
//
// What must not move: the stage, the tray height and the strip. That rule is the one
// everything in the tray is built on — a row that wraps or a chip that changes height
// moves the box under a thumb mid-tap.
//
// THE WEBFONT IS LET THROUGH, and that is the whole point of measuring here rather than
// reasoning. Space Mono is wider than the fallback the suites measure against, and a
// tray that fits in the fallback has already been reported clipped on the phone twice.
//
// Run:  node test/sound-fit.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const PAGE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '..', 'matchbox.html');
const WIDTHS = [320, 375, 390, 393, 430];

// Measured off a canvas against the chip's inner width, which is what `fitLabels` does.
// A label shrink-wraps its own text, so asking `scrollWidth > clientWidth` compares the
// text with itself and is very nearly a no-op — the fault that shipped POWD… and RUBB….
const MEASURE = `
  window.__clipped = (sel) => {
    const ls = [...document.querySelectorAll(sel)];
    if (!ls.length) return [];
    const cs = getComputedStyle(ls[0]);
    const gap = parseFloat(cs.letterSpacing) || 0;
    const cps = getComputedStyle(ls[0].parentElement);
    const pad = (parseFloat(cps.paddingLeft)||0) + (parseFloat(cps.paddingRight)||0);
    const c = document.createElement('canvas').getContext('2d');
    c.font = cs.fontSize + ' ' + cs.fontFamily;
    const out = [];
    for (const l of ls){
      const t = l.textContent;
      if (c.measureText(t).width + gap * t.length > l.parentElement.clientWidth - pad)
        out.push(t.trim());
    }
    return out;
  };
  window.__geom = () => {
    const r = s => { const e = document.querySelector(s); if (!e) return null;
                     const b = e.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width) }; };
    const chips = [...document.querySelectorAll('#mats .chip')].map(c => Math.round(c.getBoundingClientRect().width));
    const bars  = [...document.querySelectorAll('.shapes .chip')].map(c => Math.round(c.getBoundingClientRect().width));
    const bar = document.querySelector('.bar');
    const barBox = bar.getBoundingClientRect();
    /* Overflow, not "rows". The first version counted distinct y values among the bar's
       children and reported three on an untouched bar — because \`align-items:center\`
       gives a 36px chip, an 18px slider and a line of text three different tops. It was
       measuring vertical centring and calling it wrapping. \`.bar\` is a nowrap flex row,
       so it cannot wrap: what it does instead when it runs out of room is overflow, and
       that is what has to be asked. */
    const overflow = Math.round(bar.scrollWidth - bar.clientWidth);
    const past = [...bar.children].filter(c => c.getBoundingClientRect().right > barBox.right + 0.5).length;
    // The real type size off a real label. \`--chipfs\` read back empty: fitLabels sets it
    // on an element this was not looking at, so the column was blank at every width and
    // I nearly read that as "unchanged".
    const lb = document.querySelector('#mats .lb');
    return {
      stage: r('.stage'), tray: r('.tray'), strip: r('.strip'), bar: r('.bar'),
      mats: r('#mats'), brush: r('#brush'),
      matsRows: new Set([...document.querySelectorAll('#mats .chip')]
                        .map(c => Math.round(c.getBoundingClientRect().y))).size,
      barOverflow: overflow, barPast: past,
      chipW: chips, barW: bars,
      chipH: chips.length ? Math.round(document.querySelector('#mats .chip').getBoundingClientRect().height) : 0,
      fs: lb ? getComputedStyle(lb).fontSize : '—',
      clippedMats: __clipped('#mats .lb'), clippedBar: __clipped('.shapes .lb')
    };
  };
  // A ninth chip in the open drawer, cloned from a real one so it carries the same
  // classes, padding and swatch as everything else in the row.
  window.__addTool = (label) => {
    const row = document.getElementById('mats');
    const c = row.lastElementChild.cloneNode(true);
    const lb = c.querySelector('.lb'); if (lb) lb.textContent = label;
    c.removeAttribute('data-act');
    row.appendChild(c);
    fitLabels();
  };
  // A fifth chip on the bar, in its own group beside Time — the same shape the Time
  // chip itself took when it went in.
  /* Option A: nine chips, with the one long label shortened.
     "Weather" is seven characters against a longest-of-five everywhere else, and it is
     the only label the ninth chip cuts. There is a precedent for paying this way rather
     than by shrinking the row — Clear's "Everything" became "All" for exactly this
     reason, and the four short answers read better than the long one did. */
  window.__addToolShort = (label, was, now) => {
    for (const l of document.querySelectorAll('#mats .lb'))
      if (l.textContent.trim().toLowerCase() === was.toLowerCase()) l.textContent = now;
    __addTool(label);
  };
  /* Option B: the fifth chip on the bar, with the slider allowed to shrink.
     \`input[type=range]\` carries an intrinsic width, and a flex item's \`min-width\` is
     \`auto\`, so \`flex:1\` cannot take it below about 129px however little room is left.
     That is why the bar overflows instead of squeezing — releasing the floor is the
     only way the bar can pay for another chip at all. */
  window.__addBarShrink = (label, floor) => {
    const b = document.getElementById('brush');
    b.style.minWidth = floor + 'px';
    __addBar(label);
  };
  /* Option C: a second button in the header, beside Hide.

     The header is the one part of the page that cannot be put away — Hide folds the
     TRAY, not the header, and the button that does it lives here and relabels itself
     to "Tray". So a switch here is reachable before the first sound and cannot be
     hidden behind the thing it would need to be reached through. */
  window.__addHead = (label) => {
    const b = document.getElementById('fold');
    const c = b.cloneNode(true);
    c.id = ''; c.textContent = label;
    b.parentElement.insertBefore(c, b);
    fitLabels();
  };
  window.__addBar = (label) => {
    const hold = document.getElementById('timeHold');
    const c = hold.firstElementChild
            ? hold.firstElementChild.cloneNode(true)
            : document.querySelector('#shapes .chip').cloneNode(true);
    const lb = c.querySelector('.lb') || c;
    lb.textContent = label;
    c.removeAttribute('data-act');
    const g = document.createElement('div');
    g.className = 'shapes';
    g.appendChild(c);
    document.querySelector('.bar').insertBefore(g, document.getElementById('brush'));
    fitLabels();
  };
`;

const browser = await chromium.launch();
const rows = [];

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof W !== 'undefined' && W > 40);
  const realFont = await page.evaluate(async () => {
    try { await document.fonts.ready; } catch {}
    return document.fonts.check("9.5px 'Space Mono'");
  });
  if (!realFont) { console.log(`\n!! Space Mono did not load at ${width}px — these figures would be about the fallback, which is narrower. Stopping.`); process.exit(1); }
  await page.evaluate(MEASURE);
  await page.evaluate(() => fitLabels());

  /* Every drawer, before anything is added. The tray-wide rule is that no chip may be
     more than 1.25× another anywhere in the tray — not just within a row — and that is
     the rule a ninth chip in one drawer is most likely to break, because it makes that
     drawer's chips narrower than every other drawer's. Measuring Tools alone would
     have missed it entirely, which is the shape of mistake this file keeps recording:
     a check on one half is passed by breaking the other. */
  const drawers = [];
  const tabN = await page.locator('.tab').count();
  for (let i = 0; i < tabN; i++) {
    await page.locator('.tab').nth(i).click();
    await page.evaluate(() => fitLabels());
    const g = await page.evaluate(() => __geom());
    const nm = (await page.locator('.tab').nth(i).textContent()).trim();
    drawers.push({ name: nm, n: g.chipW.length, w: g.chipW[0] });
  }

  // Tools open, because it is the fullest drawer and the one under test.
  await page.locator('.tab', { hasText: /^tools$/i }).click();
  await page.evaluate(() => fitLabels());
  const before = await page.evaluate(() => __geom());

  const withTool = await page.evaluate(() => { __addTool('Sound'); return __geom(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof W !== 'undefined' && W > 40);
  await page.evaluate(MEASURE);
  await page.locator('.tab', { hasText: /^tools$/i }).click();
  await page.evaluate(() => fitLabels());
  const withBar = await page.evaluate(() => { __addBar('Sound'); return __geom(); });

  const fresh = async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof W !== 'undefined' && W > 40);
    await page.evaluate(MEASURE);
    await page.locator('.tab', { hasText: /^tools$/i }).click();
    await page.evaluate(() => fitLabels());
  };

  await fresh();
  const withShort = await page.evaluate(() => { __addToolShort('Sound', 'Weather', 'Sky'); return __geom(); });

  await fresh();
  const withHead = await page.evaluate(() => { __addHead('Sound'); return __geom(); });

  const shrunk = {};
  for (const floor of [110, 96, 80]) {
    await fresh();
    shrunk[floor] = await page.evaluate(f => { __addBarShrink('Sound', f); return __geom(); }, floor);
  }

  rows.push({ width, before, withTool, withBar, withShort, withHead, shrunk, drawers });
  await page.close();
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const moved = (a, b) => {
  const out = [];
  for (const k of ['stage', 'tray', 'strip']) {
    if (!a[k] || !b[k]) continue;
    if (a[k].y !== b[k].y) out.push(`${k} moved ${b[k].y - a[k].y}px`);
    if (a[k].h !== b[k].h) out.push(`${k} height ${a[k].h}→${b[k].h}`);
  }
  return out;
};

/* Clipping is reported as a *change* against the same width untouched, never as an
   absolute. 320px is below the range the tray was ever tuned for, and without a
   baseline column the first run of this reported "Weather clipped" for both candidates
   and gave me no way to tell whether either had caused it. A label that was already
   cut off is not evidence against the thing you just added. */
const newly = (base, after, key) => {
  const had = new Set(base[key]);
  return after[key].filter(t => !had.has(t));
};

console.log('\nAs it stands today, with the real Space Mono:\n');
console.log(pad('width', 8) + rpad('chips', 7) + rpad('chip w', 8) + rpad('chip h', 8)
          + rpad('type', 8) + rpad('slider', 8) + rpad('bar chips', 17) + rpad('overflow', 10) + '  already clipped');
console.log('-'.repeat(96));
for (const r of rows)
  console.log(pad(r.width + 'px', 8) + rpad(r.before.chipW.length, 7) + rpad(r.before.chipW[0], 8)
            + rpad(r.before.chipH, 8) + rpad(r.before.fs, 8) + rpad(r.before.brush.w, 8)
            + rpad(r.before.barW.join('/'), 17) + rpad(r.before.barOverflow + 'px', 10)
            + '  ' + (r.before.clippedMats.length ? r.before.clippedMats.join(', ') : '—'));

console.log('\nA ninth chip in Tools:\n');
console.log(pad('width', 8) + rpad('chip w', 9) + rpad('was', 6) + rpad('type', 8) + rpad('was', 7) + rpad('rows', 6) + '  newly clipped / moved');
console.log('-'.repeat(88));
for (const r of rows) {
  const bad = [...newly(r.before, r.withTool, 'clippedMats'), ...moved(r.before, r.withTool)];
  console.log(pad(r.width + 'px', 8) + rpad(r.withTool.chipW[0], 9) + rpad(r.before.chipW[0], 6)
            + rpad(r.withTool.fs, 8) + rpad(r.before.fs, 7) + rpad(r.withTool.matsRows, 6)
            + '  ' + (bad.length ? bad.join(', ') : '—'));
}

console.log('\nA fifth chip on the bar:\n');
console.log(pad('width', 8) + rpad('slider', 8) + rpad('was', 6) + rpad('bar chips', 19) + rpad('overflow', 10) + '  newly clipped / moved');
console.log('-'.repeat(94));
for (const r of rows) {
  const bad = [...newly(r.before, r.withBar, 'clippedBar'), ...newly(r.before, r.withBar, 'clippedMats'),
               ...moved(r.before, r.withBar)];
  const over = r.withBar.barOverflow + 'px' + (r.withBar.barPast ? ` (${r.withBar.barPast} past the edge)` : '');
  console.log(pad(r.width + 'px', 8) + rpad(r.withBar.brush.w, 8) + rpad(r.before.brush.w, 6)
            + rpad(r.withBar.barW.join('/'), 19) + rpad(over, 10)
            + '  ' + (bad.length ? bad.join(', ') : '—'));
}
console.log('');

console.log('Option A — nine chips in Tools, with "Weather" shortened to "Sky":\n');
console.log(pad('width', 8) + rpad('chip w', 9) + rpad('was', 6) + rpad('type', 8) + rpad('was', 7) + rpad('rows', 6) + '  newly clipped / moved');
console.log('-'.repeat(88));
for (const r of rows) {
  const bad = [...newly(r.before, r.withShort, 'clippedMats'), ...moved(r.before, r.withShort)];
  console.log(pad(r.width + 'px', 8) + rpad(r.withShort.chipW[0], 9) + rpad(r.before.chipW[0], 6)
            + rpad(r.withShort.fs, 8) + rpad(r.before.fs, 7) + rpad(r.withShort.matsRows, 6)
            + '  ' + (bad.length ? bad.join(', ') : '—'));
}

console.log('\nOption B — a fifth chip on the bar, with the slider allowed below its intrinsic floor:\n');
console.log(pad('width', 8) + rpad('floor', 7) + rpad('slider', 8) + rpad('was', 6) + rpad('overflow', 10) + '  newly clipped / moved');
console.log('-'.repeat(84));
for (const r of rows) {
  for (const floor of [110, 96, 80]) {
    const g = r.shrunk[floor];
    const bad = [...newly(r.before, g, 'clippedBar'), ...newly(r.before, g, 'clippedMats'), ...moved(r.before, g)];
    const over = g.barOverflow + 'px' + (g.barPast ? ` (${g.barPast} off)` : '');
    console.log(pad(floor === 110 ? r.width + 'px' : '', 8) + rpad(floor, 7) + rpad(g.brush.w, 8)
              + rpad(r.before.brush.w, 6) + rpad(over, 10) + '  ' + (bad.length ? bad.join(', ') : '—'));
  }
}
console.log('');

console.log('Every drawer today, and what a ninth chip in Tools does to the tray-wide ratio:\n');
for (const r of rows) {
  const others = r.drawers.filter(d => !/^tools$/i.test(d.name));
  const hi = Math.max(...others.map(d => d.w));
  const lo9 = r.withShort.chipW[0];
  const ratio = hi / lo9;
  const widest = others.find(d => d.w === hi);
  console.log(pad(r.width + 'px', 8)
    + pad(r.drawers.map(d => d.name + ' ' + d.n + '@' + d.w).join('  '), 62));
  console.log(pad('', 8) + 'Tools at nine would be ' + lo9 + 'px against ' + widest.name + "'s " + hi
    + 'px — ratio ' + (Math.round(ratio*100)/100) + (ratio > 1.25 ? '  ** over the 1.25 the suite allows **' : '  within 1.25'));
}
console.log('');

console.log('Option C — a second button in the header, beside Hide:\n');
console.log(pad('width', 8) + rpad('stage top', 11) + rpad('was', 6) + rpad('stage h', 10) + rpad('was', 6) + '  moved');
console.log('-'.repeat(64));
for (const r of rows) {
  const m = moved(r.before, r.withHead);
  console.log(pad(r.width + 'px', 8) + rpad(r.withHead.stage.y, 11) + rpad(r.before.stage.y, 6)
            + rpad(r.withHead.stage.h, 10) + rpad(r.before.stage.h, 6)
            + '  ' + (m.length ? m.join(', ') : 'nothing moved'));
}
console.log('');
