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

  // ---- which option is the calibrated one ----
  // SELECTED and DEFAULT are two different facts and the screen shows both: a
  // gold ring for what you picked, a caption for what the game is balanced
  // against. They coincide on a fresh screen, which is exactly why a check that
  // only looked at the fresh screen would prove nothing — so this moves the
  // selection away and asserts the mark STAYS where the default is.
  const marks = await page.evaluate(() => {
    const read = () => [...document.querySelectorAll('.opt')]
      .filter(b => b.querySelector('.dflt'))
      .map(b => ({ key: b.dataset.t || b.dataset.c || b.dataset.p || b.dataset.h,
                   on: b.classList.contains('on'),
                   // Does the caption fit inside its own button, at this width?
                   clipped: b.querySelector('.dflt').getBoundingClientRect().width
                            > b.getBoundingClientRect().width - 2 }));
    const before = read();
    // Move every picker off its default.
    document.querySelector('[data-t="48"]').click();
    document.querySelector('[data-c="4000"]').click();
    document.querySelector('[data-p="1"]').click();
    const after = read();
    // Put them back, so the checks below start where they expect to.
    document.querySelector('[data-t="72"]').click();
    document.querySelector('[data-c="2000"]').click();
    document.querySelector('[data-p="0"]').click();
    return { before, after,
             seatMarked: !!document.querySelector('[data-h] .dflt'),
             soundMarked: !!document.querySelector('[data-snd] .dflt') };
  });
  if (marks.before.length === 3)
    pass(`three settings name their default (${marks.before.map(m => m.key).join(', ')})`);
  else fail(`${marks.before.length} defaults marked: ${JSON.stringify(marks.before.map(m => m.key))}`);
  if (marks.before.every(m => m.on)) pass('and a fresh screen opens on every one of them');
  else fail(`the screen does not open on its own defaults: ${JSON.stringify(marks.before)}`);
  // The real check. With the selection moved away, the mark must not follow it.
  if (marks.after.length === 3 && marks.after.every(m => !m.on))
    pass('the mark stays with the default when the selection moves away');
  else fail(`the default mark followed the selection: ${JSON.stringify(marks.after)}`);
  if (marks.after.map(m => m.key).join() === marks.before.map(m => m.key).join())
    pass('and marks the same options either way');
  else fail(`marked ${marks.before.map(m => m.key)} then ${marks.after.map(m => m.key)}`);
  if (![...marks.before, ...marks.after].some(m => m.clipped)) pass('no caption is wider than its button');
  else fail(`a default caption overflows its button at ${device.width}px`);
  // Marked only where departing changes the calibration. The seat count and the
  // sound are not settings the game is tuned around, and marking them would
  // spend the signal on things that do not carry it.
  if (!marks.seatMarked && !marks.soundMarked) pass('and the seat count and sound carry no such claim');
  else fail(`a default mark appears on ${marks.seatMarked ? 'the seat count' : 'the sound'}`);

  // ---- the purse, which is now chosen rather than fixed ----
  // The figure a seat is dealt reaches the table through createGame, not
  // through RULES, so the way to check it is to start a game and read a purse.
  // Reading the button's own label back would pass with the option wired to
  // nothing at all.
  const purse = await page.evaluate(async () => {
    const btns = [...document.querySelectorAll('[data-c]')].map(b => +b.dataset.c);
    const on = document.querySelector('[data-c].on');
    const dflt = on ? +on.dataset.c : null;
    // Pick something that is NOT the default, so a wired-up option and a
    // hard-coded one look different.
    const other = btns.find(v => v !== dflt);
    document.querySelector(`[data-c="${other}"]`).click();
    return { btns, dflt, other,
             note: (document.querySelector('[data-c]').closest('.fld') || document).innerText };
  });
  if (purse.btns.length >= 2) pass(`the purse is offered at ${purse.btns.length} figures `
    + `(${purse.btns.map(v => '₡' + v).join(', ')})`);
  else fail(`only ${purse.btns.length} purse options`);
  if (purse.dflt === 2000) pass('and opens on the figure everything is balanced against (₡2000)');
  else fail(`the setup opens on ₡${purse.dflt}`);
  // "More money is harder" is the counter-intuitive half and the reason the
  // note exists at all; a screen that offers the number without it misleads.
  if (/harder/i.test(purse.note)) pass('and says plainly that more money is harder');
  else fail('the purse note does not warn that more money is harder');

  await page.click('[data-h="1"]');
  await page.click('[data-a="spector"]');
  await page.click('#begin');
  await page.waitForSelector('#game:not(.hidden)');
  const dealt = await page.evaluate(() => {
    const G = window.__G();
    return { cash: G.players.map(p => p.cash), stored: G.startingCash };
  });
  if (dealt.cash.every(c => c === purse.other) && dealt.stored === purse.other)
    pass(`a chosen purse reaches the table (₡${purse.other} to every seat)`);
  else fail(`chose ₡${purse.other}, seats were dealt ${JSON.stringify(dealt.cash)}`);
  // The menu names it, so a screenshot says which game was being played.
  const said = await page.evaluate(() => { window.showMenu(); return document.getElementById('buildLine').innerText; });
  // Strip the thousands separator before comparing — money() renders ₡1,000
  // and the digits alone do not appear anywhere in that string.
  if (said.replace(/,/g, '').includes(String(purse.other))) pass('and the menu names it beside the build');
  else fail(`the build line does not name the purse: "${said.replace(/\n/g, ' ')}"`);
  await page.evaluate(() => window.closeSheet());

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#begin');

  // ---- the anchorage pot, the other setup option ----
  const potOpts = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[data-p]')];
    const on = document.querySelector('[data-p].on');
    const fld = btns[0] && btns[0].closest('.fld');
    // The FOOT note specifically. Reading document.body caught the option
     // button's own label "Pays nothing" and would have passed with the note
     // never changing at all.
     const foot = [...document.querySelectorAll('p.note')].pop();
     return { n: btns.length, dflt: on ? on.dataset.p : null,
              note: fld ? fld.innerText : '', foot: foot ? foot.innerText : '' };
  });
  if (potOpts.n === 2) pass('the anchorage is offered on and off');
  else fail(`${potOpts.n} anchorage options`);
  if (potOpts.dflt === '0') pass('and opens OFF, which every figure is calibrated against');
  else fail(`the anchorage opens at "${potOpts.dflt}"`);
  // The standing note at the foot of the screen states the rule as a fact.
  // It said "Neutral Anchorage pays nothing" unconditionally, which would be a
  // flat lie on a table playing the house rule.
  if (/pays nothing/i.test(potOpts.foot)) pass('and the standing note agrees with it');
  else fail('the foot of the setup screen does not say the anchorage pays nothing');

  await page.click('[data-p="1"]');
  const potOn = await page.evaluate(() => ({
    foot: ([...document.querySelectorAll('p.note')].pop() || {}).innerText || '',
    note: document.querySelector('[data-p]').closest('.fld').innerText
  }));
  if (!/pays nothing/i.test(potOn.foot) && /unclaimed tribute/i.test(potOn.foot))
    pass('turning it on rewrites the standing note rather than leaving it wrong');
  else fail('the standing note still says the anchorage pays nothing with the rule on');
  // The counter-intuitive half again: it raises the takeover rate rather than
  // softening the game, and a player choosing it should be told so.
  if (/not a lifeline|more likely/i.test(potOn.note)) pass('and warns it is fuel, not a lifeline');
  else fail('the anchorage note does not say what the rule actually does');

  await page.click('[data-h="1"]');
  await page.click('[data-a="spector"]');
  await page.click('#begin');
  await page.waitForSelector('#game:not(.hidden)');
  const potGame = await page.evaluate(() => {
    const G = window.__G();
    const anch = window.__BOARD().findIndex(b => b.t === 'free');
    G.pot = 640; window.__tick();
    const cell = document.querySelector(`.cell[data-i="${anch}"] .cpr`);
    return { on: G.anchoragePot, shown: cell ? cell.textContent.trim() : null };
  });
  if (potGame.on === true) pass('the chosen rule reaches the game');
  else fail(`the game was created with anchoragePot ${potGame.on}`);
  // A jackpot you cannot see is not a jackpot. It has to be on the BOARD.
  if (potGame.shown && potGame.shown.replace(/[^0-9]/g, '') === '640')
    pass(`and the pot is legible on the square itself (${potGame.shown})`);
  else fail(`the anchorage cell shows ${JSON.stringify(potGame.shown)} holding ₡640`);

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#begin');

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
