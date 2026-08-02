// An opponent nudging itself off a citadel, on the board.
//
//   python3 -m http.server 877 --directory . &
//   node docs/test/amend.probe.mjs
//
// aiAmend is decided in the engine but WALKED by the interface, and the walk is
// the part a unit test cannot see. It reuses hold()/walk(), whose contract is
// that hold must be called before any render or the piece flashes to its
// destination and snaps back — a rule this file has broken before.
//
// It is also rare: 0.73 amendments a game measured, so playing turns until one
// happens is not a test, it is a wait. The fixture puts an opponent on a
// citadel with the phase already at 'landed', which is exactly the state
// resolveLanding is reached in.

import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:877/docs/index.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SAVE_KEY = 'grandiose-ledger-v1';

const DEVICES = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 16', width: 393, height: 852 }
];

let failures = 0;
const fail = m => { failures++; console.log('  FAIL  ' + m); };
const pass = m => console.log('  ok    ' + m);

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

  await page.goto(URL, { waitUntil: 'networkidle' });
  const start = await page.evaluate(async ([key]) => {
    const E = await import('./engine.js');
    const { SETS } = await import('./data.js');
    const G = E.createGame({
      seats: [{ name: 'Sam', kind: 'human' },
              { name: 'Spector', kind: 'ai', persona: 'spector' }],
      seed: 5, circuits: 72
    });
    const [human, ai] = G.players;
    const set = SETS.bas.sq;                       // the dear end of the board
    const hold = (p, sq) => p.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged: 0 });
    set.forEach(sq => hold(human, sq));
    human.holdings.find(h => h.sq === set[0]).citadel = 1;

    ai.cash = 8000;
    ai.pos = set[0];                               // standing on the citadel
    G.cur = ai.i;
    G.phase = 'landed';
    G.dice = [3, 4];
    localStorage.setItem(key, E.serialize(G));
    return { sq: set[0], amends: ai.amends, cash: ai.cash };
  }, [SAVE_KEY]);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#begin');
  await page.click('#resume');
  await page.waitForSelector('#game:not(.hidden)');

  // The walk is 105ms a step plus the 320ms the opponent waits before acting.
  await page.waitForTimeout(1600);

  const after = await page.evaluate(async () => {
    const E = await import('./engine.js');
    const G = E.deserialize(localStorage.getItem('grandiose-ledger-v1'));
    const ai = G.players[1];
    return { pos: ai.pos, amends: ai.amends, cash: ai.cash, phase: G.phase,
             log: G.log.slice(0, 6).map(e => e.text || '') };
  });

  if (after.pos === (start.sq + 1) % 40) pass(`it moved one square along (${start.sq} → ${after.pos})`);
  else fail(`it is on ${after.pos}, expected ${(start.sq + 1) % 40}`);

  if (after.amends === start.amends - 1) pass('and spent one amendment doing it');
  else fail(`amendments ${start.amends} → ${after.amends}`);

  if (after.cash < start.cash) pass(`and paid for it (${start.cash} → ${after.cash})`);
  else fail(`cash unchanged at ${after.cash}`);

  if (after.log.some(t => /amends the manifest/i.test(t))) pass('the ledger records it');
  else fail(`no amendment in the log: ${JSON.stringify(after.log)}`);

  if (after.phase !== 'landed') pass(`and the turn carried on (phase ${after.phase})`);
  else fail('the game is stuck in the landed phase');

  // The piece must not still be pinned mid-walk, and the board must be intact.
  const board = await page.evaluate(() => {
    const r = document.querySelector('.board').getBoundingClientRect();
    return {
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      pieces: document.querySelectorAll('.cell .tok').length,
      wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  if (Math.abs(board.w - board.h) <= 1.5) pass(`the board is still square (${board.w}x${board.h})`);
  else fail(`the board is ${board.w}x${board.h}`);

  if (board.pieces === 2) pass('both pieces are on the board exactly once');
  else fail(`${board.pieces} pieces drawn, expected 2`);

  if (board.wide <= 0) pass('no sideways scroll');
  else fail(`page scrolls sideways by ${board.wide}px`);

  if (!errors.length) pass('nothing threw');
  else errors.forEach(fail);

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
