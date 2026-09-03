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
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve as rp, extname, join } from 'path';
import { chromium } from 'playwright';
import { BOOSTS, RULES, PERSONAS, MAPS, BY_MAP, TERRAIN, groundSays, DRAFT, BY_ID, SPECIALS } from '../data.js';
import { bonusPicks, POLICIES, specFor } from '../engine.js';
import { draw } from '../render.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = rp(HERE, '..', '..');

// SCREENSHOTS GO TO AN IGNORED FOLDER, and that is not tidiness.
//
// Nine are written every run. Six of them -- play, battle, draft, inspect,
// market, run -- differ on every single run, because the page seeds each match
// from the clock, so the match they photograph is a different match each time.
// Measured twice on 29 August 2026: the same six moved both times and the same
// three (maps, roster, chooser, all static screens) were byte-identical.
//
// Committed, that means any session which merely RUNS this suite leaves six
// modified binaries in the tree, and a session that changed nothing at all
// still has to explain them. Nothing asserts on these files -- they exist so
// Sam, who is phone-only, can see the interface from a machine he cannot see.
// They do that job just as well sent to him directly.
//
// The real fix is to seed the page deterministically for the suite, which
// would also close the claim this suite reports as not-run on every pass.
// That is a piece of work, not a path change. This is the path change.
const SHOTS = rp(HERE, 'shots');
mkdirSync(SHOTS, { recursive: true });
const png = n => rp(SHOTS, n);
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

// COUNTED AS THEY FIRE, not against a number typed at the bottom. Some claims
// here are conditional -- a run whose first match is lost never reaches the ramp
// check -- so a hardcoded total prints "20 of 20" while nineteen ran, which is a
// vacuous pass wearing a green tick. It also stops the total needing an edit
// every time a claim is added, which is a number written twice.
//
// AND COVERAGE IS PRINTED, because counting as they fire fixes the wrong number
// and leaves the right one invisible. THE PAGE SEEDS EVERY MATCH FROM
// `Date.now() ^ Math.random()` -- correct for the game, and it means this suite
// takes a different path each time it runs. Two runs an hour apart printed
// "24 of 24" and "21 of 21": the second lost its opening match, so the four
// checks past that point never ran, and nothing said so. Both look like a clean
// green. `skipped` is what a claim count cannot say on its own.
// ONE WAY TO TAKE A PICK, whichever screen the game is showing. The Ledger
// replaces the card row with a button that opens a sheet, and a driver that only
// knows how to click a card would stall there rather than fail -- which reads
// exactly like a hung page.
const takePick = async page => {
  if (await page.locator('#cards .ledgerAll').count()) {
    await page.locator('#cards .ledgerAll').click();
    await page.locator('.sheet [data-pick]').first().click();
    return 'ledger';
  }
  await page.locator('#cards .card').first().click();
  return 'card';
};

let failed = 0, ran = 0;
const skipped = [];
const ok = m => { ran++; console.log(` ok   ${m}`); };
const bad = (m, why) => { ran++; failed++; console.log(`FAIL  ${m}`); (why || []).forEach(w => w && console.log(`        · ${w}`)); };

/* ------------------------------- the strength bar, against the whole card ----- */
// 9 of the 15 cards field more than one body, and the bar under a counter used
// to divide by the ceiling of the bodies STILL STANDING. Both halves fell as
// bodies died, so the ratio stayed pinned: a Crawler Swarm down to its last body
// drew exactly the bar of an untouched one, and the only thing that moved was a
// 2.3pt digit. Nothing threw and nothing looked wrong -- the bar was full, which
// is what a full bar looks like.
//
// READ OUT OF THE DRAWN SVG, not recomputed. A check that redoes the renderer's
// arithmetic agrees with the renderer by construction and would have passed on
// the defect; this parses the two rects the renderer actually emitted -- the
// black track and the coloured fill -- and takes their ratio, which is the thing
// a player's eye takes.
{
  const barOf = live => {
    const m = [...draw(live).matchAll(/<rect x="[-0-9.]+" y="[-0-9.]+" width="([0-9.]+)" height="0\.9"/g)];
    return m.length < 2 ? null : parseFloat(m[1][1]) / parseFloat(m[0][1]);
  };
  const wrong = [];
  for (const u of [...DRAFT, ...SPECIALS]) {
    const body = hp => ({ side: 0, c: 3, id: u.id, x: 10, y: 10, hp, max: u.hp, lvl: 0 });
    // Every survivor count, each body untouched: the bar must read the share of
    // the card still on its feet.
    for (let alive = u.count; alive >= 1; alive--) {
      const got = barOf(Array.from({ length: alive }, () => body(u.hp)));
      const want = alive / u.count;
      if (got === null || Math.abs(got - want) > 0.01)
        wrong.push(`${u.n} at ${alive}/${u.count} bodies drew ${(got * 100).toFixed(0)}%, not ${(want * 100).toFixed(0)}%`);
    }
    // And health and body count have to COMPOSE, or the bar is honest about one
    // of them and silent about the other.
    if (u.count > 1) {
      const half = barOf(Array.from({ length: u.count - 1 }, () => body(u.hp / 2)));
      const want = (u.count - 1) / u.count / 2;
      if (half === null || Math.abs(half - want) > 0.01)
        wrong.push(`${u.n} with ${u.count - 1} bodies at half health drew ${(half * 100).toFixed(0)}%, not ${(want * 100).toFixed(0)}%`);
    }
  }
  const multi = [...DRAFT, ...SPECIALS].filter(u => u.count > 1).length;
  if (!wrong.length)
    ok(`the strength bar measures the whole card, not the survivors (${multi} of ${DRAFT.length + SPECIALS.length} cards field more than one body)`);
  else bad('the strength bar measures the whole card, not the survivors', wrong.slice(0, 4));
}

/* ------------------------------------- does a booster reach the player at all */
// TWO HALVES OF ONE QUESTION, and the second half is how The Vanguard shipped
// doing nothing. `bonusPicks()` -- the only function that reads that booster --
// had exactly one caller in the repository: `playMatch`, which is the sweep. So
// `match.mjs` priced it at +0.18 matches and printed "the pool has no dead
// option", green, while the interface's round loop cleared its bonus after one
// pick whatever you held. A sweep cannot see this: it never loads `ui.js`.
//
// `has(boosts, ...)` is the engine's own stated rule -- the only place a booster
// id is compared -- so both halves are exact string tests rather than a parse.
// The Set method `eq.has(...)` is elsewhere in the file and does not match.
//
// AND IT READS CODE, NOT PROSE. The first version of the second check matched
// the raw file, and both files carry comments naming `bonusPicks()` -- written
// to explain why it must be called. So the check passed on a mutation that
// removed every real call and left the comment standing, which is the exact
// shape of defect it exists to catch. Found by breaking it on purpose; nothing
// about reading it said so.
const strip = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map(l => {
    const i = l.indexOf('//');
    if (i < 0) return l;
    const before = l.slice(0, i);
    // Only a `//` outside a string literal starts a comment.
    for (const q of ['"', "'", '`']) if ((before.split(q).length - 1) % 2) return l;
    return before;
  })
  .join('\n');
const SRC = f => strip(readFileSync(rp(HERE, '..', f), 'utf8'));
const engineSrc = SRC('engine.js'), uiSrc = SRC('ui.js');

// 1. Every booster in the data is read by the engine. A booster nothing compares
//    is a rule that never fires -- and it is offered to the player regardless,
//    because the offer is built from BOOSTS.
// MATCHED ON THE COMPARISON, not on a variable name. The first version looked
// for the literal `has(boosts, 'x')`, which quietly made the guard a style rule:
// `earn` indexes a side's list, so it reads `has(mine, 'salvage')` and the check
// called a live booster dead. What matters is that the id is compared somewhere,
// whatever the list is called.
const compares = id => new RegExp(`\\bhas\\([^,()]+,\\s*'${id}'\\)`).test(engineSrc);
const unread = BOOSTS.map(b => b.id).filter(id => !compares(id));
if (!unread.length) ok(`every booster in the pool is read by the engine (${BOOSTS.length})`);
else bad('every booster in the pool is read by the engine', [
  `nothing compares: ${unread.join(', ')}`]);

// 2. Every engine function that reads a booster is CALLED BY THE INTERFACE.
//    Sliced on top-level exports rather than by line, because `pickTokens`
//    wraps and a line-based test would miss it.
const readers = engineSrc.split(/\nexport /).slice(1)
  .filter(chunk => /\bhas\([^,()]+,\s*'/.test(chunk))
  .map(chunk => (chunk.match(/^(?:const|function|let)\s+(\w+)/) || [])[1])
  .filter(Boolean);
const unused = readers.filter(n => !new RegExp(`\\b${n}\\s*\\(`).test(uiSrc));
if (readers.length && !unused.length)
  ok(`every rule that reads a booster is called by the interface — ${readers.join(', ')}`);
else bad('every rule that reads a booster is called by the interface', [
  readers.length ? `the page never calls: ${unused.join(', ')}` : 'found no booster readers to check']);

/* ------------------------------- every opponent is playable, placed and quoted */
// SAM'S NOTE 18 took the roster from five to nine and gave each one a map. Three
// ways that can go wrong silently: a persona with no drafting policy is offered
// and throws on the first pick; a persona whose `map` names nothing falls back to
// Eden and nobody notices two opponents sharing a ground; and a map nobody uses
// is a scene that was drawn and never seen. All three are data, so all three are
// a static check rather than a browser one.
{
  const ids = Object.keys(PERSONAS);
  // ASKED OF THE ENGINE, not of its source. The first version of this line tested
  // a regex against an empty string and then matched POLICIES entries by their
  // indentation -- it passed, for no reason connected to whether a policy exists.
  const noPolicy = ids.filter(k => typeof POLICIES[k] !== 'function');
  const noMap = ids.filter(k => !MAPS.some(m => m.id === PERSONAS[k].map));
  const unused = MAPS.filter(m => !ids.some(k => PERSONAS[k].map === m.id)).map(m => m.id);
  const shared = ids.length !== new Set(ids.map(k => PERSONAS[k].map)).size;
  const unquoted = MAPS.filter(m => !m.q || !m.qv).map(m => m.id);
  if (!noPolicy.length && !noMap.length && !unused.length && !shared && !unquoted.length)
    ok(`every opponent has a policy, a map of its own and a line from the book (${ids.length} of them)`);
  else bad('every opponent has a policy, a map of its own and a line from the book', [
    noPolicy.length ? `no drafting policy: ${noPolicy.join(', ')}` : null,
    noMap.length ? `map names nothing: ${noMap.join(', ')}` : null,
    unused.length ? `map drawn and never used: ${unused.join(', ')}` : null,
    shared ? 'two opponents share a ground' : null,
    unquoted.length ? `map has no quoted line: ${unquoted.join(', ')}` : null]);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => { const m = e.message.split('\n')[0]; errors.push(m); if (process.env.TRACE) console.log('   PAGEERROR', m); });
page.on('console', m => { if (m.type() === 'error') { errors.push(m.text().slice(0, 120)); if (process.env.TRACE) console.log('   CONSOLE', m.text().slice(0, 160)); } });

await page.goto(base + '/column/index.html', { waitUntil: 'load' });

// ALL NINE GROUNDS ON ONE SHEET, at the real size with a real deployment on top.
// Sam is phone-only and a map is the one thing no assertion can judge: whether a
// scene competes with the counters is a thing you look at. Written every run so
// it cannot drift from what the page draws.
{
  const shot = await page.evaluate(async () => {
    const { ground, draw } = await import('./render.js');
    const { MAPS, PERSONAS } = await import('./data.js');
    const { deployment } = await import('./engine.js');
    const live = deployment(['walker', 'line', 'acid', 'ultra'],
                            ['brute', 'swarm', 'neurite', 'amabie'], 42);
    const wrap = document.createElement('div');
    wrap.id = 'mapsheet';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99;overflow:auto;display:grid;' +
      'grid-template-columns:repeat(5,1fr);gap:14px;padding:16px;background:#0b1017;' +
      'font:12px system-ui;color:#e7eef7';
    for (const m of MAPS) {
      const who = Object.values(PERSONAS).find(x => x.map === m.id);
      const cell = document.createElement('div');
      cell.innerHTML = `<svg viewBox="0 0 100 140" style="width:100%;display:block;border-radius:8px">${
        ground(m.id)}${draw(live, {})}</svg><div style="margin-top:6px"><b>${m.n}</b><br>` +
        `<span style="color:#7f8fa2">${who ? who.n + ' \u00b7 ' + who.f : 'UNUSED'}</span></div>`;
      wrap.appendChild(cell);
    }
    document.body.appendChild(wrap);
    return MAPS.length;
  });
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: png('play-maps.png'), fullPage: true });
  await page.evaluate(() => document.getElementById('mapsheet').remove());
  await page.setViewportSize({ width: 393, height: 852 });
  if (process.env.TRACE) console.log(`   drew ${shot} grounds`);
}

/* ------------------------------------------------------- the opening screen */
const title = await page.title();
if (title === 'Grandiose — The Column') ok('the page opens and is itself');
else bad('the page opens and is itself', [`titled ${JSON.stringify(title)}`]);

// DERIVED, not five. Sam's note 18 took the roster from five to nine and this
// check would have gone red for the right reason and the wrong number -- the
// claim is that every persona with a policy is offered, not that there are five.
const personas = await page.locator('[data-opp]').count();
const playable = Object.keys(PERSONAS).length;
if (personas === playable) ok(`every opponent is offered (${personas}, ${
  new Set(Object.values(PERSONAS).map(p => p.f)).size} factions)`);
else bad('every opponent is offered', [`found ${personas} of ${playable}`]);

// HIS NOTE 20, AND IT IS THE WHOLE DECISION RATHER THAN A LABEL. Terrain is
// fixed per map and must be READABLE BEFORE THE FIRST PICK: a board you cannot
// see until after you have committed a draft is a coin flip, and one you can see
// turns the draft into "answer this ground". The chooser is the last screen
// before a card is taken, so the guard is that the ground is named there --
// derived from the data, so adding terrain to a second map cannot quietly ship
// without the sentence that makes it fair.
const withGround = Object.values(PERSONAS)
  .filter(p => BY_MAP[p.map] && BY_MAP[p.map].terrain);
const named = [];
for (const p of withGround) {
  const t = TERRAIN[BY_MAP[p.map].terrain];
  const row = page.locator(`[data-opp]:has-text("${p.n}")`).first();
  const txt = (await row.count()) ? await row.textContent() : '';
  // EVERY CLAUSE, not just the first. Five grounds do two things, and a check
  // that read one sentence would pass a screen showing half a ground -- which is
  // the same defect as the card row that dropped a line in silence.
  const clauses = groundSays(t);
  if (t && txt.includes(t.n) && clauses.length && clauses.every(c => txt.includes(c)))
    named.push(`${p.n} (${clauses.length})`);
}
if (withGround.length && named.length === withGround.length)
  ok(`every map with terrain says so before the draft (${named.join(', ')})`);
else if (!withGround.length)
  bad('every map with terrain says so before the draft', ['no map carries terrain at all']);
else bad('every map with terrain says so before the draft', [
  `${named.length} of ${withGround.length} named it: ${withGround.map(p => p.n).join(', ')}`,
  'terrain you cannot read before committing a draft is a coin flip, not a decision']);

// The roster is where a player learns the counters, and where the author's lines
// are separated from the ones written for the game. If that separation is not on
// the screen, Sam cannot strike mine without opening a file.
await page.click('#roster');
const rosterRows = await page.locator('.rosterRow').count();
const written = await page.locator('.src').allTextContents();
// Twelve drafted and three bought. The specials belong on this page: a card you
// might spend most of a match's income on is one you have to be able to read
// before the market opens.
const marketOnly = await page.locator('.rosterRow em:has-text("at the market")').count();
if (rosterRows === 15 && marketOnly === 3)
  ok('the roster shows all fifteen cards and marks the three the market sells');
else bad('the roster shows all fifteen cards', [`found ${rosterRows} rows, ${marketOnly} marked as market-only`]);
// TWO QUESTIONS, NOT ONE. Whether the LINE is the author's, and whether the
// UNIT is. The Deflector's line is his and the unit is mine, and that is the one
// thing in this game Sam cannot check for himself without opening a file.
const invented = written.filter(t => /invented/i.test(t)).length;
if (written.length === 15 && written.every(t => /author|invented|written for the game/i.test(t)) && invented === 1)
  ok(`every card says whose line it carries, and the one invented unit says so`);
else bad('every card says whose line it carries', [
  `${written.length} provenance marks, ${invented} marked invented (expected 15 and 1)`]);
// The roster is a page Sam reads rather than plays; worth a look without him
// having to find it.
await page.screenshot({ path: png('play-roster.png') });
await page.click('#back');

/* ------------------------------------------------------------- play a match */
await page.click('[data-opp="varan"]');

const state = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('column-save') || 'null');
  return {
    phase: s && s.phase, lives: s && s.lives, round: s && s.round,
    // A CARD IS A BARE ID. Every other token carries a prefix and a colon --
    // up:, eq:, ord:, sab: -- and this check restated that rule as "not up:",
    // so the first token kind added after it was counted as a card.
    cards: s && [s.army[0].filter(t => !t.includes(':')).length,
                 s.army[1].filter(t => !t.includes(':')).length],
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
    // Each card's own content height against the box that clips it. Measured on
    // the real face at the real width, because 9px of text wrapping to a second
    // line is the difference between fitting and being cut in half.
    // THE CARD AND EVERY LINE IN IT. Giving each line a fixed height is what
    // stops a tall card growing the deck -- and it also means the card can never
    // overflow, so a card-level check alone goes vacuous the moment it works.
    // The clipping just moves inside a child, where it is still silent. Found by
    // extending the probe to the upgrade face, not by reading this.
    cardFit: [...document.querySelectorAll('#cards .card')].map(c => {
      // ONLY WHAT ACTUALLY CLIPS. `scrollHeight > clientHeight` on an element
      // that is not hiding its overflow is a measurement artefact, not a defect
      // -- the upgrade chevron is absolutely positioned with no height and
      // reported 6px every time. An element silently loses content only if it
      // is hiding the overflow, so that is the test.
      const parts = [c, ...c.querySelectorAll('*')]
        .filter(e => /hidden|clip/.test(getComputedStyle(e).overflowY))
        .map(e => ({ tag: e.className || e.tagName, over: e.scrollHeight - e.clientHeight }))
        .filter(e => e.over > 1)
        .sort((a, b) => b.over - a.over);
      return { name: (c.querySelector('b') || {}).textContent || '?',
               over: parts.length ? parts[0].over : 0,
               where: parts.length ? parts[0].tag : '' };
    }),
    hearts: [document.getElementById('livesA').textContent.replace(/\s/g, '').length,
             document.getElementById('livesB').textContent.replace(/\s/g, '').length],
    lit: [...document.querySelectorAll('#livesA')].map(e => e.innerHTML.split('<span')[0].length),
    prompt: document.getElementById('prompt').textContent,
    solo: !!(s && s.solo),
    money: s ? s.money : null,
    picks: s ? [s.army[0].length, s.army[1].length] : null,
    // What was just committed, and what the screen is ringing. Two answers to
    // the same question, from opposite ends: the draft, and the counters.
    committed: s ? [s.mine, s.theirs].map(t => (t ? t.replace(/^[a-z]+:/, '') : null)) : [null, null],
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
    offer: document.querySelectorAll('#cards .card').length,
    // THE LEDGER puts one button where three cards would be, so the row's count
    // stops meaning what it meant. Reported rather than inferred from the count.
    ledger: !!document.querySelector('#cards .ledgerAll'),

    // WHAT THE SAME CARDS LOOK LIKE AT A WIDER OFFER — his note 22, and the
    // reason it went unseen for as long as it has existed.
    //
    // The row is flex:1 1 0, so a fourth card takes every card from 118px to
    // 86px while the text does not shrink with it: the stat line wrapped into a
    // box one line tall with overflow:hidden and "840 hp - 44 dps" lost its
    // damage in silence. The check above could not see it for TWO separate
    // reasons, and both are the fixture rather than the assertion:
    //
    //   · it only ever sees three cards, because this suite never buys the
    //     market's wider offer, and
    //   · it reads overflowY alone, so a line cut sideways is invisible to it.
    //
    // So this widens the REAL row with the REAL card faces and measures both
    // directions. The three genuine cards stay in it and are what get measured
    // at the narrower width; the clones only make the row wider. Everything is
    // put back inside this one evaluate, so the DOM the driver sees afterwards
    // is untouched and no later tap can land on a clone.
    wideFit: (() => {
      const row = document.getElementById('cards');
      if (!row || row.children.length !== 3) return [];
      const added = [], out = [];
      for (const n of [4, 5]) {
        while (row.children.length < n) {
          const c = row.children[0].cloneNode(true);
          row.appendChild(c); added.push(c);
        }
        for (const c of row.children) for (const e of [c, ...c.querySelectorAll('*')]) {
          const st = getComputedStyle(e);
          const down = /hidden|clip/.test(st.overflowY) ? e.scrollHeight - e.clientHeight : 0;
          // AN ELLIPSIS IS NOT THIS DEFECT. The class being guarded is content
          // that disappears without a mark; a line the reader can SEE is cut
          // has not lost them anything they cannot go and read on the inspect
          // screen. So a sideways overflow is only counted where nothing tells
          // the reader it happened.
          const marked = st.textOverflow === 'ellipsis';
          const across = !marked && /hidden|clip/.test(st.overflowX)
            ? e.scrollWidth - e.clientWidth : 0;
          if (down > 1 || across > 1) out.push({
            n, tag: e.className || e.tagName,
            dir: down > 1 ? 'down' : 'across', over: down > 1 ? down : across,
            text: (e.textContent || '').slice(0, 30)
          });
        }
      }
      for (const c of added) c.remove();
      return out;
    })()
  };
});

let rounds = 0, mismatch = null, deadEnd = null;
let sides = null, fxStill = null, fxFiring = 0;
let popWrong = null, popsSeen = 0;
let marketsSeen = 0, bought = 0, buyWrong = null, marketRounds = [];
// Every life either side has BOUGHT, counted as it appears. Nothing but a
// purchase raises a life total, so the increases are the purchases.
let livesBought = 0, livesSeen = null;
// Field heights seen while a battle plays, against those seen while drafting.
const battleH = new Set();
// The first card face whose content is taller than the box that hides it.
let clipped = null;
let wideClip = null;
const wideCards = new Set();
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
  if (livesSeen) for (const i of [0, 1]) if (s.lives[i] > livesSeen[i]) livesBought += s.lives[i] - livesSeen[i];
  livesSeen = s.lives;
  if (process.env.TRACE) console.log('   trace', guard, JSON.stringify(s));

  // Draft phases only: the battle and the result legitimately show a different
  // button, and the field is not being tapped through then.
  if (s.phase === 'pick' || s.phase === 'revealed' || s.phase === 'ready')
    heights.add(`${s.fieldH}px at ${s.phase}${s.solo && s.phase === 'pick' ? ' (extra pick)' : ''}`);

  // AND DURING THE BATTLE. Kept apart from the set above, because that claim is
  // about a draft and this is a different question: note 15 puts a speed
  // selector into the deck's action row for the length of a battle, and the deck
  // is a flex sibling of the field. If the row does not own its height, the
  // battlefield changes size the moment the fight starts and back again when it
  // ends -- note 4 arriving by a third route.
  if (s.phase === 'battle') battleH.add(s.fieldH);   // rarely reached; see the fight loop

  // NOTHING ON A CARD IS CLIPPED. The card row is a fixed 132px box with
  // `overflow:hidden`, which is what stops a tall card growing the deck and
  // moving the battlefield -- and it means content that does not fit is cut off
  // in SILENCE. The field-height check above cannot see it, because the whole
  // point of the fixed box is that the field does not move. Notes 12 and 13 put
  // two more lines on every face, so this is the failure they can cause.
  if (s.phase === 'pick') for (const c of s.cardFit) if (c.over > 1) clipped = clipped || c;
  if (s.phase === 'pick') {
    for (const c of s.wideFit) if (c.over > 1) wideClip = wideClip || c;
    // WHICH CARDS THIS ACTUALLY COVERED. The worst case for the stat line is not
    // the card with the biggest numbers, it is the card with NO attack --
    // "660 hp - no attack" is wider than "840 hp - 44 dps" -- so a run that
    // happened to miss the Deflector would pass while the defect stood. The
    // count is printed rather than assumed.
    for (const c of s.cardFit) if (c.name && c.name !== '?') wideCards.add(c.name);
  }

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
    if (!s.ledger && s.offer !== 3) { deadEnd = `offered ${s.offer} cards at ${s.prompt}`; break; }
    if (s.round === 3 && !shot.draft) {
      shot.draft = 1;
      await page.screenshot({ path: png('play-draft.png') });
      // And the same screen with a counter tapped, which is where a unit says
      // what it is and whose line it carries.
      await page.locator('#field g[data-side="0"]').first().click();
      await page.screenshot({ path: png('play-inspect.png') });
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
      pause = has.every(Boolean) && rows === 15 && gone && after.phase === 'pick' &&
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
    await takePick(page);
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
      // MEASURED HERE, because the outer loop never samples mid-battle -- it
      // clicks Fight and waits. The first version of this claim collected on
      // `phase === 'battle'` in that outer loop and reported "no battle was ever
      // observed" against a suite that had just fought eight of them.
      battleH.add(await page.evaluate(() =>
        Math.round(document.getElementById('fieldWrap').getBoundingClientRect().height)));
      // Screenshot a frame where something is actually being fired. Sampling on
      // a timer caught the advance instead, and a picture of two lines walking
      // is not evidence that the shots are drawn.
      if (now > 3 && s.round >= 4 && !shot.battle) { shot.battle = 1; await page.screenshot({ path: png('play-battle.png') }); }
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
    if (!shot.market) { shot.market = 1; await page.screenshot({ path: png('play-market.png') }); }
    const offered = await page.evaluate(() =>
      [...document.querySelectorAll('.sheet [data-i]')].map(b => b.querySelector('b').textContent));
    if (offered.length) {
      await page.locator('.sheet [data-i]').first().click();
      // THE PRICE THE PLAYER IS LOOKING AT WHEN THEY COMMIT, which is not always
      // the one on the shelf. A special and a piece of kit are "from" rows --
      // the row states the cheapest the shelf holds and the chooser button
      // states what that one costs -- so reading the row and clicking the
      // chooser compared two different purchases. It reported "paid 75 for
      // something priced 70" against a game doing exactly what it said, and it
      // only ever fired on a match rich enough to afford more than the cheapest
      // special, which is why it read green for as long as it did.
      //
      // Matched on the coin rather than a trailing digit: an upgrade's button
      // reads "Walker to level 2" and a bare `(\d+)$` prices it at ₡2.
      let cost = +(offered[0].match(/₡\s*(\d+)\s*$/) || [0, 0])[1];
      const chooser = page.locator('.sheet [data-id]').first();
      if (await chooser.count()) {
        // The chooser is where notes 14 and 16 land: what is on the shelf, and
        // what the thing actually does before you spend a market's takings on it.
        if (!shot.chooser) { shot.chooser = 1; await page.screenshot({ path: png('play-chooser.png') }); }
        // THE FIRST `b`, explicitly. Note 16 put the abilities on this row and each
        // one leads with its name in bold, so a bare `locator('b')` matches five
        // and Playwright's strict mode kills the RUN -- no FAIL line, just a
        // stack trace, which is the shape of failure this suite has been bitten
        // by before. The name and price are the first bold thing in the row.
        const own = (await chooser.locator('b').first().textContent()).match(/₡\s*(\d+)\s*$/);
        if (own) cost = +own[1];
        await chooser.click();
      }
      const after = await state();
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

// Rounds played must equal lives spent. One life a round, to one side.
//
// AND A BOUGHT LIFE IS SPENT TWICE. This read `(5 - hearts) + (5 - hearts)`,
// which was lives spent until the day the market started selling one -- to you
// at the shop, and to the opponent by `spend()` whenever it is down to its last.
// A match in which either side bought one shows nine lives against ten rounds
// and the check calls the game wrong. It had been green because the harness
// plays the floor and rarely reaches 44 credits; it is a coin toss on any match
// that does, which is worse than no check at all.
//
// `livesBought` is every INCREASE observed in the saved state, and nothing but a
// purchase raises a life total. The final round cannot hide one: neither market
// opens when the match is ending.
const m = end.body && end.body.match(/after (\d+) rounds/);
const spent = (RULES.lives - end.lit[0]) + (RULES.lives - end.lit[1]) + livesBought;
if (m && +m[1] === rounds && spent === rounds && Math.min(...end.lit) === 0)
  ok(`the arithmetic closes — ${rounds} rounds, ${spent} lives spent, hearts ${end.lit.join('–')}`);
else bad('the arithmetic closes', [
  `the screen says ${m ? m[1] : '?'} rounds, the harness counted ${rounds}`,
  `hearts left ${end.lit.join(' and ')}, so ${spent} lives were spent over ${rounds} rounds`,
  Math.min(...end.lit) !== 0 ? 'the match ended with both sides still alive' : ''
].filter(Boolean));

if (end.saveGone) ok('a finished match does not come back as a resume');
else bad('a finished match does not come back as a resume', ['the save survived the result screen']);

const draftPx = new Set([...heights].map(h => +h.split('px')[0]));
const allPx = new Set([...draftPx, ...battleH]);
if (battleH.size && allPx.size === 1)
  ok(`the battlefield is the same size in a battle as in a draft (${[...allPx][0]}px)`);
else bad('the battlefield is the same size in a battle as in a draft', [
  `drafting: ${[...draftPx].join(', ')}px; fighting: ${[...battleH].join(', ')}px`,
  battleH.size ? 'the speed selector is in the deck, and the deck is a flex sibling of the field'
               : 'no battle was ever observed']);

if (!clipped) ok('no card face is clipped by the row that hides its overflow');
else bad('no card face is clipped', [
  `${clipped.name}: '${clipped.where}' overflows its box by ${clipped.over}px`,
  'the row is overflow:hidden so this is cut off in silence — the field never moves']);

// HIS NOTE 22. The check above sees the three-card row only, because this suite
// never buys the market's wider offer -- so for as long as a wider offer has
// existed, the case has been untested and the row has been cutting the stat line
// in half at four cards. Measured, not inferred: the stat line wants 90px on one
// line and gets 76px at four cards.
if (!wideClip)
  ok(`no card face is clipped at a wider offer either — 4 and 5 cards, ${wideCards.size} distinct cards seen`);
else bad('no card face is clipped at a wider offer', [
  `at ${wideClip.n} cards, '${wideClip.tag}' is cut ${wideClip.dir} by ${wideClip.over}px: "${wideClip.text}"`,
  'the market sells a wider offer, so this is a row a player reaches in play',
  `${wideCards.size} distinct cards were seen at width`]);

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

await page.screenshot({ path: png('play.png') });

/* ------------------------------------------------------------------- a run */
// A run is the loop now, and none of the above touches it: everything so far is
// one match against one persona. This plays the first match of a run and checks
// what happens at its end -- which is the only part of a run that is new.
{
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.click('#run');

  let ended = false, lastLives = null;
  for (let guard = 0; guard < 400 && !ended; guard++) {
    const s = await state();
    if (!s.phase) { ended = true; break; }
    // The last lives seen while the match was still saved. `over()` clears the
    // save, so reading it afterwards reads null -- which the first version of
    // this check did, and reported as a carry failure.
    lastLives = s.lives[0];
    if (s.phase === 'revealed') { await page.waitForTimeout(120); continue; }
    if (s.phase === 'pick') { await takePick(page); continue; }
    if (s.go === 'The market') { await page.click('#go'); await page.click('#leave'); continue; }
    if (s.go === 'Next round') { await page.click('#go'); continue; }
    if (s.go === 'Fight') {
      await page.click('#go');
      for (let w = 0; w < 60; w++) {
        const done = await page.evaluate(() => {
          const g = document.getElementById('go');
          return !!document.querySelector('.sheet') ||
                 (!g.classList.contains('off') &&
                  (g.textContent === 'Next round' || g.textContent === 'The market'));
        });
        if (done) break;
        await page.waitForTimeout(250);
      }
      continue;
    }
    if (await page.locator('.sheet').count()) { ended = true; break; }
    break;
  }

  await page.screenshot({ path: png('play-run.png') });
  const end = await page.evaluate(() => ({
    head: (document.querySelector('.sheet h1') || {}).textContent || null,
    boosts: [...document.querySelectorAll('.sheet [data-b]')].map(b => b.dataset.b),
    again: !!document.querySelector('#again'),
    text: (document.querySelector('.sheet') || {}).textContent || ''
  }));

  const survived = /survived/i.test(end.head || '');
  if (survived ? end.boosts.length === 3 : end.again)
    ok(`a run's first match ends into the run, not into a menu ("${end.head}")`);
  else bad("a run's first match ends into the run", [
    `headline ${JSON.stringify(end.head)}, boosters offered ${end.boosts.length}, again ${end.again}`]);

  if (!survived) {
    if (/run ends/i.test(end.text)) ok('a lost run says so and scores what was survived');
    else bad('a lost run says so', ['the result screen never mentioned the run']);
    skipped.push("the opponent's booster is drawn and named", 'the ramp is stated and applied',
                 'lives carry into the next match', 'a booster each carries into match 2');
  } else {
    skipped.push('a lost run says so and scores what was survived');
    // THREE OFFERED, ONE DRAWN FOR THEM. The asymmetry is the choice, so the
    // count on each side is what has to be right.
    const drawn = /theirs is drawn, yours is chosen/i.test(end.text);
    if (drawn) ok("the opponent's booster is drawn and named, yours is chosen");
    else bad("the opponent's booster is drawn and named", ['the screen never said what they took']);

    // TAKE A BOOSTER THIS SUITE HAS A CLAIM ABOUT, rather than whatever is first.
    // Both The Compact and The Ledger only show their effect in the match AFTER
    // they are taken, so each needs to be held going into match 2 -- and the
    // offer is random, so clicking blind left both claims permanently skipped.
    // That is how the Compact's own defect survived: Sam found it by playing.
    //
    // One run can only take one of them, so whichever is offered is tested and
    // the other reports as skipped. Injecting the booster into the save instead
    // was tried and does not work: the save carries the computed offer AND the
    // phase, so a doctored one either restores the old three cards or lands in a
    // state the game never reaches.
    let took = null;
    for (const want of ['compact', 'ledger']) {
      if (await page.locator(`.sheet [data-b="${want}"]`).count()) { took = want; break; }
    }
    await page.locator(took ? `.sheet [data-b="${took}"]` : '.sheet [data-b]').first().click();
    const compactOffered = took === 'compact';

    const stated = await page.evaluate(() => (document.querySelector('.sheet') || {}).textContent || '');
    await page.click('#on');
    const two = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('column-save') || 'null');
      return s && { n: s.run && s.run.n, money: s.money, per: s.perRound,
                    boosts: s.boosts, lives: s.lives, army: s.army };
    });
    if (/begin with/i.test(stated) && two && two.n === 1 && two.money[1] >= 18)
      ok(`the ramp is stated and applied — match 2's opponent starts on ${two.money[1]}`);
    else bad('the ramp is stated and applied', [
      `stated ${/begin with/i.test(stated)}, match ${two && two.n}, their purse ${two && two.money[1]}`]);

    // THE COMPACT CARRIES A CARD, and it has to arrive in the match you play
    // NEXT rather than the one after. This is Sam's bug report as a check: the
    // old suite asserted only that the booster was HELD in match 2, which was
    // true while nothing at all was carried, and the run screen said
    // "0 cards to 0" on the round after taking it.
    //
    // Read off the saved state rather than off the screen, because the carried
    // card is in the army before a single pick is made and there is nothing to
    // photograph yet.
    if (compactOffered) {
      const carriedIn = (two && two.army && two.army[0]) || [];
      if (carriedIn.length >= 1)
        ok(`The Compact carries a card into the very next match (${carriedIn.join(', ')})`);
      else bad('The Compact carries a card into the very next match', [
        'match 2 began with an empty column while The Compact was held',
        'the booster pays a match late, which is what it did before this was a check']);
    } else skipped.push('The Compact carries a card into the very next match');

    // THE LEDGER, on the real first pick of the real next match. It replaces the
    // card row with one button, so the row's count stops meaning what it meant --
    // which is why `offer` and `ledger` are reported separately by the probe.
    if (took === 'ledger') {
      const st = await page.evaluate(() => ({
        row: !!document.querySelector('#cards .ledgerAll'),
        cards: document.querySelectorAll('#cards .card').length,
      }));
      let listed = 0, grew = false;
      if (st.row) {
        await page.locator('#cards .ledgerAll').click();
        listed = await page.locator('.sheet [data-pick]').count();
        await page.locator('.sheet [data-pick]').nth(Math.min(4, Math.max(0, listed - 1))).click();
        await page.waitForTimeout(400);
        grew = await page.evaluate(() => {
          const s = JSON.parse(localStorage.getItem('column-save') || 'null');
          return !!(s && s.army && s.army[0].length >= 1);
        });
      }
      if (st.row && listed === DRAFT.length && grew)
        ok(`The Ledger names any card — the whole roster of ${listed} on the first pick, and it arrives`);
      else bad('The Ledger names any card', [
        `row shown ${st.row}, cards in the row ${st.cards}, listed ${listed} of ${DRAFT.length}, arrived ${grew}`,
        'the first pick of a match is the whole roster or the booster does nothing']);
    } else skipped.push('The Ledger names any card');

    // LIVES CARRY, AND ONLY THE MARKET RESTORES THEM. If they reset, the whole
    // point of the credit decision goes with them.
    if (two && lastLives !== null && two.lives[0] === lastLives && two.lives[1] === 5)
      ok(`lives carry into the next match (${two.lives[0]}) and theirs reset (${two.lives[1]})`);
    else bad('lives carry into the next match', [
      `you went in on ${two && two.lives[0]} after ending the last match on ${lastLives};`
      + ` they went in on ${two && two.lives[1]}`]);

    if (two && two.boosts[0].length === 1 && two.boosts[1].length === 1)
      ok(`a booster each carries into match 2 (you ${two.boosts[0]}, them ${two.boosts[1]})`);
    else bad('a booster each carries into match 2', [
      `you ${two && two.boosts[0]}, them ${two && two.boosts[1]}`]);
  }
}

/* ------------------------ the loser's bonus, with the booster and without it */
// A DIFFERENTIAL, because the absolute is not the claim. "The page offers a
// bonus pick" passes on the build that ignored The Vanguard entirely; what has
// to be true is that holding it changes the round. Two arms identical but for
// one token in `boosts[0]`, resumed from the same seeded save at the moment the
// bonus pick is offered, reading the prompt the player reads.
//
// Seeded rather than played to, because reaching a lost round while holding a
// named booster is not something a suite that plays real matches can arrange --
// the page seeds every match from the clock. This is the one place here that
// constructs a save, and it constructs the save format the page itself writes.
async function bonusRun(boosts) {
  const c = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.goto(base + '/column/index.html', { waitUntil: 'load' });
  await p.evaluate(s => localStorage.setItem('column-save', s), JSON.stringify({
    v: 1, opp: 'harlow', seed: 424242, draw: 0,
    army: [['walker', 'line', 'acid'], ['brute', 'ultra', 'swarm']],
    round: 3, loser: 0, lives: [3, 4], money: [0, 0],
    perRound: [3, 3], boosts: [boosts, []], run: null,
    pending: [[], []], wide: [0, 0],
    phase: 'pick', pickNo: 0, bonus: 0, solo: true, bonusDone: 0,
    offer: ['walker', 'line', 'acid'], mine: null, theirs: null, inspect: null
  }));
  await p.reload({ waitUntil: 'load' });
  await p.click('#resume');
  const prompts = [];
  for (let i = 0; i < 4; i++) {
    await p.waitForSelector('.card', { timeout: 5000 });
    prompts.push((await p.textContent('#prompt')).trim());
    await p.click('.card');
    await p.waitForTimeout(1100);              // the 750ms reveal, with room
  }
  await c.close();
  return { solos: prompts.filter(t => /extra pick/i.test(t)).length, prompts, errs };
}
/* --------------------- the speed control cannot change what happened ---------- */
// HIS NOTE 15, and the only property of it worth a check. `fight()` resolves the
// whole battle and keeps every frame before one is painted, so the multiplier
// only decides how fast an already-decided battle is read out. That is an
// argument; this is the measurement. The SAME seeded save, fought at 0.5x and at
// 2x, must produce the same result, the same survivors and the same lives.
async function fightAt(v) {
  const c = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.goto(base + '/column/index.html', { waitUntil: 'load' });
  await p.evaluate(([save, speed]) => {
    localStorage.setItem('column-save', save);
    localStorage.setItem('column-speed', speed);
  }, [JSON.stringify({
    v: 1, opp: 'harlow', seed: 987654, draw: 0,
    army: [['walker', 'line', 'acid', 'ultra'], ['brute', 'swarm', 'neurite', 'amabie']],
    round: 2, loser: null, lives: [4, 4], money: [0, 0],
    perRound: [3, 3], boosts: [[], []], run: null, bonusDone: 0,
    pending: [[], []], wide: [0, 0],
    phase: 'ready', pickNo: 3, bonus: null,
    offer: [], mine: null, theirs: null, inspect: null
  }), String(v)]);
  await p.reload({ waitUntil: 'load' });
  await p.click('#resume');
  const t0 = Date.now();
  await p.click('#go');                                   // Fight
  await p.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem('column-save') || 'null');
    return s && s.phase !== 'battle' && s.phase !== 'ready';
  }, { timeout: 40000 });
  const ms = Date.now() - t0;
  const out = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('column-save'));
    return { result: s.result, left: s.left, lives: s.lives, round: s.round, paid: s.paid };
  });
  await c.close();
  return { ms, out, errs };
}
const slow = await fightAt(0.5), fast = await fightAt(2);
const same = JSON.stringify(slow.out) === JSON.stringify(fast.out);
if (same && !slow.errs.length && !fast.errs.length && slow.ms > fast.ms)
  ok(`playback speed changes the pace and not the battle (0.5x ${slow.ms}ms, 2x ${fast.ms}ms, same result)`);
else bad('playback speed changes the pace and not the battle', [
  same ? null : `0.5x ${JSON.stringify(slow.out)} vs 2x ${JSON.stringify(fast.out)}`,
  slow.ms > fast.ms ? null : `0.5x took ${slow.ms}ms and 2x took ${fast.ms}ms — the control did nothing`,
  [...slow.errs, ...fast.errs].join('; ') || null]);

const plain = await bonusRun([]);
const vanguard = await bonusRun(['vanguard']);
const wantPlain = bonusPicks([]), wantVan = bonusPicks(['vanguard']);
if (plain.solos === wantPlain && vanguard.solos === wantVan && wantVan > wantPlain
    && !plain.errs.length && !vanguard.errs.length)
  ok(`the loser's bonus is the engine's number — ${plain.solos} pick, ${vanguard.solos} with The Vanguard`);
else bad("the loser's bonus is the engine's number", [
  `no booster: ${plain.solos} bonus picks, expected ${wantPlain} — ${plain.prompts.join(' | ')}`,
  `The Vanguard: ${vanguard.solos}, expected ${wantVan} — ${vanguard.prompts.join(' | ')}`,
  [...plain.errs, ...vanguard.errs].join('; ') || null]);

/* ------------------- an upgraded card says what it does AT ITS LEVEL ---------- */
// `specFor()` is the ONLY place the upgrade rule lives, and for as long as the
// interface existed it never called it once. Every figure on screen -- the stat
// line, every ability sentence, the field inspector -- was read straight off the
// base row, so a level 3 Volt Battery told the player its aura was 1.5 while the
// resolver ran it at 3.07. Nothing threw. The card was not blank or wrong-looking;
// it was a correct sentence about a different card.
//
// SEEDED, because reaching a specific card at a specific level by playing is not
// something a suite can arrange -- the page seeds each match from the clock. And
// driven through the REAL PANEL rather than by calling the formatter: the defect
// was not in the sentence, it was in which object the sentence was handed.
async function inspectAtLevel(id, lvl) {
  const c = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.goto(base + '/column/index.html', { waitUntil: 'load' });
  // `up:<id>` is the engine's own upgrade token -- armyFrom() counts them -- so
  // the army below holds one <id> at level `lvl`.
  const army = [id, ...Array.from({ length: lvl }, () => `up:${id}`), 'walker'];
  await p.evaluate(s => localStorage.setItem('column-save', s), JSON.stringify({
    v: 1, opp: 'harlow', seed: 424242, draw: 0,
    army: [army, ['brute', 'ultra', 'swarm']],
    round: 2, loser: null, lives: [4, 4], money: [0, 0],
    perRound: [3, 3], boosts: [[], []], run: null, bonusDone: 0,
    pending: [[], []], wide: [0, 0],
    phase: 'pick', pickNo: 0, bonus: 0, solo: false,
    offer: ['walker', 'line', 'acid'], mine: null, theirs: null, inspect: null
  }));
  await p.reload({ waitUntil: 'load' });
  await p.click('#resume');
  await p.waitForSelector(`#field g[data-id="${id}"]`, { timeout: 5000 });
  const drawnLvl = await p.getAttribute(`#field g[data-id="${id}"]`, 'data-lvl');
  await p.locator(`#field g[data-id="${id}"]`).first().click();
  const text = (await p.textContent('#info')) || '';
  await c.close();
  return { text, drawnLvl, errs };
}
{
  const LVL = 3, ID = 'volt';                 // the card whose damage is not an attack
  const base = BY_ID[ID], up = specFor(ID, LVL);
  const shown = await inspectAtLevel(ID, LVL);
  const has = v => shown.text.includes(v);
  // The levelled aura must be on screen and the base one must not, which is the
  // pair that tells "it asked specFor" apart from "it happened to say a number".
  const wantAura = String(+(+up.aura).toFixed(1));
  const baseAura = String(+(+base.aura).toFixed(1));
  const why = [
    +shown.drawnLvl === LVL ? null : `the counter reports level ${shown.drawnLvl}, not ${LVL}`,
    has(wantAura) ? null : `the panel never says the levelled aura ${wantAura}`,
    has(baseAura) ? `the panel still says the base aura ${baseAura}` : null,
    /\d\.\d{4,}/.test(shown.text) ? `a raw float reached the screen: ${(shown.text.match(/[\d.]*\d\.\d{4,}/) || [])[0]}` : null,
    shown.errs.join('; ') || null
  ].filter(Boolean);
  if (!why.length)
    ok(`an upgraded card states its own figures — ${base.n} at level ${LVL} reads aura ${wantAura}, not ${baseAura}`);
  else bad('an upgraded card states its own figures', why);
}

await browser.close();
server.close();

console.log(`\n${ran - failed} of ${ran} claims hold`);
if (skipped.length) {
  console.log(`${skipped.length} did not run on this path — the page seeds each match from the clock,`);
  console.log(`so which branch is taken is not this suite's to choose. Re-run to exercise them:`);
  skipped.forEach(m => console.log(`        · ${m}`));
}
console.log(`written to docs/column/test/shots/ (git-ignored): play-maps.png, play-roster.png, play-draft.png, play-inspect.png, play-market.png, play-chooser.png, play-battle.png, play-run.png, play.png\n`);
process.exit(failed ? 1 : 0);
