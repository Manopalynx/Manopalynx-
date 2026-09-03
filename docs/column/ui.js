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

import { BY_ID, RULES, PERSONAS, UPGRADE, DRAFT, SPECIALS, SHOP, RUN,
         BY_BOOST, BY_KIT, BY_ORDER, SABOTAGE, COIN, BUILD, TICK, BY_MAP,
         TERRAIN, groundSays } from './data.js';
import { rng, offer, resolve, deployment, formation, POLICIES, armyFrom, isUp, tokId, specFor,
         earn, stock, spend, upgradeable, specialsFor, kitFor, ordersFor, boosterOffer,
         offerSize, offerFor, picksFor, pickTokens, bonusPicks,
         rampFor, mends, carried } from './engine.js';
import { draw, effects, auras, ground, SIDE, shape } from './render.js';
import { glyph } from './glyphs.js';

const $ = id => document.getElementById(id);
const el = { bar: $('bar'), la: $('livesA'), lb: $('livesB'), who: $('who'),
             field: $('field'), toast: $('toast'), info: $('info'), prompt: $('prompt'),
             sub: $('sub'), cards: $('cards'), go: $('go'), cash: $('cash'),
             speed: $('speed') };

const SAVE = 'column-save';
const BEST = 'column-best';
const SPEED = 'column-speed';
const coin = n => `${COIN}${n}`;
// Defensively split on `:`, for the same reason `has()` in the engine still
// matches on a prefix: no booster carries an argument now that Standing muster
// is gone, and the cost of keeping the handling is a `split` while the cost of
// dropping it is the next one that needs an argument silently not working.
const boostOf = b => BY_BOOST[b.split(':')[0]];
const boostLabel = b => {
  const def = boostOf(b), arg = b.split(':')[1];
  return arg ? `${def.n} — ${BY_ID[arg].n}` : def.n;
};
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

// HIS NOTE 15. A multiplier ON TOP of that, so 1x is the pace he asked for in
// note 8 and somebody who never touches this sees no change at all.
//
// IT CANNOT MOVE AN OUTCOME. `fight()` resolves the whole battle and keeps the
// frames before a single one is painted, so this only decides how fast an
// already-decided battle is read out -- there is nothing downstream of it but
// the screen. A seeded match plays the same match at every speed.
//
// Persisted, because a speed you re-set every round is worse than no speed.
const SPEEDS = [0.5, 1, 2];
let mult = 1;
try { const v = +localStorage.getItem(SPEED); if (SPEEDS.includes(v)) mult = v; } catch (e) {}
function setSpeed(v) {
  mult = v;
  try { localStorage.setItem(SPEED, String(v)); } catch (e) {}
  speedRow();
}
// Drawn only during a battle, because that is the only place it does anything.
function speedRow(on) {
  if (on === false) { el.speed.className = 'off'; el.speed.innerHTML = ''; return; }
  if (on === true) el.speed.className = '';
  if (el.speed.className === 'off') return;
  el.speed.innerHTML = SPEEDS.map(v =>
    `<button data-v="${v}" class="${v === mult ? 'on' : ''}">${v}&times;</button>`).join('');
  el.speed.querySelectorAll('[data-v]').forEach(b =>
    b.onclick = () => setSpeed(+b.dataset.v));
}

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

/** The terrain of the map this match is fought on, or null for a flat field.
 *  His note 20: terrain is FIXED PER MAP, so it is a property of the opponent
 *  you are facing rather than a roll, and it is knowable before the first pick.
 *  One derivation, read by the resolver, the renderer and the text. */
/** THE FIRST PICK OF A ROUND, which is when The Ledger fires. Once a MATCH was
 *  built first and measured +0.05 at 0.6 sigma -- one free pick in twenty-one is
 *  nothing. Once a round is +0.22 at 2.8 sigma, the same size as The Vanguard.
 *
 *  IT DOES NOT READ `S.solo`, and that is the whole of a bug this file caught in
 *  its own new code. The first version did -- and `S.solo = false` is assigned
 *  AFTER the offer is built, so it was reading the previous round's value and the
 *  booster never fired. A live reference read after a later step has mutated it
 *  is the defect this record already carried twice; this was the third.
 *
 *  A bonus pick passes `false` at its own call site instead. That is exact
 *  rather than inferred: a bonus pick only exists after a round has been lost,
 *  so it can never be the first pick of a match. */
const firstOfRound = () => S && S.pickNo === 0;

export const terrainOf = opp => (PERSONAS[opp] && BY_MAP[PERSONAS[opp].map] || {}).terrain || null;

/** THE GROUND, AS A PANEL RATHER THAN A SENTENCE.
 *
 *  Five of the nine grounds now do two things, and the single line they used to
 *  carry had become the kind of run-on a player stops reading -- which would
 *  make the whole "terrain is visible before the draft" decision worthless,
 *  because a rule nobody reads is a rule nobody has.
 *
 *  One clause a property, each generated from the number it describes, so the
 *  screen cannot say 45% while the resolver uses 55%. */
const groundPanel = (t, tag = 'p') => {
  const g = TERRAIN[t];
  if (!g) return '';
  const lines = groundSays(g).map(l => `<span class="gl">${l}</span>`).join('');
  return `<${tag} class="ground"><b>${g.n}</b>${lines}</${tag}>`;
};

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
    // THE COMPACT is the only thing that carries a card between matches, and the
    // card is the engine's answer rather than this file's.
    army: [(run && run.keep) || [], []], round: 0, loser: null,
    // LIVES CARRY. Only the market restores one, so every purse is a choice
    // between a stronger column now and being alive to draft another.
    lives: [run && RUN.carryLives ? run.lives : RULES.lives, RULES.lives],
    // The opponent's head start and its extra picks are the whole of the ramp,
    // and both are stated on the screen before the match rather than hidden.
    money: [run ? run.credits : 0, rampFor(boosts[0], n)],
    perRound: [picksFor(boosts[0], 0), picksFor(boosts[1], Math.floor(n / RUN.pickEvery))],
    boosts,
    run: run ? { n, seed: run.seed } : null,
    // Bought for the coming round and spent by fighting it: orders a side gave
    // itself, and sabotage the other side paid to put on it.
    pending: [[], []],
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
    // A match saved before the loser's bonus was counted rather than cleared.
    S.bonusDone = S.bonusDone || 0;
    S.boosts = S.boosts || [[], []];
    S.pending = S.pending || [[], []];
    // A battle is not saved mid-playback; a reload lands on the fight instead.
    if (S.phase === 'battle') S.phase = 'ready';
    return true;
  } catch (e) { return false; }
}

/* ----------------------------------------------------------- the round loop */
function startRound() {
  S.pickNo = 0;
  S.bonus = S.loser;            // only the loser of the last round gets one
  // HOW MANY of them is the ENGINE's answer, not a shape in this file. It was
  // one, hardcoded as a state machine that cleared `bonus` after a single pick,
  // and `bonusPicks()` -- the function that reads The Vanguard -- had exactly one
  // caller in the repository: `playMatch`, which is the sweep. So the booster
  // measured +0.18 matches in `match.mjs` and did nothing whatever on the phone,
  // for both sides, while the suite's claim "the pool has no dead option" stayed
  // green because it never loads this file. Counted rather than stored as a
  // remaining tally, so a match saved mid-bonus resumes with the right number.
  S.bonusDone = 0;
  S.mine = S.theirs = null;
  next();
}

// A bonus pick has been taken. The loser opens with `bonusPicks()` of them --
// one, or two with The Vanguard -- and only when they are all spent does the
// round move on to the picks both sides make together.
function bonusSpent(side) {
  S.bonusDone = (S.bonusDone || 0) + 1;
  if (S.bonusDone >= bonusPicks(S.boosts[side])) S.bonus = null;
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
    S.army[1].push(...pickTokens(S.boosts[1], tok));
    bonusSpent(1);
    S.mine = null; S.theirs = tok;
    return reveal(popKeys(1, tok));
  }
  if (S.bonus === 0) {                       // your extra pick, taken alone
    S.offer = offerFor(rand, S.boosts[0], S.wide[0], S.army[0], false);
    S.solo = true; S.phase = 'pick';
    return render();
  }
  // A ramped opponent drafts more per round than you do. When your picks run
  // out and theirs have not, they take the rest alone and in the open -- the
  // ramp has to be watchable, not just felt.
  if (S.pickNo < Math.max(S.perRound[0], S.perRound[1])) {
    if (S.pickNo >= S.perRound[0]) {
      const c = offerFor(rand, S.boosts[1], S.wide[1], S.army[1], firstOfRound());
      const tok = c[POLICIES[S.opp](c, S.army[1].slice(), S.army[0].slice())];
      S.army[1].push(...pickTokens(S.boosts[1], tok));
      S.pickNo++;
      S.mine = null; S.theirs = tok;
      return reveal(popKeys(1, tok));
    }
    S.offer = offerFor(rand, S.boosts[0], S.wide[0], S.army[0], firstOfRound());
    S.withThem = S.pickNo < S.perRound[1];
    if (S.withThem) S.oppOffer = offerFor(rand, S.boosts[1], S.wide[1], S.army[1], firstOfRound());
    S.solo = false; S.phase = 'pick';
    return render();
  }
  S.phase = 'ready';
  render();
}

/** THE LEDGER'S SHEET. The roster's own row, made tappable -- the same drawing
 *  the field uses beside the same stat line, because a card named here has to be
 *  recognisable as the counter it becomes. */
function namePick() {
  const rows = S.offer.map((tok, i) => {
    const u = BY_ID[tokId(tok)];
    const sz = { heavy: 3.7, medium: 3.2, light: 2.9 }[u.w];
    return `<button class="pick shopRow tall" data-pick="${i}">
      <svg width="34" height="34" viewBox="-5 -5 10 10">${shape(u.w, 0, 0, sz, SIDE[0].fill, SIDE[0].line)}
        ${glyph(u.id, 0, 0, sz * 0.62, SIDE[0].ink, 1.15)}</svg>
      <span><b>${u.n}</b><i>${u.w} &middot; ${u.count} ${u.count === 1 ? 'body' : 'bodies'} &middot; ${statLine(u)}</i>
        <div class="abs">${abilityList(u)}</div></span>
    </button>`;
  }).join('');
  const d = sheet(`<h1>Name a card</h1>
    <p>The Ledger: your first pick of the match is any card in the roster, named
       rather than offered. It joins your column where its role puts it, like any other.</p>
    ${rows}`);
  d.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    d.remove();
    commit(+b.dataset.pick);
  });
}

function commit(i) {
  S.inspect = null; el.info.className = '';
  const seen = [S.army[0].slice(), S.army[1].slice()];
  const tok = S.offer[i];
  S.army[0].push(...pickTokens(S.boosts[0], tok));
  S.mine = tok; S.theirs = null;
  const keys = popKeys(0, tok);
  if (S.solo) { bonusSpent(0); }
  else {
    if (S.withThem) {
      const t = S.oppOffer[POLICIES[S.opp](S.oppOffer, seen[1], seen[0])];
      S.army[1].push(...pickTokens(S.boosts[1], t));
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
  // THE GROUND IS DERIVED IN ONE PLACE and read by both the resolver and the
  // renderer, so the field cannot draw a band the battle did not fight on --
  // which is the same rule the replay log exists to enforce for everything else.
  const out = resolve([...S.army[0], ...S.pending[0]], [...S.army[1], ...S.pending[1]],
                      seed, true, (t, live) => S.frames.push(live), terrainOf(S && S.opp),
                      [S.boosts[0], S.boosts[1]]);
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
  // Read every step rather than captured once, so changing it mid-battle takes
  // effect on the next frame instead of the next round.
  const speed = () => Math.max(1, S.frames.length / PLAYBACK_FRAMES) * PACE * mult;
  const step = () => {
    if (S.phase !== 'battle' || !S.frames) return;
    const v = speed();
    S.f += v;
    if (S.f >= S.frames.length) { endRound(); return; }
    const now = S.f | 0;
    paint(S.frames[now], now - Math.max(v, LINGER) + 1, now);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function endRound() {
  // Keep the last frame. What is left standing when a round ends is the only
  // feedback the player gets on what their draft actually did, and clearing it
  // to a fresh deployment throws that away at the exact moment it is useful.
  S.lastFrame = S.frames[S.frames.length - 1] || [];
  // FIELD SURGEONS. The first life a side loses in a match is given back, once,
  // and `mends()` is the engine's answer to whether it holds -- not a flag here.
  S.mended = S.mended || [0, 0];
  if (mends(S.boosts[S.result]) && !S.mended[S.result]) S.mended[S.result] = 1;
  else S.lives[S.result]--;
  S.loser = S.result;
  S.round++;
  // A wider offer, an order and a sabotage are all bought for one round and are
  // spent by having played it.
  S.wide = [0, 0];
  S.pending = [[], []];
  // What the round paid, through the ENGINE's rule and off the resolver's own
  // survivor count. The screen does not get to decide what a body is worth.
  S.paid = earn(S.left || [0, 0], 1 - S.result);
  S.money[0] += S.paid[0];
  S.money[1] += S.paid[1];
  S.phase = S.lives[0] <= 0 || S.lives[1] <= 0 ? 'over' : 'round';
  // Their market is on their cadence, not yours -- a booster can move it -- and
  // it is not gated on you opening yours.
  if (S.phase !== 'over' && S.round % SHOP.every === 0) opponentShops();
  S.frames = null;
  save(); render();
}

// Every third round. The opponent spends at the same moment and by the same
// rules -- its ramp is why a run gets harder, and a market only you could use
// would be a difficulty setting rather than an economy.
const marketDue = () => S.round % SHOP.every === 0 && S.lives[0] > 0 && S.lives[1] > 0;

function buy(item) {
  // A special is priced on the card, not in SHOP -- three prices, three cards,
  // and one place each of them lives.
  const cost = item.k === 'special' ? BY_ID[item.id].cost : item.cost;
  if (S.money[0] < cost) return false;
  S.money[0] -= cost;
  if (item.k === 'life') S.lives[0]++;
  else if (item.k === 'upgrade') S.army[0].push('up:' + item.id);
  else if (item.k === 'card' || item.k === 'special') S.army[0].push(item.id);
  else if (item.k === 'kit') S.army[0].push('eq:' + item.id);
  else if (item.k === 'order') S.pending[0].push('ord:' + item.id);
  // Sabotage travels in THEIR list, because that is where it takes effect.
  else if (item.k === 'sabotage') S.pending[1].push('sab:' + item.id);
  else if (item.k === 'offer') S.wide[0] = 1;
  save();
  return true;
}

function opponentShops() {
  for (const b of spend(S.money[1], S.army[1], S.lives[1], S.army[0], S.boosts[1])) {
    if (b.k === 'life') { S.lives[1]++; S.money[1] -= SHOP.life; }
    else if (b.k === 'upgrade') { S.army[1].push('up:' + b.id); S.money[1] -= SHOP.upgrade; }
    else if (b.k === 'card') { S.army[1].push(b.id); S.money[1] -= SHOP.card; }
    else if (b.k === 'special') { S.army[1].push(b.id); S.money[1] -= BY_ID[b.id].cost; }
    else if (b.k === 'kit') { S.army[1].push('eq:' + b.id); S.money[1] -= BY_KIT[b.id].cost; }
    else if (b.k === 'order') { S.pending[1].push('ord:' + b.id); S.money[1] -= BY_ORDER[b.id].cost; }
    else if (b.k === 'sabotage') { S.pending[0].push('sab:' + b.id); S.money[1] -= SABOTAGE.cost; }
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
  // THE GROUND IS THE OPPONENT'S. Cosmetic, so nothing downstream of this knows
  // which map it is -- the resolver is not told and does not ask.
  el.field.innerHTML = ground(S && PERSONAS[S.opp] && PERSONAS[S.opp].map, terrainOf(S && S.opp)) +
    (bodies.length ? auras(bodies) : '') + fx +
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
  return deployment([...S.army[0], ...S.pending[0]], [...S.army[1], ...S.pending[1]],
                    (S.seed * 7919 + S.round) >>> 0);
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

// WHAT A TAG MEANS, and it is his note 11. `splash` on a card said nothing about
// hitting everything within 8 for half damage; `shielded` said nothing about
// refusing ranged fire and only ranged fire, which is the whole Kraken idea out
// of the book. The counter graph IS the game -- 86% of pairings are decided --
// and until this it could only be learned by watching a battle and guessing.
//
// MECHANISM ONLY, which is Sam's ruling: what the card does, not what beats it.
//
// AND EVERY NUMBER IS READ, NOT TYPED. Each figure below comes from the same
// field the resolver reads, so a wrong radius on screen, a wrong sentence and a
// wrong fight are one defect rather than three. That is the only reason this can
// be added to fifteen cards without becoming fifteen places to go stale.
const secs = ticks => `${+(ticks * TICK).toFixed(1)}s`;
const AIM = { big: 'the biggest thing it can reach', back: 'whatever stands furthest back',
              near: 'whatever is nearest' };
function abilities(u) {
  const a = [];
  if (u.dmg) a.push([`${u.rng > 4 ? `Shoots ${Math.round(u.rng)} away` : 'Fights in reach'}`,
    `${num(u.dmg)} damage every ${secs(u.rate)}, at ${AIM[u.tgt] || AIM.near}.`]);
  else a.push(['Never attacks', 'It carries no weapon at all — it is simply expensive to stand near.']);
  if (u.move === 'seek') a.push(['Seeks',
    `Leaves the line and crosses the field for ${AIM[u.tgt] || AIM.near}, at ${u.spd} a tick.`]);
  else a.push(['Marches', 'Holds formation and advances with the column, at the column\'s pace.']);
  if (u.drop) a.push(['Drops in', 'Lands at the line of contact rather than marching to it.']);
  if (u.splash) a.push(['Splash',
    `Every hit also catches anything within ${u.splash} of the target, for half.`]);
  if (u.dot) a.push(['Burns',
    `A hit leaves ${num(u.dot, 1)} a tick for ${secs(u.dotT)}, and burning is not reduced by armour.`]);
  if (u.aura) a.push(['Aura',
    `Everything within ${u.auraR} takes ${num(u.aura, 1)} a tick. No attack, no target, nothing to block.`]);
  if (u.defl) a.push(['Shielded',
    `Refuses ${Math.round(u.defl * 100)}% of damage from anything shooting past 4 — and only that. Slow things pass straight through.`]);
  if (u.boom) a.push(['Detonates',
    `When it dies it takes ${num(u.boom.d)} off everything within ${u.boom.r}.`]);
  if (u.arm) a.push(['Armour',
    `${num(u.arm)} off every hit that lands, to a floor of 1. Burning ignores it.`]);
  return a;
}
const abilityList = u => abilities(u)
  .map(([n, d]) => `<span class="ab"><b>${n}</b> ${d}</span>`).join('');

// THE CARD AS PRINTED, in one line. Damage as a rate rather than a number and a
// cooldown, because that is the figure `paper()` already uses to compare cards
// and two numbers do not fit; per CARD rather than per body, because a pick buys
// a card. `spd` is deliberately NOT here for a marching card: doubling it
// changes 0 of 23 battles for each of the nine line cards and ~100% for each of
// the three seekers, so printing it on a Walker would print a number the game
// does not read.
const dps = u => Math.round(u.dmg * 10 / u.rate) * (u.count || 1);
// PER CARD, both of them, because a pick buys a card rather than a body. The
// figures fit one fixed line together and `3 x 180 hp . 103 dps` does not -- it
// wrapped, and the box that stops a tall card moving the battlefield would have
// eaten the second line without a word. The body count is on the tag line below,
// where the weight class already is, so nothing is lost by shortening this.
// EVERY SCALED FIGURE GOES THROUGH HERE. A base card carries clean integers, so
// for as long as the screen read the base row nothing needed rounding. The
// moment it reads specFor() it is reading `hp * (1 + 0.35 * lvl)` in floating
// point, and a level 3 Volt Battery's aura is 3.0749999999999997 -- which would
// have printed, in full, on a phone. Whole numbers for the big ones, one decimal
// for the small, and a trailing `.0` stripped so an upgraded aura reads `2`
// rather than `2.0` beside a base one reading `1.5`.
const num = (v, dp = 0) => String(+(+v).toFixed(dp));
const statLine = u => `${num(u.hp * (u.count || 1))} hp &middot; ` +
  (u.dmg ? `${dps(u)} dps` : 'no attack');
// WHAT AN UPGRADE GIVES *THIS* CARD, derived from the same fields specFor()
// scales rather than typed once for all fifteen. The line said "+35% hp &
// damage" on every card -- including the Volt Battery, whose own stat line says
// "no attack" because its damage is an aura that needs no attack. A player
// reading those two sentences together correctly concludes the upgrade is half
// wasted on it, and it is not: the aura is exactly the thing that grows.
// Two terms, because `.stat` is a 12px box with overflow:hidden and a third
// term wraps it into a silent clip -- that is note 4, and it has bitten twice.
const upChannel = u => u.dmg ? 'damage' : u.aura ? 'aura'
  : u.dot ? 'burn' : u.boom ? 'detonation' : 'damage';
const upSays = u => `+${(UPGRADE.step * 100) | 0}% hp &amp; ${upChannel(u)}`;
// The card's tag line: what it is, how many, how it moves, and the two traits
// that make it itself. Movement is stated for BOTH kinds -- "marches" is not the
// absence of "seeks", and a card silent about moving teaches nothing.
const cardTags = u => [`${u.w}${u.count > 1 ? ` &times;${u.count}` : ''}`,
  u.move === 'seek' ? `seeks at ${u.spd}` : 'marches',
  ...traits(u).filter(t => t !== 'seeks').slice(0, 2)].join(' &middot; ');

// The unit drawn at size, on ink rather than on the field's palette. The card
// is 117x118pt -- sixteen times a counter -- so the detail strokes are on.
const art = (id, px, colour = '#3a2f1e', w = 0.62) =>
  `<svg width="${px}" height="${px}" viewBox="-6 -6 12 12">${glyph(id, 0, 0, 5, colour, w, true)}</svg>`;

function cardFace(tok, i) {
  const up = isUp(tok), id = tokId(tok), base = BY_ID[id];
  const held = armyFrom(S.army[0]).up[id] || 0;
  // The card as YOU hold it. A card you have not upgraded returns the base row
  // untouched, so nothing moves for a card at level 0 -- specFor returns the
  // very same object when there is no level, no kit, no order and no sabotage.
  const u = specFor(id, held);
  const lvl = held + 1;
  const copies = armyFrom(S.army[0]).cards.filter(x => x === id).length;
  const b = document.createElement('button');
  b.className = 'card' + (up ? ' up' : '');
  b.onclick = () => commit(i);
  b.innerHTML = up
    // THE SAME FIXED SLOTS as a reinforcement, because they are the same box and
    // a second layout is a second thing to overflow. The old face put the effect,
    // the level and the copies in one `hint` -- three lines of content in a box
    // that holds two, clipped in silence the moment the lines got fixed heights.
    ? `<span class="art up">${art(id, 32)}<span class="chev">&#9650;</span></span>` +
      `<b>${u.n} UP!</b>` +
      `<span class="stat">${upSays(base)}</span>` +
      `<span class="hint">level ${lvl} of ${UPGRADE.max}</span>` +
      `<span class="held">${copies} on the field</span>`
    : `<span class="art">${art(id, 32)}</span>` +
      `<b>${u.n}</b><span class="cls">${u.w} &middot; ${u.count} ${u.count === 1 ? 'body' : 'bodies'}</span>` +
      // HIS NOTE 13, in one line. The card row is a fixed 132px box with
      // `overflow:hidden` -- that is note 4, and the deck is a flex sibling of
      // the field, so a deck that grows moves the battlefield. Three stat lines
      // do not fit and would be clipped SILENTLY; one does.
      `<span class="stat">${statLine(u)}</span>` +
      // Two traits at most on a card face now that the drawing has the top of it.
      // The roster and the inspect panel carry all of them, with what each means.
      `<span class="hint">${cardTags(u)}</span>` +
      // HIS NOTE 12. Cards, not bodies -- one counter on the field is one card,
      // and a pick buys a card. It was already shown on an UPGRADE face, where
      // it is the number that decides whether the upgrade is worth taking, and
      // nowhere on a reinforcement, where it is the number that decides whether
      // you are stacking or spreading. Always shown, including "none", because a
      // count present on some cards and absent on others reads as an omission
      // rather than as a zero.
      `<span class="held">${copies ? `${copies} on the field` : 'none yet'}</span>`;
  return b;
}

function render() {
  speedRow(false);
  el.la.innerHTML = hearts(S.lives[0]);
  el.lb.innerHTML = hearts(S.lives[1]);
  el.cash.textContent = S.money[0] ? coin(S.money[0]) : '';
  // THE GROUND IS NAMED IN THE BAR, because it was only readable on the chooser
  // -- a screen you pass through once, before a match that runs nine rounds. The
  // name is the reminder; the panel behind this header is the explanation.
  {
    const gn = TERRAIN[terrainOf(S.opp)];
    el.who.innerHTML = `Round ${S.round + 1} &middot; ${PERSONAS[S.opp].n}` +
      (gn ? ` &middot; <span class="gname">${gn.n}</span>` : '') + ` &nbsp;&#9776;`;
  }
  paint(board());
  el.cards.innerHTML = '';
  noButton();

  const size = armyFrom(S.army[0]).cards.length;
  const theirs = armyFrom(S.army[1]).cards.length;

  if (S.phase === 'pick') {
    const bonus = bonusPicks(S.boosts[0]);
    el.prompt.textContent = S.solo
      ? (bonus > 1 ? `Your extra pick ${(S.bonusDone || 0) + 1} of ${bonus}` : 'Your extra pick')
      : `Pick ${S.pickNo + 1} of ${S.perRound[0]}`;
    el.sub.innerHTML = S.solo
      ? `You lost the round, so ${bonus > 1 ? 'these are' : 'this one is'} yours alone &middot; ${size} cards to ${theirs}`
      : `${size} cards to ${theirs} &middot; they are choosing at the same time`;
    // THE LEDGER'S OFFER IS THE WHOLE ROSTER, which is twelve cards and will not
    // go in a row built for three. The row is fixed at 132px because the deck is
    // a flex sibling of the battlefield, and twelve cards in it would be 24px
    // each -- the note about the stat line clipping at FOUR is two screens up.
    //
    // So the row carries one button and the choosing happens on a sheet, where
    // there is room to read a card before naming it. `commit(i)` indexes
    // `S.offer` either way, so the two paths are the same pick.
    if (S.offer.length > offerSize(S.boosts[0], 1)) {
      el.sub.innerHTML = `Name any of the ${S.offer.length} &middot; ${size} cards to ${theirs}` +
        (S.withThem ? ' &middot; they are choosing at the same time' : '');
      const b = document.createElement('button');
      b.className = 'card ledgerAll';
      b.innerHTML = '<b>Name any card</b><span class="hint">The Ledger &middot; the whole roster is yours to choose from</span>';
      b.onclick = namePick;
      el.cards.appendChild(b);
    } else {
      S.offer.forEach((tok, i) => el.cards.appendChild(cardFace(tok, i)));
    }
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
    el.sub.textContent = 'Set the pace, or tap to skip to the result.';
    button('Skip', () => { S.f = S.frames.length; });
    el.go.className = 'ghost';
    speedRow(true);
  }

  if (S.phase === 'round') {
    const won = S.result === 1;
    el.prompt.textContent = won ? 'You hold the field' : 'Your column breaks';
    const pay = S.paid ? S.paid[0] : 0;
    el.sub.textContent = (won ? `${PERSONAS[S.opp].n} drops a life. `
                              : `You drop a life, and open the next round with ${
                                  bonusPicks(S.boosts[0]) > 1
                                    ? `${bonusPicks(S.boosts[0])} extra picks`
                                    : 'an extra pick'}. `) +
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
  // AT THE LEVEL IT IS. Every figure below -- the stat line and every ability
  // sentence -- used to be read off the base card, so a level 3 Volt Battery
  // said its aura was 1.5 while the resolver was running it at 2.06. specFor is
  // the only place the upgrade rule lives; the screen has to ask it too, or the
  // rule exists twice and the second copy is the one the player reads.
  const u = specFor(g.dataset.id, +g.dataset.lvl || 0);
  S.inspect = g.dataset.key;
  // OVER the field, not in the deck. Four lines of answer in the status line
  // resized the deck, and resizing the deck moves the battlefield -- the same
  // fault as the cards, arriving by a different route.
  el.info.className = 'on';
  el.info.innerHTML = `<span class="ill">${art(u.id, 46, SIDE[+g.dataset.side].line, 0.7)}</span>` +
    `<b>${u.n}</b> — ${u.w}, ${u.count} ${u.count === 1 ? 'body' : 'bodies'} ` +
    `&middot; ${statLine(u)}` +
    `<div class="abs">${abilityList(u)}</div>` +
    `<q>${u.q}</q><span class="src">${provenance(u)}</span>`;
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
  const here = BY_MAP[PERSONAS[S.opp].map];
  const d = sheet(`<h1>${PERSONAS[S.opp].n}</h1>
    <p class="where"><b>${PERSONAS[S.opp].f}</b> &middot; ${here ? here.n : ''}</p>
    ${groundPanel(here && here.terrain)}
    ${here ? `<q class="mapq">${here.q}</q>` : ''}
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
      `<button class="pick" data-opp="${k}"><b>${p.n}</b><i>${p.f} &middot; ${
        BY_MAP[p.map] ? BY_MAP[p.map].n : ''}<br>${p.d}${
        // BEFORE THE FIRST PICK, and that is Sam's decision rather than a
        // convenience: a board you cannot see until after you have committed a
        // draft is a coin flip, and a board you can see turns the draft into
        // "answer this ground" instead of "answer these three cards". It is on
        // the chooser because that is the last screen before a card is taken.
        groundPanel(BY_MAP[p.map] && BY_MAP[p.map].terrain, 'span')}</i></button>`).join('')}
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
      <div><b>${u.n}</b> <em>${u.w} · ${u.count} ${u.count === 1 ? 'body' : 'bodies'}${
        u.sp ? ` · ${COIN}${u.cost} at the market` : ''}</em>
        <em style="display:block">${statLine(u)}</em>
        <div class="abs">${abilityList(u)}</div>
        <q>${u.q}</q><span class="src">${provenance(u)}</span></div>
    </div>`;
  };
  const d = sheet(`<h1>The roster</h1>
    <p><b>Square</b> is heavy — one body, hard to shift. <b>Diamond</b> is medium — two
    bodies, one job each. <b>Circle</b> is light — three bodies, strong in numbers and soft
    to anything that hits an area. The drawing inside a marker is the card; its colour is
    the side. A mark only has to be told from the three others in its own shape.</p>
    ${DRAFT.map(row).join('')}
    <h2>Bought, never dealt</h2>
    <p>One of each weight class, once each. The draft never offers them; the market sells
    them, and they cost more than a market's takings — which is what makes saving a
    decision.</p>
    ${SPECIALS.map(row).join('')}
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
  const items = stock(S.money[0], S.army[0], S.lives[0], S.army[1], S.boosts[0]);
  const up = upgradeable(S.army[0]);

  const spec = specialsFor(S.money[0], S.army[0], S.boosts[0]);
  const kit = kitFor(S.money[0], S.army[0], S.boosts[0]);
  // HOW FAR OFF, derived rather than left to be worked out. A row you cannot
  // buy is only a plan if it says what the plan costs.
  const short = it => it.afford ? '' :
    ` <span class="far">${coin(it.cost - S.money[0])} more</span>`;
  // A "from" shelf names everything on it with its price, because the point of
  // showing what you cannot afford is knowing which one to save for.
  const priced = list => list.map(x => `${BY_ID[x.id] ? BY_ID[x.id].n : BY_KIT[x.id].n} ${coin(x.cost)}`).join(', ');
  const body = it => {
    if (it.k === 'special') return [`A special — from ${coin(it.cost)}`,
      `One of each weight class, once each, and the draft never offers them. ${priced(spec)}.`];
    if (it.k === 'card') return [`A card of your choosing — ${coin(it.cost)}`,
      `Any one of the ${DRAFT.length}, named rather than offered.`];
    if (it.k === 'upgrade') return [`An upgrade — ${coin(it.cost)}`,
      `+${(UPGRADE.step * 100) | 0}% health and damage on every copy of a card you name. ${up.length} to choose from.`];
    if (it.k === 'kit') return [`Kit — from ${coin(it.cost)}`,
      `Fitted to a role rather than a card, and it stays with you for the rest of this match. ${priced(kit)}.`];
    if (it.k === 'order') return [`An order — from ${coin(it.cost)}`,
      'Next round only. Given before the fight, because nothing is commanded during one.'];
    if (it.k === 'sabotage') return [`Sabotage — ${coin(it.cost)}`,
      `One card of theirs deploys on ${(SABOTAGE.left * 100) | 0}% health next round. The only thing here that makes them weaker rather than you stronger.`];
    if (it.k === 'offer') return [`A wider offer — ${coin(it.cost)}`,
      'Four cards instead of three, next round only.'];
    return [`A life — ${coin(it.cost)}`, `Back to ${S.lives[0] + 1} of ${RULES.lives}.`];
  };
  // OUT OF REACH IS STILL ON THE SHELF, and it is not a button. `disabled` keeps
  // it out of the tab order and off the tap target, so the row reads as a price
  // rather than as something that failed to respond.
  const line = (it, i) => {
    const [head, note] = body(it);
    return `<button class="pick${it.afford ? '' : ' cant'}" ${it.afford ? `data-i="${i}"` : 'disabled'}>
      <b>${head}${short(it)}</b><i>${note}</i></button>`;
  };

  const afford = items.filter(x => x.afford).length;
  const d = sheet(`<h1>The market</h1>
    <p>Round ${S.round}. You have <b>${coin(S.money[0])}</b>${
      afford ? '' : ' — not enough for anything yet, so this is what to save for'}${
      S.money[1] ? `; ${PERSONAS[S.opp].n} spent theirs already` : ''}.</p>
    ${items.map(line).join('')}
    <button class="pick" id="leave"><b>Leave the market</b><i>What you keep carries to the next
      market.</i></button>`, items.length < 3);

  d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
    const it = items[+b.dataset.i];
    if (it.k === 'card') { d.remove(); return chooser('card'); }
    if (it.k === 'upgrade') { d.remove(); return chooser('upgrade'); }
    if (it.k === 'special') { d.remove(); return chooser('special'); }
    if (it.k === 'kit') { d.remove(); return plainChooser('kit'); }
    if (it.k === 'order') { d.remove(); return plainChooser('order'); }
    if (it.k === 'sabotage') { d.remove(); return chooser('sabotage'); }
    if (buy(it)) { d.remove(); market(); }
  });
  d.querySelector('#leave').onclick = () => { d.remove(); startRound(); save(); };
}

// CHOOSING WHICH is the whole reason either item is worth buying, so both open
// the same screen: the cards, drawn as they will stand on the field.
const MARK = { heavy: 3.7, medium: 3.2, light: 2.9 };
// Kit and orders are not cards, so they get a plain list rather than the field's
// counters. Two screens rather than one because they are two kinds of thing, and
// a chooser that draws a Kraken beside "Ablative plate" teaches the wrong shape.
function plainChooser(kind) {
  const list = kind === 'kit' ? kitFor(S.money[0], S.army[0], S.boosts[0])
                              : ordersFor(S.money[0], S.boosts[0]);
  const by = kind === 'kit' ? BY_KIT : BY_ORDER;
  const d = sheet(`<h1>${kind === 'kit' ? 'Choose your kit' : 'Give an order'}</h1>
    <p>${kind === 'kit'
      ? 'Fitted to a role rather than a card, and it stays with you for the rest of this match.'
      : 'It holds for the next round only, and it is given now because nothing is commanded during a battle.'}</p>
    ${list.map(it => `<button class="pick" ${it.afford ? `data-id="${it.id}" data-cost="${it.cost}"` : 'disabled'}
        style="${it.afford ? '' : 'opacity:.45'}">
      <b>${by[it.id].n} — ${coin(it.cost)}</b><i>${by[it.id].d}</i></button>`).join('')}
    <button class="pick" id="never"><b>Change your mind</b></button>`, list.length < 3);
  d.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
    buy({ k: kind, id: b.dataset.id, cost: +b.dataset.cost });
    d.remove(); market();
  });
  d.querySelector('#never').onclick = () => { d.remove(); market(); };
}

function chooser(kind) {
  const list = kind === 'card' ? DRAFT.map(u => ({ id: u.id }))
             : kind === 'special' ? specialsFor(S.money[0], S.army[0], S.boosts[0])
             : kind === 'sabotage' ? [...new Set(armyFrom(S.army[1]).cards)].map(id => ({ id, cost: SABOTAGE.cost, afford: true }))
             : upgradeable(S.army[0]);
  const flat = kind === 'card' ? SHOP.card
             : kind === 'upgrade' ? SHOP.upgrade : null;
  const title = { card: 'Choose a card', upgrade: 'Choose an upgrade', special: 'Choose a special',
                  sabotage: 'Choose a target' }[kind];
  const intro = {
    card: `${coin(SHOP.card)} spent. It joins your column where its role puts it, like any other.`,
    upgrade: `${coin(SHOP.upgrade)} spent. +${(UPGRADE.step * 100) | 0}% health and damage on every copy you hold.`,
    special: 'One of each weight class, once each. The draft never offers these — they are bought or they are not had.',
    sabotage: `${coin(SABOTAGE.cost)} spent. Their card deploys on ${(SABOTAGE.left * 100) | 0}% health next round — every copy of it.`
  }[kind];

  // A sabotage chooser shows THEIR counters, in their colour, because that is
  // what you are picking off the other half of the field.
  const side = kind === 'sabotage' ? 1 : 0;
  // HIS NOTE 16. A special costs 70 to 90 -- more than a whole market's takings --
  // and until now the row said its traits and no more, so the biggest purchase in
  // the game was the one made with the least to go on. The card chooser is the
  // same screen and the same code path, and Sam asked for it there too.
  //
  // The upgrade and sabotage rows keep the compact note: both name a card already
  // on the field, which the player has been looking at all match, and both need
  // the COUNT more than the mechanism.
  const full = kind === 'card' || kind === 'special';
  const row = it => {
    const u = BY_ID[it.id];
    const cost = flat === null ? it.cost : flat;
    const can = flat !== null || it.afford;
    const note = kind === 'upgrade' ? `${it.held} on the field · ${traits(u).join(' · ')}`
      : kind === 'sabotage' ? `${armyFrom(S.army[1]).cards.filter(x => x === it.id).length} of them · ${traits(u).join(' · ')}`
      : `${u.w} · ${u.count} ${u.count === 1 ? 'body' : 'bodies'} · ${statLine(u)}`;
    return `<button class="pick shopRow${full ? ' tall' : ''}" ${can ? `data-id="${u.id}" data-cost="${cost}"` : 'disabled'}
        style="${can ? '' : 'opacity:.45'}">
      <svg width="34" height="34" viewBox="-5 -5 10 10">${shape(u.w, 0, 0, MARK[u.w], SIDE[side].fill, SIDE[side].line)}
        ${glyph(u.id, 0, 0, MARK[u.w] * 0.62, SIDE[side].ink, 1.15)}</svg>
      <span><b>${u.n}${kind === 'upgrade' ? ` to level ${it.lvl}` : ''}${
        kind === 'special' ? ` — ${coin(cost)}` : ''}</b><i>${note}</i>${
        full ? `<div class="abs">${abilityList(u)}</div>` : ''}</span>
    </button>`;
  };

  const d = sheet(`<h1>${title}</h1><p>${intro}</p>
    ${list.map(row).join('')}
    <button class="pick" id="never"><b>Change your mind</b></button>`);
  d.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
    buy({ k: kind, id: b.dataset.id, cost: +b.dataset.cost });
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
    // TWO CAPTURES WITH DIFFERENT TIMING, and the difference is the whole of
    // Sam's bug report.
    //
    // The ARMY is copied now, because `carryOn` fires later and a live reference
    // read after a later step is a defect this record already carries twice.
    //
    // The BOOSTERS are read at the tap, deliberately, because the booster chosen
    // on this very screen has to count. It used to be read here, before the
    // choice -- so taking The Compact carried nothing into the next match and
    // first paid a match later. The sweep did the same thing, which is why the
    // suite never saw it; he found it by playing and reading "0 cards to 0".
    const finishedArmy = S.army[0].slice();
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
               { n: nextN, credits, lives, boosts, seed: run.seed,
                 keep: carried(boosts[0], finishedArmy) });
    };

    const onward = () => {
      document.querySelectorAll('.sheet').forEach(x => x.remove());
      const d2 = sheet(`<h1>Match ${nextN}</h1>
        ${held(boosts[0], 'Yours')}${held(boosts[1], 'Theirs')}
        ${nextMatchNote(nextN, lives, boosts)}
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
          <b>${boostLabel(theirs[0])}</b> — theirs is drawn, yours is chosen.</p>` : ''}`
      : '<p>Every booster is already taken.</p>'}`, !mine.length);

    if (!mine.length) {
      const b = document.createElement('button');
      b.className = 'pick'; b.innerHTML = '<b>On</b>';
      b.onclick = onward; d.appendChild(b);
    }
    d.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
      // Three offered and the whole pool is three, so the decision is the ORDER
      // you take them in -- Veterans first compounds hardest, the fourth pick
      // pays sooner. Theirs is drawn; that asymmetry is the whole of the choice.
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
    <!-- "bodies at the end" was the size of the column you FINISHED WITH, which is
         what this number is, and it is read by someone who has just watched that
         column be wiped out -- so on the screen that says "The column is broken"
         it claimed 34 bodies where there were none. The digit was right and the
         sentence was false, which is the worse of the two. -->
    <p>${mine.cards.length} cards${ups ? `, ${ups} pick${ups === 1 ? '' : 's'} spent on upgrades` : ''} —
       ${mine.cards.reduce((n, id) => n + BY_ID[id].count, 0)} bodies on the field in the last round.
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
//
// AND THE FIGURE IS THE ONE THE MATCH WILL USE. It read
// `RULES.picksPerRound + extra` -- the ramp alone -- while `newMatch` sets their
// picks with `picksFor(boosts, extra)`, which also counts A fourth pick. So a
// screen naming their booster four lines above ("Theirs: A fourth pick — four
// picks a round instead of three") stated four in the paragraph below it when
// the answer was five, and said nothing at all for the first two matches, where
// the ramp is zero and the booster is not. One function decides how many picks a
// side gets, and this asks it.
function nextMatchNote(n, lives, boosts) {
  const opp = PERSONAS[RUN.order[n % RUN.order.length]];
  const picks = picksFor(boosts[1], Math.floor(n / RUN.pickEvery));
  const here = BY_MAP[opp.map];
  return `<h2>Next: ${opp.n}</h2>
    <p class="where"><b>${opp.f}</b>${here ? ` &middot; ${here.n}` : ''}</p>
    ${here ? `<q class="mapq">${here.q}</q>` : ''}
    <p>${opp.d}</p>
    <p>They begin with <b>${coin(rampFor(boosts[0], n))}</b>${picks > RULES.picksPerRound
      ? ` and draft <b>${picks}</b> cards a round` : ''}, at
      full strength. You go in on <b>${lives} ${lives === 1 ? 'life' : 'lives'}</b>.</p>`;
}

// What a side is carrying. Named on the screen, because a booster you cannot see
// is a rule change you did not agree to.
const held = (list, who) => list.length
  ? `<h2>${who}</h2><p>${list.map(b => `<b>${boostLabel(b)}</b> — ${boostOf(b).d}`).join('<br>')}</p>`
  : '';

/* -------------------------------------------------------------------- start */
paint([]);
menu();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
}
