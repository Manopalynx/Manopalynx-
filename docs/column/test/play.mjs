// Does the PAGE work? — the real interface, driven through a whole match.
//
// Everything else in this folder measures the engine. This measures the thing
// Sam actually taps, and it exists because the Ledger's record is made almost
// entirely of defects that read perfectly well in the source: a quantity
// silently ignored on save, an export that threw and produced no file, a quota
// failure that looked exactly like a success. None were visible by inspection.
//
// It asserts three things at every step, and the third is the one that matters:
//
//   1. NOTHING THREW. A module that fails to load paints an empty screen and
//      says nothing at all, which on a phone is indistinguishable from a slow
//      page.
//   2. THE SCREEN AGREES WITH THE ENGINE. Counters drawn = cards drafted, every
//      round, both sides. The renderer aggregates bodies into cards, so a
//      grouping bug would show one marker for two Walkers and nothing would
//      look wrong.
//   3. THE ARITHMETIC CLOSES. Lives lost across the match equals rounds played,
//      and the hearts on screen equal the lives in the state. A wrong figure
//      here does not crash — it just quietly reports the wrong match.
//
// Run:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node docs/column/test/play.mjs

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve as rp, extname, join } from 'path';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = rp(HERE, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.json': 'application/json', '.webmanifest': 'application/manifest+json',
                '.png': 'image/png', '.css': 'text/css; charset=utf-8' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(DOCS, p);
  if (!f.startsWith(DOCS) || !existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

let failed = 0;
const ok = m => console.log(` ok   ${m}`);
const bad = (m, why) => { failed++; console.log(`FAIL  ${m}`); (why || []).forEach(w => console.log(`        · ${w}`)); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => { const m = e.message.split('\n')[0]; errors.push(m); if (process.env.TRACE) console.log('   PAGEERROR', m); });
page.on('console', m => { if (m.type() === 'error') { errors.push(m.text().slice(0, 120)); if (process.env.TRACE) console.log('   CONSOLE', m.text().slice(0, 160)); } });

await page.goto(base + '/column/index.html', { waitUntil: 'load' });

/* ------------------------------------------------------- the opening screen */
const title = await page.title();
if (title === 'Grandiose — The Column') ok('the page opens and is itself');
else bad('the page opens and is itself', [`titled ${JSON.stringify(title)}`]);

const personas = await page.locator('[data-opp]').count();
if (personas === 5) ok(`five opponents offered`);
else bad('five opponents offered', [`found ${personas}`]);

// The roster is where a player learns the counters, and where the author's lines
// are separated from the ones written for the game. If that separation is not on
// the screen, Sam cannot strike mine without opening a file.
await page.click('#roster');
const rosterRows = await page.locator('.rosterRow').count();
const written = await page.locator('.src').allTextContents();
if (rosterRows === 12) ok('the roster shows all twelve cards');
else bad('the roster shows all twelve cards', [`found ${rosterRows}`]);
// TWO QUESTIONS, NOT ONE. Whether the LINE is the author's, and whether the
// UNIT is. The Deflector's line is his and the unit is mine, and that is the one
// thing in this game Sam cannot check for himself without opening a file.
const invented = written.filter(t => /invented/i.test(t)).length;
if (written.length === 12 && written.every(t => /author|invented|written for the game/i.test(t)) && invented === 1)
  ok(`every card says whose line it carries, and the one invented unit says so`);
else bad('every card says whose line it carries', [
  `${written.length} provenance marks, ${invented} marked invented (expected 12 and 1)`]);
// The roster is a page Sam reads rather than plays; worth a look without him
// having to find it.
await page.screenshot({ path: rp(HERE, 'play-roster.png') });
await page.click('#back');

/* ------------------------------------------------------------- play a match */
await page.click('[data-opp="varan"]');

const state = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('column-save') || 'null');
  return {
    phase: s && s.phase, lives: s && s.lives, round: s && s.round,
    cards: s && [s.army[0].filter(t => !t.startsWith('up:')).length,
                 s.army[1].filter(t => !t.startsWith('up:')).length],
    markers: document.querySelectorAll('#field g[data-id]').length,
    // Mean vertical position of each side's counters, in field units. The field
    // is 140 deep and the viewBox is untransformed, so these are the engine's
    // own units read back off the screen.
    midY: [0, 1].map(side => {
      const t = [...document.querySelectorAll(`#field g[data-side="${side}"]`)]
        .map(e => +e.getAttribute('data-y')).filter(n => !Number.isNaN(n));
      return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
    }),
    fx: document.querySelectorAll('#field .fx').length,
    hearts: [document.getElementById('livesA').textContent.replace(/\s/g, '').length,
             document.getElementById('livesB').textContent.replace(/\s/g, '').length],
    lit: [...document.querySelectorAll('#livesA')].map(e => e.innerHTML.split('<span')[0].length),
    prompt: document.getElementById('prompt').textContent,
    solo: !!(s && s.solo),
    money: s ? s.money : null,
    picks: s ? [s.army[0].length, s.army[1].length] : null,
    // What was just committed, and what the screen is ringing. Two answers to
    // the same question, from opposite ends: the draft, and the counters.
    committed: s ? [s.mine, s.theirs].map(t => (t ? t.replace(/^up:/, '') : null)) : [null, null],
    pops: [...document.querySelectorAll('#field .pop')].map(e => {
      const g = e.closest('g[data-id]');
      return g ? `${g.dataset.side}:${g.dataset.id}` : '?';
    }),
    go: (() => { const g = document.getElementById('go');
                 return g.classList.contains('off') ? null : g.textContent; })(),
    // THE FIELD'S OWN HEIGHT. It is a flex sibling of the deck, so anything the
    // deck gains or loses comes out of the battlefield and the whole board
    // moves. This is the number Sam's note 4 is about.
    fieldH: Math.round(document.getElementById('fieldWrap').getBoundingClientRect().height),
    offer: document.querySelectorAll('#cards .card').length
  };
});

let rounds = 0, mismatch = null, deadEnd = null;
let sides = null, fxStill = null, fxFiring = 0;
let popWrong = null, popsSeen = 0;
let marketsSeen = 0, bought = 0, buyWrong = null, marketRounds = [];
// Every field height seen during the draft, and whether a reveal ever needed a
// tap. Both of these are measurements of Sam's notes 4 and 5.
const heights = new Set();
let revealTaps = 0, revealsSeen = 0;
// Three moments Sam can look at without running anything: the draft, the battle
// mid-flight, and the result. He is phone-only — a screenshot is the only
// instrument pointed at this until it is on his Home Screen.
const shot = {};
let pause = null;
for (let guard = 0; guard < 400; guard++) {
  const s = await state();
  if (!s.phase) break;
  if (process.env.TRACE) console.log('   trace', guard, JSON.stringify(s));

  // Draft phases only: the battle and the result legitimately show a different
  // button, and the field is not being tapped through then.
  if (s.phase === 'pick' || s.phase === 'revealed' || s.phase === 'ready')
    heights.add(`${s.fieldH}px at ${s.phase}${s.solo && s.phase === 'pick' ? ' (extra pick)' : ''}`);

  if (s.phase === 'round' && s.go === 'The market') marketRounds.push(s.round);

  if (s.phase === 'revealed') {
    // NO TAP HERE. If a button has appeared, the reveal is asking permission to
    // end, which is the thing that got tedious.
    revealsSeen++;
    if (s.go !== null) revealTaps++;
    // THE RING MUST BE ON THE CARD THAT WAS PICKED. A counter's key is where the
    // card DEPLOYS, and formation-by-role made that different from where it was
    // drafted -- so the ring landed on whatever the sort had put in that slot,
    // reliably whatever stood at the front. Sam found it in a screenshot; this
    // is so the next reordering cannot.
    for (const p of s.pops) {
      const [side, id] = p.split(':');
      if (s.committed[+side] !== id) { popWrong = popWrong || `${p} rung, but side ${side} committed ${s.committed[+side]}`; }
      popsSeen++;
    }
    await page.waitForTimeout(120);
    continue;
  }

  if (s.phase === 'pick') {
    if (s.offer !== 3) { deadEnd = `offered ${s.offer} cards at ${s.prompt}`; break; }
    if (s.round === 3 && !shot.draft) {
      shot.draft = 1;
      await page.screenshot({ path: rp(HERE, 'play-draft.png') });
      // And the same screen with a counter tapped, which is where a unit says
      // what it is and whose line it carries.
      await page.locator('#field g[data-side="0"]').first().click();
      await page.screenshot({ path: rp(HERE, 'play-inspect.png') });
      await page.locator('#field').click({ position: { x: 30, y: 30 } });
    }
    // THE WAY OUT, exercised mid-match and then backed out of. A pause that
    // cannot be closed, or that loses the match it paused, is worse than none.
    if (s.round === 1 && pause === null) {
      await page.click('#who');
      const has = await page.evaluate(() => ['#close', '#roster2', '#quit'].map(q => !!document.querySelector(q)));
      await page.click('#roster2');
      const rows = await page.locator('.rosterRow').count();
      await page.click('#back');
      await page.click('#close');
      // THE SHEET MUST BE GONE, and that is the assertion, not "the state behind
      // it still looks right". Breaking the close button left every other part of
      // this check green -- the cards are still in the DOM underneath -- and the
      // suite only failed later, when a click landed on the overlay instead of a
      // card. A crash three steps downstream is not this check doing its job.
      const gone = await page.evaluate(() => !document.querySelector('.sheet'));
      const after = await state();
      pause = has.every(Boolean) && rows === 12 && gone && after.phase === 'pick' &&
              after.offer === 3 && after.cards[0] === s.cards[0]
        ? true
        : `buttons ${has.join('/')}, roster rows ${rows}, ` +
          `${gone ? 'sheet closed' : 'THE SHEET DID NOT CLOSE'}, ` +
          `back at ${after.phase} with ${after.offer} cards offered`;
      // Stop here rather than playing on. A pause that did not close leaves an
      // overlay over the cards, so every later tap lands on it and the run dies
      // in a click timeout thirty seconds later -- a crash instead of a finding.
      if (pause !== true) { deadEnd = `the pause did not back out: ${pause}`; break; }
    }
    await page.locator('#cards .card').first().click();
  } else if (s.go === 'Fight') {
    // At the moment of the fight the deployment is on screen and every card is
    // alive, so this is the one place the two counts must agree exactly.
    if (s.markers !== s.cards[0] + s.cards[1])
      mismatch = `${s.markers} counters drawn for ${s.cards[0]} + ${s.cards[1]} cards`;
    // SAM'S NOTE 3, at the moment both armies are drawn up and nothing has moved.
    if (sides === null && s.midY[0] !== null && s.midY[1] !== null)
      sides = s.midY[0] > 70 && s.midY[1] < 70 ? true
        : `your counters average y=${s.midY[0].toFixed(0)}, theirs y=${s.midY[1].toFixed(0)} of 140`;
    // DIFFERENTIAL, half one: nothing is being fired, so nothing may be drawn.
    if (fxStill === null) fxStill = s.fx;
    await page.click('#go');
    let done = false;
    for (let w = 0; w < 60; w++) {
      done = await page.evaluate(() => {
        // The result screen hides the button entirely, so a predicate that starts
        // with "the button is showing" can never see the end of a match. It
        // didn't: the first version of this waited out its whole timeout on a
        // finished game, and read as the page hanging.
        // A round can end into the market instead of into the next round, and a
        // predicate that only knows one of those waits out its timeout on the
        // other -- which reads as the battle hanging.
        const g = document.getElementById('go');
        return !!document.querySelector('#again') ||
               (!g.classList.contains('off') &&
                (g.textContent === 'Next round' || g.textContent === 'The market'));
      });
      if (done) break;
      // DIFFERENTIAL, half two: mid-battle, with the log driving the screen.
      // An absolute count would pass on a renderer that draws a ring whether or
      // not anything fired; the pair cannot.
      const now = await page.evaluate(() => document.querySelectorAll('#field .fx').length);
      fxFiring = Math.max(fxFiring, now);
      // Screenshot a frame where something is actually being fired. Sampling on
      // a timer caught the advance instead, and a picture of two lines walking
      // is not evidence that the shots are drawn.
      if (now > 3 && s.round >= 4 && !shot.battle) { shot.battle = 1; await page.screenshot({ path: rp(HERE, 'play-battle.png') }); }
      if (process.env.TRACE && w > 2) console.log('   waiting', w, JSON.stringify(await page.evaluate(() => ({
        prompt: document.getElementById('prompt').textContent,
        go: document.getElementById('go').textContent,
        marks: document.querySelectorAll('#field g[data-id]').length
      }))));
      await page.waitForTimeout(250);
    }
    if (!done) { deadEnd = 'the battle never returned to a result'; break; }
    rounds++;
  } else if (s.go === 'The market') {
    // THE MARKET IS SHOPPED, not skipped. Buying is the only part of the economy
    // the interface owns, and a run that steps past it measures nothing.
    marketsSeen++;
    const before = { money: s.money[0], picks: s.picks[0], lives: s.lives[0] };
    await page.click('#go');
    if (!shot.market) { shot.market = 1; await page.screenshot({ path: rp(HERE, 'play-market.png') }); }
    const offered = await page.evaluate(() =>
      [...document.querySelectorAll('.sheet [data-i]')].map(b => b.querySelector('b').textContent));
    if (offered.length) {
      await page.locator('.sheet [data-i]').first().click();
      // A card or an upgrade opens a chooser: take the first.
      if (await page.locator('.sheet [data-id]').count()) await page.locator('.sheet [data-id]').first().click();
      const after = await state();
      const cost = +(offered[0].match(/(\d+)\s*$/) || [0, 0])[1];
      const spent = before.money - after.money[0];
      const grew = after.picks[0] > before.picks || after.lives[0] > before.lives ||
                   await page.evaluate(() => !!(JSON.parse(localStorage.getItem('column-save')).wide || [0])[0]);
      if (spent !== cost) buyWrong = buyWrong || `paid ${spent} for something priced ${cost}`;
      else if (!grew) buyWrong = buyWrong || `paid ${spent} and nothing reached the army, the lives or the offer`;
      else bought++;
    }
    await page.click('#leave');
  } else if (s.go === 'Next round') {
    await page.click('#go');
  } else if (await page.locator('#again').count()) {
    break;
  } else {
    deadEnd = `nothing to tap at phase ${s.phase} (${s.prompt})`;
    break;
  }
}

// The hearts in the bar survive the result screen, and they are what the player
// reads. Counting them is the only version of this check that measures the game
// rather than the harness: the first version compared the round count on screen
// with the round count this file had just counted itself, which stayed green
// through a mutation that spent a life on every OTHER round.
const end = await page.evaluate(() => ({
  // Where the result sits on the screen. Top-aligned, it hangs off the top edge
  // with most of a phone of nothing underneath it.
  centred: (() => {
    const h = document.querySelector('.sheet h1');
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { mid: r.top + r.height / 2, view: window.innerHeight };
  })(),
  lit: ['livesA', 'livesB'].map(id =>
    document.getElementById(id).innerHTML.split('<span')[0].replace(/\s/g, '').length),
  over: !!document.querySelector('#again'),
  headline: document.querySelector('.sheet h1') && document.querySelector('.sheet h1').textContent,
  body: document.querySelector('.sheet p') && document.querySelector('.sheet p').textContent,
  saveGone: localStorage.getItem('column-save') === null
}));

if (!deadEnd) ok(`a whole match plays through — ${rounds} rounds, no dead ends`);
else bad('a whole match plays through', [deadEnd]);

if (end.over) ok(`the match ends and says so: "${end.headline}"`);
else bad('the match ends and says so', ['never reached the result screen']);

if (mismatch === null) ok('counters drawn equal cards drafted, every round');
else bad('counters drawn equal cards drafted', [mismatch, 'the renderer groups bodies by card — this is that grouping']);

// Rounds played must equal lives spent. Five each, one lost a round, so a match
// that ends has spent exactly five on one side and fewer on the other.
const m = end.body && end.body.match(/after (\d+) rounds/);
const spent = (5 - end.lit[0]) + (5 - end.lit[1]);
if (m && +m[1] === rounds && spent === rounds && Math.min(...end.lit) === 0)
  ok(`the arithmetic closes — ${rounds} rounds, ${spent} lives spent, hearts ${end.lit.join('–')}`);
else bad('the arithmetic closes', [
  `the screen says ${m ? m[1] : '?'} rounds, the harness counted ${rounds}`,
  `hearts left ${end.lit.join(' and ')}, so ${spent} lives were spent over ${rounds} rounds`,
  Math.min(...end.lit) !== 0 ? 'the match ended with both sides still alive' : ''
].filter(Boolean));

if (end.saveGone) ok('a finished match does not come back as a resume');
else bad('a finished match does not come back as a resume', ['the save survived the result screen']);

const px = new Set([...heights].map(h => h.split('px')[0]));
if (px.size === 1) ok(`the battlefield never moves during a draft (${[...px][0]}px throughout)`);
else bad('the battlefield never moves during a draft', [
  ...[...heights].sort(),
  'the deck is a flex sibling of the field, so every pixel it changes moves the whole board'
]);

if (revealsSeen > 0 && revealTaps === 0)
  ok(`a reveal ends by itself — ${revealsSeen} of them, no taps`);
else bad('a reveal ends by itself', [
  revealsSeen === 0 ? 'no reveal was ever observed' : `${revealTaps} of ${revealsSeen} reveals showed a button`,
  'a tap that carries no decision, three times a round, nine rounds a match'
]);

if (marketsSeen > 0 && marketRounds.every(r => r % 3 === 0))
  ok(`the market opens every third round and not otherwise (rounds ${[...new Set(marketRounds)].join(', ')})`);
else bad('the market opens every third round', [
  marketsSeen === 0 ? 'no market opened in a whole match' : `opened after rounds ${marketRounds.join(', ')}`]);

if (bought > 0 && !buyWrong) ok(`buying takes the price and delivers the goods (${bought} purchases)`);
else bad('buying takes the price and delivers the goods', [
  buyWrong || 'nothing was ever bought', 'the price on the button is the only price a player sees']);

if (popsSeen > 0 && !popWrong) ok(`the ring lands on the card that was picked (${popsSeen} of them)`);
else bad('the ring lands on the card that was picked', [
  popsSeen === 0 ? 'no committed card was ever ringed' : popWrong,
  'a counter\'s key is where the card DEPLOYS, which since formation-by-role is not where it was drafted'
]);

if (sides === true) ok('your army is drawn at the bottom of the field, theirs at the top');
else bad('your army is drawn at the bottom of the field', [
  sides === null ? 'never reached a deployment to measure' : sides,
  'the engine still deploys side 0 at low y — this is the renderer mirroring, and only the renderer'
]);

if (fxStill === 0 && fxFiring > 0)
  ok(`shots and blasts are drawn only while the battle runs (${fxStill} still, ${fxFiring} firing)`);
else bad('shots and blasts are drawn only while the battle runs', [
  `${fxStill} effects on a drawn-up field, ${fxFiring} mid-battle`,
  fxFiring === 0 ? 'the replay log is not reaching the screen'
                 : 'effects are drawn when nothing is being fired, so they are decoration'
]);

const c = end.centred;
if (c && c.mid > c.view * 0.22 && c.mid < c.view * 0.62)
  ok(`the result sits in the middle of the screen (${(c.mid / c.view * 100).toFixed(0)}% down)`);
else bad('the result sits in the middle of the screen', [
  c ? `the headline is ${(c.mid / c.view * 100).toFixed(0)}% down a ${c.view}px screen`
    : 'no result headline found']);

if (pause === true) ok('the round can be paused for the roster and backed out of, mid-match');
else bad('the round can be paused for the roster and backed out of', [
  pause === null ? 'the pause was never reached' : pause,
  'without a way back to the menu a match cannot be abandoned or an opponent changed'
]);

if (!errors.length) ok('nothing threw, start to finish');
else bad('nothing threw, start to finish', errors.slice(0, 4));

await page.screenshot({ path: rp(HERE, 'play.png') });
await browser.close();
server.close();

console.log(`\n${18 - failed} of 18 claims hold`);
console.log(`written: play-roster.png, play-draft.png, play-inspect.png, play-market.png, play-battle.png, play.png\n`);
process.exit(failed ? 1 : 0);
