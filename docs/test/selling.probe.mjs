// An opponent asking the human for money, on the phone.
//
//   python3 -m http.server 877 --directory . &
//   node docs/test/selling.probe.mjs
//
// Every contract before this ran one way: an opponent offering cash for a
// square. The sheet has always had a branch for the other direction, and until
// now nothing could reach it — which is exactly the state the human's own "they
// pay" button was in when it turned out to throw on every press.
//
// So this drives the real sheet with a real direction-2 contract and checks
// that the human is told they are PAYING rather than receiving, that the square
// is shown as one they receive, that accepting moves the square and the money
// the right ways, and that a sale they cannot afford cannot be accepted at a
// discount by accident.

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

const PRICE = 640;

const browser = await chromium.launch({ executablePath: CHROME });

for (const device of DEVICES) {
  console.log(`\n== ${device.name} (${device.width}x${device.height}) ==`);
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true
  });
  const errors = [];

  // Spector holds the one Enigma square the human needs, and wants paying for
  // it. Parked in the 'contract' phase, which is where proposeContract puts a
  // proposal to a human.
  //
  // Each scenario gets its OWN page. Seeding a second game into a tab that is
  // already playing does not work: the running game saves over the fixture
  // before the reload picks it up, and the sheet under test never appears.
  const open = async cash => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('threw: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.addInitScript(() => {
      delete window.AudioContext; delete window.webkitAudioContext;
    });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(async ([key, price, humanCash]) => {
      const E = await import('./engine.js');
      const { SETS } = await import('./data.js');
      const G = E.createGame({
        seats: [{ name: 'Sam', kind: 'human' },
                { name: 'Spector', kind: 'ai', persona: 'spector' }],
        seed: 5, circuits: 72
      });
      const [human, ai] = G.players;
      const set = SETS.eni.sq;
      const hold = (p, sq) => p.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged: 0 });
      hold(human, set[1]); hold(human, set[2]);
      hold(ai, set[0]);
      human.cash = humanCash;
      ai.cash = 120;
      G.contract = { from: ai.i, to: human.i, give: set[0], get: null,
                     cash: price, direction: 2, resumePhase: 'end' };
      G.phase = 'contract';
      localStorage.setItem(key, E.serialize(G));
    }, [SAVE_KEY, PRICE, cash]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#begin');
    await page.click('#resume');
    await page.waitForSelector('#sheetRoot .mbtn');
    return page;
  };

  const page = await open(3000);
  pass('the proposal comes up on resume');

  const sheet = await page.evaluate(() => ({
    text: document.getElementById('sheetRoot').innerText,
    buttons: [...document.querySelectorAll('#sheetRoot .mbtn')].map(b => b.textContent.trim()),
    tap: Math.min(...[...document.querySelectorAll('#sheetRoot .mbtn')]
      .map(b => b.getBoundingClientRect().height)),
    wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));

  if (/also pays/i.test(sheet.text)) pass('the human is told they are paying');
  else fail(`the sheet does not say the human pays: ${JSON.stringify(sheet.text.slice(0, 300))}`);

  if (!/also receives/i.test(sheet.text)) pass('and is not also told they receive it');
  else fail('the sheet says the human receives the cash as well as pays it');

  if (sheet.text.includes(String(PRICE))) pass(`the price is stated (${PRICE})`);
  else fail('the asking price is not on the sheet');

  if (/receives/i.test(sheet.text)) pass('the square is shown as one they receive');
  else fail('the sheet never says what the human gets');

  if (/completes Enigma for you/i.test(sheet.text)) pass('and that it closes the set');
  else fail('the set arithmetic is missing from a set-closing sale');

  if (sheet.buttons.length === 2) pass(`two answers offered (${sheet.buttons.join(' / ')})`);
  else fail(`buttons: ${sheet.buttons.join(' / ')}`);

  if (sheet.tap >= 44) pass(`buttons are hittable (${sheet.tap}px)`);
  else fail(`smallest button is ${sheet.tap}px`);

  if (sheet.wide <= 0) pass('no sideways scroll');
  else fail(`sheet scrolls sideways by ${sheet.wide}px`);

  // Accept it, and check both sides of the ledger moved.
  await page.click('#sheetRoot .mbtn.pri');
  await page.waitForTimeout(400);
  const after = await page.evaluate(async ([price]) => {
    const E = await import('./engine.js');
    const G = E.deserialize(localStorage.getItem('grandiose-ledger-v1'));
    const [human, ai] = G.players;
    const { SETS } = await import('./data.js');
    return {
      humanHas: human.holdings.some(h => h.sq === SETS.eni.sq[0]),
      aiHas: ai.holdings.some(h => h.sq === SETS.eni.sq[0]),
      humanCash: human.cash, aiCash: ai.cash, price
    };
  }, [PRICE]);

  if (after.humanHas && !after.aiHas) pass('the square changed hands');
  else fail(`holdings after: human=${after.humanHas} ai=${after.aiHas}`);

  if (after.humanCash === 3000 - PRICE && after.aiCash === 120 + PRICE) {
    pass(`the money went the other way (${after.humanCash} / ${after.aiCash})`);
  } else {
    fail(`cash after: human ${after.humanCash} (want ${3000 - PRICE}), ` +
         `ai ${after.aiCash} (want ${120 + PRICE})`);
  }

  // And the case that would have been a quiet discount: accepting a price the
  // human cannot cover. settleContract clamps to what they hold, so without the
  // legality rule this would hand over the square for whatever was in the purse.
  const poor = await open(PRICE - 1);
  await poor.click('#sheetRoot .mbtn.pri');
  await poor.waitForTimeout(400);
  const broke = await poor.evaluate(async () => {
    const E = await import('./engine.js');
    const { SETS } = await import('./data.js');
    const G = E.deserialize(localStorage.getItem('grandiose-ledger-v1'));
    return {
      humanHas: G.players[0].holdings.some(h => h.sq === SETS.eni.sq[0]),
      humanCash: G.players[0].cash
    };
  });
  if (!broke.humanHas && broke.humanCash === PRICE - 1) {
    pass('a sale they cannot cover does not go through at a discount');
  } else {
    fail(`unaffordable sale: got the square=${broke.humanHas}, cash ${broke.humanCash}`);
  }

  if (!errors.length) pass('nothing threw');
  else errors.forEach(fail);

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
