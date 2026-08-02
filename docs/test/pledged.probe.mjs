// A pledged square, on the board.
//
// Run by hand, like ui.probe.mjs:
//   python3 -m http.server 877 --directory . &
//   node docs/test/pledged.probe.mjs
//
// A pledged square earns no rent, cannot be built on and does not count toward
// its set, and until now the board said so with a ⌀ eight pixels wide — the same
// ink one garrison gets. It is now hatched in its owner's colour.
//
// What is asserted is that the hatch is actually painted, that it is the OWNER's
// colour rather than a fixed accent (the defect this file has had twice, once on
// the movement ring and once on the selection ring), that the four-character
// code stays legible through it, and above all that adding a full-cell pseudo-
// element did not grow the grid. That last one is not paranoia: the square
// marks did exactly that, taking the board from square to 375x497 and giving the
// page a 117px scroll, and nothing about it threw.

import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:877/docs/index.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SAVE_KEY = 'grandiose-ledger-v1';

const DEVICES = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 16', width: 393, height: 852 },
  { name: 'iPhone 16 landscape', width: 852, height: 393 }
];

let failures = 0;
const fail = m => { failures++; console.log('  FAIL  ' + m); };
const pass = m => console.log('  ok    ' + m);

// Two Enigma squares to one seat: one pledged, one not. Everything the hatch is
// asserted against is a difference between those two cells, so a rule that
// applied to every cell would fail here rather than read as a pass.
const PLEDGED = 6, CLEAR = 8;

const browser = await chromium.launch({ executablePath: CHROME });

for (const device of DEVICES) {
  console.log(`\n== ${device.name} (${device.width}x${device.height}) ==`);
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('threw: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => {
    delete window.AudioContext; delete window.webkitAudioContext;
  });

  // Seed a save with one square pledged, using the engine's own serializer so
  // the fixture cannot drift from the save format.
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(async ([key, pledged, clear]) => {
    const E = await import('./engine.js');
    const G = E.createGame({
      seats: [{ name: 'Sam', kind: 'human' }, { name: 'Spector', kind: 'ai', persona: 'spector' }],
      seed: 5, circuits: 72
    });
    const p = G.players[0];
    p.holdings.push({ sq: pledged, garrisons: 0, citadel: 0, mortgaged: 1 });
    p.holdings.push({ sq: clear, garrisons: 0, citadel: 0, mortgaged: 0 });
    localStorage.setItem(key, E.serialize(G));
  }, [SAVE_KEY, PLEDGED, CLEAR]);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#begin');
  await page.click('#resume');
  await page.waitForSelector('#game:not(.hidden)');
  pass('the saved game resumes');

  const m = await page.evaluate(([pledged, clear]) => {
    const cell = i => document.querySelector(`.cell[data-i="${i}"]`);
    const hatch = i => getComputedStyle(cell(i), '::after');
    const board = document.querySelector('.board').getBoundingClientRect();
    const px = s => parseFloat(s) || 0;
    return {
      classed: cell(pledged).className.includes('pledged'),
      clearClassed: cell(clear).className.includes('pledged'),
      image: hatch(pledged).backgroundImage,
      clearImage: hatch(clear).backgroundImage,
      opacity: px(hatch(pledged).opacity),
      hatchZ: hatch(pledged).zIndex,
      codeZ: getComputedStyle(cell(pledged).querySelector('.code')).zIndex,
      tokZ: getComputedStyle(cell(pledged).querySelector('.toks')).zIndex,
      // The owner's ring is drawn in their pip colour, set inline. The hatch
      // uses currentColor, so the two must agree by construction.
      ink: getComputedStyle(cell(pledged)).color,
      ringInk: getComputedStyle(cell(clear)).color,
      codeInk: getComputedStyle(cell(pledged).querySelector('.code')).color,
      clearCodeInk: getComputedStyle(cell(clear).querySelector('.code')).color,
      boardW: +board.width.toFixed(1),
      boardH: +board.height.toFixed(1),
      pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyScroll: document.body.scrollHeight - document.body.clientHeight
    };
  }, [PLEDGED, CLEAR]);

  console.log(`        board ${m.boardW}x${m.boardH} · hatch opacity ${m.opacity} ` +
              `· ink ${m.ink} · code ${m.codeInk}`);

  if (m.classed && !m.clearClassed) pass('only the pledged square is marked');
  else fail(`pledged=${m.classed} clear=${m.clearClassed}`);

  if (/repeating-linear-gradient/.test(m.image)) pass('the hatch is painted');
  else fail(`no hatch on the pledged square: ${m.image}`);

  if (m.clearImage === 'none') pass('an unpledged square of the same set is clean');
  else fail(`the unpledged square is hatched too: ${m.clearImage}`);

  // currentColor resolves to the cell's colour, which is the owner's pip.
  if (m.image.includes(m.ink)) pass(`the hatch is the owner's own colour (${m.ink})`);
  else fail(`hatch colour ${m.image} is not the owner ink ${m.ink}`);

  if (+m.hatchZ === 1 && +m.codeZ === 2) pass('the hatch runs under the square code');
  else fail(`hatch z ${m.hatchZ} against code z ${m.codeZ}`);

  if (+m.tokZ > +m.hatchZ) pass('the pieces stay above it');
  else fail(`token z ${m.tokZ} is not above hatch z ${m.hatchZ}`);

  if (m.codeInk !== m.clearCodeInk) pass('a pledged square reads as dimmed');
  else fail('the code is the same colour pledged as not');

  // The one that matters. A full-cell pseudo-element is out of flow and cannot
  // push a grid track, but that was also true of the icons before they did.
  const square = Math.abs(m.boardW - m.boardH) <= 1.5;
  if (square) pass(`the board is still square (${m.boardW}x${m.boardH})`);
  else fail(`the board is ${m.boardW}x${m.boardH}`);

  if (m.pageScroll <= 0) pass('no sideways scroll');
  else fail(`page scrolls sideways by ${m.pageScroll}px`);

  if (m.bodyScroll <= 0) pass('no page scroll');
  else fail(`page picked up ${m.bodyScroll}px of scroll`);

  if (!errors.length) pass('nothing threw');
  else errors.forEach(fail);

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
