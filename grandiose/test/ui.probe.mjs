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

const URL = process.env.URL || 'http://127.0.0.1:877/grandiose/index.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const DEVICES = [
  { name: 'iPhone SE',        width: 375, height: 667 },
  { name: 'iPhone 16',        width: 393, height: 852 },
  { name: 'iPhone 16 Pro Max', width: 440, height: 956 }
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

  if (layout.codeFont >= 9.5) pass('square labels are legible');
  else fail(`square label font is ${layout.codeFont}px`);
  if (layout.logFont >= 13) pass('body text is legible');
  else fail(`log font is ${layout.logFont}px`);
  if (layout.minAct >= 44) pass('action buttons meet the 44pt tap target');
  else fail(`smallest action button is ${layout.minAct}px, under the 44pt minimum`);
  if (layout.scrollW <= layout.clientW + 1) pass('no horizontal scrolling');
  else fail(`page scrolls sideways: ${layout.scrollW} > ${layout.clientW}`);
  if (layout.bodyScroll <= 1) pass('everything fits without scrolling the page');
  else fail(`body scrolls by ${layout.bodyScroll}px`);

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

  // ---- building, which the blind prober above never reaches by luck ----
  // Hand the current player a completed set and check the Manage sheet offers
  // the build, that it takes the money, and that it comes out of the pool.
  const built = await page.evaluate(async () => {
    const ui = window;
    const G = window.__G ? window.__G() : null;
    if (!G) return 'no game handle';
    const p = G.players[G.cur];
    p.cash = 5000;
    p.holdings = [
      { sq: 13, garrisons: 0, citadel: 0, mortgaged: 0 },
      { sq: 14, garrisons: 0, citadel: 0, mortgaged: 0 },
      { sq: 15, garrisons: 0, citadel: 0, mortgaged: 0 }
    ];
    for (const q of G.players) if (q !== p) q.holdings = q.holdings.filter(h => ![13, 14, 15].includes(h.sq));
    const poolBefore = G.garrisonPool, cashBefore = p.cash;
    ui.showManage();
    const btn = document.querySelector('.sheet [data-fn^="build|"]');
    if (!btn) return 'no build button offered on a completed set';
    btn.click();
    return {
      spent: cashBefore - G.players[G.cur].cash,
      fromPool: poolBefore - G.garrisonPool,
      garrisons: G.players[G.cur].holdings.find(h => h.sq === 13)?.garrisons
    };
  });
  if (typeof built === 'string') fail(built);
  else if (built.spent === 100 && built.fromPool === 1 && built.garrisons === 1) {
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
