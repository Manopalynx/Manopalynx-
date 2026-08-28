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

import { BY_ID, RULES, PERSONAS, UPGRADE, WEIGHT, UNITS, BUILD } from './data.js';
import { rng, offer, resolve, deployment, POLICIES, armyFrom, isUp, tokId } from './engine.js';
import { draw, effects, auras, GROUND, SIDE, shape } from './render.js';
import { glyph } from './glyphs.js';

const $ = id => document.getElementById(id);
const el = { bar: $('bar'), la: $('livesA'), lb: $('livesB'), who: $('who'),
             field: $('field'), toast: $('toast'), info: $('info'), prompt: $('prompt'),
             sub: $('sub'), cards: $('cards'), go: $('go') };

const SAVE = 'column-save';
// A battle takes as long as it takes -- 90 ticks or 800 -- and the playback must
// not. The speed is chosen per battle so every round runs for about the same
// four seconds: long enough to watch the lines meet, short enough that a phone
// is not held still through a stalemate.
const PLAYBACK_FRAMES = 230;

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

function newMatch(opp) {
  S = {
    v: 1, opp, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, draw: 0,
    army: [[], []], lives: [RULES.lives, RULES.lives], round: 0, loser: null,
    phase: 'pick', pickNo: 0, bonus: null,
    offer: [], mine: null, theirs: null, inspect: null
  };
  rebuild();
  startRound();
}

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
    const cards = offer(rand, RULES.offer, S.army[1]);
    const tok = cards[POLICIES[S.opp](cards, S.army[1].slice(), S.army[0].slice())];
    S.army[1].push(tok);
    S.bonus = null; S.mine = null; S.theirs = tok;
    return reveal(popKeys(1, tok));
  }
  if (S.bonus === 0) {                       // your extra pick, taken alone
    S.offer = offer(rand, RULES.offer, S.army[0]);
    S.solo = true; S.phase = 'pick';
    return render();
  }
  if (S.pickNo < RULES.picksPerRound) {
    S.offer = offer(rand, RULES.offer, S.army[0]);
    S.oppOffer = offer(rand, RULES.offer, S.army[1]);
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
    const t = S.oppOffer[POLICIES[S.opp](S.oppOffer, seen[1], seen[0])];
    S.army[1].push(t);
    S.theirs = t;
    S.pickNo++;
    keys.push(...popKeys(1, t));
  }
  reveal(keys);
}

// Which counters this pick lit up. A reinforcement is the card just added; an
// UPGRADE adds nothing to the field, so it lights every copy of the card it
// improved -- which is also the honest picture of what the pick did.
function popKeys(side, tok) {
  const cards = armyFrom(S.army[side]).cards;
  if (!isUp(tok)) return [side + ':' + (cards.length - 1)];
  const id = tokId(tok);
  return cards.map((x, i) => (x === id ? side + ':' + i : null)).filter(Boolean);
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
  S.phase = 'battle'; S.f = 0;
  render();
  play();
}

function play() {
  const speed = Math.max(1, Math.ceil(S.frames.length / PLAYBACK_FRAMES));
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
  S.phase = S.lives[0] <= 0 || S.lives[1] <= 0 ? 'over' : 'round';
  S.frames = null;
  save(); render();
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
  el.who.innerHTML = `Round ${S.round + 1} &middot; ${PERSONAS[S.opp].n} &nbsp;&#9776;`;
  paint(board());
  el.cards.innerHTML = '';
  noButton();

  const size = armyFrom(S.army[0]).cards.length;
  const theirs = armyFrom(S.army[1]).cards.length;

  if (S.phase === 'pick') {
    el.prompt.textContent = S.solo ? 'Your extra pick' : `Pick ${S.pickNo + 1} of ${RULES.picksPerRound}`;
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
    el.sub.textContent = won
      ? `${PERSONAS[S.opp].n} drops a life. You have ${S.lives[0]}.`
      : `You drop a life — and open the next round with an extra pick.`;
    button('Next round', () => { startRound(); save(); });
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
    <h2>Choose your opponent</h2>
    ${Object.entries(PERSONAS).filter(([k]) => POLICIES[k]).map(([k, p]) =>
      `<button class="pick" data-opp="${k}"><b>${p.n}</b><i>${p.d}</i></button>`).join('')}
    <h2>Reference</h2>
    <button class="pick" id="roster"><b>The roster</b><i>All twelve cards, what they do,
      and which lines are the author's.</i></button>
    <div class="foot">${BUILD}</div>`);

  d.querySelectorAll('[data-opp]').forEach(b =>
    b.onclick = () => { document.querySelectorAll('.sheet').forEach(x => x.remove()); newMatch(b.dataset.opp); });
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

function over() {
  const won = S.lives[1] <= 0;
  const opp = PERSONAS[S.opp].n;
  const mine = armyFrom(S.army[0]);
  const ups = S.army[0].filter(isUp).length;
  try { localStorage.removeItem(SAVE); } catch (e) {}
  clearTimeout(revealTimer);
  const d = sheet(`<h1>${won ? 'The field is yours' : 'The column is broken'}</h1>
    <p>${won ? `${opp} is out of lives after ${S.round} rounds.`
             : `${opp} takes it after ${S.round} rounds.`}</p>
    <h2>Your column</h2>
    <p>${mine.cards.length} cards${ups ? `, ${ups} pick${ups === 1 ? '' : 's'} spent on upgrades` : ''} —
       ${mine.cards.reduce((n, id) => n + BY_ID[id].count, 0)} bodies at the end.
       ${S.lives[0]} ${S.lives[0] === 1 ? 'life' : 'lives'} left.</p>
    <button class="pick" id="again"><b>Again</b></button>`, true);
  d.querySelector('#again').onclick = () => {
    document.querySelectorAll('.sheet').forEach(x => x.remove());
    S = null; paint([]); menu();
  };
}

/* -------------------------------------------------------------------- start */
paint([]);
menu();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
}
