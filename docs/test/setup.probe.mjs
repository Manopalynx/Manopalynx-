// The setup screen, and what the sound does when a game ends.
//
//   python3 -m http.server 877 --directory . &
//   node docs/test/setup.probe.mjs
//
// Two things neither a unit test nor the main probe covers. The seat count is a
// real interface — four name fields have to fit a 375pt screen and stay
// hittable, and the opponents have to become unselectable when the table fills.
// And "the sound keeps playing from the game after the game is done" is a
// defect in a teardown path that only runs when a game is abandoned, which the
// main probe never does.

import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:877/docs/index.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

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
  // Audio is stubbed rather than deleted here: the teardown below has to
  // actually run, and with no AudioContext at all it would be trivially silent
  // and prove nothing. This records what the score was asked to do.
  await page.addInitScript(() => {
    window.__moods = [];
    window.__cleared = 0;
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#begin');

  // ---- defaults ----
  const start = await page.evaluate(() => ({
    seatButtons: [...document.querySelectorAll('[data-h]')].map(b => b.textContent.trim()),
    chosen: (document.querySelector('[data-h].on') || {}).textContent,
    names: [...document.querySelectorAll('[data-n]')].map(i => i.value)
  }));

  if (start.seatButtons.join(',') === '1,2,3,4') pass('one to four humans are offered');
  else fail(`seat buttons are ${start.seatButtons.join(',')}`);

  if (start.chosen === '1') pass('and it opens on one, for solo play');
  else fail(`the default seat count is ${start.chosen}`);

  if (start.names.length === 1 && start.names[0] === 'Samuel') pass('named Samuel');
  else fail(`the default names are ${JSON.stringify(start.names)}`);

  // ---- four humans ----
  await page.click('[data-h="4"]');
  const four = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('[data-n]')];
    const cards = [...document.querySelectorAll('[data-a]')];
    return {
      names: inputs.map(i => i.value),
      minField: Math.min(...inputs.map(i => i.getBoundingClientRect().height)),
      // Found by its text, not its position. A positional selector here picked
      // up the "Player 1" name label instead, and because that is a truthy
      // string the fallback beside it never ran — a probe reporting on the
      // wrong element, which is worse than one reporting nothing.
      label: [...document.querySelectorAll('#setup label')]
        .map(l => l.textContent.trim()).find(t => /Opponents/.test(t)) || '(no such label)',
      cardOpacity: Math.max(...cards.map(c => parseFloat(getComputedStyle(c).opacity))),
      wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  if (four.names.length === 4) pass(`four name fields (${four.names.join(', ')})`);
  else fail(`${four.names.length} name fields at four humans`);

  // Four seats should be four allegiances. The first attempt put Samuel, Hale
  // and Harlow at the same table, and all three are Union.
  if (four.names.join() === 'Samuel,Vex,Rourke,Ondh') pass('and they are four different powers');
  else fail(`the default names are now ${four.names.join(', ')}`);

  if (new Set(four.names).size === 4) pass('and no two seats share a name');
  else fail(`duplicate default names: ${four.names.join(', ')}`);

  if (four.minField >= 30) pass(`the fields are still usable (${four.minField}px)`);
  else fail(`a name field is ${four.minField}px tall`);

  if (/full/i.test(four.label || '')) pass('the opponents say the table is full');
  else fail(`the opponents label reads "${four.label}"`);

  if (four.cardOpacity <= 0.25) pass('and are visibly out of reach');
  else fail(`an opponent card is still at opacity ${four.cardOpacity}`);

  if (four.wide <= 0) pass('no sideways scroll at four seats');
  else fail(`the setup screen scrolls sideways by ${four.wide}px`);

  // Adding an opponent must be refused rather than silently ignored.
  await page.click('[data-a="varan"]');
  const stillFour = await page.evaluate(() =>
    [...document.querySelectorAll('[data-a]')].filter(c => /✓/.test(c.textContent)).length);
  if (stillFour === 0) pass('a full table takes no opponent');
  else fail(`${stillFour} opponents joined a full table`);

  // ---- the sheet that meets a player before their first game ----
  // One seat and no opponents is refused, correctly. Its Close button was
  // written data-fn="closeSheet()" against forty-odd written without the
  // parentheses, so the lookup missed and the call threw inside an onclick.
  // The sheet is modal and has one button, so this trapped a player on the
  // setup screen entirely — reported from play as "it didn't let me press
  // close". It rendered right, sized right and did nothing.
  await page.click('[data-h="1"]');
  await page.click('#begin');
  await page.waitForSelector('#sheetRoot .mbtn');
  const stuck = await page.evaluate(() => ({
    text: document.querySelector('#sheetRoot').innerText,
    buttons: [...document.querySelectorAll('#sheetRoot .mbtn')].map(b => b.textContent.trim()),
    inGame: !document.getElementById('game').classList.contains('hidden')
  }));
  if (/two columns/i.test(stuck.text) && !stuck.inGame) pass('a lone player is refused a game');
  else fail(`a game began with one seat, or the wrong sheet appeared: ${stuck.buttons.join('/')}`);

  await page.click('#sheetRoot .mbtn');
  await page.waitForTimeout(120);
  const closed = await page.evaluate(() =>
    document.getElementById('sheetRoot').innerHTML.trim() === '');
  if (closed) pass('and Close closes it');
  else fail('the only button on a modal sheet does nothing — the player is trapped here');

  // ---- the sound, when a game ends ----
  await page.click('[data-a="spector"]');
  await page.click('#begin');
  await page.waitForSelector('#game:not(.hidden)');

  // Drive the game to its swarm-heavy end state, then walk out to the menu.
  await page.evaluate(async () => {
    const S = await import('./score.js');
    const A = await import('./audio.js');
    // Record what the teardown asks for, without an audio context to prove it.
    window.__moods = [];
    const realSet = S.Score.set.bind(S.Score);
    S.Score.set = m => { window.__moods.push(m); return realSet(m); };
    const realClear = A.clearPresence;
    window.__cleared = 0;
    // clearPresence is called through the module namespace, so count it by
    // watching the state it resets rather than by wrapping the export.
    S.Score.R = S.Score.R0 * Math.pow(2, -38 / 1200);   // as the takeover leaves it
    realSet('neurex');
    window.__before = { R: S.Score.R, mood: S.Score.state };
  });

  await page.evaluate(() => window.newGame());
  await page.waitForSelector('#setup:not(.hidden)');

  const after = await page.evaluate(async () => {
    const S = await import('./score.js');
    return {
      before: window.__before,
      mood: S.Score.state,
      R: S.Score.R,
      R0: S.Score.R0,
      moodsAsked: window.__moods
    };
  });

  if (after.before.mood === 'neurex') pass('the game ended in the takeover, as set up');
  else fail(`the fixture did not reach the takeover: ${after.before.mood}`);

  if (after.mood === 'ledger') pass('the menu is not still playing the takeover');
  else fail(`the setup screen is in the "${after.mood}" mood`);

  if (Math.abs(after.R - after.R0) < 0.001) pass('and the score is back in tune');
  else fail(`the menu is playing ${(1200 * Math.log2(after.R / after.R0)).toFixed(0)} cents flat`);

  if (!errors.length) pass('nothing threw');
  else errors.forEach(fail);

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
