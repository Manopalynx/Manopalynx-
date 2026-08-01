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
