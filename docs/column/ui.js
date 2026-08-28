// GRANDIOSE — THE COLUMN. The interface, and nothing else.
//
// EVERY RULE IS IN engine.js AND data.js. This file draws, listens and animates.
// It never decides who won, never scores a card, never lays a body out: it asks
// the engine and shows the answer. The Ledger's record is unambiguous about what
// happens otherwise -- a sentence quoting a whole upkeep bill as the cost of one
// vassal was numerically correct and false, and a screen that does its own
// arithmetic is one edit away from disagreeing with the game.
//
// The battle is played back from the resolver's own tick sampler, so what you
// watch IS what was resolved. It cannot drift, because there is nothing to
// drift from.

import { BY_ID, RULES, PERSONAS, UPGRADE, WEIGHT, UNITS, SHOP, RUN, BOOSTS, BY_BOOST,
         COIN, BUILD } from './data.js';
import { rng, offer, resolve, deployment, formation, POLICIES, armyFrom, isUp, tokId,
         earn, stock, spend, upgradeable, boosterOffer,
         offerSize, picksFor, marketEvery, chestFor } from './engine.js';
import { draw, effects, auras, GROUND, SIDE, shape } from './render.js';
import { glyph } from './glyphs.js';

const $ = id => document.getElementById(id);
const el = { bar: $('bar'), la: $('livesA'), lb: $('livesB'), who: $('who'),
             field: $('field'), toast: $('toast'), info: $('info'), prompt: $('prompt'),
             sub: $('sub'), cards: $('cards'), go: $('go'), cash: $('cash') };

const SAVE = 'column-save';
const BEST = 'column-best';
const coin = n => `${COIN}${n}`;
// A battle takes as long as it takes -- 90 ticks or 800 -- and the playback must
// not. The speed is chosen per battle so every round runs for about the same
// four seconds: long enough to watch the lines meet, short enough that a phone
// is not held still through a stalemate.
const PLAYBACK_FRAMES = 230;

// Sam's note 8, and it is his number: 35% slower. It multiplies the pace rather
// than stretching the frame budget, because the budget only governs LONG
// battles -- a short one already plays a tick a frame and could not slow down at
// all without this. A fractional pace repeats frames instead, which is the only
// way to slow a fixed-timestep replay that has no frames in between.
const PACE = 0.65;

// How many ticks of shots a single painted frame shows. Drawing only the ticks
// just stepped over is exactly right and invisible: a short battle plays at one
// tick a frame, so every shot would flash for a single 16ms frame and the field
// would look empty while it was being fought. Four ticks of overlap costs
// nothing and is the difference between seeing fire and not.
const LINGER = 4;

// How long a committed pick stays on screen before the next three cards arrive.
// Sam's note 5: a Continue button after every selection is a tap that carries no
// decision, three times a round, nine rounds a match. The reveal is still the
// point -- you have to SEE what you both took -- so it stays, it just stops
// asking permission to end.
const REVEAL_MS = 750;
let revealTimer = null;

/* ------------------------------------------------------------------- state */
let S = null;

// One seeded stream for the whole match, and a COUNT of how many numbers have
// come off it. That count is the whole of the save format for randomness: on
// resume the stream is rebuilt and spun forward, so a match reloaded on the
// train continues into exactly the draft it would have had.
let stream = null;
const rand = () => { S.draw++; return stream(); };
function rebuild() { stream = rng(S.seed); for (let i = 0; i < S.draw; i++) stream(); }

/**
 * @param {string} opp      persona id
 * @param {object} [run]    { n, credits } when this match is part of a run
 */
function newMatch(opp, run) {
  const n = run ? run.n : 0;
  const boosts = run ? [run.boosts[0].slice(), run.boosts[1].slice()] : [[], []];
  S = {
    v: 1, opp, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, draw: 0,
    army: [[], []], round: 0, loser: null,
    // LIVES CARRY. Only the market restores one, so every purse is a choice
    // between a stronger column now and being alive to draft another.
    lives: [run && RUN.carryLives ? run.lives : RULES.lives, RULES.lives],
    // The opponent's head start and its extra picks are the whole of the ramp,
    // and both are stated on the screen before the match rather than hidden.
    money: [(run ? run.credits : 0) + chestFor(boosts[0]), n * RUN.ramp + chestFor(boosts[1])],
    perRound: [picksFor(boosts[0], 0), picksFor(boosts[1], Math.floor(n / RUN.pickEvery))],
    boosts,
    run: run ? { n, seed: run.seed } : null,
    wide: [0, 0],
    phase: 'pick', pickNo: 0, bonus: null,
    offer: [], mine: null, theirs: null, inspect: null
  };
  rebuild();
  startRound();
}

const bestRun = () => { try { return +localStorage.getItem(BEST) || 0; } catch (e) { return 0; } };
const setBest = n => { try { if (n > bestRun()) localStorage.setItem(BEST, String(n)); } catch (e) {} };

function save() {
  // Frames are the battle replayed body by body -- tens of thousands of objects,
  // and derivable from the seed in a millisecond. Storing them would put a
  // quota failure between the player and their match, which is the Ledger's
  // oldest defect wearing a different hat.
  try {
    localStorage.setItem(SAVE, JSON.stringify(
      { ...S, frames: undefined, lastFrame: undefined, ev: undefined }));
  } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || s.phase === 'over' || !PERSONAS[s.opp]) return false;
    S = s; rebuild();
    // The market arrived mid-development. A match saved before it existed has no
    // purse, and defaulting is kinder than throwing his game away.
    S.money = S.money || [0, 0];
    S.wide = S.wide || [0, 0];
    S.perRound = S.perRound || [RULES.picksPerRound, RULES.picksPerRound];
    S.boosts = S.boosts || [[], []];
    // A battle is not saved mid-playback; a reload lands on the fight instead.
    if (S.phase === 'battle') S.phase = 'ready';
    return true;
  } catch (e) { return false; }
}

/* ----------------------------------------------------------- the round loop */
function startRound() {
  S.pickNo = 0;
  S.bonus = S.loser;            // only the loser of the last round gets one
  S.mine = S.theirs = null;
  next();
}

// Drives the round forward one commitment at a time. Each pick is a blind
// simultaneous commitment: the opponent's answer is computed from the board as
// it stood BEFORE this pick, then both are revealed, which is Sam's structure
// and the reason a persona that reads the board is worth having.
function next() {
  S.inspect = null; el.info.className = '';
  if (S.bonus === 1) {                       // the opponent's extra pick, in the open
    const cards = offer(rand, offerSize(S.boosts[1], S.wide[1]), S.army[1]);
    const tok = cards[POLICIES[S.opp](cards, S.army[1].slice(), S.army[0].slice())];
    S.army[1].push(tok);
    S.bonus = null; S.mine = null; S.theirs = tok;
    return reveal(popKeys(1, tok));
  }
  if (S.bonus === 0) {                       // your extra pick, taken alone
    S.offer = offer(rand, offerSize(S.boosts[0], S.wide[0]), S.army[0]);
    S.solo = true; S.phase = 'pick';
    return render();
  }
  // A ramped opponent drafts more per round than you do. When your picks run
  // out and theirs have not, they take the rest alone and in the open -- the
  // ramp has to be watchable, not just felt.
  if (S.pickNo < Math.max(S.perRound[0], S.perRound[1])) {
    if (S.pickNo >= S.perRound[0]) {
      const c = offer(rand, offerSize(S.boosts[1], S.wide[1]), S.army[1]);
      const tok = c[POLICIES[S.opp](c, S.army[1].slice(), S.army[0].slice())];
      S.army[1].push(tok);
      S.pickNo++;
      S.mine = null; S.theirs = tok;
      return reveal(popKeys(1, tok));
    }
    S.offer = offer(rand, offerSize(S.boosts[0], S.wide[0]), S.army[0]);
    S.withThem = S.pickNo < S.perRound[1];
    if (S.withThem) S.oppOffer = offer(rand, offerSize(S.boosts[1], S.wide[1]), S.army[1]);
    S.solo = false; S.phase = 'pick';
    return render();
  }
  S.phase = 'ready';
  render();
}

function commit(i) {
  S.inspect = null; el.info.className = '';
  const seen = [S.army[0].slice(), S.army[1].slice()];
  const tok = S.offer[i];
  S.army[0].push(tok);
  S.mine = tok; S.theirs = null;
  const keys = popKeys(0, tok);
  if (S.solo) { S.bonus = null; }
  else {
    if (S.withThem) {
      const t = S.oppOffer[POLICIES[S.opp](S.oppOffer, seen[1], seen[0])];
      S.army[1].push(t);
      S.theirs = t;
      keys.push(...popKeys(1, t));
    }
    S.pickNo++;
  }
  reveal(keys);
}

// Which counters this pick lit up. A reinforcement is the card just added; an
// UPGRADE adds nothing to the field, so it lights every copy of the card it
// improved -- which is also the honest picture of what the pick did.
function popKeys(side, tok) {
  const cards = armyFrom(S.army[side]).cards;
  // THROUGH THE FORMATION, not the draft. A counter's key is where the card
  // DEPLOYS, and since note 9 that is no longer where it was picked -- so a ring
  // computed from draft order landed on whatever the sort had put in that slot,
  // which was reliably whatever stood at the front. One function decides the
  // order, and both the field and this now ask it.
  const slot = new Map(formation(cards).map((draftIndex, ci) => [draftIndex, ci]));
  const at = d => side + ':' + slot.get(d);
  if (!isUp(tok)) return [at(cards.length - 1)];
  const id = tokId(tok);
  return cards.map((x, i) => (x === id ? at(i) : null)).filter(Boolean);
}

// Show what was committed, then move on by itself.
function reveal(keys) {
  S.pop = keys;
  S.phase = 'revealed';
  save(); render();
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    if (!S || S.phase !== 'revealed') return;
    S.pop = null;
    S.phase = 'pick';
    next();
  }, REVEAL_MS);
}

function fight() {
  const seed = (S.seed * 7919 + S.round) >>> 0;
  S.frames = [];
  // THE LOG IS ON NOW. It has existed since the engine was written and nothing
  // had ever read it, so a battle was a crowd of markers thinning out for no
  // visible reason: no projectile, no blast, no flinch. Sam's first two notes
  // are both answered by drawing what the resolver already recorded.
  const out = resolve(S.army[0], S.army[1], seed, true, (t, live) => S.frames.push(live));
  // Indexed by tick, so a playback step can ask for the ticks it just skipped
  // rather than for "the last thing that happened".
  S.ev = [];
  for (const entry of out.log) S.ev[entry.t] = entry.ev;
  // The loser is the engine's, not the screen's. A draw costs whoever has fewer
  // left standing, so a stalled field still moves the match on.
  S.result = out.winner === null
    ? (out.left[0] <= out.left[1] ? 0 : 1)
    : 1 - out.winner;
  S.left = out.left;
  S.phase = 'battle'; S.f = 0;
  render();
  play();
}

function play() {
  const speed = Math.max(1, S.frames.length / PLAYBACK_FRAMES) * PACE;
  const step = () => {
    if (S.phase !== 'battle' || !S.frames) return;
    S.f += speed;
    if (S.f >= S.frames.length) { endRound(); return; }
    const now = S.f | 0;
    paint(S.frames[now], now - Math.max(speed, LINGER) + 1, now);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function endRound() {
  // Keep the last frame. What is left standing when a round ends is the only
  // feedback the player gets on what their draft actually did, and clearing it
  // to a fresh deployment throws that away at the exact moment it is useful.
  S.lastFrame = S.frames[S.frames.length - 1] || [];
  S.lives[S.result]--;
  S.loser = S.result;
  S.round++;
  // A wider offer is bought for one round and is spent by having played it.
  S.wide = [0, 0];
  // What the round paid, through the ENGINE's rule and off the resolver's own
  // survivor count. The screen does not get to decide what a body is worth.
  S.paid = earn(S.left || [0, 0], 1 - S.result, S.boosts);
  S.money[0] += S.paid[0];
  S.money[1] += S.paid[1];
  S.phase = S.lives[0] <= 0 || S.lives[1] <= 0 ? 'over' : 'round';
  // Their market is on their cadence, not yours -- a booster can move it -- and
  // it is not gated on you opening yours.
  if (S.phase !== 'over' && S.round % marketEvery(S.boosts[1]) === 0) opponentShops();
  S.frames = null;
  save(); render();
}

// Every third round. The opponent spends at the same moment and by the same
// rules -- its ramp is why a run gets harder, and a market only you could use
// would be a difficulty setting rather than an economy.
const marketDue = () => S.round % marketEvery(S.boosts[0]) === 0 && S.lives[0] > 0 && S.lives[1] > 0;

function buy(item) {
  const cost = item.cost;
  if (S.money[0] < cost) return false;
  S.money[0] -= cost;
  if (item.k === 'life') S.lives[0]++;
  else if (item.k === 'upgrade') S.army[0].push('up:' + item.id);
  else if (item.k === 'card') S.army[0].push(item.id);
  else if (item.k === 'offer') S.wide[0] = 1;
  save();
  return true;
}

function opponentShops() {
  for (const b of spend(S.money[1], S.army[1], S.lives[1])) {
    if (b.k === 'life') { S.lives[1]++; S.money[1] -= SHOP.life; }
    else if (b.k === 'upgrade') { S.army[1].push('up:' + b.id); S.money[1] -= SHOP.upgrade; }
    else if (b.k === 'card') { S.army[1].push(b.id); S.money[1] -= SHOP.card; }
    else if (b.k === 'offer') { S.wide[1] = 1; S.money[1] -= SHOP.offer; }
  }
}

/* ---------------------------------------------------------------- painting */
// `from` and `to` are the tick range this painted step covers. At speed 14 a
// frame skips thirteen ticks, and drawing only the newest one would throw away
// almost every shot fired.
function paint(live, from, to) {
  const bodies = live || [];
  let fx = '', flash = null;
  if (S && S.ev && to !== undefined) {
    const byKey = new Map(bodies.map(u => [u.k, u]));
    const evs = [];
    for (let t = Math.max(0, from); t <= to; t++) if (S.ev[t]) evs.push(...S.ev[t]);
    const out = effects(evs, byKey);
    fx = out.svg; flash = out.flash;
  }
  el.field.innerHTML = GROUND + (bodies.length ? auras(bodies) : '') + fx +
    draw(bodies, { pick: S && S.inspect, flash, pop: S && S.pop && new Set(S.pop) });
}

// What is on the field right now: mid-battle it is the frame being played, and
// between picks it is the deployment the next battle will actually start from --
// asked of the engine rather than laid out here, so the preview cannot show a
// formation the fight does not use.
function board() {
  if (S.phase === 'battle' && S.frames) return S.frames[Math.min(S.f | 0, S.frames.length - 1)];
  if (S.phase === 'round' && S.lastFrame) return S.lastFrame;
  if (!S.army[0].length && !S.army[1].length) return [];
  return deployment(S.army[0], S.army[1], (S.seed * 7919 + S.round) >>> 0);
}

const hearts = n => '&#9829;'.repeat(Math.max(0, n)) +
  `<span class="off">${'&#9829;'.repeat(Math.max(0, RULES.lives - n))}</span>`;

// Short, DERIVED tags. Nothing here is typed into the roster twice: change a
// number in data.js and the card face changes with it.
function traits(u) {
  const t = [];
  // A Volt Battery has range 0 and no attack at all -- it is simply expensive to
  // stand near. The resolver's melee cutoff is <= 4, so reading it straight
  // called the one card that never swings a "melee" unit.
  if (!u.dmg) t.push('no attack');
  else if (u.rng > 4) t.push(`range ${Math.round(u.rng)}`);
  else t.push('melee');
  if (u.move === 'seek') t.push('seeks');
  if (u.splash) t.push('splash');
  if (u.dot) t.push('burns');
  if (u.aura) t.push('aura');
  if (u.defl) t.push('shielded');
  if (u.boom) t.push('detonates');
  if (u.arm >= 8) t.push('armoured');
  return t;
}

// The unit drawn at size, on ink rather than on the field's palette. The card
// is 117x118pt -- sixteen times a counter -- so the detail strokes are on.
const art = (id, px, colour = '#3a2f1e', w = 0.62) =>
  `<svg width="${px}" height="${px}" viewBox="-6 -6 12 12">${glyph(id, 0, 0, 5, colour, w, true)}</svg>`;

function cardFace(tok, i) {
  const up = isUp(tok), id = tokId(tok), u = BY_ID[id];
  const lvl = (armyFrom(S.army[0]).up[id] || 0) + 1;
  const copies = armyFrom(S.army[0]).cards.filter(x => x === id).length;
  const b = document.createElement('button');
  b.className = 'card' + (up ? ' up' : '');
  b.onclick = () => commit(i);
  b.innerHTML = up
    ? `<span class="art up">${art(id, 34)}<span class="chev">&#9650;</span></span>` +
      `<b>${u.n} UP!</b><span class="cls">upgrade</span>` +
      `<span class="hint">+${(UPGRADE.step * 100) | 0}% health &amp; damage<br>` +
      `level ${lvl} of ${UPGRADE.max} &middot; ${copies} on the field</span>`
    : `<span class="art">${art(id, 40)}</span>` +
      `<b>${u.n}</b><span class="cls">${u.w} &middot; ${u.count} ${u.count === 1 ? 'body' : 'bodies'}</span>` +
      // Two at most on a card face now that the drawing has the top of it. The
      // roster and the inspect panel carry all of them.
      `<span class="hint">${traits(u).slice(0, 2).join(' &middot; ')}</span>`;
  return b;
}

function render() {
  el.la.innerHTML = hearts(S.lives[0]);
  el.lb.innerHTML = hearts(S.lives[1]);
  el.cash.textContent = S.money[0] ? coin(S.money[0]) : '';
  el.who.innerHTML = `Round ${S.round + 1} &middot; ${PERSONAS[S.opp].n} &nbsp;&#9776;`;
  paint(board());
  el.cards.innerHTML = '';
  noButton();

  const size = armyFrom(S.army[0]).cards.length;
  const theirs = armyFrom(S.army[1]).cards.length;

  if (S.phase === 'pick') {
    el.prompt.textContent = S.solo ? 'Your extra pick' : `Pick ${S.pickNo + 1} of ${S.perRound[0]}`;
    el.sub.innerHTML = S.solo
      ? `You lost the round, so this one is yours alone &middot; ${size} cards to ${theirs}`
      : `${size} cards to ${theirs} &middot; they are choosing at the same time`;
    S.offer.forEach((tok, i) => el.cards.appendChild(cardFace(tok, i)));
  }

  if (S.phase === 'revealed') {
    el.prompt.textContent = 'Committed';
    el.sub.innerHTML = [
      S.mine ? `<b style="color:var(--blue)">You: ${label(S.mine)}</b>` : '',
      S.theirs ? `<b style="color:var(--amber)">${PERSONAS[S.opp].n}: ${label(S.theirs)}</b>` : ''
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
  }

  if (S.phase === 'ready') {
    el.prompt.textContent = 'The column is drawn up';
    el.sub.textContent = `${size} cards against ${theirs}. Tap a marker to read it.`;
    button('Fight', fight);
  }

  if (S.phase === 'battle') {
    el.prompt.textContent = 'Engaged';
    el.sub.textContent = 'Tap to skip to the result.';
    button('Skip', () => { S.f = S.frames.length; });
    el.go.className = 'ghost';
  }

  if (S.phase === 'round') {
    const won = S.result === 1;
    el.prompt.textContent = won ? 'You hold the field' : 'Your column breaks';
    const pay = S.paid ? S.paid[0] : 0;
    el.sub.textContent = (won ? `${PERSONAS[S.opp].n} drops a life. `
                              : 'You drop a life, and open the next round with an extra pick. ') +
      `${coin(pay)} earned — a purse of ${coin(SHOP.purse)}` +
      (won ? ` and ${S.left[0]} still standing.` : '.');
    if (marketDue()) button('The market', () => market());
    else button('Next round', () => { startRound(); save(); });
  }

  if (S.phase === 'over') return over();
  save();
}

// WHOSE IS IT. Two different questions, and the interface must not blur them:
// whether the LINE is the author's, and whether the UNIT is. The Deflector's
// line is his and the unit is not, and that has to be visible without opening a
// file -- it is the one thing in this game he cannot check for himself.
function provenance(u) {
  if (u.nv) return "invented for the game &middot; the line is the author's";
  return u.qv ? "the author's line" : 'written for the game';
}

const label = tok => isUp(tok)
  ? `${BY_ID[tokId(tok)].n} UP!`
  : `${BY_ID[tok].n} ×${BY_ID[tok].count}`;

// The button always occupies its space and sometimes has nothing in it. Hiding
// it with `hidden` collapsed the deck by fifty-three pixels, and the deck is a
// flex sibling of the field, so the whole battlefield slid down the screen every
// time a pick was made. That is Sam's note 4 and it was never about the cards.
function button(text, fn) {
  el.go.className = '';
  el.go.textContent = text;
  el.go.onclick = fn;
}
function noButton() {
  el.go.className = 'off';
  el.go.textContent = '';
  el.go.onclick = null;
}

/* --------------------------------------------------------------- inspecting */
// A marker answers when you tap it. The quote and, more importantly, WHOSE it
// is: Sam wrote the novel, so a line he did not write must never sit on a card
// looking as though he did.
el.field.addEventListener('click', e => {
  if (!S) return;
  const g = e.target.closest && e.target.closest('g[data-id]');
  if (!g) { S.inspect = null; el.info.className = ''; paint(board()); return; }
  const u = BY_ID[g.dataset.id];
  S.inspect = g.dataset.key;
  // OVER the field, not in the deck. Four lines of answer in the status line
  // resized the deck, and resizing the deck moves the battlefield -- the same
  // fault as the cards, arriving by a different route.
  el.info.className = 'on';
  el.info.innerHTML = `<span class="ill">${art(u.id, 46, SIDE[+g.dataset.side].line, 0.7)}</span>` +
    `<b>${u.n}</b> — ${u.w}, ${u.count} ${u.count === 1 ? 'body' : 'bodies'} ` +
    `&middot; ${traits(u).join(' &middot; ')}<q>${u.q}</q>` +
    `<span class="src">${provenance(u)}</span>`;
  paint(board());
});

/* ------------------------------------------------------------- the overlays */
function sheet(html, centre) {
  const d = document.createElement('div');
  d.className = centre ? 'sheet centre' : 'sheet';
  d.innerHTML = html;
  document.getElementById('app').appendChild(d);
  return d;
}

// THE WAY OUT OF A MATCH. Without this the roster is reachable only before the
// first pick and the opponent cannot be changed without finishing five lives or
// clearing the browser's storage -- which is "technically present but
// unreachable", and reads, correctly, as not shipped.
el.who.addEventListener('click', () => {
  if (!S || document.querySelector('.sheet')) return;
  const d = sheet(`<h1>${PERSONAS[S.opp].n}</h1>
    <p>Round ${S.round + 1}. ${S.lives[0]} ${S.lives[0] === 1 ? 'life' : 'lives'} to
       ${S.lives[1]}, ${armyFrom(S.army[0]).cards.length} cards to
       ${armyFrom(S.army[1]).cards.length}.</p>
    ${S.run ? `<p>Match ${S.run.n + 1} of a run &middot; ${coin(S.money[0])} &middot;
       ${S.lives[0]} ${S.lives[0] === 1 ? 'life' : 'lives'} left, and they are not restored
       between matches.</p>${held(S.boosts[0], 'Your boosters')}${held(S.boosts[1], 'Theirs')}` : ''}
    <button class="pick" id="close"><b>Back to the round</b></button>
    <button class="pick" id="roster2"><b>The roster</b><i>What every card does, and which
      lines are the author's.</i></button>
    <button class="pick" id="quit"><b>Abandon and start again</b><i>Choose a different
      opponent. This match is not kept.</i></button>
    <div class="foot">${BUILD}</div>`, true);
  d.querySelector('#close').onclick = () => d.remove();
  d.querySelector('#roster2').onclick = () => roster();
  d.querySelector('#quit').onclick = () => {
    try { localStorage.removeItem(SAVE); } catch (e) {}
    clearTimeout(revealTimer);
    S = null;
    document.querySelectorAll('.sheet').forEach(x => x.remove());
    paint([]);
    menu();
  };
});

function menu() {
  const saved = localStorage.getItem(SAVE) && load();
  const d = sheet(`
    <h1>The Column</h1>
    <p>Five lives. Three picks a round, committed blind and revealed together. The round
    ends when one column is gone; the loser drops a life and opens the next one with an
    extra pick. Nothing in a battle is random — the same two armies always fight the same
    fight, so the whole game is what you drafted.</p>
    ${saved ? `<h2>In progress</h2><button class="pick" id="resume"><b>Resume — round ${S.round + 1}
       against ${PERSONAS[S.opp].n}</b><i>${S.lives[0]} lives to ${S.lives[1]}</i></button>` : ''}
    <h2>A run</h2>
    <button class="pick" id="run"><b>Begin a run</b><i>Match after match. Your column is
      drafted again each time; your credits and your remaining lives carry, and only the
      market sells a life back. A booster after every match survived — three offered to you,
      one drawn for them.${bestRun() ? ` Best so far: ${bestRun()} matches.` : ''}</i></button>
    <h2>Or a single match</h2>
    ${Object.entries(PERSONAS).filter(([k]) => POLICIES[k]).map(([k, p]) =>
      `<button class="pick" data-opp="${k}"><b>${p.n}</b><i>${p.d}</i></button>`).join('')}
    <h2>Reference</h2>
    <button class="pick" id="roster"><b>The roster</b><i>All twelve cards, what they do,
      and which lines are the author's.</i></button>
    <div class="foot">${BUILD}</div>`);

  d.querySelectorAll('[data-opp]').forEach(b =>
    b.onclick = () => { document.querySelectorAll('.sheet').forEach(x => x.remove()); newMatch(b.dataset.opp); });
  d.querySelector('#run').onclick = () => {
    document.querySelectorAll('.sheet').forEach(x => x.remove());
    newMatch(RUN.order[0], { n: 0, credits: 0, lives: RULES.lives, boosts: [[], []],
                             seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
  };
  const r = d.querySelector('#resume');
  // A match saved mid-reveal has no timer waiting to advance it -- the timer
  // does not survive a closed tab. Advancing is the same call the timer would
  // have made, off the same seeded stream, so the offer is the one it would
  // have given.
  if (r) r.onclick = () => {
    d.remove();
    if (S.phase === 'revealed') { S.pop = null; S.phase = 'pick'; next(); }
    else render();
  };
  d.querySelector('#roster').onclick = () => roster();
}

function roster() {
  // The counter exactly as the field draws it, beside the name. That mapping is
  // the whole of learning the game, and a roster that draws it differently
  // teaches the wrong thing.
  const row = u => {
    const s = { heavy: 3.7, medium: 3.2, light: 2.9 }[u.w];
    return `<div class="rosterRow">
      <svg width="38" height="38" viewBox="-5 -5 10 10">${shape(u.w, 0, 0, s, SIDE[0].fill, SIDE[0].line)}
        ${glyph(u.id, 0, 0, s * 0.62, SIDE[0].ink, 1.15)}</svg>
      <div><b>${u.n}</b> <em>${u.w} · ${u.count} ${u.count === 1 ? 'body' : 'bodies'}</em>
        <em style="display:block">${traits(u).join(' · ')}</em>
        <q>${u.q}</q><span class="src">${provenance(u)}</span></div>
    </div>`;
  };
  const d = sheet(`<h1>The roster</h1>
    <p><b>Square</b> is heavy — one body, hard to shift. <b>Diamond</b> is medium — two
    bodies, one job each. <b>Circle</b> is light — three bodies, strong in numbers and soft
    to anything that hits an area. The drawing inside a marker is the card; its colour is
    the side. A mark only has to be told from the three others in its own shape.</p>
    ${UNITS.map(row).join('')}
    <p style="margin-top:18px">Every unit is from <i>Grandiose: The Rise to Power</i>, and
    every line on this page is checked word by word against the manuscript. Anything marked
    <b>invented for the game</b> is mine and is the first thing to strike.</p>
    <button class="pick" id="back"><b>Back</b></button>`);
  d.querySelector('#back').onclick = () => d.remove();
}

// THE MARKET. It sells what the draft cannot promise you: a card by name rather
// than a random offer, a level on a card you choose, a life, a wider offer next
// round. Money buying certainty is what makes a drafting game feel like it is
// going somewhere; a shop selling a damage multiplier sells nothing.
function market() {
  const items = stock(S.money[0], S.army[0], S.lives[0]);
  const up = upgradeable(S.army[0]);

  const line = (it, i) => {
    if (it.k === 'card') return `<button class="pick" data-i="${i}"><b>A card of your choosing — ${coin(it.cost)}</b>
      <i>Any one of the twelve, named rather than offered.</i></button>`;
    if (it.k === 'upgrade') return `<button class="pick" data-i="${i}"><b>An upgrade — ${coin(it.cost)}</b>
      <i>+${(UPGRADE.step * 100) | 0}% health and damage on every copy of a card you name.
      ${up.length} to choose from.</i></button>`;
    if (it.k === 'offer') return `<button class="pick" data-i="${i}"><b>A wider offer — ${coin(it.cost)}</b>
      <i>Four cards instead of three, next round only.</i></button>`;
    return `<button class="pick" data-i="${i}"><b>A life — ${coin(it.cost)}</b>
      <i>Back to ${S.lives[0] + 1} of ${RULES.lives}.</i></button>`;
  };

  const d = sheet(`<h1>The market</h1>
    <p>Round ${S.round}. You have <b>${coin(S.money[0])}</b>${S.money[1] ? `; ${PERSONAS[S.opp].n} spent theirs already` : ''}.</p>
    ${items.length ? items.map(line).join('') : '<p>Nothing here you can afford yet.</p>'}
    <button class="pick" id="leave"><b>Leave the market</b><i>What you keep carries to the next
      market.</i></button>`, items.length < 3);

  d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
    const it = items[+b.dataset.i];
    if (it.k === 'card') { d.remove(); return chooser('card'); }
    if (it.k === 'upgrade') { d.remove(); return chooser('upgrade'); }
    if (buy(it)) { d.remove(); market(); }
  });
  d.querySelector('#leave').onclick = () => { d.remove(); startRound(); save(); };
}

// CHOOSING WHICH is the whole reason either item is worth buying, so both open
// the same screen: the cards, drawn as they will stand on the field.
const MARK = { heavy: 3.7, medium: 3.2, light: 2.9 };
function chooser(kind) {
  const list = kind === 'card'
    ? UNITS.map(u => ({ id: u.id }))
    : upgradeable(S.army[0]);
  const cost = kind === 'card' ? SHOP.card : SHOP.upgrade;
  const d = sheet(`<h1>${kind === 'card' ? 'Choose a card' : 'Choose an upgrade'}</h1>
    <p>${coin(cost)} spent. ${kind === 'card'
        ? 'It joins your column where its role puts it, like any other.'
        : `+${(UPGRADE.step * 100) | 0}% health and damage on every copy you hold.`}</p>
    ${list.map(it => { const u = BY_ID[it.id]; return `<button class="pick shopRow" data-id="${u.id}">
      <svg width="34" height="34" viewBox="-5 -5 10 10">${shape(u.w, 0, 0, MARK[u.w], SIDE[0].fill, SIDE[0].line)}
        ${glyph(u.id, 0, 0, MARK[u.w] * 0.62, SIDE[0].ink, 1.15)}</svg>
      <span><b>${u.n}${kind === 'upgrade' ? ` to level ${it.lvl}` : ''}</b><i>${kind === 'upgrade'
        ? `${it.held} on the field · ${traits(u).join(' · ')}`
        : `${u.w} · ${u.count} ${u.count === 1 ? 'body' : 'bodies'} · ${traits(u).join(' · ')}`}</i></span>
    </button>`; }).join('')}
    <button class="pick" id="never"><b>Change your mind</b></button>`);
  d.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
    buy({ k: kind, id: b.dataset.id, cost });
    d.remove(); market();
  });
  d.querySelector('#never').onclick = () => { d.remove(); market(); };
}

function over() {
  const won = S.lives[1] <= 0;
  const opp = PERSONAS[S.opp].n;
  const mine = armyFrom(S.army[0]);
  const ups = S.army[0].filter(isUp).length;
  const run = S.run;
  const credits = S.money[0];
  try { localStorage.removeItem(SAVE); } catch (e) {}
  clearTimeout(revealTimer);

  // IN A RUN, a win is not an ending. The score is how far you got, so a win
  // rolls straight into the next opponent and only a loss stops.
  if (run && won) {
    const nextN = run.n + 1;
    setBest(nextN);
    const lives = S.lives[0];
    const boosts = [S.boosts[0].slice(), S.boosts[1].slice()];
    // Three to you, one at random to them, off the run's own seed so the same
    // run offers the same choices however many times it is reloaded.
    const r = rng((run.seed * 7717 + run.n) >>> 0);
    const mine = boosterOffer(r, boosts[0]);
    const theirs = boosterOffer(rng((run.seed * 7717 + run.n + 1013) >>> 0), boosts[1]);
    if (theirs.length) boosts[1].push(theirs[0]);

    const carryOn = () => {
      document.querySelectorAll('.sheet').forEach(x => x.remove());
      newMatch(RUN.order[nextN % RUN.order.length],
               { n: nextN, credits, lives, boosts, seed: run.seed });
    };

    const onward = () => {
      document.querySelectorAll('.sheet').forEach(x => x.remove());
      const d2 = sheet(`<h1>Match ${nextN}</h1>
        ${held(boosts[0], 'Yours')}${held(boosts[1], 'Theirs')}
        ${nextMatchNote(nextN, lives)}
        <button class="pick" id="on"><b>March on</b></button>
        <button class="pick" id="stop"><b>End the run here</b><i>Best so far: ${bestRun()} matches.</i></button>`);
      d2.querySelector('#on').onclick = carryOn;
      d2.querySelector('#stop').onclick = () => {
        document.querySelectorAll('.sheet').forEach(x => x.remove());
        S = null; paint([]); menu();
      };
    };

    const d = sheet(`<h1>Match ${run.n + 1} survived</h1>
      <p>${opp} is out of lives after ${S.round} rounds. You carry <b>${coin(credits)}</b> and
         <b>${lives} ${lives === 1 ? 'life' : 'lives'}</b> forward — lives are not restored
         between matches, only bought. Your column is drafted again from nothing.</p>
      ${mine.length ? `<h2>Take one</h2>${mine.map(id => `<button class="pick" data-b="${id}">
        <b>${BY_BOOST[id].n}</b><i>${BY_BOOST[id].d}</i></button>`).join('')}
        ${theirs.length ? `<p style="margin-top:14px">${opp} takes
          <b>${BY_BOOST[theirs[0]].n}</b> — theirs is drawn, yours is chosen.</p>` : ''}`
      : '<p>Every booster is already taken.</p>'}`, !mine.length);

    if (!mine.length) {
      const b = document.createElement('button');
      b.className = 'pick'; b.innerHTML = '<b>On</b>';
      b.onclick = onward; d.appendChild(b);
    }
    d.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
      boosts[0].push(b.dataset.b);
      onward();
    });
    return;
  }

  const d = sheet(`<h1>${won ? 'The field is yours' : 'The column is broken'}</h1>
    <p>${won ? `${opp} is out of lives after ${S.round} rounds.`
             : `${opp} takes it after ${S.round} rounds.`}</p>
    ${run ? `<h2>The run ends</h2><p>You survived <b>${run.n}</b>
       ${run.n === 1 ? 'match' : 'matches'} before this one. Best: ${bestRun()}.</p>` : ''}
    <h2>Your column</h2>
    <p>${mine.cards.length} cards${ups ? `, ${ups} pick${ups === 1 ? '' : 's'} spent on upgrades` : ''} —
       ${mine.cards.reduce((n, id) => n + BY_ID[id].count, 0)} bodies at the end.
       ${S.lives[0]} ${S.lives[0] === 1 ? 'life' : 'lives'} left, ${coin(credits)} unspent.</p>
    <button class="pick" id="again"><b>Again</b></button>`, true);
  d.querySelector('#again').onclick = () => {
    document.querySelectorAll('.sheet').forEach(x => x.remove());
    S = null; paint([]); menu();
  };
}

// What the next opponent brings. Stated, so a loss is legible rather than
// mysterious -- the ramp is the thing you are running from and hiding it turns
// a run into a difficulty setting nobody chose.
function nextMatchNote(n, lives) {
  const opp = PERSONAS[RUN.order[n % RUN.order.length]];
  const extra = Math.floor(n / RUN.pickEvery);
  return `<h2>Next: ${opp.n}</h2><p>${opp.d}</p>
    <p>They begin with <b>${coin(n * RUN.ramp)}</b>${extra
      ? ` and draft <b>${RULES.picksPerRound + extra}</b> cards a round` : ''}, at
      full strength. You go in on <b>${lives} ${lives === 1 ? 'life' : 'lives'}</b>.</p>`;
}

// What a side is carrying. Named on the screen, because a booster you cannot see
// is a rule change you did not agree to.
const held = (list, who) => list.length
  ? `<h2>${who}</h2><p>${list.map(id => `<b>${BY_BOOST[id].n}</b> — ${BY_BOOST[id].d}`).join('<br>')}</p>`
  : '';

/* -------------------------------------------------------------------- start */
paint([]);
menu();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
}
