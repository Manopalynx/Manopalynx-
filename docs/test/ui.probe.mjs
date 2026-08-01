// Drives the real page in a real browser at real iPhone sizes.
//
// Not part of `node --test` — it needs Playwright and a local server, so it is
// run by hand. Named .probe.mjs so the *.test.mjs glob leaves it alone.
//
//   npm i playwright
//   python3 -m http.server 877 --directory . &
//   node grandiose/test/ui.probe.mjs
//
// It plays real turns through the interface and fails on any thrown error,
// any console error, any page that scrolls sideways, and any tap target or
// body text below what is legible and hittable on a phone.

import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:877/docs/index.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const DEVICES = [
  { name: 'iPhone SE',              width: 375, height: 667 },
  { name: 'iPhone 16',              width: 393, height: 852 },
  { name: 'iPhone 16 Pro Max',      width: 440, height: 956 },
  { name: 'iPhone 16 landscape',    width: 852, height: 393 },
  { name: 'iPhone 16 PM landscape', width: 956, height: 440 }
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
    // No audio in headless — an AudioContext here proves nothing and stalls.
    delete window.AudioContext; delete window.webkitAudioContext;
  });
  await page.goto(URL, { waitUntil: 'networkidle' });

  // ---- setup screen ----
  await page.waitForSelector('#begin');
  await page.click('[data-a="spector"]');            // add an opponent
  await page.click('#begin');
  await page.waitForSelector('#game:not(.hidden)');
  pass('game starts');

  // ---- layout ----
  const layout = await page.evaluate(() => {
    const cs = s => getComputedStyle(document.querySelector(s));
    const r = s => document.querySelector(s).getBoundingClientRect();
    const acts = [...document.querySelectorAll('.act')].map(b => b.getBoundingClientRect().height);
    return {
      cell: +r('.cell').width.toFixed(1),
      codeFont: parseFloat(cs('.cell .code').fontSize),
      priceFont: parseFloat(cs('.cell .cpr').fontSize),
      logFont: parseFloat(cs('.log').fontSize),
      msgFont: parseFloat(cs('.mid .msg').fontSize),
      minAct: Math.min(...acts),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      bodyScroll: document.body.scrollHeight - document.body.clientHeight
    };
  });
  console.log(`        cell ${layout.cell}px · code ${layout.codeFont}px · price ${layout.priceFont}px ` +
              `· log ${layout.logFont}px · smallest button ${layout.minAct}px`);

  if (layout.codeFont >= 10) pass('square labels are legible');
  else fail(`square label font is ${layout.codeFont}px`);
  // Legible is not the same as fitting. Measure every code for overflow rather
  // than trusting that four characters happen to sit inside a 31px cell.
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.cell .code')]
      .filter(el => el.scrollWidth > el.clientWidth + 0.5)
      .map(el => el.textContent));
  if (!clipped.length) pass('no square code is clipped by its cell');
  else fail(`${clipped.length} codes overflow their cell: ${clipped.slice(0, 6).join(', ')}`);
  if (layout.logFont >= 13) pass('body text is legible');
  else fail(`log font is ${layout.logFont}px`);
  if (layout.minAct >= 44) pass('action buttons meet the 44pt tap target');
  else fail(`smallest action button is ${layout.minAct}px, under the 44pt minimum`);
  if (layout.scrollW <= layout.clientW + 1) pass('no horizontal scrolling');
  else fail(`page scrolls sideways: ${layout.scrollW} > ${layout.clientW}`);
  if (layout.bodyScroll <= 1) pass('everything fits without scrolling the page');
  else fail(`body scrolls by ${layout.bodyScroll}px`);
  const board = await page.evaluate(() => {
    const b = document.querySelector('#board').getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1),
             fitsW: b.width <= innerWidth + 1, fitsH: b.height <= innerHeight + 1 };
  });
  if (board.fitsW && board.fitsH) pass(`the board fits the screen (${board.w}x${board.h})`);
  else fail(`the board is ${board.w}x${board.h} in a ${await page.evaluate(() => innerWidth + 'x' + innerHeight)} viewport`);
  if (Math.abs(board.w - board.h) <= 2) pass('the board is square');
  else fail(`the board is not square: ${board.w}x${board.h}`);

  // ---- play real turns ----
  const clickIf = async sel => {
    const el = await page.$(sel);
    if (!el) return false;
    if (await el.isDisabled().catch(() => false)) return false;
    await el.click({ timeout: 2000 }).catch(() => {});
    return true;
  };

  let moves = 0;
  for (let step = 0; step < 260; step++) {
    await page.waitForTimeout(60);
    const state = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet');
      const acts = [...document.querySelectorAll('.act')]
        .filter(b => !b.disabled).map(b => b.textContent.trim().split('\n')[0]);
      return { sheet: !!sheet, sheetTitle: sheet ? sheet.querySelector('h3')?.textContent : null, acts };
    });

    if (state.sheet) {
      // Sealed bids and claims need a number before the primary button works.
      if (await page.$('#bidIn')) await page.fill('#bidIn', '120').catch(() => {});
      const primary = await page.$('.sheet .mbtn.pri:not([disabled])');
      if (primary) await primary.click({ timeout: 2000 }).catch(() => {});
      else {
        const any = await page.$('.sheet .mbtn:not([disabled])');
        if (any) await any.click({ timeout: 2000 }).catch(() => {});
      }
      continue;
    }
    if (await clickIf('.act.pri:not([disabled])')) { moves++; continue; }
    if (await clickIf('.act:not([disabled])')) { moves++; continue; }
  }
  if (moves > 20) pass(`played ${moves} interface actions`);
  else fail(`only ${moves} actions were possible — the interface wedged`);

  const progress = await page.evaluate(() => {
    const meta = document.querySelector('.mid .meta');
    return { meta: meta ? meta.textContent.trim() : '', entries: document.querySelectorAll('.le').length };
  });
  console.log(`        ${progress.meta} · ${progress.entries} log entries`);
  if (progress.entries > 10) pass('the game actually progressed');
  else fail('the log barely moved — nothing happened');

  // ---- save and resume ----
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('grandiose-ledger-v1');
    return raw ? JSON.parse(raw) : null;
  });
  if (saved && saved.G && saved.G.players) pass('the game saved itself');
  else fail('nothing was written to localStorage');

  await page.reload({ waitUntil: 'networkidle' });
  const resumeVisible = await page.$('#resume');
  if (resumeVisible) {
    await page.click('#resume');
    await page.waitForSelector('#game:not(.hidden)');
    const after = await page.evaluate(() => document.querySelectorAll('.le').length);
    if (after > 10) pass('the game resumed with its log intact');
    else fail('resume produced an empty game');
  } else fail('no resume offered after reload');

  // ---- the piece must not flash to its destination before it walks ----
  // The engine finishes a move before returning, so p.pos is already the
  // destination. Any render between the engine call and the first step of the
  // walk shows the piece arrive, then snap back to start and walk there again.
  const jump = await page.evaluate(() => {
    const G = window.__G();
    // Forced rather than waited for: the play loop rarely leaves the game in a
    // roll phase with a human to move, and this check must actually run.
    while (G.players[G.cur].kind !== 'human') G.cur = (G.cur + 1) % G.players.length;
    G.phase = 'roll';
    const p = G.players[G.cur];
    p.inFacility = false;
    const from = p.pos;
    window.act_roll();                       // renders synchronously before any timer
    const cell = document.querySelector('.tok.me');
    const shown = cell && cell.closest('[data-i]') ? +cell.closest('[data-i]').dataset.i : -1;
    return { from, shown, engineNowAt: G.players[G.cur].pos };
  });
  if (jump === 'skip') console.log('        (skipped the jump check — not in a roll phase)');
  else if (jump.shown === jump.from && jump.engineNowAt !== jump.from) {
    pass('the piece stays put when the dice are rolled, then walks');
  } else if (jump.shown === jump.engineNowAt && jump.from !== jump.engineNowAt) {
    fail(`the piece jumped straight to square ${jump.shown} before walking back to ${jump.from}`);
  } else {
    console.log(`        (jump check inconclusive: ${JSON.stringify(jump)})`);
  }
  await page.waitForTimeout(2200);           // let that move finish before carrying on

  // ---- the Holdings sheet must not move under the thumb ----
  const managed = await page.evaluate(async () => {
    const G = window.__G();
    const p = G.players[G.cur];
    p.cash = 6000;
    // Looked up rather than hardcoded, so this survives the board changing again.
    const eden = window.__SETS().eden.sq;
    const extra = window.__BOARD()
      .map((b, k) => [b, k])
      .filter(([b, k]) => b.s && !eden.includes(k))
      .slice(0, 5)
      .map(([, k]) => k);
    p.holdings = [...eden, ...extra].map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    for (const q of G.players) {
      if (q !== p) q.holdings = q.holdings.filter(h => !p.holdings.some(x => x.sq === h.sq));
    }
    window.showManage();
    const sheet = document.querySelector('.sheet');
    sheet.scrollTop = 120;                   // as if the player had scrolled to a holding
    const scrolled = sheet.scrollTop;
    const rowBefore = document.querySelector(`[data-row="${eden[0]}"]`);
    const topBefore = rowBefore.getBoundingClientRect().top;
    const btn = rowBefore.querySelector('[data-fn^="build|"]');
    if (!btn) return 'no build button on a completed set';
    btn.click();
    const sheetAfter = document.querySelector('.sheet');
    const rowAfter = document.querySelector(`[data-row="${eden[0]}"]`);
    return {
      sameSheet: sheet === sheetAfter,
      sameRow: rowBefore === rowAfter,
      scrollBefore: scrolled,
      scrollAfter: sheetAfter.scrollTop,
      moved: Math.abs(rowAfter.getBoundingClientRect().top - topBefore)
    };
  });
  if (typeof managed === 'string') fail(managed);
  else {
    if (managed.sameSheet && managed.sameRow) pass('building updates the sheet in place');
    else fail('the Holdings sheet is rebuilt on every purchase');
    if (managed.scrollAfter === managed.scrollBefore) pass('the scroll position survives a purchase');
    else fail(`the list jumped from ${managed.scrollBefore} to ${managed.scrollAfter} on purchase`);
    if (managed.moved <= 1) pass('the row you tapped does not move');
    else fail(`the row moved ${managed.moved.toFixed(1)}px under the thumb`);
  }
  await page.evaluate(() => window.closeSheet());

  // ---- the contract sheet ----
  const trade = await page.evaluate(async () => {
    const G = window.__G(), SETS = window.__SETS();
    while (G.players[G.cur].kind !== 'human') G.cur = (G.cur + 1) % G.players.length;
    const me = G.players[G.cur];
    const them = G.players.find(q => q !== me);
    me.debt = 0; me.cash = 5000;
    const eden = SETS.eden.sq, syn = SETS.syn.sq;
    // Two of Eden here, the third over there — so the square being asked for
    // genuinely completes a set and the flag has something to report.
    // Two of Eden here, the third over there — so the square being asked for
    // genuinely completes a set. Both sides also hold a spread of other squares,
    // because a two-row sheet cannot scroll and would not test the scroll at all.
    const BOARD = window.__BOARD();
    const spare = BOARD.map((b, k) => [b, k]).filter(([b, k]) => b.s && !eden.includes(k)).map(([, k]) => k);
    me.holdings = [eden[0], eden[1], ...spare.slice(0, 6)]
      .map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    them.holdings = [eden[2], ...spare.slice(6, 12)]
      .map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    for (const q of G.players) {
      if (q !== me && q !== them) q.holdings = q.holdings.filter(h =>
        !eden.includes(h.sq) && h.sq !== syn[0]);
    }
    G.phase = 'end';
    window.__tick();          // a render alone leaves `busy` set from the last opponent
    await new Promise(r => setTimeout(r, 30));

    // 1. an owned square offers a route straight into a contract
    window.showSquare(eden[2]);
    const offerBtn = document.querySelector('.sheet [data-fn^="offerFor|"]');
    if (!offerBtn) return 'tapping an owned square offers no way to make an offer';
    offerBtn.click();
    await new Promise(r => setTimeout(r, 40));
    const asked = window.__TR && window.__TR();
    const wanted = asked ? (Array.isArray(asked.get) ? asked.get : [asked.get]) : [];
    if (!asked || !wanted.includes(eden[2]) || asked.to !== them.i) {
      return `the offer did not open a contract for that square and owner (got ${JSON.stringify(asked && asked.get)})`;
    }

    // 2. the cash field starts empty rather than at a literal zero
    const cash = document.getElementById('trCash');
    if (!cash) return 'no cash field';
    const startedEmpty = cash.value === '';

    // 3. the totals are shown, and follow what is selected
    const sum = document.querySelector('.tradeSum');
    if (!sum) return 'no value summary on the contract sheet';
    const withGet = sum.textContent;
    cash.value = '250';
    cash.dispatchEvent(new Event('input'));
    const withCash = document.querySelector('.tradeSum').textContent;

    // 4. selecting must not rebuild the sheet under the thumb
    const sheetEl = document.querySelector('.sheet');
    sheetEl.scrollTop = 90;
    const scrolledTo = sheetEl.scrollTop;      // may clamp on a short sheet
    const mine = me.holdings.find(h => !eden.includes(h.sq));
    const giveBtn = document.querySelector(`[data-fn="tradeSet|give|${mine.sq}"]`);
    if (!giveBtn) return 'nothing of ours is offered to give';
    const rowTop = giveBtn.getBoundingClientRect().top;
    giveBtn.click();
    const sameSheet = document.querySelector('.sheet') === sheetEl;
    const sameRow = document.querySelector(`[data-fn="tradeSet|give|${mine.sq}"]`) === giveBtn;
    return {
      startedEmpty,
      totalsChanged: withCash !== withGet,
      mentionsCompletes: /Completes/.test(document.querySelector('.tradeSum').textContent),
      sameSheet, sameRow,
      scrolledTo,
      scrollKept: sheetEl.scrollTop === scrolledTo,
      moved: Math.abs(giveBtn.getBoundingClientRect().top - rowTop)
    };
  });
  if (typeof trade === 'string') fail(trade);
  else {
    pass('an owned square opens a contract for it');
    if (trade.startedEmpty) pass('the cash field starts empty, not at zero');
    else fail('the cash field still needs a 0 deleting');
    if (trade.totalsChanged) pass('the value summary follows what is offered');
    else fail('the value summary did not react to the cash offered');
    if (trade.mentionsCompletes) pass('it flags a set completion');
    else fail('a completing square was not flagged');
    if (trade.sameSheet && trade.sameRow && trade.scrollKept && trade.moved <= 1) {
      pass('selecting a square updates in place and holds the scroll');
    } else {
      fail(`the contract sheet rebuilt on selection (scroll kept ${trade.scrollKept}, moved ${trade.moved}px)`);
    }
  }
  await page.evaluate(() => window.closeSheet());
  await page.waitForTimeout(150);

  // ---- the menu must name the build and the seed ----
  // These exist only to be read off a screenshot, so "the value is in the DOM"
  // is not the assertion — it has to be rendered text that matches the running
  // game. Values are copied out here rather than held by reference, because the
  // New game check below abandons this game and would mutate anything retained.
  const stamp = await page.evaluate(() => {
    document.getElementById('menuBtn').click();
    const el = document.getElementById('buildLine');
    if (!el) return 'the menu shows no build/seed line';
    return { text: (el.textContent || '').replace(/\s+/g, ' ').trim(), seed: window.__G().seed };
  });
  if (typeof stamp === 'string') fail(stamp);
  else {
    const build = stamp.text.match(/Build (grandiose-v\d+)/);
    if (build) pass(`the menu names the build (${build[1]})`);
    else fail(`the menu does not print a build version — got "${stamp.text.slice(0, 80)}"`);
    const shown = stamp.text.match(/seed (\d+)/);
    if (!shown) fail(`the menu does not print a seed — got "${stamp.text.slice(0, 80)}"`);
    else if (+shown[1] === (stamp.seed >>> 0)) pass(`the seed shown is the seed in play (${shown[1]})`);
    else fail(`the menu shows seed ${shown[1]} but the game is running ${stamp.seed >>> 0}`);
  }
  await page.evaluate(() => document.querySelector('[data-fn="closeSheet"]')?.click());

  // ---- there must be a way out of a game in progress ----
  const menu = await page.evaluate(async () => {
    const btn = document.getElementById('menuBtn');
    if (!btn) return 'no menu button in the bar';
    btn.click();
    const sheet = document.querySelector('.sheet');
    if (!sheet) return 'the menu did not open';
    const newGame = sheet.querySelector('[data-fn="newGame"]');
    if (!newGame) return 'the menu offers no way to start over';
    const before = newGame.textContent;
    newGame.click();                       // first tap must ARM, not fire
    const armed = newGame.dataset.armed === '1' && newGame.textContent !== before;
    const stillPlaying = !!window.__G() && !document.getElementById('game').classList.contains('hidden');
    // and a second tap must actually do it
    newGame.click();
    await new Promise(r => setTimeout(r, 60));
    const wentToSetup = !document.getElementById('setup').classList.contains('hidden');
    return { armed, stillPlaying, wentToSetup };
  });
  if (typeof menu === 'string') fail(menu);
  else {
    if (menu.armed && menu.stillPlaying) pass('a destructive button arms before it fires');
    else fail('New game fired on a single tap');
    if (menu.wentToSetup) pass('the menu can abandon a game and return to setup');
    else fail('confirming New game did not return to the menu screen');
  }
  // put a game back for the checks that follow
  await page.evaluate(() => { document.querySelector('[data-a="spector"]').click(); });
  await page.click('#begin');
  await page.waitForSelector('#game:not(.hidden)');
  await page.waitForTimeout(400);

  // ---- being short must ask, not decide for you ----
  const settle = await page.evaluate(async () => {
    const G = window.__G();
    const SETS = window.__SETS();
    while (G.players[G.cur].kind !== 'human') G.cur = (G.cur + 1) % G.players.length;
    const p = G.players[G.cur];
    const other = G.players.find(q => q !== p);
    // Give them a board worth pledging and almost no cash, then land them on a
    // rent they cannot cover.
    p.cash = 5;
    p.holdings = SETS.eden.sq.map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    const rented = SETS.agora.sq[0];
    // One garrison, not three: at three the rent is 1100 and the player's whole
    // board raises 285, so nothing could cover it and Auto would be blamed for
    // arithmetic rather than behaviour.
    other.holdings = [{ sq: rented, garrisons: 1, citadel: 0, mortgaged: 0 }];
    for (const q of G.players) if (q !== other) q.holdings = q.holdings.filter(h => h.sq !== rented);
    p.pos = rented;
    G.phase = 'landed';
    window.act_resolve();
    if (G.phase !== 'settle') return `expected the settle phase, got ${G.phase}`;
    const sheet = document.querySelector('.sheet');
    if (!sheet) return 'no settlement sheet appeared';
    const pledgeBtn = document.querySelector('.sheet [data-fn^="settlePledge|"]');
    if (!pledgeBtn) return 'the sheet offers nothing to pledge';
    const before = p.cash;
    pledgeBtn.click();
    const raised = G.players[G.cur].cash - before;
    // Auto should cover the rest without being asked twice.
    const auto = document.querySelector('.sheet [data-fn="settleAuto"]');
    if (auto) auto.click();
    const covered = G.players[G.cur].cash >= G.settlement.owed;
    document.querySelector('.sheet [data-fn="settleDone"]').click();
    await new Promise(r => setTimeout(r, 60));
    return { raised, covered, settled: G.settlement === null, phaseAfter: G.phase };
  });
  if (typeof settle === 'string') fail(settle);
  else {
    if (settle.raised > 0) pass(`pledging in the settlement sheet raises money (${settle.raised})`);
    else fail('pledging raised nothing');
    if (settle.covered) pass('Auto covers the remainder');
    else fail('Auto did not cover the shortfall');
    if (settle.settled && settle.phaseAfter !== 'settle') pass('settling completes the payment and moves on');
    else fail(`still parked in ${settle.phaseAfter}`);
  }
  await page.evaluate(() => window.closeSheet());
  await page.waitForTimeout(200);

  // ---- what the panel says against what the engine charges ----
  // The panel used to write its fleet rents out by hand. They were true of a
  // two-fleet board three boards ago and silently wrong ever since: the panel
  // said ₡50, the engine took ₡25, and nothing failed. Read the figures back
  // out of the rendered panel and compare them to rentOf.
  const quoted = await page.evaluate(async () => {
    const G = window.__G(), E = window.__E(), BOARD = window.__BOARD();
    const me = G.players[G.cur];
    const them = G.players.find(q => q !== me);
    const fleets = BOARD.map((b, i) => [b, i]).filter(([b]) => b.t === 'f').map(([, i]) => i);
    const utils  = BOARD.map((b, i) => [b, i]).filter(([b]) => b.t === 'u').map(([, i]) => i);
    for (const q of G.players) q.holdings = [];
    G.dice = [4, 5];   // 9

    // Read "You would pay" and the highlighted row out of the rendered panel.
    const read = sq => {
      window.showSquare(sq);
      const sheet = document.querySelector('.sheet');
      const num = t => {
        const m = /₡([\d,]+)/.exec(t || '');
        return m ? +m[1].replace(/,/g, '') : null;
      };
      const stat = [...sheet.querySelectorAll('.stat')]
        .find(d => /You would pay/.test(d.textContent));
      const row = [...sheet.querySelectorAll('tr')].find(r => /— now/.test(r.textContent));
      const out = {
        shown: stat ? num(stat.textContent) : null,
        row: row ? num(row.textContent) : null,
        rowText: row ? row.textContent.replace(/\s+/g, ' ').trim() : null,
        engine: E.rentOf(G, sq, G.dice[0] + G.dice[1])
      };
      window.closeSheet();
      return out;
    };

    const results = [];
    for (let n = 1; n <= fleets.length; n++) {
      them.holdings = fleets.slice(0, n).map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
      results.push({ what: `${n} fleet(s)`, ...read(fleets[0]) });
    }
    for (let n = 1; n <= utils.length; n++) {
      them.holdings = utils.slice(0, n).map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
      results.push({ what: `${n} utility(ies)`, ...read(utils[0]), noRowFigure: true });
    }
    // A built holding, where the table is a fixed column of the data.
    const eden = window.__SETS().eden.sq;
    them.holdings = eden.map(sq => ({ sq, garrisons: 2, citadel: 0, mortgaged: 0 }));
    results.push({ what: 'a set at 2 garrisons', ...read(eden[0]), noRowFigure: true });
    return results;
  });
  for (const r of quoted) {
    if (r.shown === r.engine) pass(`panel quotes ${r.what} at ₡${r.engine}, the same as the engine`);
    else fail(`panel says ₡${r.shown} for ${r.what}, engine charges ₡${r.engine}`);
    if (r.noRowFigure) continue;
    if (r.row === r.engine) pass(`  and marks the current tier (${r.rowText})`);
    else fail(`  the highlighted tier reads ${r.rowText} against ₡${r.engine}`);
  }

  // ---- the landing button states the bill before it is paid ----
  // "Resolve" told the player nothing. Whatever the button now says has to be
  // the figure the engine is about to take.
  const landing = await page.evaluate(async () => {
    const G = window.__G(), E = window.__E(), BOARD = window.__BOARD();
    const me = G.players[G.cur];
    const them = G.players.find(q => q !== me);
    const seen = {};
    const sample = () => {
      window.__render();
      const btn = document.querySelector('.acts .act.pri') || document.querySelector('.act.pri');
      return btn ? btn.textContent.replace(/\s+/g, ' ').trim() : null;
    };

    // rent owed to a named opponent
    for (const q of G.players) q.holdings = [];
    const syn = window.__SETS().syn.sq;
    them.holdings = [{ sq: syn[0], garrisons: 0, citadel: 0, mortgaged: 0 }];
    me.pos = syn[0]; me.cash = 3000; G.dice = [3, 4]; G.phase = 'landed';
    seen.rent = { label: sample(), owed: E.rentOf(G, syn[0], 7), who: them.name };

    // an unowned square quotes its price
    const spare = BOARD.findIndex((b, i) => b.pr && !G.players.some(q => q.holdings.some(h => h.sq === i)));
    me.pos = spare; G.phase = 'landed';
    seen.buy = { label: sample(), price: BOARD[spare].pr };

    // your own holding asks for nothing
    me.holdings = [{ sq: syn[1], garrisons: 0, citadel: 0, mortgaged: 0 }];
    me.pos = syn[1]; G.phase = 'landed';
    seen.own = { label: sample() };
    return seen;
  });
  const says = (label, ...needles) =>
    !!label && needles.every(n => label.toLowerCase().includes(String(n).toLowerCase()));
  if (says(landing.rent.label, 'pay', landing.rent.owed, landing.rent.who.split(' ')[0]))
    pass(`the landing button names the bill and the creditor ("${landing.rent.label}")`);
  else fail(`landing button reads "${landing.rent.label}", expected ₡${landing.rent.owed} to ${landing.rent.who}`);
  if (says(landing.buy.label, 'buy', landing.buy.price))
    pass(`an unowned square quotes its price ("${landing.buy.label}")`);
  else fail(`landing button reads "${landing.buy.label}", expected the price ₡${landing.buy.price}`);
  if (says(landing.own.label, 'nothing due') || says(landing.own.label, 'your holding'))
    pass(`your own square asks for nothing ("${landing.own.label}")`);
  else fail(`landing button reads "${landing.own.label}" on your own holding`);
  await page.evaluate(() => window.closeSheet());

  // ---- a drawn card says what it does ----
  // The flavour text is written to be read, not to be precise: "Varan finds
  // ₡120 that should not have been there" never said who ends up with it.
  const cards = await page.evaluate(async () => {
    const G = window.__G(), E = window.__E();
    const CON = window.__CON();
    const p = G.players[G.cur];
    const read = card => {
      G.pendingCard = { card, isContingency: true };
      G.phase = 'card';
      window.__showCard();
      const eff = document.querySelector('.sheet .effect');
      const text = eff ? eff.textContent.replace(/\s+/g, ' ').trim() : null;
      window.closeSheet();
      return text;
    };
    p.pos = 22; p.cash = 4000; p.holdings = [];
    G.dice = [3, 4];
    const out = { every: [], seats: G.players.length };
    for (const c of CON) out.every.push({ x: c.x, said: read(c) });
    out.debit = read(CON.find(c => c.cash < 0));
    out.credit = read(CON.find(c => c.cash > 0));
    out.move = read(CON.find(c => c.go === 39));
    out.detention = read(CON.find(c => c.jail));
    out.each = read(CON.find(c => c.each));
    out.eachRate = Math.abs(CON.find(c => c.each).each);
    out.pardon = read(CON.find(c => c.pardon));
    // A per-garrison charge with something actually held.
    const eden = window.__SETS().eden.sq;
    p.holdings = eden.map(sq => ({ sq, garrisons: 3, citadel: 0, mortgaged: 0 }));
    out.per = read(CON.find(c => c.perGarrison));
    // The longest card in the deck: does its Enter button still land above the
    // fold on the smallest phone, or has the effect line pushed it off?
    //
    // Two things this has to get right. It must measure AFTER the sheet's rise
    // animation — during it the button reads 22px low, which shows up as the
    // same 4px overflow on every viewport at once, and an overflow that does
    // not vary with screen height is not an overflow. And it must not hold the
    // game in a forced `card` phase across an await: the game's own scheduler
    // runs in that gap and works on state the probe invented.
    let tallest = null, tallestH = 0;
    for (const c of CON) {
      G.pendingCard = { card: c, isContingency: true };
      G.phase = 'card';
      window.__showCard();
      const h = document.querySelector('.sheet').scrollHeight;
      if (h > tallestH) { tallestH = h; tallest = c; }
      window.closeSheet();
    }
    G.pendingCard = { card: tallest, isContingency: true };
    G.phase = 'card';
    window.__showCard();
    await new Promise(r => setTimeout(r, 300));         // one gap, not sixteen
    const btn = document.querySelector('.sheet .mbtn').getBoundingClientRect();
    out.worst = { h: btn.bottom, x: tallest.x, vh: window.innerHeight,
                  fits: btn.bottom <= window.innerHeight };
    window.closeSheet();
    G.pendingCard = null; G.phase = 'end';
    return out;
  });
  const missing = cards.every.filter(c => !c.said);
  if (!missing.length) pass(`every Contingency card states its effect (${cards.every.length} cards)`);
  else fail(`${missing.length} cards state nothing: ${missing.map(m => m.x).join(' | ')}`);
  if (/Pay ₡120/.test(cards.debit)) pass(`a charge says so plainly ("${cards.debit}")`);
  else fail(`the debit card said "${cards.debit}"`);
  if (/Gain ₡/.test(cards.credit)) pass(`a payment says so plainly ("${cards.credit}")`);
  else fail(`the credit card said "${cards.credit}"`);
  if (/Move to Cradle/.test(cards.move)) pass(`a movement card names its destination ("${cards.move}")`);
  else fail(`the movement card said "${cards.move}"`);
  if (/Detention/.test(cards.detention)) pass('detention is stated');
  else fail(`the detention card said "${cards.detention}"`);
  if (/9 garrisons/.test(cards.per) && /₡225/.test(cards.per))
    pass(`a per-garrison charge is worked out for you ("${cards.per}")`);
  else fail(`the per-garrison card said "${cards.per}"`);
  // The only cards that reach the other players: the total has to be the rate
  // times however many are actually at this table, not a figure written down.
  const eachTotal = cards.eachRate * (cards.seats - 1);
  if (cards.each && cards.each.includes(String(eachTotal)))
    pass(`a pay-each card totals it for the table ("${cards.each}")`);
  else fail(`the pay-each card said "${cards.each}", expected ₡${eachTotal} across ${cards.seats - 1}`);
  if (cards.pardon && /favour/i.test(cards.pardon)) pass(`a favour says it is kept ("${cards.pardon}")`);
  else fail(`the favour card said "${cards.pardon}"`);
  if (cards.worst.fits) pass(`the longest card fits above the fold, ${Math.round(cards.worst.vh - cards.worst.h)}px clear`);
  else fail(`"${cards.worst.x}" pushes Enter it to ${Math.round(cards.worst.h)}px, off the screen`);

  // ---- the Overseer's favour, from the button ----
  // A favour is held for a long time before it is spent, so the button only
  // exists on the turn you are detained. Check it appears, that it walks you
  // out, and that it does not also charge the fee.
  const favour = await page.evaluate(async () => {
    const G = window.__G();
    const p = G.players[G.cur];
    p.inFacility = true; p.attempts = 1; p.pardons = 0; p.cash = 3000;
    G.phase = 'roll';
    window.__render();
    const labels = () => [...document.querySelectorAll('.act')]
      .map(b => b.textContent.replace(/\s+/g, ' ').trim());
    const withoutIt = labels().find(l => /Settle|Favour/.test(l));
    p.pardons = 1;
    window.__render();
    const withIt = labels().find(l => /Settle|Favour/.test(l));
    const btn = [...document.querySelectorAll('.act')].find(b => /Favour/.test(b.textContent));
    if (!btn) return { withoutIt, withIt, err: 'no Favour button while holding one' };
    const cash = p.cash;
    btn.click();
    await new Promise(r => setTimeout(r, 60));
    return { withoutIt, withIt, out: !p.inFacility, left: p.pardons,
             spent: cash - G.players.find(q => q.i === p.i).cash };
  });
  if (favour.err) fail(favour.err);
  else {
    if (/Settle/.test(favour.withoutIt)) pass(`with no favour the slot settles the fee ("${favour.withoutIt}")`);
    else fail(`with no favour the slot read "${favour.withoutIt}"`);
    if (/Favour/.test(favour.withIt)) pass(`holding one puts it on the button ("${favour.withIt}")`);
    else fail(`holding one, the slot read "${favour.withIt}"`);
    if (favour.out && favour.left === 0 && favour.spent === 0)
      pass('spending a favour walks you out for nothing');
    else fail(`favour left detained=${!favour.out}, held=${favour.left}, spent=${favour.spent}`);
  }
  await page.evaluate(() => { const G = window.__G(); G.players.forEach(q => q.pardons = 0); });

  // ---- the deck reference ----
  // Both decks, listed. The failure that matters is a card silently missing or
  // a row with no effect against it, not the wording.
  const decks = await page.evaluate(() => {
    window.showDecks();
    const sheet = document.querySelector('.sheet');
    if (!sheet) return 'the decks sheet did not open';
    const rows = [...sheet.querySelectorAll('.deckrow')].map(r => ({
      what: r.querySelector('.deckwhat')?.textContent.trim(),
      says: r.querySelector('.decksays')?.textContent.trim()
    }));
    const wide = sheet.scrollWidth > sheet.clientWidth + 1;
    window.closeSheet();
    return { rows, wide, expected: window.__CON().length + window.__COL().length };
  });
  if (typeof decks === 'string') fail(decks);
  else {
    if (decks.rows.length === decks.expected)
      pass(`the decks screen lists all ${decks.expected} cards`);
    else fail(`the decks screen lists ${decks.rows.length} of ${decks.expected} cards`);
    const blank = decks.rows.filter(r => !r.what || r.what === '—' || !r.says);
    if (!blank.length) pass('every card there states an effect');
    else fail(`${blank.length} rows have no effect against them: ${blank.map(b => b.says).join(' | ')}`);
    if (!decks.wide) pass('the decks screen does not scroll sideways');
    else fail('the decks screen scrolls sideways');
  }

  // ---- the line under a square's name ----
  // Thirty of forty squares quote the novel. The quoted ones are italic against
  // a gold rule and the written ones are plain, which is the only place a player
  // can tell which is which — so check the distinction actually renders.
  const flav = await page.evaluate(() => {
    const BOARD = window.__BOARD();
    const out = [];
    for (let i = 0; i < BOARD.length; i++) {
      window.showSquare(i);
      const el = document.querySelector('.sheet .flav');
      out.push({
        i, n: BOARD[i].n, qv: !!BOARD[i].qv,
        shown: el ? el.textContent.trim() : null,
        quoted: el ? el.classList.contains('quoted') : null,
        italic: el ? getComputedStyle(el).fontStyle === 'italic' : null
      });
      window.closeSheet();
    }
    return out;
  });
  const noLine = flav.filter(f => !f.shown);
  if (!noLine.length) pass(`every square shows its line (${flav.length} squares)`);
  else fail(`${noLine.length} squares show no line: ${noLine.map(f => f.n).join(', ')}`);
  const mismarked = flav.filter(f => f.shown && f.quoted !== f.qv);
  if (!mismarked.length) pass("the author's lines are marked apart from the game's");
  else fail(`${mismarked.length} lines are marked wrong: ${mismarked.map(f => f.n).join(', ')}`);
  const notItalic = flav.filter(f => f.qv && !f.italic);
  if (!notItalic.length) pass('quoted lines actually render italic');
  else fail(`${notItalic.length} quoted lines are not italic: ${notItalic.map(f => f.n).join(', ')}`);

  // ---- an incoming contract has to show what it does to your board ----
  // It used to show name, price, rent and traffic: everything except the two
  // facts that set the price, which are what colour it is and how much of that
  // colour each side ends up with.
  const contract = await page.evaluate(async () => {
    const G = window.__G(), SETS = window.__SETS(), BOARD = window.__BOARD();
    const me = G.players[G.cur];
    const them = G.players.find(q => q !== me && q.kind !== 'human') || G.players[1];
    const eden = SETS.eden.sq;
    const fleets = BOARD.map((b, i) => [b, i]).filter(([b]) => b.t === 'f').map(([, i]) => i);
    for (const q of G.players) q.holdings = [];
    // Two of Eden and one fleet to me; the third Eden and a second fleet to them.
    const ven = SETS.ven.sq;
    me.holdings = [eden[0], eden[1], ven[0], fleets[0]].map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    them.holdings = [eden[2], fleets[1]].map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    // me gives a Venenum square and receives the third Eden — a real completion.
    // A same-set swap correctly completes nothing, which is not what this checks.
    G.contract = { from: them.i, to: me.i, get: [ven[0]], give: [eden[2]], cash: 0, direction: 1 };
    window.__showContract();
    const sheet = document.querySelector('.sheet');
    const text = sheet.textContent.replace(/\s+/g, ' ');
    const swatches = sheet.querySelectorAll('.swatch').length;
    const completes = /completes .*Eden/i.test(text);
    const breaks = /breaks your/i.test(text);
    window.closeSheet();

    // And a fleet, where the rent is purely a count.
    G.contract = { from: them.i, to: me.i, get: null, give: fleets[1], cash: 0, direction: 1 };
    window.__showContract();
    const fleetText = document.querySelector('.sheet').textContent.replace(/\s+/g, ' ');
    window.closeSheet();
    G.contract = null;
    return { text, swatches, completes, breaks, fleetText, them: them.name.split(' ').pop() };
  });
  if (contract.swatches >= 2) pass(`a contract shows the colour of what is moving (${contract.swatches} swatches)`);
  else fail(`only ${contract.swatches} colour swatches on a two-square contract`);
  // Both sides, on every square — showing only your own count hides what the
  // offer quietly does for the other player.
  const mine = /you\s*2 → 3/.test(contract.text);
  const theirs = new RegExp(`${contract.them}\\s*1 → 0`).test(contract.text);
  if (mine && theirs) pass('it shows what each side holds of the set, before and after');
  else fail(`set counts wrong (yours ${mine}, theirs ${theirs}): ${contract.text.slice(0, 300)}`);
  if (contract.completes) pass('it flags a set completion');
  else fail('receiving the third Eden square was not flagged as completing it');
  if (/Fleets held/.test(contract.fleetText)) pass('a fleet contract counts the fleets');
  else fail(`no fleet count on a fleet contract: ${contract.fleetText.slice(0, 260)}`);
  if (/You would charge/.test(contract.fleetText)) pass('and states what you would charge after');
  else fail('a fleet contract never says what your rent becomes');

  // ---- what a turn and a garrison actually cost ----
  const costs = await page.evaluate(async () => {
    const G = window.__G(), SETS = window.__SETS();
    const p = G.players[G.cur];
    const eden = SETS.eden.sq;
    p.cash = 5000;
    p.holdings = eden.map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    for (const q of G.players) if (q !== p) q.holdings = q.holdings.filter(h => !eden.includes(h.sq));
    window.showManage();
    const rows = [...document.querySelectorAll('.sheet .rowState')].map(e => e.textContent);
    const upkeepEmpty = document.querySelector('.sheet [data-mg="upkeep"]').textContent;
    // Build one, so upkeep is no longer zero and the breakdown has something to say.
    document.querySelector('.sheet [data-fn^="build|"]').click();
    const upkeepBuilt = document.querySelector('.sheet [data-mg="upkeep"]').textContent;
    window.closeSheet();
    G.phase = 'end';
    window.__render();
    const endBtn = [...document.querySelectorAll('.act')].find(b => /End turn/.test(b.textContent));
    return { rows, upkeepEmpty, upkeepBuilt, gc: SETS.eden.gc,
             endLabel: endBtn ? endBtn.textContent.replace(/\s+/g, ' ').trim() : null };
  });
  if (costs.rows.some(r => r.includes(String(costs.gc))))
    pass(`a holding row states what a garrison costs (${costs.rows[0]})`);
  else fail(`no garrison cost on any Manage row: ${costs.rows.join(' | ')}`);
  if (/×/.test(costs.upkeepBuilt))
    pass(`upkeep is broken down once there is something to break down (${costs.upkeepBuilt})`);
  else fail(`upkeep shows no breakdown after building: "${costs.upkeepBuilt}"`);
  if (/upkeep/i.test(costs.endLabel || ''))
    pass(`the End turn button states the upkeep it charges ("${costs.endLabel}")`);
  else fail(`End turn button reads "${costs.endLabel}" with upkeep owing`);

  // ---- the selection ring does not outlive its sheet ----
  const ring = await page.evaluate(async () => {
    window.showSquare(1);
    const during = document.querySelectorAll('.cell.sel').length;
    window.closeSheet();
    await new Promise(r => setTimeout(r, 40));
    return { during, after: document.querySelectorAll('.cell.sel').length };
  });
  if (ring.during === 1 && ring.after === 0)
    pass('the selection ring appears with its sheet and goes with it');
  else fail(`selection ring: ${ring.during} while open, ${ring.after} after closing`);

  // ---- a contract carrying more than one square each way ----
  const bundle = await page.evaluate(async () => {
    const G = window.__G(), SETS = window.__SETS(), E = window.__E();
    const me = G.players[G.cur];
    const them = G.players.find(q => q !== me);
    const eden = SETS.eden.sq, ven = SETS.ven.sq;
    for (const q of G.players) q.holdings = [];
    // I already hold one of Eden, so taking their two completes it — which is
    // the whole point of being able to bundle in the first place.
    me.holdings = [eden[2], ven[0], ven[1]].map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    them.holdings = [eden[0], eden[1]].map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    me.debt = 0; them.debt = 0;
    G.phase = 'end';

    window.showTrade();
    const pick = (kind, sq) => {
      const b = document.querySelector(`.sheet [data-fn="tradeSet|${kind}|${sq}"]`);
      if (b) b.click();
      return !!b;
    };
    // Switch to the right counterparty first, then take both of theirs and
    // offer both of ours.
    const toBtn = document.querySelector(`.sheet [data-fn="tradeSet|to|${them.i}"]`);
    if (toBtn) toBtn.click();
    // Whatever an earlier section left selected, take it back out first — the
    // sheet deliberately remembers a contract in progress.
    for (const kind of ['get', 'give']) {
      for (const sq of [...window.__TR()[kind]]) {
        const b = document.querySelector(`.sheet [data-fn="tradeSet|${kind}|${sq}"]`);
        if (b) b.click();
      }
    }
    const ok = [pick('get', eden[0]), pick('get', eden[1]),
                pick('give', ven[0]), pick('give', ven[1])].every(Boolean);
    // Snapshot the counts NOW. TR is a live object and the cap test below adds
    // to it, so reading .length at return time reports the wrong moment.
    const gets = window.__TR().get.length, gives = window.__TR().give.length;
    const sum = document.querySelector('.sheet .tradeSum')?.textContent.replace(/\s+/g, ' ') || '';
    const heads = [...document.querySelectorAll('.sheet [data-count]')].map(h => h.textContent.trim());

    // Now cap: a third and fourth square must not go in beyond the cap.
    const spare = window.__BOARD().map((b, i) => [b, i])
      .filter(([b, i]) => b.pr && !eden.includes(i) && !ven.includes(i)).map(([, i]) => i);
    for (const sq of spare.slice(0, 3)) {
      them.holdings.push({ sq, garrisons: 0, citadel: 0, mortgaged: 0 });
    }
    window.showTrade();
    for (const sq of [eden[0], eden[1], ...spare.slice(0, 3)]) pick('get', sq);
    const capped = window.__TR().get.length;

    window.closeSheet();
    return { ok, gets, gives, sum, heads, capped,
             max: window.__RULES().tradeMax };
  });
  if (bundle.ok && bundle.gets === 2 && bundle.gives === 2)
    pass('a contract can carry two squares each way');
  else fail(`bundle selection: picked=${bundle.ok}, ${bundle.gets} gets, ${bundle.gives} gives`);
  if (bundle.heads.some(h => /2 of 3/.test(h))) pass(`the sheet counts the bundle (${bundle.heads.join(' / ')})`);
  else fail(`no running count in the headings: ${bundle.heads.join(' / ')}`);
  if (/Completes/.test(bundle.sum)) pass(`the totals flag what a bundle completes (${bundle.sum})`);
  else fail(`the summary said nothing about completion: ${bundle.sum}`);
  if (bundle.capped === bundle.max) pass(`the cap holds at ${bundle.max} squares`);
  else fail(`selected ${bundle.capped} squares against a cap of ${bundle.max}`);

  // ---- the galaxy, and the re-render trap it sits in ----
  // The board is rebuilt with innerHTML on every render. If the centre panel is
  // rebuilt with it, the canvas is destroyed and the animation restarts many
  // times a second. Assert the element survives, and that it is actually drawing.
  const galaxy = await page.evaluate(async () => {
    const before = document.querySelector('.galaxyCanvas');
    if (!before) return 'no canvas in the centre panel';
    const w = before.width, h = before.height;
    if (!w || !h) return `canvas has no backing store (${w}x${h})`;
    const sample = () => {
      const c = document.querySelector('.galaxyCanvas');
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    await new Promise(r => requestAnimationFrame(() => r()));
    const first = sample();
    let lit = 0;
    for (let i = 3; i < first.length; i += 4) if (first[i] > 8) lit++;
    // force several renders, the exact thing that used to wipe it
    for (let k = 0; k < 5; k++) window.__render();
    const after = document.querySelector('.galaxyCanvas');
    await new Promise(r => setTimeout(r, 260));
    const second = sample();
    let moved = 0;
    for (let i = 3; i < first.length; i += 4) if (first[i] !== second[i]) moved++;
    return { same: before === after, litPixels: lit, changedPixels: moved, w, h };
  });
  if (typeof galaxy === 'string') fail(galaxy);
  else {
    if (galaxy.same) pass('the canvas survives board re-renders');
    else fail('the canvas is destroyed on re-render — the animation would restart constantly');
    if (galaxy.litPixels > 500) pass(`the galaxy is drawing (${galaxy.litPixels} lit pixels)`);
    else fail(`the galaxy drew almost nothing (${galaxy.litPixels} lit pixels)`);
    if (galaxy.changedPixels > 200) pass('the galaxy is animating');
    else fail(`the galaxy is static (${galaxy.changedPixels} pixels changed in 260ms)`);
  }

  // ---- building, which the blind prober above never reaches by luck ----
  // Hand the current player a completed set and check the Manage sheet offers
  // the build, that it takes the money, and that it comes out of the pool.
  const built = await page.evaluate(async () => {
    const ui = window;
    const G = window.__G ? window.__G() : null;
    if (!G) return 'no game handle';
    const p = G.players[G.cur];
    p.cash = 5000;
    const eden = window.__SETS().eden.sq;
    p.holdings = eden.map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));
    for (const q of G.players) if (q !== p) q.holdings = q.holdings.filter(h => !eden.includes(h.sq));
    const poolBefore = G.garrisonPool, cashBefore = p.cash;
    ui.showManage();
    const btn = document.querySelector('.sheet [data-fn^="build|"]');
    if (!btn) return 'no build button offered on a completed set';
    btn.click();
    return {
      gc: window.__SETS().eden.gc,
      spent: cashBefore - G.players[G.cur].cash,
      fromPool: poolBefore - G.garrisonPool,
      garrisons: G.players[G.cur].holdings.find(h => h.sq === eden[0])?.garrisons
    };
  });
  if (typeof built === 'string') fail(built);
  else if (built.spent === built.gc && built.fromPool === 1 && built.garrisons === 1) {
    pass('building through Manage charges the set cost and draws from the pool');
  } else fail(`building misbehaved: ${JSON.stringify(built)}`);
  await page.evaluate(() => window.closeSheet());

  if (errors.length) {
    fail(`${errors.length} runtime error(s)`);
    [...new Set(errors)].slice(0, 6).forEach(e => console.log('        ' + e));
  } else pass('no runtime errors');

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
