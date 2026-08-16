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

  // ---- the non-property squares must carry a mark, and it must fit ----
  // .cell is overflow:hidden, so an icon a few pixels too large does not fail —
  // it crops, and a cropped silhouette still looks deliberate. Rendered boxes
  // are compared against the cell's own box rather than trusting the CSS.
  const marks = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.cell')];
    const marked = cells.filter(c => c.classList.contains('marked'));
    if (!marked.length) return 'no square carries a mark';
    let drawn = 0, clipped = [], codeHidden = [];
    for (const c of marked) {
      const svg = c.querySelector('.cico');
      const code = c.querySelector('.code');
      if (!svg) { clipped.push((code?.textContent || '?') + ' has no svg'); continue; }
      const cb = c.getBoundingClientRect(), sb = svg.getBoundingClientRect();
      if (sb.width > 0 && sb.height > 0) drawn++;
      // half a pixel of tolerance for subpixel layout at deviceScaleFactor 3
      if (sb.top < cb.top - 0.5 || sb.bottom > cb.bottom + 0.5 ||
          sb.left < cb.left - 0.5 || sb.right > cb.right + 0.5) {
        clipped.push(code?.textContent || '?');
      }
      const rb = code.getBoundingClientRect();
      if (rb.bottom > cb.bottom + 0.5 || rb.width < 1) codeHidden.push(code.textContent);
    }
    return { total: marked.length, drawn, clipped, codeHidden,
             props: cells.length - marked.length };
  });
  if (typeof marks === 'string') fail(marks);
  else {
    if (marks.total === 18) pass(`every non-property square carries a mark (${marks.total})`);
    else fail(`expected 18 marked squares, found ${marks.total}`);
    if (marks.drawn === marks.total) pass(`every mark renders at a real size (${marks.drawn})`);
    else fail(`${marks.total - marks.drawn} marks rendered at zero size`);
    if (!marks.clipped.length) pass('no mark overflows its cell');
    else fail(`marks cropped by their cell: ${marks.clipped.join(', ')}`);
    if (!marks.codeHidden.length) pass('the code is still readable beside the mark');
    else fail(`the mark pushed the code out of: ${marks.codeHidden.join(', ')}`);
    if (marks.props === 22) pass(`properties keep the colour bar as their identity (${marks.props})`);
    else fail(`expected 22 unmarked properties, found ${marks.props}`);
  }

  // ---- the sound cues must fire on the right edges, and only then ----
  // A recording AudioContext is installed in place of the one deleted at the top
  // of this file. What it plays cannot be judged here — that needs ears, and it
  // is the one part of the feature left to the author. What is asserted is that
  // a cue happens at all, happens once, and does not happen when silenced.
  const cues = await page.evaluate(() => {
    const noop = () => {};
    // Ramp targets are recorded, not discarded: the endgame duck is only
    // observable as "what did the music gain get asked to become".
    const param = () => { const o = { value: 0, _t: null,
      setValueAtTime: v => { o.value = v; }, cancelScheduledValues: noop,
      linearRampToValueAtTime: v => { o._t = v; o.value = v; },
      exponentialRampToValueAtTime: v => { o._t = v; o.value = v; } }; return o; };
    // connect() must hand back its destination: score.js chains
    // dly.connect(dtone).connect(dfb).connect(dly) and l.connect(la).connect(o.detune).
    const link = o => Object.assign(o, { connect: d => d, disconnect: noop });
    window.__nodes = 0;
    window.AudioContext = class {
      constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = {}; }
      resume() { this.state = 'running'; return { then: f => (f(), { catch: noop }) }; }
      addEventListener() {}
      createGain() { return link({ gain: param() }); }
      createBiquadFilter() { return link({ type: '', frequency: param(), Q: param() }); }
      createDelay() { return link({ delayTime: param() }); }
      createConvolver() { return link({ buffer: null }); }
      createBufferSource() { window.__nodes++; return link({ buffer: null, loop: false, start: noop, stop: noop }); }
      createOscillator() { window.__nodes++; return link({ type: '', frequency: param(), detune: param(), start: noop, stop: noop }); }
      createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    };
    const S = window.__Sound, Score = window.__Score, G = window.__G();
    // The cues borrow the score's context, so the score has to be started on the
    // stub before anything can sound. Score.init() is what a real tap calls.
    Score.ctx = null; Score.ready = false;
    S._reset(); S.setOn(true);
    Score.init();
    const unlocked = !!(Score.ready && Score.ctx && Score.lp);

    const count = fn => { window.__nodes = 0; fn(); return window.__nodes; };
    const direct  = count(() => S.stage(1));
    const louder  = count(() => S.stage(4));
    S.setOn(false);
    const silenced = count(() => S.stage(4));
    const silencedAbsorb = count(() => S.absorbed());
    S.setOn(true);

    // Now through the watcher, which is what actually runs in a game.
    G.swarmMark = 0; window.__render();
    G.swarmMark = 1;
    const onCross = count(() => window.__render());
    const onRepeat = count(() => window.__render());   // same state, must be silent

    // Absorption: a player acquiring an overlord.
    const victim = G.players.find(p => p.lord === null || p.lord === undefined);
    const other = G.players.find(p => p !== victim);
    let onAbsorb = 0, absorbRepeat = 0;
    if (victim && other) {
      victim.lord = other.i;
      onAbsorb = count(() => window.__render());
      absorbRepeat = count(() => window.__render());
      victim.lord = null; window.__render();
    }
    // Landing on the Absorbed corner. This is the cue that was missing entirely:
    // it is the go-to square, so the piece is moved straight on to Detention and
    // is only ever on square 30 for the one render between the walk finishing
    // and the landing resolving.
    const GOTO = 30;
    const walker = G.players[G.cur];
    const wasAt = walker.pos;
    // Everyone off the corner and a render taken FIRST, so the next render is a
    // genuine arrival. Without moving the walker off it too, a turn that happened
    // to leave it standing on square 30 made the "arrival" no change at all, and
    // the check failed at random — roughly one run in five.
    G.players.forEach(q => { if (q.pos === GOTO) q.pos = 1; });
    window.__render();
    walker.pos = GOTO;
    const onGoto = count(() => window.__render());
    const gotoRepeat = count(() => window.__render());
    walker.pos = wasAt; window.__render();

    // The bed is a level, not an event. Moving the stage must move it, and
    // holding the stage must not rebuild it.
    const bedBefore = count(() => S.setPresence(2));
    const bedSame = count(() => S.setPresence(2));
    const bedMoved = S.setPresence(4);

    // The approach: the last fifteen circuits taking the score over.
    const R0 = Score.R0;
    S.setApproach(72);
    const farMusic = Score.music.gain._t;
    const farR = Score.R;
    S.setApproach(12);
    const midMusic = Score.music.gain._t;
    const midR = Score.R;
    S.setApproach(1);
    const endMusic = Score.music.gain._t;
    const endR = Score.R;
    S.clearPresence();
    const backMusic = Score.music.gain._t;
    const backR = Score.R;

    // Conversion: the mood the board reports inside ten circuits.
    const moodFar = window.__moodFor(G, 40);
    const moodNear = window.__moodFor(G, 8);

    return { unlocked, direct, louder, silenced, silencedAbsorb, onCross, onRepeat,
             onAbsorb, absorbRepeat, onGoto, gotoRepeat, bedBefore, bedSame, bedMoved,
             farMusic, midMusic, endMusic, backMusic,
             drifted: +(midR < R0 && endR < midR), backInTune: Math.abs(backR - R0) < 0.001,
             farR: +farR.toFixed(3), R0: +R0.toFixed(3), moodFar, moodNear };
  });
  if (cues.unlocked) pass('the audio context unlocks on a gesture');
  else fail('unlock() refused a context it should have taken');
  if (cues.direct > 0) pass(`a stage report schedules sound (${cues.direct} nodes)`);
  else fail('a stage report scheduled nothing');
  if (cues.louder > cues.direct) pass(`stage 4 is fuller than stage 1 (${cues.louder} vs ${cues.direct})`);
  else fail(`stage 4 scheduled ${cues.louder} nodes against stage 1's ${cues.direct}`);
  if (cues.silenced === 0 && cues.silencedAbsorb === 0) pass('sound off means nothing is scheduled at all');
  else fail(`silenced but still scheduled ${cues.silenced}/${cues.silencedAbsorb} nodes`);
  if (cues.onCross > 0) pass('crossing a swarm stage fires the cue');
  else fail('the swarm stage advanced and nothing sounded');
  if (cues.onRepeat === 0) pass('the cue is edge-triggered, not repeated every render');
  else fail(`re-rendering the same state fired again (${cues.onRepeat} nodes) — it would drone through every move`);
  if (cues.onAbsorb > 0) pass('absorption fires its own cue');
  else fail('a player was absorbed in silence');
  if (cues.absorbRepeat === 0) pass('absorption does not retrigger while the state stands');
  else fail(`absorption fired again on re-render (${cues.absorbRepeat} nodes)`);
  if (cues.onGoto > 0) pass('landing on Absorbed fires the cue');
  else fail('a piece landed on Absorbed in silence — the reported bug');
  if (cues.gotoRepeat === 0) pass('and does not fire again while the piece stands there');
  else fail(`Absorbed retriggered on re-render (${cues.gotoRepeat} nodes)`);
  if (cues.bedMoved) pass('the swarm bed follows the stage');
  else fail('setPresence refused to move the bed');
  if (cues.bedSame === 0) pass('holding a stage does not rebuild the bed');
  else fail(`re-setting the same stage created ${cues.bedSame} more nodes — they would accumulate all game`);
  if (cues.farMusic === null || cues.farMusic === 1) pass('the score plays untouched while the swarm is far off');
  else fail(`the music was ducked to ${cues.farMusic} at 72 circuits out`);
  if (cues.midMusic < 1 && cues.midMusic > cues.endMusic)
    pass(`the score ducks as the swarm closes (${cues.midMusic.toFixed(2)} at 12, ${cues.endMusic.toFixed(2)} at 1)`);
  else fail(`the duck did not deepen: ${cues.midMusic} at 12 circuits, ${cues.endMusic} at 1`);
  if (cues.endMusic >= 0.25 && cues.endMusic <= 0.45)
    pass(`the converted score is still audible at the end (${cues.endMusic.toFixed(2)})`);
  else fail(`the score ends at ${cues.endMusic} — below 0.25 the digested music cannot be heard ` +
            'and the swarm is a drone; above 0.45 it has not been taken over');
  if (cues.drifted) pass('the score is pulled out of tune as it is converted');
  else fail('the tuning never drifted, so the score is being buried rather than digested');
  if (cues.backInTune && cues.backMusic === 1) pass('a new game restores the tuning and the level');
  else fail(`a new game left R at ${cues.R0}->${cues.farR} and music at ${cues.backMusic}`);
  if (cues.moodFar !== 'neurex' && cues.moodNear === 'neurex')
    pass('inside ten circuits the score is converted, outside it is not');
  else fail(`mood was ${cues.moodFar} at 40 circuits and ${cues.moodNear} at 8`);

  // ---- no two marks may look alike ----
  // data.js already forbids two codes of the same length differing by a single
  // character, because COL/CON — the two decks — were exactly that. A mark is
  // subject to the same failure and nothing was checking it: the first set drawn
  // here gave Detention three bars between two rails and The Column three flutes
  // between two slabs, which is the same silhouette at 20px, on the two busiest
  // squares on the board (6.19% and 6.63%).
  //
  // Each mark is rasterised at 40x40 and compared by intersection-over-union of
  // its ink. The threshold is not a guess: the bars/column pair measured 0.54
  // and the closest surviving pair measures 0.463, so 0.50 sits between a known
  // failure and the known-good set.
  const alike = await page.evaluate(async () => {
    const seen = new Map();
    for (const c of document.querySelectorAll('.cell.marked')) {
      const svg = c.querySelector('.cico'), code = c.querySelector('.code').textContent.trim();
      if (svg && !seen.has(svg.innerHTML)) seen.set(svg.innerHTML, code);
    }
    if (seen.size < 2) return 'fewer than two distinct marks to compare';
    const S = 40;
    const raster = async inner => {
      const url = 'data:image/svg+xml;base64,' + btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${S}" height="${S}" fill="#fff">${inner}</svg>`);
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('mark failed to rasterise')); img.src = url; });
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0, S, S);
      const d = g.getImageData(0, 0, S, S).data, bits = new Uint8Array(S * S);
      for (let i = 0; i < S * S; i++) bits[i] = d[i * 4 + 3] > 110 ? 1 : 0;
      return bits;
    };
    const names = [...seen.values()], bits = [];
    for (const inner of seen.keys()) bits.push(await raster(inner));
    const empty = names.filter((n, i) => !bits[i].some(v => v));
    let worst = { v: -1 };
    for (let i = 0; i < bits.length; i++) for (let j = i + 1; j < bits.length; j++) {
      let I = 0, U = 0;
      for (let k = 0; k < bits[i].length; k++) { if (bits[i][k] && bits[j][k]) I++; if (bits[i][k] || bits[j][k]) U++; }
      const v = U ? I / U : 1;
      if (v > worst.v) worst = { v, a: names[i], b: names[j] };
    }
    return { count: names.length, empty, worst };
  });
  if (typeof alike === 'string') fail(alike);
  else if (alike.empty.length) fail(`these marks rasterise to nothing: ${alike.empty.join(', ')}`);
  else if (alike.worst.v < 0.50)
    pass(`no two marks look alike (closest ${alike.worst.a}/${alike.worst.b} at ${alike.worst.v.toFixed(2)})`);
  else
    fail(`${alike.worst.a} and ${alike.worst.b} are the same shape (IoU ${alike.worst.v.toFixed(2)}, limit 0.50)`);

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
    // Eden whole and unpledged, so the build and upkeep assertions below still
    // have a complete set to work on -- plus ONE pledged square from another
    // set, so the redeem half of the button check actually runs. Without it the
    // sheet only ever renders Pledge and half that assertion is decoration.
    const pledged = window.__BOARD().findIndex((b, i) => b.s && !eden.includes(i));
    p.holdings = [
      ...eden.map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 })),
      { sq: pledged, garrisons: 0, citadel: 0, mortgaged: 1 }
    ];
    for (const q of G.players) {
      if (q !== p) q.holdings = q.holdings.filter(h => !eden.includes(h.sq) && h.sq !== pledged);
    }
    window.showManage();
    const rows = [...document.querySelectorAll('.sheet .rowState')].map(e => e.textContent);
    // The build and sell prices are set-level constants and live on the set
    // heading now, stated in full and once. They used to be appended to each
    // row, where a buildable square carries two buttons and the line ran out of
    // width -- it clipped to "+G ₡2…" against a real cost of ₡200, which is
    // worse than saying nothing because it reads as an answer.
    const costLines = [...document.querySelectorAll('.sheet .pgCost')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
    // Nothing in this sheet may be clipped, which is the fault being fixed.
    const clipped = [...document.querySelectorAll('.sheet .rowState, .sheet .pgCost span, .sheet .rowbtns button')]
      .filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent.trim());
    // A pledged square must name what buying it back costs, and a live one what
    // pledging it raises. Both are square-level and cannot go on the heading.
    const pledgeBtns = [...document.querySelectorAll('.sheet [data-fn^="toggleMortgage|"]')]
      .map(e => e.textContent.replace(/\s+/g, ' ').trim());
    const upkeepEmpty = document.querySelector('.sheet [data-mg="upkeep"]').textContent;
    // Build one, so upkeep is no longer zero and the breakdown has something to say.
    document.querySelector('.sheet [data-fn^="build|"]').click();
    const upkeepBuilt = document.querySelector('.sheet [data-mg="upkeep"]').textContent;
    window.closeSheet();
    G.phase = 'end';
    window.__render();
    const endBtn = [...document.querySelectorAll('.act')].find(b => /End turn/.test(b.textContent));
    return { rows, costLines, clipped, pledgeBtns, upkeepEmpty, upkeepBuilt, gc: SETS.eden.gc,
             sellG: Math.floor(SETS.eden.gc / 2), sellC: Math.floor(SETS.eden.gc * 5 / 2),
             endLabel: endBtn ? endBtn.textContent.replace(/\s+/g, ' ').trim() : null };
  });
  // All four figures, on the heading: what a garrison and a citadel cost, and
  // what each sells back for. Asserted against the engine's own arithmetic
  // rather than against literals.
  const costLine = costs.costLines[0] || '';
  const wantPrices = [costs.gc, costs.sellG, costs.sellC].map(String);
  const absent = wantPrices.filter(n => !costLine.replace(/,/g, '').includes(n));
  if (costs.costLines.length && !absent.length)
    pass(`the set heading states build and sell prices (${costLine})`);
  else fail(`heading prices wrong: line="${costLine}" missing=${absent.join(',')}`);
  if (!costs.clipped.length) pass('nothing is clipped in the Holdings sheet');
  else fail(`clipped in the Holdings sheet: ${costs.clipped.slice(0, 4).join(' | ')}`);
  const pricedPledge = costs.pledgeBtns.filter(t => /₡\s?\d/.test(t));
  const sawRedeem = costs.pledgeBtns.some(t => /^Redeem/.test(t));
  const sawPledge = costs.pledgeBtns.some(t => /^Pledge/.test(t));
  if (costs.pledgeBtns.length && pricedPledge.length === costs.pledgeBtns.length && sawRedeem && sawPledge)
    pass(`pledge and redeem both name their price (${costs.pledgeBtns.filter(t => /^Redeem/.test(t))[0]}, ${costs.pledgeBtns.filter(t => /^Pledge/.test(t))[0]})`);
  else fail(`pledge/redeem figures wrong: ${JSON.stringify(costs.pledgeBtns)} redeem=${sawRedeem} pledge=${sawPledge}`);
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

  // The contract sheet states what the other side is holding, and states it for
  // the side actually SELECTED. Switching counterparty has to move the figure:
  // a line that renders the first opponent's purse and never updates would look
  // completely right on the screen Sam reported from, and be a lie on every
  // other tab of it.
  // Written to the seat count rather than assuming it. This probe's table is
  // two seats at this point, so a check hard-coded to two opponents throws
  // rather than reports -- and a check that throws tells you nothing about the
  // thing it was written for.
  const purse = await page.evaluate(() => {
    const G = window.__G();
    const me = G.players[G.cur];
    const others = G.players.filter(p => p.i !== me.i);
    G.phase = 'end';

    // Everything this block disturbs, put back. It sets purses and switches the
    // selected counterparty, and switching one clears the squares picked so
    // far -- the direction check further down reads both, and reported a 900
    // credit swing against the 100 on the table until this restore existed.
    const purses = G.players.map(p => ({ p, cash: p.cash, debt: p.debt }));
    const TR = window.__TR();
    const before = { to: TR.to, get: [...TR.get], give: [...TR.give], cash: TR.cash, direction: TR.direction };

    // Distinct purses so a figure belonging to the wrong seat cannot pass, and
    // one marker so the debt half is exercised wherever there is a seat for it.
    others.forEach((o, n) => { o.cash = 1234 + n * 1000; o.debt = n === 1 ? 456 : 0; });
    const seen = [];
    window.showTrade();
    for (const o of others) {
      document.querySelector(`.sheet [data-fn="tradeSet|to|${o.i}"]`)?.click();
      const el = document.querySelector('.sheet [data-them="cash"]');
      seen.push({
        want: o.cash,
        debt: o.debt,
        text: el ? el.textContent.replace(/\s+/g, ' ').trim() : null
      });
    }
    window.closeSheet();

    for (const { p, cash, debt } of purses) { p.cash = cash; p.debt = debt; }
    TR.to = before.to;
    TR.get.length = 0; TR.get.push(...before.get);
    TR.give.length = 0; TR.give.push(...before.give);
    TR.cash = before.cash;
    TR.direction = before.direction;
    return { seats: G.players.length, seen };
  });
  // Doubles: settle the square, then roll again, in one press. The engine has
  // always routed endTurn back to the roll phase while rollAgain stands; what
  // this checks is that the interface SAYS so and does it in one tap, and that
  // the upkeep really is still owed afterwards rather than quietly taken twice.
  const dbl = await page.evaluate(async () => {
    const G = window.__G();
    const before = { phase: G.phase, rollAgain: G.rollAgain, run: G.doublesRun, cur: G.cur };
    const p = G.players[G.cur];
    p.inFacility = false;
    G.phase = 'end';
    G.rollAgain = true;
    G.doublesRun = 1;
    window.__render();

    const btnFor = label => [...document.querySelectorAll('#acts button')]
      .find(b => b.textContent.trim().startsWith(label));
    const again = btnFor('Roll again');
    const end = btnFor('End turn');
    const seen = {
      offered: !!again,
      sub: again ? again.textContent.replace(/\s+/g, ' ').trim() : null,
      // You cannot decline the roll, so the turn-ending path must not be live.
      endDisabled: end ? (end.disabled || end.getAttribute('aria-disabled') === 'true') : null,
      cashBefore: p.cash,
      turnBefore: G.turn
    };
    if (again) again.click();
    await new Promise(r => setTimeout(r, 900));
    seen.phaseAfter = G.phase;
    seen.stillMyTurn = G.cur === before.cur;
    seen.rollAgainCleared = G.rollAgain === false || G.doublesRun > 1;

    G.phase = before.phase; G.rollAgain = before.rollAgain; G.doublesRun = before.run;
    window.__render();
    return seen;
  });
  if (!dbl.offered) fail('no "Roll again" offered after a doubles roll');
  else if (dbl.endDisabled !== true) fail('"End turn" was still live while a doubles roll was owed');
  else if (dbl.phaseAfter === 'end' && dbl.stillMyTurn) fail('"Roll again" did not roll — still sitting in the end phase');
  else if (!dbl.stillMyTurn) fail('"Roll again" passed the turn on instead of rolling again');
  else pass(`doubles roll again in one press (${dbl.sub}, then ${dbl.phaseAfter})`);

  // The sealed-bid sheet names the square's colour group and says who already
  // holds what of it. Driven through the real phase machine -- openAuction then
  // a tick -- rather than by calling the renderer, so the routing is exercised
  // too. showBid is not in ACTIONS and so is not on window; that is not a
  // reason to reach past the game to reach it.
  const auction = await page.evaluate(() => {
    const G = window.__G(), E = window.__E(), SETS = window.__SETS();
    const eden = SETS.eden.sq;
    const snapshot = {
      phase: G.phase,
      auction: G.auction,
      holdings: G.players.map(p => ({ p, h: p.holdings }))
    };
    const me = G.players[G.cur];
    const other = G.players.find(q => q !== me);
    // Two of Eden to the other seat, the third unowned and going under the
    // hammer -- so they are one short with exactly one free, which is the case
    // the sheet is meant to make impossible to miss.
    for (const q of G.players) q.holdings = [];
    other.holdings = [eden[0], eden[1]].map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 }));

    E.openAuction(G, eden[2]);
    window.__tick();
    const sheet = document.querySelector('.sheet');
    // The set name off the SWATCH ROW, not off the whole sheet. Read from the
    // sheet at large it was true with the feature deleted -- the name turns up
    // elsewhere -- so that third of the assertion was decoration until it was
    // pinned to the row it is actually about.
    const headRow = sheet ? [...sheet.querySelectorAll('.stat')].find(e => e.querySelector('.swatch')) : null;
    const text = headRow ? headRow.textContent.replace(/\s+/g, ' ').trim() : '';
    const swatches = sheet ? sheet.querySelectorAll('.swatch').length : 0;
    const subs = sheet ? [...sheet.querySelectorAll('.stat.sub2')].map(e => e.textContent.replace(/\s+/g, ' ').trim()) : [];

    window.closeSheet();
    G.phase = snapshot.phase;
    G.auction = snapshot.auction;
    for (const { p, h } of snapshot.holdings) p.holdings = h;
    return { text, swatches, subs, setName: SETS.eden.n, them: other.name };
  });
  const named = auction.text.includes(auction.setName);
  const counted = auction.subs.some(s => /2 of 3/.test(s));
  const closes = auction.subs.some(s => /closes it/i.test(s));
  if (named && auction.swatches >= 1 && counted && closes) {
    pass(`the bid sheet names the set and who holds it (${auction.subs.join(' | ')})`);
  } else {
    fail(`bid sheet standing wrong: named=${named} swatches=${auction.swatches} subs=${JSON.stringify(auction.subs)}`);
  }

  const holds = (text, n) => !!text && text.replace(/[,₡]/g, '').includes(String(n));
  const wrong = purse.seen.filter(s => !holds(s.text, s.want)
    || (s.debt && !/debt/i.test(s.text || '')));
  if (purse.seen.length && !wrong.length) {
    const note = purse.seen.length > 1 ? 'and follows the tab' : `${purse.seats}-seat table, one opponent`;
    pass(`the contract sheet shows the other side's purse, ${note}`);
  } else {
    fail(`counterparty purse wrong: ${JSON.stringify(wrong)}`);
  }
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

  // ---- a contract can ask THEM to pay ----
  // tradeSet handled the counterparty and then assumed every other key was a
  // list, so tapping the direction toggle ran `list.indexOf` on the number 1 and
  // threw. The tap did nothing, direction never left its default of 1, and a
  // human could not draw a contract where the other side pays them — the engine
  // had always supported it and only the interface could not ask. The existing
  // contract checks all built bundles and never touched this toggle, which is
  // exactly how it shipped.
  const dir = await page.evaluate(async () => {
    const G = window.__G();
    G.players[0].holdings.push({ sq: 14, garrisons: 0, citadel: 0, mortgaged: 0 });
    G.players[1].holdings.push({ sq: 13, garrisons: 0, citadel: 0, mortgaged: 0 });
    window.__render();
    const open = [...document.querySelectorAll('#acts [data-fn]')].find(x => /Propose/i.test(x.textContent));
    if (!open) return 'no Propose button';
    open.click();
    await new Promise(r => setTimeout(r, 160));
    const pick = re => [...document.querySelectorAll('.sheet [data-fn^="tradeSet|direction|"]')]
      .find(x => re.test(x.textContent));
    const them = pick(/They pay/i), you = pick(/You pay/i);
    if (!them || !you) return 'no direction toggle on the contract sheet';

    const cashBox = document.querySelector('.sheet input[type="number"]');
    if (!cashBox) return 'no credits box on the contract sheet';
    cashBox.value = '100';
    cashBox.dispatchEvent(new Event('input', { bubbles: true }));

    // The totals line specifically. "You receive" appears three times on this
    // sheet — as a bundle header ("You receive - 3 of 3"), as a bare label, and
    // on the totals row, which is the only one that ends "at list". Two earlier
    // selectors here picked the wrong one and failed for reasons that had
    // nothing to do with the code under test.
    const receiveTotal = () => {
      const el = [...document.querySelectorAll('.sheet *')]
        .filter(e => e.children.length < 3 && /You receive/i.test(e.textContent) && /at list/i.test(e.textContent))
        .shift();
      if (!el) return null;
      const m = el.textContent.replace(/[^0-9]/g, '');
      return m ? +m : null;
    };

    // Compared as a DIFFERENCE, not against a literal: whatever squares are in
    // the bundle when this runs contributes to the same total, and an earlier
    // version of this check asserted "100" against a line reading ₡420.
    you.click();
    await new Promise(r => setTimeout(r, 140));
    const payTotal = receiveTotal();
    them.click();
    await new Promise(r => setTimeout(r, 140));
    const afterThem = { on: them.classList.contains('on'),
                        dir: window.__TR ? window.__TR().direction : null,
                        cash: window.__TR ? window.__TR().cash : null,
                        gain: receiveTotal() === null || payTotal === null ? null : receiveTotal() - payTotal };
    you.click();
    await new Promise(r => setTimeout(r, 140));
    const afterYou = { on: you.classList.contains('on'), dir: window.__TR ? window.__TR().direction : null };
    const cancel = [...document.querySelectorAll('.sheet [data-fn]')].find(x => /cancel|close/i.test(x.dataset.fn));
    if (cancel) cancel.click();
    return { afterThem, afterYou };
  });
  if (typeof dir === 'string') fail(dir);
  else {
    if (dir.afterThem.on && dir.afterThem.dir === -1)
      pass('a contract can ask the other side to pay');
    else fail(`tapping "They pay" left direction at ${dir.afterThem.dir} — the toggle does nothing`);
    if (dir.afterYou.on && dir.afterYou.dir === 1) pass('and the choice goes back the other way');
    else fail(`tapping "You pay" left direction at ${dir.afterYou.dir}`);
    // With credits on the table the totals must follow the direction, or the
    // sheet would agree to something different from what it displays.
    if (dir.afterThem.cash !== 100)
      fail(`the credits box did not register (cash is ${dir.afterThem.cash}) — the totals check proves nothing`);
    else if (dir.afterThem.gain === 100)
      pass('and what you receive rises by exactly the credits when they pay');
    else fail(`switching to "They pay" moved what you receive by ${dir.afterThem.gain}, not the 100 on the table`);
  }

  // ---- what you have built must be visible on every edge ----
  // The colour bar sits on the INWARD side of each cell, which on a left-edge
  // cell is the right — exactly where the development mark was placed. Measured
  // at 83% covered on all of indices 11-19, with the bar at z-index 1 and the
  // mark at auto, so a whole column of the board showed no citadels, no
  // garrisons and no pledges. Nothing failed; the state was simply invisible on
  // a ninth of the squares. Checked on every buyable square, not a sample,
  // because it was edge-specific and a sample would have missed it.
  const marks2 = await page.evaluate(() => {
    const G = window.__G(), B = window.__BOARD();
    const buyable = [];
    B.forEach((b, i) => { if (b.t === 'p' || b.t === 'f' || b.t === 'u') buyable.push(i); });
    const before = G.players[0].holdings.slice();
    G.players[0].holdings = buyable.map(sq => ({ sq, garrisons: 0, citadel: 1, mortgaged: 0 }));
    window.__render();
    const hidden = [];
    let checked = 0;
    for (const sq of buyable) {
      const cell = document.querySelector(`.cell[data-i="${sq}"]`);
      const grr = cell && cell.querySelector('.grr');
      const bar = cell && cell.querySelector('.cbar');
      if (!grr) { hidden.push({ sq, name: B[sq].n, why: 'no mark drawn at all' }); continue; }
      if (!bar) { checked++; continue; }
      checked++;
      const g = grr.getBoundingClientRect(), r = bar.getBoundingClientRect();
      const ow = Math.min(g.right, r.right) - Math.max(g.left, r.left);
      const oh = Math.min(g.bottom, r.bottom) - Math.max(g.top, r.top);
      const cover = (ow > 0 && oh > 0) ? (100 * ow * oh) / (g.width * g.height) : 0;
      if (cover > 1) hidden.push({ sq, name: B[sq].n, why: `${cover.toFixed(0)}% under the colour bar` });
    }
    G.players[0].holdings = before;
    window.__render();
    return { checked, hidden };
  });
  if (marks2.checked < 20) fail(`only ${marks2.checked} squares were checked for development marks`);
  else if (!marks2.hidden.length)
    pass(`a citadel is visible on every buyable square (${marks2.checked})`);
  else fail('development is hidden on: ' +
    marks2.hidden.map(h => `${h.name} (${h.why})`).join(', '));

  // ---- the moving piece is highlighted in its OWN colour ----
  // This has now been the same defect twice. The selection ring was var(--tx),
  // which is Spector's pip; the movement highlight was var(--gold), which is
  // byte-identical to the first seat's. All four pips ARE the four theme
  // accents, so any fixed colour here belongs to somebody. Checked against every
  // seat rather than one, because a single-seat check passes on the bug.
  const trail = await page.evaluate(() => {
    const G = window.__G();
    const hex = c => { const m = c.match(/\d+/g);
      return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase() : c; };
    const was = { cur: G.cur, pos: G.players.map(q => q.pos) };
    const out = [];
    for (let i = 0; i < G.players.length; i++) {
      G.cur = i; G.players[i].pos = 6 + i;
      window.__render();
      const cell = document.querySelector('.cell.here');
      const pip = document.querySelectorAll('.pchip .pip')[i];
      if (!cell || !pip) { out.push({ seat: i, bad: 'no highlight or pip' }); continue; }
      out.push({ seat: i, name: G.players[i].name,
                 outline: hex(getComputedStyle(cell).outlineColor),
                 pip: hex(getComputedStyle(pip).backgroundColor) });
    }
    G.cur = was.cur; G.players.forEach((q, i) => { q.pos = was.pos[i]; });
    window.__render();
    return out;
  });
  {
    const wrong = trail.filter(t => t.bad || t.outline !== t.pip);
    if (!wrong.length) pass(`the moving piece is ringed in its own colour (${trail.length} seats)`);
    else fail('the movement highlight is not the moving player\'s colour: ' +
      wrong.map(w => w.bad || `${w.name} moves but the ring is ${w.outline}, their pip is ${w.pip}`).join('; '));
    const distinct = new Set(trail.map(t => t.outline));
    if (distinct.size === trail.length) pass('and every seat rings differently');
    else fail(`only ${distinct.size} distinct ring colours across ${trail.length} seats`);
  }

  // ---- a sheet never opens on top of a raised keyboard ----
  // .scrim is position:fixed against the layout viewport, which on iOS does not
  // shrink for the software keyboard — so a sheet opened while an input is
  // focused is laid out against a viewport that no longer matches the screen,
  // and its buttons stop taking taps until something resynchronises it. Headless
  // has no keyboard, so what is checked is the precondition: nothing is left
  // focused when a sheet appears.
  const focusLeft = await page.evaluate(async () => {
    const G = window.__G(), E = window.__E();
    E.openAuction(G, 6);
    window.__tick();
    await new Promise(r => setTimeout(r, 250));
    const focusedBefore = document.activeElement ? document.activeElement.id : null;
    // Whatever the bid sheet does next, the sheet that replaces it must not
    // inherit a focused input.
    window.__showCard ? null : null;
    const btn = document.querySelector('.sheet [data-fn]');
    const had = !!document.querySelector('#bidIn');
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 120));
    return { had, focusedBefore, focusedAfter: document.activeElement ? document.activeElement.tagName : null };
  });
  if (!focusLeft.had) fail('no bid input on the sealed-bid sheet — this check is looking at the wrong screen');
  else if (focusLeft.focusedBefore === 'bidIn') {
    if (focusLeft.focusedAfter === 'BODY') pass('the keyboard is dropped before the next sheet opens');
    else fail(`an input was still focused (${focusLeft.focusedAfter}) when the next sheet opened`);
  } else fail(`the bid input did not take focus (${focusLeft.focusedBefore}) — the check proves nothing`);

  // ---- a player chip opens what that player holds ----
  // The chips were inert panels for the whole life of the game, so the
  // affordance matters as much as the sheet: a tap target nobody knows is a tap
  // target is not one. The count badge is checked because it is the affordance.
  const who = await page.evaluate(async () => {
    const chips = [...document.querySelectorAll('.pchip')];
    if (!chips.length) return 'no player chips in the bar';
    const G = window.__G();
    // Give the second seat something worth listing.
    const p = G.players[1];
    for (const [sq, g, c, m] of [[6, 2, 0, 0], [8, 1, 0, 0], [9, 0, 0, 1], [5, 0, 0, 0], [31, 0, 1, 0]]) {
      if (!G.players.some(q => q.holdings.some(h => h.sq === sq))) {
        p.holdings.push({ sq, garrisons: g, citadel: c, mortgaged: m });
      }
    }
    window.__render();
    const chip = document.querySelector('.pchip[data-who="1"]');
    if (!chip) return 'no chip for seat 1';
    const badge = chip.querySelector('.chipMore');
    const box = chip.getBoundingClientRect();
    // Every opponent's chip name, and whether it fits. The names come from
    // PERSONAS and are fixed content, so a truncated one is a layout fault
    // rather than somebody typing too much into the name box.
    const cut = [...document.querySelectorAll('.pchip')].map((c, k) => {
      const sp = c.querySelector('.who');
      return { seat: k, ai: G.players[k].kind === 'ai', text: sp.textContent,
               over: sp.scrollWidth > sp.clientWidth + 0.5 };
    });
    const bd = badge ? badge.getBoundingClientRect() : null;
    chip.click();
    await new Promise(r => setTimeout(r, 60));
    const sh = document.querySelector('.sheet');
    if (!sh) return 'tapping a chip opened nothing';
    const rows = [...sh.querySelectorAll('.pgRow')];
    const out = {
      tag: chip.tagName,
      tap: [Math.round(box.width), Math.round(box.height)],
      hasBadge: !!badge,
      badgeText: badge ? badge.textContent.trim() : '',
      cutNames: cut.filter(c => c.ai && c.over).map(c => c.text),
      badgeOnCashRow: !!(bd && chip.querySelector('.cashRow .chipMore')),
      heading: sh.querySelector('h3') ? sh.querySelector('h3').textContent : '',
      name: p.name,
      groups: sh.querySelectorAll('.pgHead').length,
      rows: rows.length,
      rents: rows.filter(r => /₡|—/.test(r.querySelector('.pgRent').textContent)).length,
      sideways: sh.scrollWidth > sh.clientWidth + 1
    };
    const close = sh.querySelector('[data-fn="closeSheet"]');
    if (close) close.click();
    return out;
  });
  if (typeof who === 'string') fail(who);
  else {
    if (who.tag === 'BUTTON') pass('a player chip is a real button');
    else fail(`a chip is a <${who.tag}> — it will not take a tap or read as one`);
    if (who.tap[1] >= 44) pass(`the chip is a hittable target (${who.tap.join('x')})`);
    else fail(`chip is ${who.tap.join('x')} — under the 44px a thumb needs`);
    if (who.hasBadge && who.badgeText) pass(`the chip shows its holding count (${who.badgeText})`);
    else fail('no affordance on the chip — nobody will know it can be tapped');
    // The badge began in the top-right corner, with 22px reserved on the name
    // row to clear it — which took the name from 51.8px to 29.8px and truncated
    // "Varan", a name that had always fitted. It lives on the cash line now,
    // where there is room that will never be used.
    if (who.badgeOnCashRow) pass('the count sits on the cash line, not in the name\'s width');
    else fail('the count is back on the name row — that is where it ate two characters');
    if (!who.cutNames.length) pass('every opponent name fits whole');
    else fail(`these names are cut off: ${who.cutNames.join(', ')}`);
    if (who.heading === who.name) pass(`tapping a chip opens that player (${who.heading})`);
    else fail(`tapped seat 1 (${who.name}) and got "${who.heading}"`);
    if (who.groups > 0 && who.rows > 0) pass(`holdings are grouped by set (${who.groups} groups, ${who.rows} squares)`);
    else fail(`the sheet listed ${who.groups} groups and ${who.rows} squares`);
    if (who.rents === who.rows) pass('every holding states the rent it charges');
    else fail(`${who.rows - who.rents} holdings show no rent — the figure that decides a trade`);
    if (!who.sideways) pass('the player sheet does not scroll sideways');
    else fail('the player sheet scrolls sideways');
  }

  // ---- the swarm arrives in the sky, not only in the score ----
  // Inside ten circuits the disc already took the Neurex mood, but 89.7% of its
  // stars are the arm and hot tints and both are GREEN — which in the book is
  // their shields, the thing that answers your fire once they are here. The
  // approach is red: the tide, the stain across a quadrant, the blips arriving.
  // Counted with a discriminant that excludes gold, because #D9A441 is itself
  // red-dominant and a naive test scored the ordinary ledger sky at 74% red.
  const arrival = await page.evaluate(async () => {
    const G = window.__G();
    const read = async dist => {
      G.circuits = 72; G.circuit = 72 - dist + 1;
      window.__render();
      await new Promise(r => setTimeout(r, 900));
      const c = document.querySelector('.galaxyCanvas'), g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let lit = 0, red = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] <= 10) continue;
        lit++;
        // Strongly red-dominant with the green actually low: separates the
        // swarm's #E84A3E from the ledger's gold, whose green sits at 164.
        if (d[i] > 120 && d[i + 1] < 120 && d[i] - d[i + 1] > 80) red++;
      }
      return { dist, lit, red, share: +(100 * red / Math.max(1, lit)).toFixed(2) };
    };
    // Two thresholds overlap here and confound a naive sweep: the MOOD flips to
    // neurex at ten circuits, which turns the disc green and drops the red share
    // BELOW its ordinary-sky baseline, while the GRIP starts at fifteen and
    // reddens it. Measured across both, red goes 18.7% → 9.1% → 29.9% and looks
    // broken. So the arrival is measured inside a constant mood — ten, five and
    // one are all neurex — and only the grip varies.
    const far = await read(30);
    const edge = await read(15);         // grip 0, mood still ledger
    const ten = await read(10);          // grip 0.33, neurex
    const five = await read(5);          // grip 0.67, neurex
    const near = await read(1);          // grip 1, neurex
    G.circuit = 1; window.__render();
    return { far, edge, ten, five, near };
  });
  {
    const { far, edge, ten, five, near } = arrival;
    console.log(`        red share — 30 out ${far.share}% · 15 ${edge.share}% · ` +
                `10 ${ten.share}% · 5 ${five.share}% · 1 ${near.share}%`);
    if (Math.abs(edge.share - far.share) <= 0.6)
      pass(`nothing has arrived yet at fifteen circuits (${edge.share}% against ${far.share}%)`);
    else fail(`the sky already differs at fifteen out (${edge.share}% against ${far.share}%)`);
    if (near.share > five.share && five.share > ten.share)
      pass(`the sky reddens as it closes (${ten.share}% → ${five.share}% → ${near.share}%)`);
    else fail(`the reddening is not monotonic within the neurex mood: ` +
              `${ten.share}% → ${five.share}% → ${near.share}%`);
    if (near.share > ten.share * 2)
      pass(`and it is unmistakable by the last circuit (${near.share}% against ${ten.share}%)`);
    else fail(`the last circuit is ${near.share}% red against ${ten.share}% at ten — too little to read`);
  }

  // ---- the universe the galaxy sits in ----
  // The panel outside the disc was a black rectangle, and it is the largest
  // single area on the screen. The corners are sampled specifically because
  // they are the part the disc never reaches: if the background field ever
  // stopped being built, nothing would fail — the middle would still look busy
  // and the corners would quietly go back to being a void.
  const sky = await page.evaluate(async () => {
    const c = document.querySelector('.galaxyCanvas');
    if (!c) return 'no canvas';
    const g = c.getContext('2d');
    const W = c.width, H = c.height, q = Math.floor(Math.min(W, H) * 0.22);
    const corners = () => {
      const d = g.getImageData(0, 0, W, H).data;
      const out = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if ((x < q || x > W - q) && (y < q || y > H - q)) out.push(d[(y * W + x) * 4 + 3]);
      }
      return out;
    };
    const first = corners();
    let lit = 0;
    for (const a of first) if (a > 8) lit++;

    // LIVENESS is measured over the whole canvas, not the corners, and that is
    // the fix for a check that had been failing at random.
    //
    // The corners are the right place to ask whether the field is DRAWN -- they
    // are what the disc never reaches. They are the wrong place to ask whether
    // it MOVES: the sixteen twinklers are placed with Math.random over the
    // whole canvas, the corner region is about a fifth of it, so on an unlucky
    // load barely any land there and a live background reports almost no
    // movement. Across runs on one unchanged build this came in at 34, 200,
    // 124, 619, 91 and then 28 and 53 pixels, tripping a threshold of 4.
    // Lengthening the window to 2800ms had already been tried and is not the
    // cause; where it sampled was.
    //
    // Every twinkler is in frame over the whole canvas, and the peak across
    // several samples is taken rather than one arbitrary phase of the cycle, so
    // the answer no longer depends on which moment or which seed it caught.
    const step = 4;                       // every 4th pixel, for speed
    const frame = () => {
      const d = g.getImageData(0, 0, W, H).data;
      const out = [];
      for (let i = 0; i < W * H; i += step) out.push(d[i * 4 + 3]);
      return out;
    };
    const base = frame();
    let changed = 0, peak = 0;
    for (let n = 0; n < 4; n++) {
      await new Promise(r => setTimeout(r, 700));
      const now = frame();
      let c = 0, pk = 0;
      for (let i = 0; i < base.length; i++) {
        const d = Math.abs(base[i] - now[i]);
        if (d > 3) c++;
        if (d > pk) pk = d;
      }
      if (c > changed) changed = c;
      if (pk > peak) peak = pk;
    }
    return { sampled: first.length, lit, changed, peak,
             pct: +(100 * changed / Math.max(1, lit)).toFixed(1) };
  });
  if (typeof sky === 'string') fail(sky);
  else {
    if (sky.lit > 150) pass(`the corners are not a void (${sky.lit} lit pixels)`);
    else fail(`the corners are still empty (${sky.lit} lit pixels) — the background field is not drawing`);
    // A LIVENESS check, not a measurement, and the threshold is set where it
    // cannot false-fail. The sample is the four corners; the sky is generated
    // with Math.random on every load, so how many of the sixteen twinklers land
    // in that region changes run to run. It has come in at 930, at 88 and at
    // exactly 20 on the same build. The real guarantee — that some stars twinkle
    // and most do not — is asserted against the star counts in galaxy.test.mjs,
    // where nothing is sampled and nothing can drift.
    if (sky.changed > 4 && sky.peak > 20)
      pass(`the background is alive (${sky.changed} pixels moved, peak ${sky.peak}/255)`);
    else fail(`nothing at all moved in the background (${sky.changed} pixels, peak ${sky.peak})`);
    // "Some occasionally, not a shimmering field" is asserted in galaxy.test.mjs
    // against the star counts themselves. It was tried here as a share of lit
    // corner pixels and measured between 9.5% and 70.2% across the five
    // viewports on the same build — the denominator is whatever happened to be
    // bright at the sampling instant, so it moved with twinkle phase and not
    // with anything real. A guard that reports a different answer every run is
    // worse than none.
    console.log(`        corners: ${sky.lit} lit, ${sky.changed} moved, peak ${sky.peak}/255`);
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

  // The Holdings sheet groups by set the same way the player sheet does, and
  // the headings must sit BETWEEN rows rather than inside one. refreshManage
  // finds rows by [data-row], so a heading cannot disturb it -- but a heading
  // rendered inside a row would grow the row, and growing a row in this exact
  // list is what once walked it out from under a thumb mid-tap.
  const grouped = await page.evaluate(() => {
    const G = window.__G ? window.__G() : null;
    const p = G.players[G.cur];
    const eden = window.__SETS().eden.sq;
    p.holdings = [
      ...eden.map(sq => ({ sq, garrisons: 0, citadel: 0, mortgaged: 0 })),
      { sq: window.__BOARD().findIndex(b => b.t === 'f'), garrisons: 0, citadel: 0, mortgaged: 0 }
    ];
    window.showManage();
    const sheet = document.querySelector('.sheet');
    const heads = [...sheet.querySelectorAll('.pgHead')];
    return {
      heads: heads.map(h => h.textContent.trim().split('\n')[0].trim()),
      insideARow: heads.filter(h => h.closest('[data-row]')).length,
      rows: sheet.querySelectorAll('[data-row]').length,
      // Every row still finds itself by attribute, which is what the in-place
      // refresh depends on.
      refreshable: p.holdings.every(h => !!sheet.querySelector(`[data-row="${h.sq}"]`))
    };
  });
  if (grouped.heads.length >= 2 && grouped.insideARow === 0 && grouped.refreshable) {
    pass(`the Holdings sheet groups by set (${grouped.heads.join(', ')}) with ${grouped.rows} rows intact`);
  } else {
    fail(`Holdings grouping wrong: ${JSON.stringify(grouped)}`);
  }
  await page.evaluate(() => window.closeSheet());

  // ---- the table Sam actually plays: one human, three opponents ----
  //
  // Everything above runs on a two-seat game, which is why two checks written
  // this session could only ever exercise half of what they claimed: the
  // counterparty purse could not test "follows the selected tab" with one
  // opponent to select, and no contract could be put to a choice of seats. That
  // is the same blind spot sweep.mjs had -- a real instrument measuring a game
  // he does not play -- so this starts a fresh four-seat game and checks the
  // contract sheet there.
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#begin');
  for (const who of ['spector', 'varan', 'vale']) await page.click(`[data-a="${who}"]`);
  await page.click('#begin');
  await page.waitForSelector('#game:not(.hidden)');

  const many = await page.evaluate(async () => {
    const G = window.__G(), SETS = window.__SETS(), BOARD = window.__BOARD();
    if (G.players.length !== 4) return `expected four seats, got ${G.players.length}`;
    const me = G.players[0];
    const others = G.players.filter(p => p.i !== me.i);
    if (others.some(p => p.kind !== 'ai')) return 'the three opponents did not all seat';

    // A square each, from a different set, so every counterparty has something
    // to trade and the sheet has to rebuild per seat.
    const spare = BOARD.map((b, i) => [b, i]).filter(([b]) => b.pr && b.s).map(([, i]) => i);
    me.holdings = [{ sq: spare[0], garrisons: 0, citadel: 0, mortgaged: 0 }];
    me.cash = 5000; me.debt = 0;
    others.forEach((o, n) => {
      o.holdings = [{ sq: spare[3 + n * 3], garrisons: 0, citadel: 0, mortgaged: 0 }];
      o.cash = 400 + n * 700; o.debt = 0;
    });
    G.phase = 'end';
    window.showTrade();

    const tabs = [...document.querySelectorAll('.sheet [data-fn^="tradeSet|to|"]')];
    const seen = [];
    for (const o of others) {
      const tab = document.querySelector(`.sheet [data-fn="tradeSet|to|${o.i}"]`);
      if (!tab) { seen.push({ who: o.name, missing: true }); continue; }
      tab.click();
      const purse = document.querySelector('.sheet [data-them="cash"]');
      const rows = document.querySelectorAll('.sheet [data-fn^="tradeSet|get|"]').length;
      seen.push({
        who: o.name, want: o.cash, rows,
        text: purse ? purse.textContent.replace(/\s+/g, ' ').trim() : null
      });
    }
    window.closeSheet();
    return { tabs: tabs.length, seen, names: others.map(o => o.name) };
  });

  if (typeof many === 'string') fail(many);
  else {
    if (many.tabs === 3) pass('the contract sheet offers all three opponents');
    else fail(`contract sheet shows ${many.tabs} counterparty tabs on a four-seat table`);
    const wrong = many.seen.filter(s => s.missing
      || !(s.text || '').replace(/[,₡]/g, '').includes(String(s.want)));
    if (!wrong.length) {
      pass(`and the purse follows the tab across three seats (${many.seen.map(s => s.want).join(', ')})`);
    } else {
      fail(`purse did not follow the tab: ${JSON.stringify(wrong)}`);
    }
    const noRows = many.seen.filter(s => !s.missing && !s.rows);
    if (!noRows.length) pass('each opponent\'s own squares are offered');
    else fail(`no squares listed for ${noRows.map(s => s.who).join(', ')}`);
  }

  // Agreeing to a contract raises a screen, and the opponent speaks on it.
  // Refusing already did; accepting moved the squares in silence.
  //
  // Run against ALL THREE opponents rather than whichever seat comes first.
  // Against one it only ever exercised Spector, and Varan is the only persona
  // with a line taken from the novel -- so the branch that marks the author's
  // words on screen never ran, which is the same half-a-check this session has
  // now produced three times.
  const spoke = [];
  for (const seat of [1, 2, 3]) {
    const one = await page.evaluate(async (i) => {
      const G = window.__G(), BOARD = window.__BOARD();
      const me = G.players[0], them = G.players[i];
      if (!them || them.kind !== 'ai') return `seat ${i} is not an opponent`;
      if (!them.holdings.length) return `seat ${i} holds nothing to buy`;
      them.cash = 0; them.debt = 0;          // hungry, so the offer below carries
      me.cash = 9000; me.debt = 0;
      const sq = them.holdings[0].sq;
      G.phase = 'end';
      window.showTrade();
      document.querySelector(`.sheet [data-fn="tradeSet|to|${them.i}"]`)?.click();
      document.querySelector(`.sheet [data-fn="tradeSet|get|${sq}"]`)?.click();
      const cash = document.getElementById('trCash');
      if (!cash) return `no cash field for seat ${i}`;
      cash.value = String(BOARD[sq].pr * 6);      // far over any asking price
      cash.dispatchEvent(new Event('input'));
      const held = them.holdings.length;
      document.querySelector('.sheet [data-fn="sendTrade"]')?.click();
      await new Promise(r => setTimeout(r, 60));
      const sheet = document.querySelector('.sheet');
      const card = sheet ? sheet.querySelector('.card') : null;
      const out = {
        persona: them.persona,
        heading: sheet ? (sheet.querySelector('h3')?.textContent || '').trim() : null,
        quote: card ? card.textContent.replace(/\s+/g, ' ').trim() : null,
        quoted: card ? card.classList.contains('quoted') : null,
        moved: them.holdings.length === held - 1
      };
      window.closeSheet();
      return out;
    }, seat);
    if (typeof one === 'string') { fail(one); spoke.length = 0; break; }
    spoke.push(one);
  }

  if (spoke.length === 3) {
    const LINES = await page.evaluate(() => window.__CONTRACT_LINES());
    const bad = [];
    for (const r of spoke) {
      if (r.heading !== 'Agreed') { bad.push(`${r.persona}: heading "${r.heading}"`); continue; }
      if (!r.moved) { bad.push(`${r.persona}: square did not change hands`); continue; }
      const match = (LINES[r.persona].yes || []).find(l => r.quote && r.quote.includes(l.t));
      if (!match) { bad.push(`${r.persona}: line is not one of theirs — ${r.quote}`); continue; }
      // The author's lines are marked in the data and must be marked on screen.
      if (!!match.qv !== r.quoted) {
        bad.push(`${r.persona}: data says qv=${!!match.qv}, screen says ${r.quoted}`);
      }
    }
    if (!bad.length) {
      const quotedSeen = spoke.filter(r => r.quoted).length;
      pass(`accepting raises a screen and each opponent speaks in turn ` +
           `(${spoke.map(r => r.persona).join(', ')}; ${quotedSeen} in the author's own words)`);
    } else {
      fail(`acceptance screen: ${bad.join(' | ')}`);
    }
  }

  // The author's words have to be MARKED on screen, and the line above cannot
  // promise to exercise that: Varan holds the only quoted line among four, and
  // which one he says is down to the seeded RNG -- it reported "0 in the
  // author's own words" every run. So this forces his quoted line to be the
  // only one available, renders it through the real path, and puts the list
  // back. Without this the marking branch is written and never executed.
  const marked = await page.evaluate(async () => {
    const G = window.__G(), BOARD = window.__BOARD(), LINES = window.__CONTRACT_LINES();
    const them = G.players.find(p => p.persona === 'varan');
    const quoted = LINES.varan.yes.find(l => l.qv);
    if (!them) return 'Varan is not at this table';
    if (!quoted) return 'no quoted line in the data to render';
    const keep = LINES.varan.yes;
    LINES.varan.yes = [quoted];                     // force it
    try {
      const me = G.players[0];
      if (!them.holdings.length) {
        them.holdings = [{ sq: BOARD.findIndex(b => b.pr && b.s), garrisons: 0, citadel: 0, mortgaged: 0 }];
      }
      // Varan is the dearest seat and adds a flat premium against whoever leads
      // the table, which by now is me. pr * 6 was enough in the loop above and
      // was refused here, so this offers a figure no valuation can reach --
      // the check is about how the line RENDERS, not about his price.
      them.cash = 0; them.debt = 0; me.cash = 400000; me.debt = 0;
      const sq = them.holdings[0].sq;
      G.phase = 'end';
      window.showTrade();
      document.querySelector(`.sheet [data-fn="tradeSet|to|${them.i}"]`)?.click();
      document.querySelector(`.sheet [data-fn="tradeSet|get|${sq}"]`)?.click();
      const cash = document.getElementById('trCash');
      cash.value = String(BOARD[sq].pr * 100);
      cash.dispatchEvent(new Event('input'));
      document.querySelector('.sheet [data-fn="sendTrade"]')?.click();
      await new Promise(r => setTimeout(r, 60));
      const card = document.querySelector('.sheet .card');
      const out = {
        text: quoted.t,
        shown: card ? card.textContent.replace(/\s+/g, ' ').trim() : null,
        quoted: card ? card.classList.contains('quoted') : null,
        attrib: card ? !!card.querySelector('.attrib') : null
      };
      window.closeSheet();
      return out;
    } finally {
      LINES.varan.yes = keep;                       // put it back
    }
  });

  if (typeof marked === 'string') fail(marked);
  else if (!marked.shown || !marked.shown.includes(marked.text)) {
    fail(`the forced quoted line was not shown: ${marked.shown}`);
  } else if (!marked.quoted || !marked.attrib) {
    fail(`the author's line rendered unmarked (quoted=${marked.quoted}, attribution=${marked.attrib})`);
  } else {
    pass("a line taken from the novel is marked as the author's on screen");
  }

  // ---- the chip row must not change height when the board changes ----
  //
  // Becoming a vassal used to add a line to a player chip, and vassalage grows
  // TWO chips at once -- the new vassal's and the new overlord's. The chip row
  // sits above the board, so the whole screen stepped down mid-turn. Measured
  // rather than inspected: the heights and the board's own top, before and
  // after, through a real vassalage.
  const chipJump = await page.evaluate(async () => {
    const G = window.__G(), E = window.__E();
    const heights = () => [...document.querySelectorAll('.pchip')]
      .map(c => +c.getBoundingClientRect().height.toFixed(1));
    const boardTop = () => +document.getElementById('board').getBoundingClientRect().top.toFixed(1);

    for (const p of G.players) { p.lord = null; p.vassals = []; p.debt = 0; }
    window.__render();
    const before = { chips: heights(), board: boardTop() };

    // A real bankruptcy into another player, which is the only route in.
    const debtor = G.players[1], creditor = G.players[0];
    debtor.cash = 0; debtor.holdings = []; creditor.cash = 5000;
    E.pay(G, debtor, creditor, 400);
    window.__render();
    const after = { chips: heights(), board: boardTop() };

    return {
      before, after,
      sworn: debtor.lord === creditor.i,
      status: [...document.querySelectorAll('.pchip .vs')].length,
      chips: document.querySelectorAll('.pchip').length
    };
  });
  if (!chipJump.sworn) fail('the probe could not create a vassal to measure the jump');
  else {
    const grew = chipJump.before.chips.some((h, i) => Math.abs(h - chipJump.after.chips[i]) > 0.5);
    const moved = Math.abs(chipJump.before.board - chipJump.after.board);
    if (!grew && moved <= 0.5) {
      pass(`the chip row holds its height through a vassalage (board moved ${moved}px)`);
    } else {
      fail(`vassalage moved the board ${moved}px; chips ${chipJump.before.chips} -> ${chipJump.after.chips}`);
    }
    // Every chip reserves the line whether or not it has anything to say.
    if (chipJump.status === chipJump.chips) pass('every chip reserves its status line');
    else fail(`${chipJump.status} status lines across ${chipJump.chips} chips — the reserve is conditional`);
  }

  // ---- an offer made TO you states both purses ----
  const offered = await page.evaluate(async () => {
    const G = window.__G(), E = window.__E(), BOARD = window.__BOARD();
    const me = G.players[0], them = G.players.find(p => p.kind === 'ai');
    for (const p of G.players) { p.lord = null; p.vassals = []; p.debt = 0; }
    const sq = BOARD.findIndex(b => b.pr && b.s);
    them.holdings = [{ sq, garrisons: 0, citadel: 0, mortgaged: 0 }];
    me.holdings = []; me.cash = 3210; them.cash = 987;
    G.phase = 'end';
    const r = E.proposeContract(G, { from: them.i, to: me.i, get: null, give: sq, cash: 100, direction: 2 });
    if (!r || !r.pending) return `the offer did not park for an answer (${JSON.stringify(r)})`;
    window.__tick();
    const read = sel => {
      const el = document.querySelector(`.sheet [data-purse="${sel}"]`);
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
    };
    const out = { you: read('you'), them: read('them') };
    window.closeSheet();
    G.contract = null; G.phase = 'end';
    return out;
  });
  if (typeof offered === 'string') fail(offered);
  else {
    const has = (t, n) => !!t && t.replace(/[,₡]/g, '').includes(String(n));
    if (has(offered.you, 3210) && has(offered.them, 987)) {
      pass(`an offer made to you states both purses (${offered.you} / ${offered.them})`);
    } else {
      fail(`purses missing from the offer sheet: you="${offered.you}" them="${offered.them}"`);
    }
  }

  // ---- the number on a square: price until owned, then what it charges ----
  const figures = await page.evaluate(() => {
    const G = window.__G(), BOARD = window.__BOARD(), SETS = window.__SETS(), E = window.__E();
    const me = G.players[0], them = G.players[1];
    for (const p of G.players) { p.holdings = []; p.lord = null; p.vassals = []; p.debt = 0; }
    const eden = SETS.eden.sq;
    const utils = BOARD.map((b, i) => [b, i]).filter(([b]) => b.t === 'u').map(([, i]) => i);
    const unowned = BOARD.findIndex((b, i) => b.pr && b.s && !eden.includes(i));

    // Eden entire, so eden[0] bare is the DOUBLED rent a complete set charges --
    // the first version of this check expected r[0] and read 28 against 14,
    // which was the rule working and the expectation wrong. A lone square from
    // another set covers the undoubled case beside it.
    const lone = SETS.ven.sq[0];
    me.holdings = [
      { sq: eden[0], garrisons: 0, citadel: 0, mortgaged: 0 },   // bare, set complete
      { sq: eden[1], garrisons: 2, citadel: 0, mortgaged: 0 },   // two garrisons
      { sq: eden[2], garrisons: 0, citadel: 1, mortgaged: 0 },   // citadel
      { sq: lone, garrisons: 0, citadel: 0, mortgaged: 0 },      // bare, set incomplete
      { sq: utils[0], garrisons: 0, citadel: 0, mortgaged: 0 }   // one utility of two
    ];
    them.holdings = [{ sq: unowned + 0, garrisons: 0, citadel: 0, mortgaged: 1 }];  // pledged
    window.__render();

    const read = i => {
      const el = document.querySelector(`.cell[data-i="${i}"] .cpr`);
      if (!el) return null;
      return {
        text: el.textContent.trim(),
        rent: el.classList.contains('rent'),
        clipped: el.scrollWidth > el.clientWidth + 0.5
      };
    };
    const out = {
      unownedIdx: utils[1],
      unowned: read(utils[1]), unownedPrice: BOARD[utils[1]].pr,
      bare: read(eden[0]), bareWant: BOARD[eden[0]].r[0] * 2,
      lone: read(lone), loneWant: BOARD[lone].r[0],
      two: read(eden[1]), twoWant: BOARD[eden[1]].r[2],
      cit: read(eden[2]), citWant: BOARD[eden[2]].r[4],
      util: read(utils[0]),
      pledged: read(them.holdings[0].sq)
    };
    // Both utilities to one player: the multiplier must move 4 -> 10.
    me.holdings.push({ sq: utils[1], garrisons: 0, citadel: 0, mortgaged: 0 });
    window.__render();
    out.bothUtils = read(utils[0]);
    // The colour a rent renders in, against the colour of the seat charging it.
    const colourAt = i => {
      const el = document.querySelector(`.cell[data-i="${i}"] .cpr`);
      return el ? getComputedStyle(el).color : null;
    };
    them.holdings.push({ sq: eden[0], garrisons: 0, citadel: 0, mortgaged: 0 });
    me.holdings = me.holdings.filter(h => h.sq !== eden[0]);
    window.__render();
    out.theirsColour = colourAt(eden[0]);
    out.mineColour = colourAt(lone);
    const pip = document.querySelectorAll('.pchip .pip')[me.i];
    out.minePip = pip ? getComputedStyle(pip).backgroundColor : null;
    // Every figure on the board, for clipping.
    out.anyClipped = [...document.querySelectorAll('.cell .cpr')]
      .filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent.trim());
    return out;
  });

  const eq = (got, want, label) => got && got.text === String(want)
    ? null : `${label}: showed "${got && got.text}" wanted "${want}"`;
  const figureFaults = [
    eq(figures.unowned, figures.unownedPrice, 'an unowned square'),
    eq(figures.bare, figures.bareWant, 'a bare holding in a complete set'),
    eq(figures.lone, figures.loneWant, 'a bare holding in an incomplete set'),
    eq(figures.two, figures.twoWant, 'two garrisons'),
    eq(figures.cit, figures.citWant, 'a citadel'),
    eq(figures.util, '×4', 'one utility'),
    eq(figures.bothUtils, '×10', 'both utilities'),
    eq(figures.pledged, '—', 'a pledged square'),
    figures.unowned && figures.unowned.rent ? 'an unowned square is styled as rent' : null,
    figures.cit && !figures.cit.rent ? 'a citadel rent is not styled as rent' : null,
    // A rent takes the colour of whoever charges it. It used to take var(--tx),
    // which is Spector's persona colour to the digit, so every rent on the board
    // was painted as if he owned it.
    figures.mineColour === figures.theirsColour
      ? `both owners' rents render the same colour (${figures.mineColour})` : null,
    figures.mineColour !== figures.minePip
      ? `a rent is ${figures.mineColour}, its owner's pip is ${figures.minePip}` : null
  ].filter(Boolean);
  if (!figureFaults.length) {
    pass(`a square shows price then rent (bare ${figures.lone.text}, set ${figures.bare.text}, 2G ${figures.two.text}, ` +
         `citadel ${figures.cit.text}, utility ${figures.util.text}/${figures.bothUtils.text}, pledged ${figures.pledged.text})`);
  } else {
    fail(`square figures wrong — ${figureFaults.join(' | ')}`);
  }
  if (!figures.anyClipped.length) pass('no figure is clipped by its cell');
  else fail(`clipped figures: ${figures.anyClipped.slice(0, 6).join(', ')}`);

  if (errors.length) {
    fail(`${errors.length} runtime error(s)`);
    [...new Set(errors)].slice(0, 6).forEach(e => console.log('        ' + e));
  } else pass('no runtime errors');

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
