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
if (written.length === 12 && written.every(t => /author|written for the game/i.test(t)))
  ok('every card says whose line it carries');
else bad('every card says whose line it carries', [`${written.length} provenance marks`]);
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
    hearts: [document.getElementById('livesA').textContent.replace(/\s/g, '').length,
             document.getElementById('livesB').textContent.replace(/\s/g, '').length],
    lit: [...document.querySelectorAll('#livesA')].map(e => e.innerHTML.split('<span')[0].length),
    prompt: document.getElementById('prompt').textContent,
    go: document.getElementById('go').hidden ? null : document.getElementById('go').textContent,
    offer: document.querySelectorAll('#cards .card').length
  };
});

let rounds = 0, mismatch = null, deadEnd = null;
// Three moments Sam can look at without running anything: the draft, the battle
// mid-flight, and the result. He is phone-only — a screenshot is the only
// instrument pointed at this until it is on his Home Screen.
const shot = {};
let pause = null;
for (let guard = 0; guard < 400; guard++) {
  const s = await state();
  if (!s.phase) break;
  if (process.env.TRACE) console.log('   trace', guard, JSON.stringify(s));

  if (s.phase === 'pick') {
    if (s.offer !== 3) { deadEnd = `offered ${s.offer} cards at ${s.prompt}`; break; }
    if (s.round === 3 && !shot.draft) { shot.draft = 1; await page.screenshot({ path: rp(HERE, 'play-draft.png') }); }
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
  } else if (s.go === 'Continue') {
    await page.click('#go');
  } else if (s.go === 'Fight') {
    // At the moment of the fight the deployment is on screen and every card is
    // alive, so this is the one place the two counts must agree exactly.
    if (s.markers !== s.cards[0] + s.cards[1])
      mismatch = `${s.markers} counters drawn for ${s.cards[0]} + ${s.cards[1]} cards`;
    await page.click('#go');
    let done = false;
    for (let w = 0; w < 60; w++) {
      done = await page.evaluate(() => {
        // The result screen hides the button entirely, so a predicate that starts
        // with "the button is showing" can never see the end of a match. It
        // didn't: the first version of this waited out its whole timeout on a
        // finished game, and read as the page hanging.
        const g = document.getElementById('go');
        return !!document.querySelector('#again') ||
               (!g.hidden && g.textContent === 'Next round');
      });
      if (done) break;
      if (w === 1 && !shot.battle) { shot.battle = 1; await page.screenshot({ path: rp(HERE, 'play-battle.png') }); }
      if (process.env.TRACE && w > 2) console.log('   waiting', w, JSON.stringify(await page.evaluate(() => ({
        prompt: document.getElementById('prompt').textContent,
        go: document.getElementById('go').textContent,
        marks: document.querySelectorAll('#field g[data-id]').length
      }))));
      await page.waitForTimeout(500);
    }
    if (!done) { deadEnd = 'the battle never returned to a result'; break; }
    rounds++;
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

console.log(`\n${10 - failed} of 10 claims hold`);
console.log(`written: docs/column/test/play-draft.png, play-battle.png, play.png\n`);
process.exit(failed ? 1 : 0);
