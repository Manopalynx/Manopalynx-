// Interaction harness for upliftledger.html
//
// The ledger is a single file with no build and no framework, so there is nothing to
// unit-test in isolation: the only meaningful subject is the page being used. Each
// scenario below therefore seeds localStorage, loads the page, performs one real
// interaction, and asserts three things at once:
//
//   1. NOTHING THREW      — no unhandled exception, no console error
//   2. ENTRY COUNT HELD   — calls did not silently appear or vanish
//   3. NOTHING MOVED      — the content under your finger stayed put
//
// All three matter and none is the point on its own. Every defect found in this file
// so far has been a SILENT one — a quantity ignored on save, a duplicate guard crying
// wolf, an export that threw and produced no file, a quota failure that looked
// exactly like success. Assertion 1 alone would have caught the CSV crash. Assertion 3
// exists because the notes list can move a customer's card out from under a tap.
//
// Run:  npm i playwright  &&  node test/interaction.mjs
// Chromium only — that is what the ledger is used in.

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const LEDGER = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '..', 'upliftledger.html');
const KEY = 'uplift-ledger-v3';

// ---------- seed helpers ----------
// Seeds run inside the page. Dates are computed there so the suite is not pinned to
// the machine's clock or timezone.
const SEED_PRELUDE = `
  const pad = n => String(n).padStart(2,'0');
  const localDT = ms => { const d = new Date(ms);
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes()); };
  const today = new Date();
  const DS = today.getFullYear()+'-'+pad(today.getMonth()+1)+'-'+pad(today.getDate());
  const YS = (()=>{ const d=new Date(Date.now()-86400000);
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); })();
  const put = payload => localStorage.setItem('${KEY}',
    JSON.stringify(Object.assign({schemaVersion:1,entries:[],targets:{},spotlights:{},
      easyLeads:{},pctTargets:{},planned:{},noTarget:{}}, payload)));
  const filler = (n, date) => Array.from({length:n}, (_,i) => ({
    id:'f'+i, callId:'f'+i, date:date, product:'SIM', before:20, after:28, loggedAt:Date.now() }));
`;
const seed = body => new Function(SEED_PRELUDE + body);

// A callback carrying a note, due `mins` from now. Negative = already overdue.
const callbackSeed = mins => seed(`
  put({ entries: [{ id:'cb0', callId:'cb0', date:DS, product:'Device', before:30, after:45,
                    note:'Mrs Smith re contract', attempts:0,
                    callbackAt: localDT(Date.now() + (${mins})*60000), loggedAt:Date.now() },
                  { id:'cb1', callId:'cb1', date:DS, product:'Device', before:30, after:45,
                    note:'J Patel — wants broadband quote', attempts:0,
                    callbackAt: localDT(Date.now() + 300*60000), loggedAt:Date.now() }
                 ].concat(filler(20, DS)) });
`);

// ---------- the runner ----------
let passed = 0, failed = 0;

async function scenario(browser, {
  name,
  seedFn,
  anchor = '#listTitle',      // a element that exists before and after; never sticky
  scrollTo = null,            // element to bring into view before acting (default: the anchor)
  before = null,              // extra page setup after load, before measuring
  act,
  entryDelta = 0,
  expect = null,              // optional extra assertion: (page, ctx) => string|null
  // Assertion 3 is NOT universal. Some interactions are supposed to move the page:
  // clicking 'edit' scrolls the log form into view on purpose, and opening the export
  // chooser moves focus into a dialog. Asserting no-movement there would be asserting
  // against a feature, and a suite that cries wolf stops being read.
  checkDisplacement = true
}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const problems = [];
  page.on('pageerror', e => problems.push('uncaught: ' + e.message));
  page.on('console', m => {
    // the CDN is unreachable offline by design; the page handles that itself
    if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
      problems.push('console: ' + m.text());
    }
  });
  // Block the network outright. Chart.js and the webfonts are remote, and waiting on
  // them makes the load event never settle when offline.
  await page.route(u => /^https?:/.test(u.href), r => r.abort());

  const fails = [];
  try {
    await page.goto(LEDGER, { waitUntil: 'domcontentloaded' });
    if (seedFn) {
      await page.evaluate(seedFn);
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(500);
    if (before) await before(page);

    const countEntries = () => page.evaluate(k => {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw).entries || []).length : 0;
    }, KEY);

    const nBefore = await countEntries();

    // Park the anchor mid-viewport so a shift in either direction is measurable, and
    // so anything inserted at the top of the page is off-screen above us.
    await page.locator(scrollTo || anchor).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -220));
    await page.waitForTimeout(250);
    const topBefore = await page.locator(anchor).first().evaluate(n => n.getBoundingClientRect().top);

    await act(page);
    await page.waitForTimeout(650);

    const topAfter = await page.locator(anchor).first()
      .evaluate(n => n.getBoundingClientRect().top).catch(() => null);
    const nAfter = await countEntries();

    // 1. nothing threw
    if (problems.length) fails.push(problems[0]);
    // 2. entry count held
    if (nAfter - nBefore !== entryDelta) {
      fails.push(`entries ${nBefore} -> ${nAfter}, expected delta ${entryDelta}`);
    }
    // 3. nothing moved
    if (topAfter === null) fails.push('anchor disappeared');
    else if (checkDisplacement) {
      const d = Math.round(topAfter - topBefore);
      if (Math.abs(d) > 2) fails.push(`displacement ${d > 0 ? '+' : ''}${d}px`);
    }
    // scenario-specific extras
    if (expect) {
      const extra = await expect(page);
      if (extra) fails.push(extra);
    }
  } catch (err) {
    fails.push('harness error: ' + String(err.message).split('\n')[0]);
  }

  if (fails.length) { failed++; console.log(`FAIL  ${name}`); fails.forEach(f => console.log(`        · ${f}`)); }
  else { passed++; console.log(` ok   ${name}`); }
  await page.close();
}

// ---------- scenarios ----------
const browser = await chromium.launch();

console.log('\n— callback attempts: a banner transition happens above the fold —');

await scenario(browser, {
  name: 'attempt +1 on an overdue callback (due banner disappears)',
  seedFn: callbackSeed(-10),
  anchor: '#notesCard h2',
  act: p => p.locator('[data-attinc]').first().click()
});

await scenario(browser, {
  name: 'attempt -1 pulls a callback into the warning window (banner appears)',
  seedFn: callbackSeed(90),
  anchor: '#notesCard h2',
  act: p => p.locator('[data-attdec]').first().click()
});

await scenario(browser, {
  name: 'control: attempt +1 with no banner transition',
  seedFn: callbackSeed(600),
  anchor: '#notesCard h2',
  act: p => p.locator('[data-attinc]').first().click()
});

console.log('\n— banners that appear because you logged a call —');

await scenario(browser, {
  name: 'backup nudge crosses its threshold on the next call',
  // 6 unbacked calls: the 7th trips BACKUP_CALLS and inserts the banner at the top
  seedFn: seed(`put({ entries: filler(6, DS), lastBackup: null });`),
  act: async p => {
    await p.fill('#fBefore', '30'); await p.fill('#fAfter', '45');
    await p.click('#submitBtn');
  },
  entryDelta: 1
});

await scenario(browser, {
  name: 'today strip appears on the first call of a new day',
  seedFn: seed(`put({ entries: filler(8, YS), lastBackup: Date.now() });`),
  act: async p => {
    await p.fill('#fBefore', '30'); await p.fill('#fAfter', '45');
    await p.click('#submitBtn');
  },
  entryDelta: 1
});

await scenario(browser, {
  name: 'storage alert appears when the disk fills mid-shift',
  seedFn: seed(`put({ entries: filler(8, DS), lastBackup: Date.now() });`),
  before: p => p.evaluate(() => {
    Storage.prototype.setItem = function () {
      const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
    };
    Storage.prototype.removeItem = function () {};
  }),
  act: async p => {
    await p.fill('#fBefore', '30'); await p.fill('#fAfter', '45');
    await p.click('#submitBtn');
  },
  // the write fails, so what is on disk cannot change
  entryDelta: 0,
  expect: async p => (await p.isVisible('#storageAlert')) ? null : 'storage alert did not appear'
});

console.log('\n— silent data failures (assertion 1 and 2 carry these, not displacement) —');

await scenario(browser, {
  name: 'CSV export survives a row with unreadable amounts',
  seedFn: seed(`put({ entries: [
    { id:'ok', callId:'ok', date:DS, product:'Device', before:30, after:45, loggedAt:Date.now() },
    { id:'bad', callId:'bad', date:DS, product:'Device' } ] });`),
  act: async p => {
    const dl = p.waitForEvent('download', { timeout: 6000 }).catch(() => null);
    await p.click('#exportBtn');
    await p.waitForTimeout(200);
    await p.click('#expOptMonth');
    p.__dl = await dl;
  },
  checkDisplacement: false,   // openExport() focuses into the dialog
  expect: async p => (p.__dl ? null : 'export produced no file')
});

await scenario(browser, {
  name: 'a damaged row does not make the month read as £0.00',
  seedFn: seed(`put({ entries: [
    { id:'ok', callId:'ok', date:DS, product:'Device', before:30, after:45, loggedAt:Date.now() },
    { id:'bad', callId:'bad', date:DS, product:'Device' } ] });`),
  act: async () => {},
  expect: async p => {
    const h = await p.textContent('#headlineTotal');
    return h.trim() === '+£15.00' ? null : `headline reads ${h.trim()}, expected +£15.00`;
  }
});

await scenario(browser, {
  name: 'editing a call cannot silently multiply it by the quantity stepper',
  seedFn: seed(`put({ entries: [
    { id:'e0', callId:'e0', date:DS, product:'Device', before:30, after:45, loggedAt:Date.now() } ] });`),
  act: async p => {
    await p.click('#entryList .entry .edit');
    await p.waitForTimeout(250);
    await p.click('#submitBtn');
  },
  checkDisplacement: false,   // clicking 'edit' scrolls the form into view on purpose
  expect: async p => {
    const h = await p.textContent('#headlineTotal');
    return h.trim() === '+£15.00' ? null : `headline reads ${h.trim()}, expected +£15.00`;
  }
});

await scenario(browser, {
  name: 'Escape in a field does not wipe a half-typed call',
  seedFn: seed(`put({ entries: filler(4, DS) });`),
  act: async p => {
    await p.fill('#fBefore', '32'); await p.fill('#fAfter', '45');
    await p.click('#fNote'); await p.type('#fNote', 'mrs smith');
    await p.keyboard.press('Escape');
  },
  expect: async p => {
    const b = await p.inputValue('#fBefore');
    const n = await p.inputValue('#fNote');
    return (b === '32' && n === 'mrs smith') ? null : `form lost content: before=${b} note=${n}`;
  }
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
