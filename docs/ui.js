// Interface for Grandiose — The Ledger. Everything DOM lives here; nothing in
// this file decides a rule. The engine is asked what is true and told what the
// player did, and it never waits — it hands back the path a piece took and this
// file animates it.

import {
  SETS, BOARD, N, JAIL, GOTO, FLEETS, UTILS, TRAFFIC, FLEET_RENT, PERSONAS, RULES, EPIGRAPH, CONTINGENCY, COLUMN,
  BUILD
} from './data.js';
import * as E from './engine.js';
import { Score, moodFor } from './score.js';
import { startGalaxy } from './galaxy.js';
import * as Sound from './audio.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'grandiose-ledger-v1';
const PIPS = ['#D9A441', '#5ECFC8', '#E0776A', '#8B7DD8'];

let G = null;
let anim = null;          // {i, pos} — a piece mid-walk, overriding its real square
let selected = -1;
let busy = false;         // an opponent is thinking; suppress human input

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = E.money;

/* ============================================================ save */
function save() {
  if (!G) return;
  try { localStorage.setItem(SAVE_KEY, E.serialize(G)); }
  catch { /* private mode, or full — the game continues either way */ }
}
function loadSaved() {
  try { return E.deserialize(localStorage.getItem(SAVE_KEY) || ''); }
  catch { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to do */ }
}

/* ============================================================ setup */
// One seat by default, because the ordinary way this is played is one person on
// one phone against the opponents — and a default of two meant changing it every
// single time.
//
// The names are the book's, and which ones is not arbitrary: four seats should
// be four allegiances, or the table is one side of a war arguing with itself.
// Spector is the Leader's own instrument, so Samuel already brings the Union.
//
//   Samuel  the Union
//   Vex     nobody's. A pirate captain of the Raven's Claw, "a vessel assembled
//           from the corpses of at least nine other vessels", hired by the Union
//           and then found "taking the very freighters whose cargoes had paid
//           them". Bought, and not owned — which is the whole game.
//   Rourke  the resistance, holding Horizon
//   Ondh    Basileia. Doctor Sera Ondh, who brings up a map of Basileian space
//           with three systems ringed in amber.
//
// The first attempt here was Samuel, Hale, Rourke, Harlow, and it was wrong:
// Hale commands Samuel and Harlow leads the Union's military, so three of the
// four seats were Union. Corrected by the author. The mistake was mine and it
// was a specific one — I read the line "Eden," Hale said as an allegiance when
// it is a man naming a destination, and built a faction out of two words.
//
// All four are one word, which is what the player chips show.
const setup = {
  humans: 1,
  names: ['Samuel', 'Vex', 'Rourke', 'Ondh'],
  ais: [],
  circuits: 72
};

function drawSetup() {
  const saved = loadSaved();
  const seatsUsed = setup.humans + setup.ais.length;
  const free = 4 - seatsUsed;
  $('setup').innerHTML = `
    <h1>Grandiose<em>THE LEDGER</em></h1>
    <div class="quote">${esc(EPIGRAPH.text)}<b>— ${esc(EPIGRAPH.cite)}</b></div>
    ${saved ? `<button class="big" id="resume">Resume the game in progress</button>` : ''}
    <div class="fld"><label>Humans at the table</label>
      <div class="opts">${[1, 2, 3, 4].map(k =>
        `<button class="opt${setup.humans === k ? ' on' : ''}" data-h="${k}">${k}</button>`).join('')}</div>
      <p class="note" style="margin-top:10px">Four seats in all, however they are shared out.
      The phone gets passed: sealed bids and contracts are one player's eyes only.</p>
    </div>
    <div class="fld" id="nameWrap"></div>
    <div class="fld"><label>Opponents — ${free === 0 ? 'the table is full'
        : `${free} seat${free > 1 ? 's' : ''} free`}</label>
      ${Object.entries(PERSONAS).map(([k, a]) => {
        const on = setup.ais.includes(k);
        // Greyed at 0.45 when simply not chosen, and further when there is no
        // room left — an unselected card and an unselectable one looked alike,
        // so a full table read as three opponents refusing to be tapped.
        const shut = !on && free === 0;
        return `<div class="aiCard" data-a="${k}" style="border-left-color:${a.c};
            opacity:${on ? 1 : shut ? .2 : .45}">
          <div class="pip" style="background:${a.c};margin-top:6px"></div>
          <div><div class="n">${esc(a.n)}${on ? ' ✓' : ''}</div><div class="d">${esc(a.d)}</div></div>
        </div>`;
      }).join('')}
    </div>
    <div class="fld"><label>Circuits before the swarm arrives</label>
      <div class="opts">${[48, 72, 120].map(k =>
        `<button class="opt${setup.circuits === k ? ' on' : ''}" data-t="${k}">${k}</button>`).join('')}</div>
      <p class="note" style="margin-top:10px">Something is coming from outside the galaxy and
      it does not negotiate. This is how long you have before it gets here — and whoever holds
      the most when it does, held the most. The deep array will keep you posted.</p>
    </div>
    <div class="fld"><label>Sound</label>
      <div class="opts">${[['1', 'On'], ['0', 'Off']].map(([v, n]) =>
        `<button class="opt${(Sound.isOn() ? '1' : '0') === v ? ' on' : ''}" data-snd="${v}">${n}</button>`).join('')}</div>
      <p class="note" style="margin-top:10px">${Sound.supported()
        ? `The score, and the deep array heard as well as read. On a phone added to the
           Home Screen the ringer switch does not reliably silence a web page, so the
           switch is here rather than only in the menu — set it before you start.`
        : `This browser has no audio, so there is nothing to turn on. Everything else works.`}</p>
    </div>
    <button class="big" id="begin">Open the ledger${seatsUsed < 2 ? ' — add an opponent' : ''}</button>
    <p class="note">Sealed-bid auctions are mandatory and the phone gets passed.
    Garrisons are finite. Neutral Anchorage pays nothing. Doubles roll again — three in a row and an Overseer files you.<br><br>
    The game saves itself after every move, so a call or a locked screen costs nothing.</p>`;

  let nw = '';
  for (let i = 0; i < setup.humans; i++) {
    nw += `<label>Player ${i + 1}</label><input type="text" data-n="${i}" value="${esc(setup.names[i] || '')}"
      maxlength="14" autocapitalize="words" autocomplete="off">`;
  }
  $('nameWrap').innerHTML = nw;
  $('nameWrap').querySelectorAll('[data-n]').forEach(inp =>
    inp.oninput = () => { setup.names[+inp.dataset.n] = inp.value.slice(0, 14); });

  // The same Score.on the menu toggles — one setting, two places to reach it,
  // rather than a second switch that could disagree with the first. Tapping is
  // itself a gesture, which is the only moment iOS will start a context, so an
  // "On" here starts the score straight away instead of waiting for Begin.
  $('setup').querySelectorAll('[data-snd]').forEach(b => b.onclick = () => {
    Sound.setOn(b.dataset.snd === '1');
    if (Sound.isOn()) Score.init();
    drawSetup();
  });

  $('setup').querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
    setup.humans = +b.dataset.h;
    while (setup.humans + setup.ais.length > 4) setup.ais.pop();
    drawSetup();
  });
  $('setup').querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
    const k = el.dataset.a, i = setup.ais.indexOf(k);
    if (i >= 0) setup.ais.splice(i, 1);
    else if (setup.humans + setup.ais.length < 4) setup.ais.push(k);
    drawSetup();
  });
  $('setup').querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    setup.circuits = +b.dataset.t; drawSetup();
  });
  $('begin').onclick = begin;
  if ($('resume')) $('resume').onclick = () => { G = saved; startShell(); };
}

function begin() {
  if (setup.humans + setup.ais.length < 2) {
    sheet(`<h3>A ledger needs two columns</h3><div class="sub">nobody to play against</div>
      <p style="font-size:15px;line-height:1.5">Add a second player or an opponent.</p>
      ${btns([['Close', 'closeSheet', 'pri wide']])}`);
    return;
  }
  const seats = [];
  for (let i = 0; i < setup.humans; i++) {
    seats.push({ name: (setup.names[i] || `Player ${i + 1}`).trim() || `Player ${i + 1}`, kind: 'human' });
  }
  setup.ais.forEach(k => seats.push({ name: PERSONAS[k].n, kind: 'ai', persona: k }));
  resetSoundWatch();
  G = E.createGame({ seats, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, circuits: setup.circuits });
  G.log.unshift({ kind: 'leader', circuit: 1, text: 'Nine systems are burning their drives to readiness. Begin.' });
  clearSave();
  startShell();
}

function startShell() {
  Score.init();                     // called from a tap, which iOS requires
  $('setup').classList.add('hidden');
  $('game').classList.remove('hidden');
  tick();
}

/* ============================================================ board geometry */
// Go bottom-right, play running anticlockwise along the bottom — an 11x11
// perimeter, which is 4 corners plus 9 a side: exactly Monopoly's 40.
const SIDE = (N + 4) / 4;                       // 11
const GRID = (() => {
  const m = new Array(N);
  const last = SIDE, per = SIDE - 2;             // 9 squares between corners
  m[0] = [last, last];
  for (let k = 1; k <= per; k++) m[k] = [last, last - k];
  m[per + 1] = [last, 1];
  for (let k = 1; k <= per; k++) m[per + 1 + k] = [last - k, 1];
  m[2 * (per + 1)] = [1, 1];
  for (let k = 1; k <= per; k++) m[2 * (per + 1) + k] = [1, 1 + k];
  m[3 * (per + 1)] = [1, last];
  for (let k = 1; k <= per; k++) m[3 * (per + 1) + k] = [1 + k, last];
  return m;
})();
// Which edge a square sits on, so the deep cells can face inwards like a real
// board rather than every cell being an identical square.
const edgeOf = i => {
  const per = SIDE - 2;
  if (i === 0 || i === per + 1 || i === 2 * (per + 1) || i === 3 * (per + 1)) return 'corner';
  if (i < per + 1) return 'bottom';
  if (i < 2 * (per + 1)) return 'left';
  if (i < 3 * (per + 1)) return 'top';
  return 'right';
};

const pipOf = p => PIPS[p.i % PIPS.length];
const colourOf = b => b.s ? SETS[b.s].c : b.t === 'f' ? 'var(--fleet)' : b.t === 'u' ? 'var(--util)' : null;

/* ------------------------------------------------------- square marks */
// A property cell carries a colour bar, a code, a price and its development.
// The eighteen squares that are not properties carried a four-letter code and
// nothing else — and twelve of those have no colour bar or price either, so the
// emptiest cells on the board were also the busiest. Measured from TRAFFIC:
// those twelve take 27.2% of all landings, Detention alone 6.19% (the busiest
// square there is), and the two decks 10.4% between them — more than any colour
// set. The cells you land on most were telling you least.
//
// CLMN and CON are the sharpest case. The two decks were once COL/CON, recorded
// in the README as "the worst possible pair to confuse", and the fix was a
// naming rule. Four letters at 10px still resolve slowly under a thumb; a
// silhouette does not. The code stays alongside, because the info panel, the
// ledger sheet and the traffic table are all keyed on codes.
//
// Drawn rather than fetched: inline SVG on currentColor costs no request, no
// cache entry and no dependency, and stays sharp at 3x. Bold silhouettes only —
// nothing survives detail at ~15px on a 375pt screen.
const ICON = {
  // An open ledger. The square is The Ledger Opens, and the book is the motif
  // the whole game is named for.
  go: '<path d="M12 6.4C9.4 4.8 6.6 4.4 3.2 4.8v13.4c3.4-.4 6.2 0 8.8 1.6 2.6-1.6 5.4-2 8.8-1.6V4.8c-3.4-.4-6.2 0-8.8 1.6Z"/>'
    + '<path d="M11.2 6.8h1.6v12.4h-1.6Z" fill="var(--void)"/>',
  // A fluted column — The Column, the money deck. Solid and vertical, so it
  // cannot be mistaken for the branching mark opposite it.
  col: '<path d="M4 3h16v2.6H4Zm0 15.4h16V21H4Z"/>'
     + '<path d="M7.6 5.6h1.7v12.8H7.6Zm3.55 0h1.7v12.8h-1.7Zm3.55 0h1.7v12.8h-1.7Z"/>',
  // A path that forks — Contingency, the movement deck. Deliberately the visual
  // opposite of the column: open, branching, going two ways at once.
  con: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">'
     + '<path d="M12 21.2V15"/><path d="M12 15 8.6 11.6"/><path d="M12 15l3.4-3.4"/></g>'
     + '<path d="M5 8 9.84 9.16 6.16 12.84Z"/><path d="M19 8 17.84 12.84 14.16 9.16Z"/>',
  // Money leaving you, onto a plate. Both taxes are a figure you hand over.
  tax: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
     + '<path d="M12 3.4v10"/><path d="m7.6 9 4.4 4.4L16.4 9"/><path d="M4.6 17.8h14.8"/></g>',
  // A hull under way. The Pillar of Commerce is the Union's flagship, not a
  // station, so these read as ships rather than ports.
  f: '<path d="M22 12 8.2 5.4v13.2Z"/>'
   + '<rect x="2.2" y="7" width="4.4" height="3.2" rx="1"/>'
   + '<rect x="2.2" y="13.8" width="4.4" height="3.2" rx="1"/>',
  // Something listening. The Deep Array is the voice that counts the swarm in.
  u: '<circle cx="12" cy="17.6" r="2.4"/>'
   + '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
   + '<path d="M6.6 12.8a7.6 7.6 0 0 1 10.8 0"/><path d="M3.2 9a12.4 12.4 0 0 1 17.6 0"/></g>',
  // An eye, not bars. Bars were drawn first and were a mistake: three vertical
  // strokes between two rails is the same silhouette as the fluted column at
  // 20px, and Detention (6.19%) and The Column (6.63%) are the two busiest
  // squares on the board — so the mark meant to end a confusion created a worse
  // one. The Overseer watches, which is both unmistakable in outline and closer
  // to what the square is.
  jail: '<g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round">'
      + '<path d="M1.8 12s3.9-6.5 10.2-6.5S22.2 12 22.2 12s-3.9 6.5-10.2 6.5S1.8 12 1.8 12Z"/></g>'
      + '<circle cx="12" cy="12" r="2.9"/>',
  // An anchor, for the one corner that asks nothing of you.
  free: '<circle cx="12" cy="4.4" r="2.4"/>'
      + '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M12 7.4V20"/><path d="M7.6 11h8.8"/><path d="M4.6 14.2a7.4 7.4 0 0 0 14.8 0"/></g>',
  // Mandibles closing. The Absorbed corner is where the Neurex speak, and this
  // is the one mark on the board that should look wrong rather than designed.
  goto: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">'
      + '<path d="M3.4 3.8c0 8.4 4.2 12.6 8.6 15"/><path d="M20.6 3.8c0 8.4-4.2 12.6-8.6 15"/>'
      + '<path d="M8.4 5.6c.4 4.2 1.8 6.6 3.6 8.2"/><path d="M15.6 5.6c-.4 4.2-1.8 6.6-3.6 8.2"/></g>'
};
const iconFor = b => ICON[b.t] || '';
const posOf = p => (anim && anim.i === p.i ? anim.pos : p.pos);

/* ============================================================ render */
function render() {
  renderBar();
  renderBoard();
  renderActions();
  renderLog();
  soundWatch();
}

/* ------------------------------------------------------------ sound cues */
// The engine has no DOM, no timers and no audio, and it stays that way. Both
// cues are therefore read off state the interface can already see, by comparing
// against the last render rather than by the engine calling out:
//
//   G.swarmMark   how many of the four deep-array reports have been made
//   p.lord        null until that player is absorbed
//
// Only transitions fire. render() runs on every animation frame of a walking
// piece, so anything keyed on a level rather than an edge would retrigger for
// the length of a move.
let heard = { mark: -1, lords: '', onGoto: '' };

function soundWatch() {
  if (!G) return;
  const lords = G.players.map(p => (p.lord === null || p.lord === undefined ? '-' : p.lord)).join(',');
  const mark = G.swarmMark ?? 0;
  // Landing on Absorbed. This was the missing cue: the square is the go-to
  // corner, so resolveLanding sends the piece straight on to Detention and it is
  // never sitting there when anyone looks. But tick() renders between the walk
  // finishing and the landing resolving, with phase 'landed', and at that one
  // moment the piece IS on square 30. That is the edge to catch.
  const onGoto = G.players.filter(p => p.pos === GOTO).map(p => p.i).join(',');
  const first = heard.mark === -1;
  // A resumed save must not replay every report the last session already heard,
  // so the first render after loading only takes the reading.
  if (!first) {
    const newlyAbsorbed =
      lords !== heard.lords &&
      lords.replace(/-/g, '').length > heard.lords.replace(/-/g, '').length;
    const arrived = onGoto && onGoto !== heard.onGoto;
    if (newlyAbsorbed || arrived) Sound.absorbed();
    else if (mark > heard.mark) Sound.stage(mark);
  }
  // Both are levels rather than events, so they are set every render and do
  // their own nothing when neither has moved.
  Sound.setPresence(mark);
  Sound.setApproach(E.swarmDistance(G));
  heard = { mark, lords, onGoto };
}

// Starting a new game re-arms all three, so a second game reports from the top.
function resetSoundWatch() {
  heard = { mark: -1, lords: '', onGoto: '' };
  Sound.clearPresence();
}

// Four chips have to fit 393pt without the last one sliding off the edge, and
// "High Commander Varan" will never fit whole. The rule lives in engine.js so
// that every screen shortens a name the same way; see displayName there.
const chipName = E.displayName;

function renderBar() {
  const chips = G.players.map((p, i) => {
    const rel = p.lord !== null
      ? `<div class="vs">vassal · ${esc(chipName(G.players[p.lord]))}</div>`
      : p.vassals.length ? `<div class="vs">overlord ×${p.vassals.length}</div>` : '';
    const held = p.holdings.length;
    return `<button class="pchip${i === G.cur ? ' act' : ''}" data-who="${i}"
        aria-label="${esc(p.name)} — ${held} holding${held === 1 ? '' : 's'}">
      <div class="nm"><span class="pip" style="background:${pipOf(p)}"></span><span class="who">${esc(chipName(p))}</span></div>
      <div class="cashRow"><span class="cash">${money(p.cash)}</span>
        <span class="chipMore" aria-hidden="true">${held}<span class="chev">›</span></span></div>
      ${p.debt ? `<div class="vs" style="color:var(--warn)">debt ${money(p.debt)}</div>` : ''}${rel}</button>`;
  }).join('');
  $('bar').innerHTML = chips + `<button class="menuBtn" id="menuBtn" aria-label="Menu">☰</button>`;
  $('menuBtn').onclick = () => { Score.resume(); showMenu(); };
  $('bar').querySelectorAll('[data-who]').forEach(el =>
    el.onclick = () => { Score.resume(); showPlayer(+el.dataset.who); });
}

// The centre panel is built ONCE and re-attached after each render rather than
// rebuilt with the cells. It holds a live canvas, and innerHTML on the board
// would throw that away sixty times a second and restart the animation with it.
let midEl = null, galaxy = null;
function ensureMid() {
  if (midEl) return midEl;
  midEl = document.createElement('div');
  midEl.className = 'mid';
  midEl.innerHTML = `<canvas class="galaxyCanvas"></canvas>
    <div class="midInner">
      <div class="who"></div>
      <div class="dice"><div class="die">–</div><div class="die">–</div></div>
      <div class="sq"></div>
      <div class="msg"></div>
      <div class="meta"></div>
    </div>`;
  return midEl;
}

// What actually just happened, mechanically. The Leader's asides and the
// opponents' lines already have the log underneath; repeating the top log entry
// here put the same sentence on screen twice and wasted the biggest panel.
function lastEvent() {
  const entry = G.log.find(l => l.kind === 'note');
  return entry ? entry.text : '';
}

let diceRolling = false;
function paintMid() {
  if (!midEl) return;
  const p = E.current(G);
  const set = (sel, text) => { const el = midEl.querySelector(sel); if (el) el.textContent = text; };
  set('.who', p.name + (p.lord !== null ? ' · vassal' : ''));
  set('.sq', BOARD[posOf(p)].n);
  set('.msg', lastEvent());
  // Once the deep array is reporting, the counter stops being an administrative
  // limit and starts being the thing the whole book is about.
  // From the first turn, not from the last twelve. Hidden until late, the whole
  // idea was invisible in any game that did not run to the end.
  const out = E.swarmDistance(G);
  set('.meta', `SWARM ${out} OUT · GARRISONS ${G.garrisonPool} · CITADELS ${G.citadelPool}`);
  const meta = midEl.querySelector('.meta');   // midEl, not $('mid') — it has no id
  if (meta) meta.classList.toggle('near', out <= RULES.swarmWarning);
  if (!diceRolling) {
    const dice = midEl.querySelectorAll('.die');
    dice[0].textContent = G.dice[0] || '–';
    dice[1].textContent = G.dice[1] || '–';
  }
}

// A roll that simply appears is a number changing. A roll that tumbles for a
// third of a second is a roll.
function tumbleDice(final, done) {
  if (!midEl) { done(); return; }
  const dice = midEl.querySelectorAll('.die');
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dice[0].textContent = final[0]; dice[1].textContent = final[1];
    done(); return;
  }
  diceRolling = true;
  midEl.classList.add('rolling');
  let n = 0;
  // The dice are the one animation on a raw interval rather than through
  // later(), and its completion continues the turn — walk() dereferences whose
  // turn it is. Abandoning a game during the third of a second the dice tumble
  // therefore threw, which is the same defect the scheduler was written for,
  // reached through setInterval instead of setTimeout. The tumble itself is
  // only text in two boxes and can finish harmlessly; what must not happen is
  // handing the turn on to a game that is over.
  const mine = era;
  const spin = setInterval(() => {
    dice[0].textContent = 1 + Math.floor(Math.random() * 6);
    dice[1].textContent = 1 + Math.floor(Math.random() * 6);
    if (++n >= 7) {
      clearInterval(spin);
      diceRolling = false;
      midEl.classList.remove('rolling');
      dice[0].textContent = final[0];
      dice[1].textContent = final[1];
      if (era === mine && G) done();
    }
  }, 48);
}

function renderBoard() {
  const cur = E.current(G);
  let h = '';
  BOARD.forEach((b, i) => {
    const [r, c] = GRID[i];
    const owner = E.ownerOf(G, i);
    const held = owner ? E.holding(owner, i) : null;
    const colour = colourOf(b);
    const edge = edgeOf(i);
    const corner = edge === 'corner';
    const toks = G.players.filter(q => posOf(q) === i)
      .map(q => `<div class="tok${q.i === G.cur ? ' me' : ''}" style="background:${pipOf(q)};color:${pipOf(q)}"></div>`)
      .join('');
    const dev = held ? (held.citadel ? '◆' : held.garrisons ? '▪'.repeat(held.garrisons) : held.mortgaged ? '⌀' : '') : '';
    const ownStyle = owner ? `color:${pipOf(owner)};box-shadow:inset 0 0 0 2px ${pipOf(owner)}` : '';
    const ico = iconFor(b);
    h += `<div class="cell e-${edge}${posOf(cur) === i ? ' here' : ''}${selected === i ? ' sel' : ''}${ico ? ' marked' : ''}${held && held.mortgaged ? ' pledged' : ''}"
        style="grid-row:${r};grid-column:${c};--here:${pipOf(cur)};${ownStyle}" data-i="${i}">
      ${colour ? `<div class="cbar" style="background:${colour}"></div>` : ''}
      ${ico ? `<svg class="cico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ico}</svg>` : ''}
      <div class="code">${esc(b.a)}</div>
      ${b.pr ? `<div class="cpr">${b.pr}</div>` : ''}
      ${dev ? `<div class="grr">${dev}</div>` : ''}
      <div class="toks">${toks}</div></div>`;
  });

  const board = $('board');
  board.innerHTML = h;
  board.appendChild(ensureMid());          // survives the innerHTML above
  paintMid();
  if (!galaxy) {
    // The canvas keeps animating after New game sets G to null, so the distance
      // has to be guarded here — moodFor tolerates a null G, but swarmDistance
      // reads G.circuits and does not.
      galaxy = startGalaxy(midEl.querySelector('.galaxyCanvas'),
        () => moodFor(G, G ? E.swarmDistance(G) : undefined),
        // The same approach the score reads, so the sky and the music share one
        // clock rather than two tables that would disagree eventually.
        () => (G ? Sound.approachFor(E.swarmDistance(G)) : null));
  } else {
    galaxy.resize();
  }
  board.querySelectorAll('[data-i]').forEach(el =>
    el.onclick = () => showSquare(+el.dataset.i));
}

function renderActions() {
  const p = E.current(G);
  if (G.over) {
    $('acts').innerHTML = actBtn('Final ledger', 'showFinal()', 'pri')
      + actBtn('New game', 'newGame()') + actBtn('Copy result', 'copyResult()');
    bindActs();
    return;
  }
  const waiting = busy || p.kind === 'ai';
  if (waiting) {
    $('acts').innerHTML = `<button class="act" disabled style="grid-column:1/4">${esc(p.name)} is deciding…</button>`;
    return;
  }

  const primary = G.phase === 'roll'
    ? actBtn('Roll', 'act_roll()', 'pri',
        p.inFacility ? `held · attempt ${p.attempts + 1} of ${RULES.facilityAttempts}` : '&nbsp;')
    : G.phase === 'landed'
      ? (() => { const q = phraseLanding(E.landingPreview(G)); return actBtn(q.label, 'act_resolve()', 'pri', q.sub); })()
      : actBtn('Roll', '', '', '&nbsp;', true);

  const canAmend = G.phase === 'landed' && p.amends > 0 && p.cash >= E.amendCost(p);
  // While detained the second slot settles with the Overseer instead of amending
  // — with a favour if one is held, since paying ₡150 while holding a free way
  // out is never the better move on the turn you are actually detained.
  const detained = G.phase === 'roll' && p.inFacility;
  const second = detained
    ? (p.pardons > 0
        ? actBtn('Favour', 'act_pardon()', '', `${p.pardons} held · free`)
        : actBtn('Settle', 'act_payFee()', '', money(RULES.facilityFee), p.cash < RULES.facilityFee))
    : actBtn('Amend', 'act_amend()', '', `${money(E.amendCost(p))} · ${p.amends} left`, !canAmend);
  const relational = p.lord !== null
    ? actBtn('Second ledger', 'showRevolt()', '', 'hidden')
    : p.vassals.length
      ? actBtn('Set tithe', 'showTithe()', '', `${p.tithe}%`)
      : actBtn('—', '', '', '&nbsp;', true);

  $('acts').innerHTML = primary
    + second
    + actBtn('Manage', 'showManage()', '', 'build · pledge')
    + actBtn('Propose', 'showTrade()', '', 'draw a contract')
    + relational
    // Upkeep is charged by ending the turn, so this is where it belongs. It was
    // only ever visible inside the Manage sheet, which is not where you pay it.
    + actBtn('End turn', 'act_end()', G.phase === 'end' ? 'pri' : '',
        E.upkeep(p) ? `upkeep ${money(E.upkeep(p))}` : '&nbsp;', G.phase !== 'end');
  bindActs();
}

// "Resolve" told you nothing until it was already done. The label is now the
// action and the amount; the sub-line is who or why. The square's full name is
// already in the centre panel, so it does not need repeating here.
function phraseLanding(v) {
  switch (v.kind) {
    case 'rent':      return { label: `Pay ${money(v.amount)}`, sub: `to ${esc(chipName(G.players[v.to]))}` };
    case 'tax':       return { label: `Pay ${money(v.amount)}`, sub: esc(v.name) };
    case 'unowned':   return { label: `Buy ${money(v.amount)}`, sub: 'or decline to auction' };
    case 'card':      return { label: 'Draw', sub: esc(v.name) };
    case 'detention': return { label: 'Absorbed', sub: 'taken to Detention' };
    case 'own':       return { label: 'Your holding', sub: 'nothing due' };
    case 'pledged':   return { label: 'Nothing due', sub: 'pledged' };
    default:          return { label: 'Nothing due', sub: esc(v.name) };
  }
}

const actBtn = (label, fn, cls = '', sub = '&nbsp;', disabled = false) =>
  `<button class="act ${cls}" data-fn="${fn}"${disabled ? ' disabled' : ''}>${label}<small>${sub}</small></button>`;

function bindActs() {
  $('acts').querySelectorAll('[data-fn]').forEach(b => {
    const fn = b.dataset.fn;
    if (fn) b.onclick = () => { Score.resume(); ACTIONS[fn.replace(/\(\)$/, '')](); };
  });
}

// Open by default. The board is square and the screen is not, so shutting the
// ledger leaves a gap nothing else can fill — that should be a choice the
// player makes for a clearer board, not the state they are handed.
let logOpen = true;
function toggleLog() { logOpen = !logOpen; renderLog(); }

function renderLog() {
  const wrap = $('logWrap');
  // In landscape the ledger has a column of its own and is always open; the
  // toggle is hidden there, so the class must not be able to shut it.
  const landscape = window.matchMedia('(orientation:landscape) and (max-height:560px)').matches;
  wrap.classList.toggle('open', logOpen || landscape);
  const count = G.log.length;
  $('logToggle').innerHTML =
    `<span>${logOpen ? 'The ledger' : esc(topLine())}</span><b>${logOpen ? '▾' : `▴ ${count}`}</b>`;
  $('logToggle').onclick = toggleLog;
  $('log').innerHTML = G.log.map(l => {
    if (l.kind === 'leader') return `<div class="le leader">${esc(l.text)}</div>`;
    if (l.kind === 'voice') {
      const who = G.players[l.who];
      return `<div class="le voice"><b style="color:${pipOf(who)}">${esc(who.name)}:</b> “${esc(l.text)}”</div>`;
    }
    return `<div class="le"><span class="t">C${l.circuit}</span> ${esc(l.text)}</div>`;
  }).join('');
}

// The one line worth seeing when the ledger is shut.
function topLine() {
  const l = G.log[0];
  if (!l) return '';
  if (l.kind === 'voice') return `${chipName(G.players[l.who])}: ${l.text}`;
  return l.text;
}

/* ============================================================ sheets */
// Arm-then-confirm for anything expensive or irreversible. One tap turns the
// button into a warning that says what it is about to do; a second commits.
// It disarms on any other press, or after a few seconds, so an armed button
// can never sit waiting for a stray thumb.
let armTimer = null;
function disarmAll(root = document) {
  clearTimeout(armTimer);
  root.querySelectorAll('[data-armed="1"]').forEach(b => {
    b.dataset.armed = '0';
    if (b.dataset.label) b.innerHTML = b.dataset.label;
    b.classList.remove('armed');
  });
}
function bindSheet(scope) {
  scope.querySelectorAll('[data-fn]').forEach(b => {
    b.onclick = () => {
      Score.resume();
      if (b.dataset.confirm && b.dataset.armed !== '1') {
        disarmAll(document);
        b.dataset.label = b.innerHTML;
        b.dataset.armed = '1';
        b.innerHTML = b.dataset.confirm;
        b.classList.add('armed');
        armTimer = setTimeout(() => disarmAll(document), 4000);
        return;
      }
      disarmAll(document);
      dropKeyboard();
      const [name, ...args] = b.dataset.fn.split('|');
      ACTIONS[name](...args);
    };
  });
}
// Anything focused is blurred before the swap. On iOS a sheet with a number
// input raises the software keyboard, and .scrim is position:fixed against the
// LAYOUT viewport, which does not shrink for it — so the next sheet is laid out
// against a viewport that no longer matches the screen. Reported from play as
// the Continue button on the revealed-bids sheet refusing to respond until the
// background had been touched, which is what resynchronises it. Destroying the
// focused input by replacing innerHTML does not reliably dismiss the keyboard;
// blurring it first does.
//
// Not verifiable here: headless Chromium has no software keyboard, so this
// removes the precondition rather than being proven against the symptom.
function dropKeyboard() {
  const el = document.activeElement;
  if (el && el !== document.body && typeof el.blur === 'function') el.blur();
}

function sheet(inner) {
  dropKeyboard();
  $('sheetRoot').innerHTML = `<div class="scrim"><div class="sheet"><div class="grab"></div>${inner}</div></div>`;
  bindSheet($('sheetRoot'));
}
// The dashed ring says "this is the square the open sheet is about". Once the
// sheet is gone it marks nothing, and a marker left behind on a board that has
// since moved on is just another thing to decode. Cleared here rather than on a
// timer: nothing should vanish while somebody is still reading it.
function closeSheet() {
  $('sheetRoot').innerHTML = '';
  if (selected !== -1) { selected = -1; renderBoard(); }
}
// [label, action, classes, confirmLabel]. A fourth entry arms the button.
const btns = list => `<div class="mbtns">${list.map(([label, fn, cls = '', confirm]) =>
  `<button class="mbtn ${cls}" data-fn="${fn}"${confirm ? ` data-confirm="${esc(confirm)}"` : ''}>${label}</button>`).join('')}</div>`;

/* ============================================================ the flow */
// One place decides what happens next. Every action ends by calling tick().
// A game can be abandoned while an opponent is mid-turn. New game sets G to
// null, and every timer already scheduled for that opponent then lands in a
// world with no game in it. tick() has always guarded for that; the callbacks
// that run BEFORE tick did not — reading whose turn it is, or walking a piece,
// both touch G first and both threw.
//
// Latent for as long as the table defaulted to two humans and one opponent,
// where an opponent held a third of the turns. Defaulting to one human made it
// half of them, and the probe started catching it on the way out of a game.
//
// One scheduler with one guard, rather than a check at each site — which is the
// shape of every other defect this file has had. `era` also covers the case the
// null check alone would miss: abandoning a game and immediately starting
// another, where G is not null but is a different game entirely.
let era = 0;
function later(fn, ms) {
  const mine = era;
  return setTimeout(() => { if (era === mine && G) fn(); }, ms);
}

function tick() {
  if (!G) return;
  save();
  // The distance is passed in rather than recomputed inside score.js, so the
  // formula for it lives in exactly one place.
  Score.set(moodFor(G, E.swarmDistance(G)));
  render();

  if (G.over) { busy = false; render(); showFinal(); return; }
  const p = E.current(G);

  switch (G.phase) {
    case 'roll':
      if (p.kind === 'ai') { busy = true; render(); later(act_roll, 750); }
      else busy = false;
      break;

    case 'landed':
      if (p.kind === 'ai') { busy = true; later(aiResolve, 320); }
      else busy = false;
      break;

    case 'card':
      if (p.kind === 'ai') { busy = true; later(runCard, 520); }
      else { busy = false; showCard(); }
      break;

    case 'offer':
      if (p.kind === 'ai') {
        busy = true;
        later(() => {
          if (E.aiWantsToBuy(G, p, p.pos)) E.buy(G, p);
          else E.openAuction(G, p.pos);
          tick();
        }, 520);
      } else { busy = false; showOffer(); }
      break;

    case 'auction':
      busy = false;
      if (G.auction.resolved) showAuctionResult(); else showBid();
      break;

    case 'contest':
      busy = false;
      if (G.contest.resolved) showContestResult(); else showClaim();
      break;

    case 'contract':
      busy = false;
      showContract();
      break;

    case 'settle':
      busy = false;
      showSettle();
      break;

    case 'end':
      if (p.kind === 'ai') {
        busy = true;
        later(() => {
          E.aiDevelop(G, p);
          if (G.phase === 'contract' || G.over) { tick(); return; }
          E.endTurn(G);
          tick();
        }, 620);
      } else busy = false;
      break;
  }
  if (!busy) render();
}

// Walks a piece square by square, then continues. The engine has already
// finished the move; this is only the eye catching up.
// The engine finishes a move before it returns, so a piece's real position is
// already its destination. Anything that renders between the engine call and
// the first step of the walk shows the piece arriving and then snapping back to
// start again. hold() pins it where it was, and must be called BEFORE any
// render that follows an engine move.
function hold(p, from) { anim = { i: p.i, pos: from }; }

function walk(path, done) {
  if (!path || !path.length) { anim = null; renderBoard(); done(); return; }
  const p = E.current(G);
  if (!anim || anim.i !== p.i) anim = { i: p.i, pos: path[0] };
  let k = -1;                       // the piece is already held at its origin
  const step = () => {
    k++;
    if (k >= path.length) { anim = null; renderBoard(); done(); return; }
    anim.pos = path[k];
    renderBoard();
    later(step, 105);
  };
  later(step, 105);
}

/* ============================================================ actions */
const ACTIONS = {
  act_roll, act_resolve, act_amend, act_end,
  showSquare, showManage, showTrade, showTithe, showRevolt, showFinal, showLedger, showDecks,
  closeSheet, newGame, copyResult, toggleLog, act_payFee, act_pardon, showMenu, toggleScore, showPlayer,
  showSettle, settlePledge, settleSellG, settleBreak, settleAuto, settleDone,
  buyNow, declineToAuction, takeCard, sealBid, sealClaim, endAuction, endContest,
  answerContract, build, raiseCitadel, sellDev, toggleMortgage, repay,
  setTithe, release, declare, tradeSet, sendTrade, takeCounter, offerFor, playOn
};
for (const k of Object.keys(ACTIONS)) window[k] = ACTIONS[k];

function act_roll() {
  if (G.phase !== 'roll') return;
  const p = E.current(G);
  const from = p.pos;
  const r = E.roll(G);
  if (!r) return;
  hold(p, from);                    // before the render, or it flashes to the destination
  busy = true; render();
  tumbleDice(G.dice, () => {
    if (r.held) { busy = false; tick(); return; }
    walk(r.path, () => {
      busy = false;
      if (p.kind === 'ai') aiResolve();
      else tick();
    });
  });
}

function act_resolve() {
  if (G.phase !== 'landed') return;
  E.resolveLanding(G);
  tick();
}

// An opponent settling on the square it has landed on. It may amend the
// manifest first — the same nudge the human gets a button for — and if it does,
// the step is walked rather than teleported, exactly as act_amend walks it.
//
// Every AI path into resolveLanding goes through here. That is the point: the
// defects this file keeps producing are all capability reachable from one route
// and not another, so the amend hangs off the resolve rather than off each
// caller that happens to remember it.
function aiResolve() {
  const p = E.current(G);
  const from = p.pos;
  const r = E.aiAmend(G, p);
  if (!r) { E.resolveLanding(G); tick(); return; }
  hold(p, from);
  busy = true; render();
  walk(r.path, () => { busy = false; E.resolveLanding(G); tick(); });
}

function act_amend() {
  const p = E.current(G);
  const from = p.pos;
  const r = E.amendManifest(G);
  if (!r) return;
  hold(p, from);
  busy = true; render();
  walk(r.path, () => { busy = false; E.resolveLanding(G); tick(); });
}

function act_payFee() {
  if (!E.payFacilityFee(G)) return;
  tick();
}

function act_pardon() {
  if (!E.usePardon(G)) return;
  tick();
}

function act_end() {
  if (G.phase !== 'end') return;
  E.endTurn(G);
  tick();
}

function runCard() {
  const p = E.current(G);
  const from = p.pos;
  const r = E.applyCard(G);
  closeSheet();
  if (!r) { tick(); return; }
  if (r.path && r.path.length) hold(p, from);
  busy = true; render();
  walk(r.path, () => { busy = false; tick(); });
}

function takeCard() { runCard(); }

/* ---------------------------------------------------------- menu */
// There was no way out of a game in progress at all — the only route back to
// the setup screen was finishing and pressing New game.
function showMenu() {
  const p = E.current(G);
  sheet(`<h3>The ledger</h3><div class="sub">circuit ${G.circuit} of ${G.circuits}</div>
    <div class="stat"><span>Whose turn</span><span>${esc(p.name)}</span></div>
    <div class="stat"><span>Garrisons left</span><span>${G.garrisonPool} · citadels ${G.citadelPool}</span></div>
    <div class="stat"><span>Score</span><span>${Score.on ? 'on' : 'off'}</span></div>
    ${btns([
      [Score.on ? 'Turn the score off' : 'Turn the score on', 'toggleScore', 'wide'],
      ['What the board pays', 'showLedger', 'wide'],
      ['The decks', 'showDecks', 'wide'],
      ['Back to the board', 'closeSheet', 'pri'],
      ['New game', 'newGame', 'dgr', 'Confirm — abandons this game']
    ])}
    <p style="font-size:13px;color:var(--dim);line-height:1.5;margin-top:14px">
    The game saves itself after every move. Closing the app does not lose it —
    only starting a new one does.</p>
    <p style="font-size:12px;color:var(--dim);line-height:1.6;margin-top:10px;
       font-variant-numeric:tabular-nums" id="buildLine">
    Build <b>${esc(BUILD)}</b> · seed <b>${G.seed >>> 0}</b><br>
    Quote both of these in a bug report — the build says whether you are on the
    current version, and the seed replays the same dice and the same opponents.</p>`);
}
// Through Sound.setOn rather than Score.toggle, so the choice is written down
// and the setup screen comes back up agreeing with it next launch.
function toggleScore() { Score.resume(); Sound.setOn(!Score.on); render(); showMenu(); }

/* ---------------------------------------------------------- square detail */
function showSquare(i) {
  i = +i;
  // The ring belongs to the sheet, not to the tap that opened it — setting it in
  // the click handler meant every other route here showed a sheet marking nothing.
  if (selected !== i) { selected = i; renderBoard(); }
  const b = BOARD[i];
  const owner = E.ownerOf(G, i);
  const held = owner ? E.holding(owner, i) : null;
  const kind = b.s ? SETS[b.s].n : b.t === 'f' ? 'Fleet' : b.t === 'u' ? 'Utility' : '—';
  let s = `<h3>${esc(b.n)}</h3><div class="sub">${esc(kind)} · square ${i}</div>
    ${flavour(b)}
    <div class="stat"><span>Landing frequency</span><span>${TRAFFIC[i].toFixed(2)}%</span></div>`;
  if (b.pr) s += `<div class="stat"><span>Price</span><span>${money(b.pr)}</span></div>`;
  if (b.amt) s += `<div class="stat"><span>Charge</span><span>${money(b.amt)}</span></div>`;
  if (b.s) {
    s += `<div class="stat"><span>Set payback (3 garrisons)</span><span>${E.paybackTurns(b.s, TRAFFIC)} turns</span></div>
      <div class="stat"><span>Garrison cost</span><span>${money(SETS[b.s].gc)}</span></div>
      <table><tr><th>Build</th><th>Rent</th></tr>
      <tr><td>Bare</td><td>${money(b.r[0])}</td></tr>
      <tr><td>Full set</td><td>${money(b.r[0] * 2)}</td></tr>
      <tr><td>1 garrison</td><td>${money(b.r[1])}</td></tr>
      <tr><td>2</td><td>${money(b.r[2])}</td></tr>
      <tr><td>3</td><td>${money(b.r[3])}</td></tr>
      <tr><td>Citadel</td><td>${money(b.r[4])}</td></tr></table>`;
  }
  // Built from FLEET_RENT rather than written out. The old hardcoded line said
  // "₡50 · ₡150 for both" — true of the two-fleet board this game had three
  // boards ago, and quietly wrong ever since.
  if (b.t === 'f') {
    const held = owner ? E.countType(owner, 'f') : 0;
    s += `<table><tr><th>Fleets held</th><th>Rent</th></tr>` +
      FLEET_RENT.slice(1).map((r, k) => `<tr${held === k + 1 ? ' style="color:var(--gold)"' : ''}>
        <td>${k + 1}${held === k + 1 ? ' — now' : ''}</td><td>${money(r)}</td></tr>`).join('') +
      `</table>`;
  }
  if (b.t === 'u') {
    const held = owner ? E.countType(owner, 'u') : 0;
    s += `<table><tr><th>Utilities held</th><th>Rent</th></tr>
      <tr${held === 1 ? ' style="color:var(--gold)"' : ''}><td>1${held === 1 ? ' — now' : ''}</td><td>4× the roll</td></tr>
      <tr${held === 2 ? ' style="color:var(--gold)"' : ''}><td>2${held === 2 ? ' — now' : ''}</td><td>10× the roll</td></tr></table>`;
  }
  if (owner && owner.i !== (E.current(G) || {}).i) {
    const now = E.rentOf(G, i, G.dice[0] + G.dice[1] || 7);
    s += `<div class="stat"><span>You would pay</span><span style="color:${now ? 'var(--warn)' : 'var(--tx)'}">${money(now)}</span></div>`;
  }
  if (b.t === 'jail') {
    s += `<p style="font-size:14px;line-height:1.5;color:var(--dim);margin-top:12px">
      Roll doubles and walk out, settle for ${money(RULES.facilityFee)} at any point, or be released
      on the ${RULES.facilityAttempts}rd attempt and pay it anyway. An Overseer is an official, and
      officials have a price.</p>`;
    // Favours are held for a long time before they are spent, so who is
    // carrying one is worth knowing before anybody is detained.
    const holders = G.players.filter(q => q.pardons > 0);
    if (holders.length) {
      s += `<div class="stat"><span>Favours held</span><span>` + holders
        .map(q => `<span style="color:${pipOf(q)}">${esc(chipName(q))} ×${q.pardons}</span>`)
        .join(' · ') + `</span></div>`;
    }
  }
  if (owner) s += `<div class="stat"><span>Held by</span><span style="color:${pipOf(owner)}">${esc(owner.name)}${held.mortgaged ? ' (pledged)' : ''}</span></div>`;

  // Tapping a square used to be purely informational. If somebody else holds it
  // and it is your turn, this is the shortest route to an offer.
  const me = E.current(G);
  const canDeal = owner && me && owner.i !== me.i && me.kind === 'human'
    && !me.debt && !busy && !G.over;
  const blocked = canDeal && !E.tradable(G, owner, i);
  if (blocked) {
    s += `<div class="warnbox">${held.mortgaged
      ? 'Pledged — it cannot change hands until it is redeemed.'
      : (held.garrisons || held.citadel)
        ? 'Garrisoned — the buildings must go before it can move.'
        : `${esc(SETS[b.s].n)} is built up. Nothing in the set can move until it is cleared.`}</div>`;
  }
  s += btns([
    ...(canDeal && !blocked ? [[`Offer ${esc(chipName(owner))} for it`, `offerFor|${i}`, 'pri wide']] : []),
    ['The ledger', 'showLedger', ''],
    ['Close', 'closeSheet', canDeal && !blocked ? '' : 'pri']
  ]);
  sheet(s);
}

// A reference list of both decks. Deliberately player-independent: the effect
// line on a drawn card says what it will do to YOU, which is the right thing
// there and the wrong thing here, where the question is what is in the deck.
function deckEffect(c) {
  if (c.cash !== undefined) return c.cash > 0 ? `Gain ${money(c.cash)}` : `Pay ${money(-c.cash)}`;
  if (c.each) return c.each > 0
    ? `Collect ${money(c.each)} from every other overlord`
    : `Pay ${money(-c.each)} to every other overlord`;
  if (c.pardon) return 'Keep an Overseer favour';
  if (c.perGarrison) return `Pay ${money(c.perGarrison)} per garrison held`;
  if (c.perCitadel) return `Pay ${money(c.perCitadel)} per citadel held`;
  if (c.jail) return 'Straight to Overseer Detention';
  if (c.go !== undefined) return `Move to ${esc(BOARD[c.go].n)}`;
  if (c.back) return `Move back ${c.back} squares`;
  if (c.fleet) return 'Move to the nearest fleet';
  if (c.util) return 'Move to the nearest utility';
  return '—';
}

function showDecks() {
  const deck = (title, sub, cards) => `<h4 style="font-family:var(--m);font-size:13px;
    letter-spacing:.08em;text-transform:uppercase;color:var(--gold);margin:18px 0 6px">${title}</h4>
    <div class="sub" style="margin-bottom:8px">${sub}</div>` + cards.map(c =>
      `<div class="deckrow"><div class="deckwhat">${deckEffect(c)}</div>
       <div class="decksays">${esc(c.x).replace(/\*(.+?)\*/g, '<em>$1</em>')}</div></div>`).join('');

  sheet(`<h3>The decks</h3><div class="sub">everything that can be drawn</div>
    <p style="font-size:14px;line-height:1.5;color:var(--dim)">Both decks are dealt from a
    shuffled order and reshuffled when they run out, so neither can be counted after one pass.
    Amounts that depend on the table — the two that pay every overlord — are worked out when
    the card is drawn.</p>
    ${deck('Contingency', `${CONTINGENCY.length} cards · mostly movement`, CONTINGENCY)}
    ${deck('The Column', `${COLUMN.length} cards · mostly money`, COLUMN)}
    ${btns([['Close', 'closeSheet', 'pri wide']])}`);
}

// The line under a square's name. Italic when it is the author's — `qv` marks a
// line lifted from the novel — and plain when it was written for the game, so
// which is which is visible at the table rather than only in data.js.
function flavour(b) {
  if (!b.q) return '';
  return `<div class="flav${b.qv ? ' quoted' : ''}">${esc(b.q)}</div>`;
}

function showLedger() {
  let s = `<h3>The ledger</h3><div class="sub">what the board actually pays</div>
    <p style="font-size:14px;line-height:1.5;color:var(--dim)">Landing frequency is solved from
    the board and checked against the engine on every test run. Payback is opponent turns to
    recover a full set built to three garrisons.</p>
    <table><tr><th>Set</th><th>Traffic</th><th>Cost</th><th>Payback</th></tr>`;
  for (const [k, v] of Object.entries(SETS)) {
    const traffic = v.sq.reduce((a, i) => a + TRAFFIC[i], 0);
    const cost = v.sq.reduce((a, i) => a + BOARD[i].pr, 0) + v.gc * 3 * v.sq.length;
    s += `<tr><td style="color:${v.c}">${esc(v.n)}</td><td>${traffic.toFixed(1)}%</td>
      <td>${money(cost)}</td><td>${E.paybackTurns(k, TRAFFIC)}</td></tr>`;
  }
  s += `</table><p style="font-size:14px;color:var(--dim);line-height:1.5;margin-top:12px">
    The Holding Facility takes ${TRAFFIC[JAIL].toFixed(1)}% of all landings — more than twice any
    other square. Eden sits six, seven and eight squares past it, which is where two dice most
    want to land.</p>${btns([['The decks', 'showDecks', ''], ['Close', 'closeSheet', 'pri']])}`;
  sheet(s);
}

/* ---------------------------------------------------------- buy / auction */
function showOffer() {
  const p = E.current(G);
  const b = BOARD[p.pos];
  sheet(`<h3>${esc(b.n)}</h3><div class="sub">unclaimed · ${money(b.pr)}</div>
    <div class="stat"><span>Landing frequency</span><span>${TRAFFIC[p.pos].toFixed(2)}%</span></div>
    ${b.s ? `<div class="stat"><span>Set payback</span><span>${E.paybackTurns(b.s, TRAFFIC)} turns</span></div>` : ''}
    <div class="stat"><span>Your cash</span><span>${money(p.cash)}</span></div>
    ${p.debt ? `<div class="warnbox">A debt marker blocks purchases. This goes straight to sealed bid.</div>` : `
    <p style="font-size:14px;color:var(--dim);margin:14px 0 0;line-height:1.5">
    Decline and it goes to sealed bid. Everyone bids blind, once. Highest takes it.</p>`}
    ${btns(p.debt
      ? [['To auction', 'declineToAuction|0', 'pri wide']]
      : [[`Buy ${money(b.pr)}`, 'buyNow', 'pri'],
         ['Decline, but bid', 'declineToAuction|0', ''],
         ['Decline and pass', 'declineToAuction|1', 'wide',
          'Confirm — no bid at all on this one']])}`);
  if (!p.debt && p.cash < b.pr) {
    const el = $('sheetRoot').querySelector('.mbtn.pri');
    if (el) { el.disabled = true; el.textContent = 'Not enough cash'; }
  }
}
function buyNow() { closeSheet(); E.buy(G, E.current(G)); tick(); }
// "Decline and pass" is the common case — you did not want it at any price —
// and it used to cost you a sheet, a typed zero and a pass of the phone anyway.
function declineToAuction(sitOut) {
  const p = E.current(G);
  closeSheet();
  E.openAuction(G, p.pos, sitOut === '1' ? [p.i] : []);
  tick();
}

function showBid() {
  const a = G.auction;
  const p = G.players[a.queue[a.at]];
  const b = BOARD[a.sq];
  sheet(`<h3>${a.round === 2 ? 'Tied — bid again' : 'Sealed bid'}</h3>
    <div class="sub">${esc(b.n)} · ${esc(p.name)} only</div>
    ${a.round === 2 ? `<div class="warnbox">Level at ${money(a.tiedAt)}. Only the tied
      bidders go again, and none of you may go below ${money(a.tiedAt)}. Still level after
      this and it falls to turn order.</div>` : ''}
    ${a.queue.length > 1 ? `<div class="warnbox"><b>Pass the phone to ${esc(p.name)}.</b>
      Nobody sees any bid until every bid is in.</div>` : ''}
    <div class="stat"><span>List price</span><span>${money(b.pr)}</span></div>
    <div class="stat"><span>You hold</span><span>${money(p.cash)}</span></div>
    <div class="stat"><span>Landing frequency</span><span>${TRAFFIC[a.sq].toFixed(2)}%</span></div>
    ${b.s ? `<div class="stat"><span>Set payback</span><span>${E.paybackTurns(b.s, TRAFFIC)} turns</span></div>` : ''}
    <input type="number" id="bidIn" inputmode="numeric" placeholder="${a.round === 2 ? a.tiedAt : 0}"
      min="${a.round === 2 ? Math.min(a.tiedAt, p.cash) : 0}" max="${p.cash}" style="margin-top:14px">
    ${btns([
      ['Seal it', `sealBid|${p.i}`, 'pri'],
      ['No bid', `sealBid|${p.i}|0`, ''],
      [`Everything · ${money(p.cash)}`, `sealBid|${p.i}|max`, 'wide',
       `Confirm — bid every credit you hold (${money(p.cash)})`]
    ])}`);
  setTimeout(() => { const el = $('bidIn'); if (el) el.focus(); }, 80);
}
function sealBid(i, preset) {
  const p = G.players[+i];
  const el = $('bidIn');
  const amount = preset === '0' ? 0
    : preset === 'max' ? p.cash
    : (el ? el.value : 0);
  E.submitBid(G, +i, amount);
  closeSheet();
  setTimeout(tick, 120);
}
function showAuctionResult() {
  const a = G.auction;
  const b = BOARD[a.sq];
  // One bid or none is not a result worth a sheet and a tap — it is already in
  // the ledger. Only show the reveal when there was actually a contest.
  if (a.ranked.filter(e => e.v > 0).length <= 1) { endAuction(); return; }
  let s = `<h3>Bids revealed</h3><div class="sub">${esc(b.n)}</div>`;
  for (const e of a.ranked) {
    s += `<div class="stat"><span style="color:${pipOf(e.p)}">${esc(e.p.name)}</span>
      <span>${e.v > 0 ? money(e.v) : 'no bid'}</span></div>`;
  }
  s += a.winner === null || a.winner === undefined
    ? `<div class="card">Nobody bid. It stays unclaimed.</div>`
    : `<div class="card">${esc(G.players[a.winner].name)} takes it for ${money(a.price)}.${
        a.tiebreak === 'order'
          ? ` Level at ${money(a.price)} even after the runoff, so it fell to turn order.`
          : a.round === 2 ? ' Won on the second round, after a tie.' : ''}</div>`;
  s += btns([['Continue', 'endAuction', 'pri wide']]);
  sheet(s);
}
function endAuction() { closeSheet(); E.closeAuction(G); tick(); }

/* ---------------------------------------------------------- contested claim */
function showClaim() {
  const c = G.contest;
  const p = G.players[c.queue[c.at]];
  const v = G.players[c.vassal];
  const incumbent = p.i === c.incumbent;
  sheet(`<h3>Competing claim</h3><div class="sub">${esc(v.name)} · ${esc(p.name)} only</div>
    ${c.queue.length > 1 ? `<div class="warnbox"><b>Pass the phone to ${esc(p.name)}.</b></div>` : ''}
    <p style="font-size:14.5px;line-height:1.5;color:var(--dim)">
    ${incumbent
      ? `You already hold ${esc(v.name)}. ${esc(G.players[c.claimant].name)} is trying to take them.`
      : `${esc(v.name)} cannot settle with you — but ${esc(G.players[c.incumbent].name)} already holds their oath.`}
    Sealed, once. The higher claim pays it to the bank and takes the vassal. A tie holds for the incumbent.</p>
    <div class="stat"><span>Their holdings</span><span>${money(E.holdingsValue(v))}</span></div>
    <div class="stat"><span>Your cash</span><span>${money(p.cash)}</span></div>
    <input type="number" id="bidIn" inputmode="numeric" placeholder="0" min="0" max="${p.cash}" style="margin-top:14px">
    ${btns([['Seal it', `sealClaim|${p.i}`, 'pri wide']])}`);
  setTimeout(() => { const el = $('bidIn'); if (el) el.focus(); }, 80);
}
function sealClaim(i) {
  const el = $('bidIn');
  E.submitClaim(G, +i, el ? el.value : 0);
  closeSheet();
  setTimeout(tick, 120);
}
function showContestResult() {
  const c = G.contest;
  const v = G.players[c.vassal], a = G.players[c.incumbent], b = G.players[c.claimant];
  sheet(`<h3>Claim resolved</h3><div class="sub">${esc(v.name)}</div>
    <div class="stat"><span style="color:${pipOf(a)}">${esc(a.name)} (incumbent)</span><span>${money(c.bids[a.i] || 0)}</span></div>
    <div class="stat"><span style="color:${pipOf(b)}">${esc(b.name)}</span><span>${money(c.bids[b.i] || 0)}</span></div>
    <div class="card">${c.moved
      ? `${esc(b.name)} pays ${money(c.bids[b.i] || 0)} and takes the oath of ${esc(v.name)}. Whatever ${esc(v.name)} had buried, they begin again.`
      : `${esc(a.name)} holds. ${esc(v.name)} stays where they were — and half of what they had put aside is spent defending nothing.`}</div>
    ${btns([['Continue', 'endContest', 'pri wide']])}`);
}
function endContest() { closeSheet(); E.closeContest(G); tick(); }

/* ---------------------------------------------------------- cards */
function showCard() {
  const { card, isContingency } = G.pendingCard;
  sheet(`<h3>${isContingency ? 'Contingency' : 'The Column'}</h3>
    <div class="sub">${esc(E.current(G).name)}</div>
    <div class="card">${esc(card.x).replace(/\*(.+?)\*/g, '<em>$1</em>')}</div>
    ${cardEffectLines(E.cardEffect(G, card))}
    ${btns([['Enter it', 'takeCard', 'pri wide']])}`);
}

// The flavour text is written to be read. This says what it does.
//
// Worth its space for two reasons beyond clarity: a card that moves you also
// resolves the square it lands on with no stop in between, so without this the
// arrival is the first the player hears of a bill; and a per-garrison charge
// has an amount that only the game knows.
function cardEffectLines(e) {
  const out = [];
  if (e.cash !== null) out.push(e.cash > 0 ? `Gain ${money(e.cash)}` : `Pay ${money(-e.cash)}`);
  if (e.each) {
    out.push(e.each.incoming
      ? `Collect ${money(e.each.rate)} from each of the other ${e.each.others} — ${money(e.each.total)}`
      : `Pay ${money(e.each.rate)} to each of the other ${e.each.others} — ${money(e.each.total)}`);
  }
  if (e.pardon) out.push('Keep an Overseer favour — walks you out of detention, free');
  if (e.per) {
    out.push(e.per.count === 0
      ? `${money(e.per.rate)} for each ${e.per.of} — you hold none, so nothing`
      : `Pay ${money(e.per.rate)} for each of your ${e.per.count} ${e.per.of}${e.per.count === 1 ? '' : 's'} — ${money(e.per.total)}`);
  }
  if (e.detention) out.push('Straight to Overseer Detention, without passing the ledger opening');
  else if (e.to !== null) {
    out.push(`Move to ${esc(e.name)}`
      + (e.passesStart ? `, collecting ${money(e.award)} as the ledger opens` : ''));
    const t = e.then;
    if (t) {
      if (t.kind === 'rent') out.push(`Held by ${esc(chipName(G.players[t.to]))} — you will pay ${money(t.amount)} on arrival`);
      else if (t.kind === 'unowned') out.push(`Unclaimed — you may take it for ${money(t.amount)}`);
      else if (t.kind === 'tax') out.push(`You will pay ${money(t.amount)} on arrival`);
      else if (t.kind === 'own') out.push('Your own holding — nothing due');
      else if (t.kind === 'pledged') out.push('Pledged — nothing due');
      else if (t.kind === 'card') out.push('You will draw again');
    }
  }
  if (!out.length) return '';
  return `<div class="effect">${out.map(l => `<div>${l}</div>`).join('')}</div>`;
}

/* ---------------------------------------------------------- manage */
const manageState = h => h.mortgaged ? 'PLEDGED' : h.citadel ? 'CITADEL'
  : `${h.garrisons} garrison${h.garrisons === 1 ? '' : 's'}`;

function manageControls(p, h) {
  let c = '';
  if (E.canBuild(G, p, h.sq)) c += `<button data-fn="build|${h.sq}">+G</button>`;
  if (E.canRaiseCitadel(G, p, h.sq)) c += `<button data-fn="raiseCitadel|${h.sq}">◆</button>`;
  if (h.garrisons > 0 || h.citadel) c += `<button data-fn="sellDev|${h.sq}">−</button>`;
  if (!h.garrisons && !h.citadel) {
    c += `<button data-fn="toggleMortgage|${h.sq}">${h.mortgaged ? 'Redeem' : 'Pledge'}</button>`;
  }
  return c;
}

// What another player holds. Ownership is already public — the board draws an
// owner's ring and the garrison marks on every square — so this aggregates what
// you could already get by squinting at forty cells, and reveals nothing.
// Checked before building it: there is no hidden state to leak. `strength` and
// `tithe` are the only per-player extras and neither is secret.
//
// Rent is the figure that actually decides a trade, so it is the one shown
// against each square, at its current development.
function showPlayer(i) {
  const p = G.players[i];
  if (!p) return;
  const worth = E.netWorth(G, p);
  const gar = p.holdings.reduce((n, h) => n + h.garrisons, 0);
  const cit = p.holdings.filter(h => h.citadel).length;

  let s = `<h3>${esc(p.name)}</h3>
    <div class="sub">${p.kind === 'ai' ? esc(PERSONAS[p.persona].d) : 'At the table'}</div>
    <div class="stat"><span>Cash</span><span>${money(p.cash)}</span></div>
    <div class="stat"><span>Worth</span><span>${money(worth)}</span></div>`;
  if (p.debt) s += `<div class="stat"><span style="color:var(--warn)">Debt</span><span style="color:var(--warn)">${money(p.debt)}</span></div>`;
  s += `<div class="stat"><span>Holdings</span><span>${p.holdings.length} · ${gar} garrison${gar === 1 ? '' : 's'} · ${cit} citadel${cit === 1 ? '' : 's'}</span></div>`;
  if (p.lord !== null && p.lord !== undefined) {
    s += `<div class="stat"><span>Vassal of</span><span>${esc(G.players[p.lord].name)} · ${G.players[p.lord].tithe}% tithe</span></div>`;
  }
  if (p.vassals.length) {
    s += `<div class="stat"><span>Overlord of</span><span>${p.vassals.map(v => esc(chipName(G.players[v]))).join(', ')} · ${p.tithe}% tithe</span></div>`;
  }

  if (!p.holdings.length) {
    s += `<p style="color:var(--dim);font-size:15px;margin-top:14px">Holds nothing yet.</p>`;
  } else {
    // Grouped by colour set, because a set is the unit that changes rent, and
    // "2 of 3" is the thing you are actually reading for.
    const groups = new Map();
    for (const h of p.holdings) {
      const b = BOARD[h.sq];
      const key = b.s || (b.t === 'f' ? '_fleet' : b.t === 'u' ? '_util' : '_other');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(h);
    }
    const label = key => key === '_fleet' ? 'Fleets' : key === '_util' ? 'Utilities'
      : key === '_other' ? 'Other' : SETS[key].n;
    const colour = key => key === '_fleet' ? 'var(--fleet)' : key === '_util' ? 'var(--util)'
      : key === '_other' ? 'var(--dim)' : SETS[key].c;
    const order = [...groups.keys()].sort((a, b) =>
      (a.startsWith('_') ? 1 : 0) - (b.startsWith('_') ? 1 : 0) || a.localeCompare(b));

    for (const key of order) {
      const hs = groups.get(key).sort((a, b) => a.sq - b.sq);
      const total = key === '_fleet' ? FLEETS.length : key === '_util' ? UTILS.length
        : key.startsWith('_') ? hs.length : SETS[key].sq.length;
      const complete = hs.length >= total;
      s += `<div class="pgHead" style="color:${colour(key)}">${esc(label(key))}
        <span class="pgCount">${hs.length} of ${total}${complete ? ' · complete' : ''}</span></div>`;
      for (const h of hs) {
        const b = BOARD[h.sq];
        const rent = E.rentOf(G, h.sq);
        const dev = h.citadel ? 'citadel' : h.garrisons ? `${h.garrisons} garrison${h.garrisons === 1 ? '' : 's'}` : 'bare';
        s += `<div class="pgRow">
          <div class="pgName">${esc(b.n)}</div>
          <div class="pgState">${h.mortgaged ? 'pledged' : dev}</div>
          <div class="pgRent">${h.mortgaged ? '—' : money(rent)}</div></div>`;
      }
    }
    s += `<p class="note" style="margin-top:12px">Rent shown is what you would owe landing there
      now, at a roll of seven where the roll matters.</p>`;
  }
  s += btns([['Close', 'closeSheet', 'pri wide']]);
  sheet(s);
}

function showManage() {
  const p = E.current(G);
  let s = `<h3>Holdings</h3><div class="sub" data-mg="who"></div>
    <div class="stat"><span>Upkeep per turn</span><span data-mg="upkeep"></span></div>
    <div class="stat"><span>Pools</span><span data-mg="pools"></span></div>`;
  if (p.debt) {
    s += `<div class="warnbox">A debt marker blocks buying, building and contracts until it is cleared.
      It grows ${Math.round(RULES.debtInterest * 100)}% every turn.</div>`;
  }
  if (!p.holdings.length) s += `<p style="color:var(--dim);font-size:15px;margin-top:14px">Nothing held.</p>`;

  for (const h of [...p.holdings].sort((a, b) => a.sq - b.sq)) {
    const b = BOARD[h.sq];
    s += `<div class="row" data-row="${h.sq}">
      <div class="rowMain"><div class="rowName" style="color:${b.s ? SETS[b.s].c : 'var(--body)'}">${esc(b.n)}</div>
      <div class="rowState"></div></div>
      <div class="rowbtns">${manageControls(p, h)}</div></div>`;
  }
  if (p.debt) s += btns([[`Repay ${money(Math.min(p.cash, p.debt))}`, 'repay', 'dgr wide']]);
  s += btns([['Done', 'closeSheet', 'pri wide']]);
  sheet(s);
  refreshManage();
}

// Updates the open Holdings sheet IN PLACE.
//
// Rebuilding the whole sheet after every purchase threw away the scrolled
// element and put the list back at the top, so the row you had just tapped
// walked out from under your thumb and the next tap landed on a different
// holding. The row count never changes here — you cannot acquire or lose a
// property from this sheet — so only the text and the buttons need to move.
function refreshManage() {
  const root = $('sheetRoot');
  if (!root.querySelector('[data-mg="upkeep"]')) return;      // sheet not open
  const p = E.current(G);
  const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
  set('[data-mg="who"]', `${p.name} · ${money(p.cash)}${p.debt ? ` · debt ${money(p.debt)}` : ''}`);
  const g = p.holdings.reduce((n, h) => n + h.garrisons, 0);
  const c = p.holdings.filter(h => h.citadel).length;
  const parts = [];
  if (g) parts.push(`${g}×${money(RULES.garrisonUpkeep)}`);
  if (c) parts.push(`${c}×${money(RULES.citadelUpkeep)}`);
  if (p.vassals.length) parts.push(`${p.vassals.length} vassal${p.vassals.length === 1 ? '' : 's'}`);
  set('[data-mg="upkeep"]', money(E.upkeep(p)) + (parts.length ? ` · ${parts.join(' + ')}` : ''));
  set('[data-mg="pools"]', `${G.garrisonPool} garrisons · ${G.citadelPool} citadels`);

  for (const h of p.holdings) {
    const row = root.querySelector(`[data-row="${h.sq}"]`);
    if (!row) continue;
    // The +G button never said what it would take. The set's garrison cost is in
    // the square panel, which is two taps away and the wrong moment.
    const b = BOARD[h.sq];
    const gc = b.s ? SETS[b.s].gc : 0;
    let line = `${manageState(h)} · rent ${money(E.rentOf(G, h.sq, 7))}`;
    if (E.canBuild(G, p, h.sq)) line += ` · +G ${money(gc)}`;
    else if (E.canRaiseCitadel(G, p, h.sq)) line += ` · citadel ${money(gc)}`;
    else if (gc && !h.mortgaged && h.garrisons < 3 && !h.citadel) line += ` · +G ${money(gc)}`;
    row.querySelector('.rowState').textContent = line;
    const controls = row.querySelector('.rowbtns');
    const next = manageControls(p, h);
    if (controls.innerHTML !== next) { controls.innerHTML = next; bindSheet(controls); }
  }
  const repayBtn = root.querySelector('[data-fn="repay"]');
  if (repayBtn) repayBtn.textContent = `Repay ${money(Math.min(p.cash, p.debt))}`;
}

const afterManage = () => { save(); render(); refreshManage(); };
function build(sq) { E.build(G, E.current(G), +sq); afterManage(); }
function raiseCitadel(sq) { E.raiseCitadel(G, E.current(G), +sq); afterManage(); }
function sellDev(sq) { E.sellDevelopment(G, E.current(G), +sq); afterManage(); }
function toggleMortgage(sq) {
  const p = E.current(G), h = E.holding(p, +sq);
  if (h.mortgaged) E.redeem(G, p, +sq); else E.pledge(G, p, +sq);
  afterManage();
}
function repay() { E.repayDebt(G, E.current(G)); afterManage(); }

/* ---------------------------------------------------------- tithe / revolt */
function showTithe() {
  const p = E.current(G);
  sheet(`<h3>Tithe rate</h3>
    <div class="sub">${p.vassals.length} vassal${p.vassals.length > 1 ? 's' : ''} · upkeep ${money(E.upkeep(p))}/turn</div>
    <p style="font-size:14.5px;color:var(--dim);line-height:1.5">This share of everything your vassals
    hold counts toward your total — and every turn under it arms them. Squeeze harder and they are
    worth more to you, for less long. You cannot see how close they are.</p>
    <p style="font-size:13px;color:var(--dim);line-height:1.5;margin-top:-4px">The cash a tithe brings
    in is small beside the upkeep. You hold them to be holding them.</p>
    <div class="opts" style="margin-top:14px">${RULES.titheRates.map(r =>
      `<button class="opt${p.tithe === r ? ' on' : ''}" data-fn="setTithe|${r}">${r}%</button>`).join('')}</div>
    <div class="sub" style="margin:20px 0 6px">Let them go</div>
    <p style="font-size:13.5px;color:var(--dim);line-height:1.5;margin:0 0 8px">
    Holding them costs ${money(E.upkeep(p))} every turn. Release one and that
    stops — along with the tithe, and whatever they have buried against you.</p>
    ${p.vassals.map(vi => `<button class="pick" data-fn="release|${vi}">
      Release ${esc(G.players[vi].name)}
      <span class="sub2">sworn since falling · holds ${money(E.holdingsValue(G.players[vi]))}</span>
    </button>`).join('')}
    ${btns([['Done', 'closeSheet', 'pri wide']])}`);
}
function release(vi) {
  const p = E.current(G);
  if (!E.releaseVassal(G, p, +vi)) return;
  save();
  closeSheet();
  tick();
}

function setTithe(r) {
  E.setTithe(G, E.current(G), +r);
  save(); render();
  // In place, for the same reason Holdings is: rebuilding the sheet moves the
  // buttons out from under the thumb that just pressed one.
  const p = E.current(G), root = $('sheetRoot');
  root.querySelectorAll('[data-fn^="setTithe|"]').forEach(b =>
    b.classList.toggle('on', +b.dataset.fn.split('|')[1] === p.tithe));
  const sub = root.querySelector('.sub');
  if (sub) sub.textContent =
    `${p.vassals.length} vassal${p.vassals.length > 1 ? 's' : ''} · upkeep ${money(E.upkeep(p))}/turn`;
}

function showRevolt() {
  const p = E.current(G);
  const lord = G.players[p.lord];
  const threshold = E.revoltThreshold(p);
  const pc = Math.min(100, p.strength / threshold * 100);
  const ready = p.strength >= threshold;
  sheet(`<h3>The second ledger</h3><div class="sub">under ${esc(lord.name)} · tithe ${lord.tithe}%</div>
    <p style="font-size:14.5px;color:var(--dim);line-height:1.5">Strength buried inside freight tonnage.
    ${esc(lord.name)} cannot see this page.</p>
    <div class="stat"><span>Accumulated</span><span>${money(p.strength)} of ${money(threshold)}</span></div>
    <div class="bars"><i style="width:${pc}%"></i></div>
    ${ready
      ? `<p style="font-size:15px;color:var(--gold);margin-top:16px;line-height:1.5">You have enough.
         Declaring costs ${money(RULES.revoltCost)} and ends the arrangement permanently.</p>
         ${btns([
           [`Declare — ${money(RULES.revoltCost)}`, 'declare', 'pri',
            `Confirm — ${money(RULES.revoltCost)}, and the arrangement ends for good`],
           ['Not yet', 'closeSheet', '']])}`
      : `<p style="font-size:14px;color:var(--dim);margin-top:14px">Wait. Every turn under the arrangement is a turn counted, and the harder they squeeze the faster it counts.</p>
         ${btns([['Close', 'closeSheet', 'pri wide']])}`}`);
  if (ready && p.cash < RULES.revoltCost) {
    const el = $('sheetRoot').querySelector('.mbtn.pri');
    if (el) { el.disabled = true; el.textContent = 'Not enough cash'; }
  }
}
function declare() { E.declareIndependence(G, E.current(G)); closeSheet(); tick(); }

/* ---------------------------------------------------------- contracts */
let TR = null;
let COUNTER = null;      // a price an opponent named after refusing
// Opens the contract sheet with this square already asked for.
function offerFor(sq) {
  sq = +sq;
  const me = E.current(G);
  const owner = E.ownerOf(G, sq);
  if (!owner || owner.i === me.i || me.debt) return;
  closeSheet();
  TR = { from: me.i, to: owner.i, get: [sq], give: [], cash: 0, direction: 1 };
  drawTrade();
}

function showTrade() {
  const me = E.current(G);
  if (me.debt) {
    sheet(`<h3>Restructuring</h3><div class="sub">${esc(me.name)}</div>
      <p style="font-size:15px;line-height:1.5">A debt marker blocks contracts until it is cleared.</p>
      ${btns([['Close', 'closeSheet', 'pri wide']])}`);
    return;
  }
  const others = G.players.filter(q => q.i !== me.i);
  if (!TR || TR.from !== me.i) TR = { from: me.i, to: others[0].i, get: [], give: [], cash: 0, direction: 1 };
  drawTrade();
}

function drawTrade() {
  const me = G.players[TR.from], them = G.players[TR.to];
  const others = G.players.filter(q => q.i !== me.i);
  const suggestion = E.seekContract(G, me, me.persona || 'spector');

  const why = (owner, sq) => {
    const h = E.holding(owner, sq), b = BOARD[sq];
    if (h.garrisons > 0 || h.citadel) return 'garrisoned — sell buildings first';
    if (b.s && SETS[b.s].sq.some(j => {
      const o = E.ownerOf(G, j); if (!o) return false;
      const hh = E.holding(o, j); return hh && (hh.garrisons > 0 || hh.citadel);
    })) return `${SETS[b.s].n} is built up — clear the set first`;
    return null;
  };
  const row = (owner, sq, sel, fn) => {
    const b = BOARD[sq], blocked = why(owner, sq);
    // A pledged square may be traded now, so the line that used to refuse it is
    // a price instead: whoever ends up holding it owes this to make it earn.
    const h = E.holding(owner, sq);
    const pledged = h && h.mortgaged;
    return `<button class="pick${sel ? ' on' : ''}" ${blocked ? 'disabled' : `data-fn="${fn}"`}>
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:8px;
        background:${b.s ? SETS[b.s].c : 'var(--fleet)'}"></span>${esc(b.n)}
      <span class="sub2">${money(b.pr)} · ${pledged
        ? `pledged — ${money(E.redeemCost(sq))} to redeem`
        : `rent ${money(E.rentOf(G, sq, 7))}`}</span>
      ${blocked ? `<span class="why">${blocked}</span>` : ''}</button>`;
  };

  let s = `<h3>Draw a contract</h3><div class="sub">${esc(me.name)} · ${money(me.cash)} in hand</div>`;
  if (suggestion && suggestion.to === TR.to && !TR.get.length) {
    s += `<div class="warnbox" style="border-color:var(--gold);background:rgba(217,164,65,.08)">
      <b>${esc(BOARD[suggestion.get].n)}</b> would complete ${esc(SETS[BOARD[suggestion.get].s].n)} for you.</div>`;
  }
  s += `<div class="opts" style="margin-bottom:16px">${others.map(o =>
    `<button class="opt${TR.to === o.i ? ' on' : ''}" data-fn="tradeSet|to|${o.i}">${esc(chipName(o))}</button>`).join('')}</div>`;

  // Tapping a square adds or removes it. Up to RULES.tradeMax a side, which is
  // what makes "two lesser worlds for the one that closes a set" possible at all.
  s += `<div class="sub" data-count="get" style="margin:4px 0 8px">You receive — ${TR.get.length} of ${RULES.tradeMax}</div>`;
  s += them.holdings.length
    ? [...them.holdings].sort((a, b) => a.sq - b.sq).map(h => row(them, h.sq, TR.get.includes(h.sq), `tradeSet|get|${h.sq}`)).join('')
    : `<p style="color:var(--dim);font-size:14px">${esc(them.name)} holds nothing.</p>`;

  s += `<div class="sub" data-count="give" style="margin:18px 0 8px">You give — ${TR.give.length} of ${RULES.tradeMax}</div>`;
  s += [...me.holdings].sort((a, b) => a.sq - b.sq).map(h => row(me, h.sq, TR.give.includes(h.sq), `tradeSet|give|${h.sq}`)).join('');

  s += `<div class="sub" style="margin:18px 0 8px">Credits</div>
    <div class="opts" style="margin-bottom:10px">
      <button class="opt${TR.direction === 1 ? ' on' : ''}" data-fn="tradeSet|direction|1">You pay</button>
      <button class="opt${TR.direction === -1 ? ' on' : ''}" data-fn="tradeSet|direction|-1">They pay</button></div>
    <input type="number" id="trCash" inputmode="numeric" value="${TR.cash || ''}" min="0" placeholder="0">
    <div class="tradeSum"></div>
    ${btns([['Propose', 'sendTrade', 'pri'], ['Cancel', 'closeSheet', '']])}`;
  sheet(s);
  const cashEl = $('trCash');
  if (cashEl) {
    // Empty rather than a literal 0, and select-all on focus, so a number can be
    // typed straight in instead of deleted first.
    cashEl.onfocus = () => cashEl.select();
    cashEl.oninput = () => { readTradeCash(); refreshTrade(); };
  }
  refreshTrade();
}

function tradeSet(key, value) {
  readTradeCash();
  const v = value === 'null' ? null : +value;
  if (key === 'to') {
    // Switching counterparty changes the whole "you receive" list, so this one
    // genuinely has to rebuild.
    TR.to = v; TR.get = []; TR.give = [];
    drawTrade();
    return;
  }
  // Which way the credits move is a scalar, not a list. Without this branch it
  // fell through to the toggle below and threw `list.indexOf is not a function`
  // on a number, so the tap did nothing at all — and since direction starts at
  // 1, a human could never draw a contract where the other side pays THEM. The
  // engine had always supported it; only the interface could not ask.
  if (key === 'direction') {
    TR.direction = v === -1 ? -1 : 1;
    refreshTrade();
    return;
  }
  // Toggle. Tapping a chosen square takes it back out, which is the only way to
  // change your mind without starting the contract again.
  const list = TR[key];
  const at = list.indexOf(v);
  if (at >= 0) list.splice(at, 1);
  else if (list.length < RULES.tradeMax) list.push(v);
  else return;                       // at the cap: say nothing, change nothing
  refreshTrade();
}

const readTradeCash = () => {
  const el = $('trCash');
  if (el) TR.cash = Math.max(0, parseInt(el.value, 10) || 0);
};

// What each side is worth AT LIST. Deliberately not a fairness score: a square
// that completes your set is worth several times its list price, and a scorer
// that did not know that would confidently call a brilliant trade a bad one.
function tradeTotals() {
  const sum = list => list.reduce((n, i) => n + BOARD[i].pr, 0);
  const cash = TR.cash || 0;
  return {
    youGet: sum(TR.get) + (TR.direction === -1 ? cash : 0),
    youGive: sum(TR.give) + (TR.direction === 1 ? cash : 0)
  };
}

// Which sets a whole bundle finishes for somebody. Asked per square, two
// squares of the same set each looked like they completed nothing, because
// each was counted without the other.
function completesFor(list, who) {
  const squares = Array.isArray(list) ? list : list === null || list === undefined ? [] : [list];
  const bySet = new Map();
  for (const sq of squares) {
    const b = BOARD[sq];
    if (b.s) bySet.set(b.s, (bySet.get(b.s) || 0) + 1);
  }
  const done = [];
  for (const [key, incoming] of bySet) {
    const held = SETS[key].sq.filter(j => {
      const o = E.ownerOf(G, j);
      return o && o.i === who.i;
    }).length;
    if (held + incoming >= SETS[key].sq.length) done.push(SETS[key].n);
  }
  return done.length ? done.join(' and ') : null;
}

// Selection and totals update in place. Rebuilding the whole sheet on every tap
// scrolled a long list back to the top and moved the row out from under the
// thumb that had just pressed it — the same defect Holdings had.
function refreshTrade() {
  const root = $('sheetRoot');
  if (!root.querySelector('.tradeSum')) return;
  const me = G.players[TR.from], them = G.players[TR.to];

  root.querySelectorAll('[data-fn^="tradeSet|get|"]').forEach(b =>
    b.classList.toggle('on', TR.get.includes(+b.dataset.fn.split('|')[2])));
  root.querySelectorAll('[data-fn^="tradeSet|give|"]').forEach(b =>
    b.classList.toggle('on', TR.give.includes(+b.dataset.fn.split('|')[2])));
  // The counts in the two headings move as squares go in and out.
  const heads = root.querySelectorAll('[data-count]');
  heads.forEach(h => {
    const k = h.dataset.count;
    h.textContent = `${k === 'get' ? 'You receive' : 'You give'} — ${TR[k].length} of ${RULES.tradeMax}`;
  });
  root.querySelectorAll('[data-fn^="tradeSet|direction|"]').forEach(b =>
    b.classList.toggle('on', +b.dataset.fn.split('|')[2] === TR.direction));

  const t = tradeTotals();
  const mine = completesFor(TR.get, me), theirs = completesFor(TR.give, them);
  root.querySelector('.tradeSum').innerHTML =
    `<div class="sumRow"><span>You receive</span><span>${money(t.youGet)} at list</span></div>
     <div class="sumRow"><span>You give</span><span>${money(t.youGive)} at list</span></div>
     ${mine ? `<div class="sumFlag">Completes ${esc(mine)} for you</div>` : ''}
     ${theirs ? `<div class="sumFlag warn">Completes ${esc(theirs)} for ${esc(chipName(them))}</div>` : ''}`;

  const propose = root.querySelector('[data-fn="sendTrade"]');
  if (propose) propose.disabled = TR.get === null && TR.give === null;
}

function sendTrade() {
  readTradeCash();
  const proposal = { ...TR };
  closeSheet();
  const r = E.proposeContract(G, proposal);
  if (!r.ok) {
    sheet(`<h3>Not a legal contract</h3><div class="sub">nothing was exchanged</div>
      <p style="font-size:15px;line-height:1.5">Both sides must be free of debt, anything
      changing hands must be unmortgaged and unbuilt, and whoever is paying must
      hold the money.</p>${btns([['Close', 'closeSheet', 'pri wide']])}`);
    return;
  }
  if (r.pending) { tick(); return; }              // a human must answer
  if (!r.accepted) {
    const them = G.players[proposal.to];
    const line = G.log[0];
    if (r.counter) {
      COUNTER = r.counter;
      const me = G.players[proposal.from];
      // Which way the money runs decides every line on this sheet. A counter to
      // a SALE — the direction a pledged square is nearly always disposed of
      // through — is them naming what they will pay, not what they want, and
      // the affordability check belongs on their purse rather than yours.
      const selling = proposal.direction === 2;
      sheet(`<h3>Refused — but they name a price</h3><div class="sub">${esc(them.name)}</div>
        <div class="card">“${esc(line ? line.text : '')}”</div>
        <div class="stat"><span>You asked</span><span>${money(proposal.cash)}</span></div>
        <div class="stat"><span>${selling ? 'They will pay' : 'They want'}</span>
          <span>${money(r.counter.cash)}</span></div>
        <div class="stat"><span>${selling ? 'They hold' : 'You hold'}</span>
          <span>${money(selling ? them.cash : me.cash)}</span></div>
        ${btns([
          [selling ? `Take ${money(r.counter.cash)}` : `Pay ${money(r.counter.cash)}`,
           'takeCounter', 'pri', `Confirm — ${money(r.counter.cash)}`],
          ['Walk away', 'closeSheet', '']
        ])}`);
      const payer = selling ? them : me;
      if (payer.cash < r.counter.cash) {
        const el = $('sheetRoot').querySelector('.mbtn.pri');
        if (el) {
          el.disabled = true;
          el.textContent = selling ? 'They cannot cover it' : 'You cannot cover it';
        }
      }
    } else {
      sheet(`<h3>Refused</h3><div class="sub">${esc(them.name)}</div>
        <div class="card">“${esc(line ? line.text : 'No.')}”</div>
        ${btns([['Close', 'closeSheet', 'pri wide']])}`);
    }
  }
  save(); render();
}

function takeCounter() {
  if (!COUNTER) return;
  const c = COUNTER;
  COUNTER = null;
  closeSheet();
  if (!E.contractIsLegal(G, c)) { tick(); return; }
  // The payer is whoever the direction says it is. Checking the proposer's
  // purse on a sale checked the wrong person entirely.
  const payer = G.players[c.direction === 2 ? c.to : c.from];
  if (payer.cash < c.cash) { tick(); return; }
  E.settleContract(G, c);
  save();
  tick();
}

function showContract() {
  const c = G.contract;
  const from = G.players[c.from], to = G.players[c.to];
  // `to` is the human being asked. A square is worth what it does to THEIR
  // board, so every line below is from their side of the table: what colour it
  // is, how much of that colour each of them ends up holding, and — for fleets
  // and utilities, whose rent is purely a count — what they would charge after.
  // A contract can carry several squares each way now, so the heading is written
  // once and each square gets its own block underneath.
  const briefAll = (list, label, gaining) => {
    const squares = E.sqList(list);
    if (!squares.length) return '';
    return `<div class="sub" style="margin:14px 0 6px">${label}${
      squares.length > 1 ? ` — ${squares.length} squares` : ''}</div>`
      + squares.map(sq => brief(sq, gaining)).join('');
  };
  // Counts must reflect the WHOLE contract, not one square at a time. With two
  // squares of the same set moving together, per-square arithmetic reports each
  // as if the other were not in the deal and both come out wrong.
  const toGains = E.sqList(c.give), toLoses = E.sqList(c.get);
  const inSet = (list, key) => list.filter(sq => BOARD[sq].s === key).length;
  const ofType = (list, t) => list.filter(sq => BOARD[sq].t === t).length;

  // A set's arithmetic is a property of the whole contract, so it is printed
  // once. Printed per square, a two-for-one inside one set repeated the same
  // "2 → 2" under both, which reads like a bug even though it is right.
  const shown = new Set();
  const brief = (sq, gaining) => {
    const b = BOARD[sq];
    let s = `<div class="stat"><span>${esc(b.n)}</span><span>${money(b.pr)}</span></div>`;
    const tag = b.s || b.t;
    const first = !shown.has(tag);
    shown.add(tag);

    if (b.s && first) {
      const set = SETS[b.s], key = b.s;
      const mine = set.sq.filter(i => (E.ownerOf(G, i) || {}).i === to.i).length;
      const after = mine + inSet(toGains, key) - inSet(toLoses, key);
      const theirsNow = set.sq.filter(i => (E.ownerOf(G, i) || {}).i === from.i).length;
      const theirsThen = theirsNow + inSet(toLoses, key) - inSet(toGains, key);
      s += `<div class="stat"><span><i class="swatch" style="background:${set.c}"></i>
        ${esc(set.n)}</span><span>of ${set.sq.length}</span></div>
        <div class="stat sub2"><span>you</span><span>${mine} → <b>${after}</b></span></div>
        <div class="stat sub2"><span>${esc(chipName(from))}</span>
          <span>${theirsNow} → <b>${theirsThen}</b></span></div>`;
      if (after === set.sq.length && mine < set.sq.length) {
        s += `<div class="warnbox ok">This completes ${esc(set.n)} for you. Rent doubles
          across the set and you can garrison it.</div>`;
      } else if (mine === set.sq.length && after < set.sq.length) {
        s += `<div class="warnbox">This breaks your ${esc(set.n)}. You lose the doubled
          rent on all ${set.sq.length}.</div>`;
      }
      if (theirsThen === set.sq.length && theirsNow < set.sq.length) {
        s += `<div class="warnbox">This completes ${esc(set.n)} for ${esc(from.name)}.</div>`;
      }
    } else if ((b.t === 'f' || b.t === 'u') && first) {
      const kind = b.t;
      const held = E.countType(to, kind);
      const after = held + ofType(toGains, kind) - ofType(toLoses, kind);
      s += `<div class="stat"><span><i class="swatch" style="background:var(--${kind === 'f' ? 'fleet' : 'util'})"></i>
        ${kind === 'f' ? 'Fleets' : 'Utilities'} held</span>
        <span>${held} → <b>${after}</b></span></div>`;
      // Rent on these is a count, so the figure that matters is what YOU would
      // charge afterwards — not what it earns its current owner today.
      const rate = n => kind === 'f' ? (FLEET_RENT[n] || 0) : n === 2 ? 70 : n === 1 ? 28 : 0;
      const now = rate(held), then = rate(after);
      s += `<div class="stat"><span>You would charge</span>
        <span>${money(now)} → <b style="color:${then > now ? 'var(--tx)' : 'var(--warn)'}">${money(then)}</b>${
          kind === 'u' ? ' <small>on a 7</small>' : ''}</span></div>`;
    }

    // A pledged square is the one thing on this sheet that does not say what it
    // is. It earns nothing, so "Rent now ₡0" reads as a worthless square — and
    // it is not: it counts as owned, so taking it doubles the rent across the
    // rest of the set and unlocks building on those straight away, while itself
    // staying dead until somebody pays to redeem it.
    //
    // Both halves have to be said, and to whichever side is receiving it. A
    // seller who thinks they are handing over a dead asset is handing over a
    // monopoly; a buyer who does not see the redemption is reading the price
    // wrong by more than half the list.
    const held = E.holding(gaining ? from : to, sq);
    if (held && held.mortgaged) {
      s += `<div class="warnbox"><b>${esc(b.n)} is pledged.</b> It earns nothing until
        ${money(E.redeemCost(sq))} is paid to redeem it — but it still counts toward
        ${b.s ? esc(SETS[b.s].n) : 'its group'} for whoever holds it.</div>`;
    }
    s += `<div class="stat"><span>Rent now</span><span>${money(E.rentOf(G, sq, 7))}</span></div>
      <div class="stat"><span>Landing frequency</span><span>${TRAFFIC[sq].toFixed(2)}%</span></div>`;
    return s;
  };
  sheet(`<h3>${esc(from.name)} → ${esc(to.name)}</h3>
    <div class="sub">${esc(to.name)}'s eyes only — pass the phone</div>
    ${briefAll(c.get, `${esc(to.name)} gives up`, false)}
    ${briefAll(c.give, `${esc(to.name)} receives`, true)}
    <div class="card">${c.cash
      ? (c.direction === 1
        ? `${esc(to.name)} also receives ${money(c.cash)}`
        : `${esc(to.name)} also pays ${money(c.cash)}`)
      : 'No credits change hands.'}</div>
    ${btns([['Accept', 'answerContract|1', 'pri'], ['Refuse', 'answerContract|0', 'dgr']])}`);
}
function answerContract(accept) {
  closeSheet();
  E.respondToContract(G, accept === '1');
  tick();
}

/* ---------------------------------------------------------- settlement */
// You owe more than you hold. The engine used to strip your board for you, in
// an order that broke your best citadel before your worst holding. Now you
// choose — or press Auto and get the sane order.
function showSettle() {
  const st = G.settlement;
  if (!st) return;
  const p = G.players[st.player];
  const short = Math.max(0, st.owed - p.cash);
  const owedTo = st.to === null ? 'the bank' : G.players[st.to].name;
  const canRaise = E.raisableValue(G, p);

  const rows = [...p.holdings].sort((a, b) => a.sq - b.sq).map(h => {
    const b = BOARD[h.sq];
    const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;
      margin-right:8px;background:${b.s ? SETS[b.s].c : 'var(--fleet)'}"></span>`;
    if (h.citadel) {
      return `<button class="pick" data-fn="settleBreak|${h.sq}">${swatch}Break the citadel on ${esc(b.n)}
        <span class="sub2">raises ${money(Math.floor(SETS[b.s].gc * 5 / 2))} · rent falls to ${money(b.r[3])}</span></button>`;
    }
    if (h.garrisons > 0) {
      return `<button class="pick" data-fn="settleSellG|${h.sq}">${swatch}Sell a garrison on ${esc(b.n)}
        <span class="sub2">raises ${money(Math.floor(SETS[b.s].gc / 2))} · ${h.garrisons} there now</span></button>`;
    }
    if (h.mortgaged) {
      return `<button class="pick" disabled>${swatch}${esc(b.n)}
        <span class="why">already pledged</span></button>`;
    }
    return `<button class="pick" data-fn="settlePledge|${h.sq}">${swatch}Pledge ${esc(b.n)}
      <span class="sub2">raises ${money(E.pledgeValue(h.sq))} · pays no rent until redeemed for ${money(E.redeemCost(h.sq))}</span></button>`;
  }).join('');

  const enough = p.cash >= st.owed;
  sheet(`<h3>${enough ? 'Settled' : 'You are short'}</h3>
    <div class="sub">${esc(p.name)} · owed to ${esc(owedTo)}</div>
    <div class="stat"><span>Due</span><span>${money(st.owed)}</span></div>
    <div class="stat"><span>In hand</span><span>${money(p.cash)}</span></div>
    <div class="stat"><span>Still to find</span>
      <span style="color:${short ? 'var(--warn)' : 'var(--tx)'}">${money(short)}</span></div>
    ${short > canRaise ? `<div class="warnbox">Everything you hold would raise ${money(canRaise)}.
      That is not enough, and ${st.to === null
        ? 'the shortfall becomes a debt marker at 10% a turn.'
        : `you will enter vassalage under ${esc(owedTo)}.`}</div>` : ''}
    ${rows || '<p style="color:var(--dim);font-size:14px">Nothing left to raise against.</p>'}
    ${btns([
      [enough ? `Pay ${money(st.owed)}` : 'Settle for what I have', 'settleDone', 'pri'],
      ['Auto', 'settleAuto', '']
    ])}`);
}

function afterSettleAction() { save(); render(); showSettle(); }
function settlePledge(sq) { E.pledge(G, G.players[G.settlement.player], +sq); afterSettleAction(); }
function settleSellG(sq) { E.sellDevelopment(G, G.players[G.settlement.player], +sq); afterSettleAction(); }
function settleBreak(sq) { E.sellDevelopment(G, G.players[G.settlement.player], +sq); afterSettleAction(); }
function settleAuto() { E.autoSettle(G); afterSettleAction(); }
function settleDone() { closeSheet(); E.settleNow(G); tick(); }

/* ---------------------------------------------------------- endings */
function showFinal() {
  const rows = E.standings(G);
  const champion = G.players[G.winner];
  // "Circuit 49 of 48" — which is true, and reads like a defect. The counter
  // steps past the limit and THAT is what ends the game, so a swarm ending is
  // always one over. It is not a number worth showing at all there: the run
  // finished, and how long it was is the thing to say. A conquest ending does
  // want its circuit, because the interesting part is that it came early.
  const playOn = E.playOnCircuits(G);
  const closed = G.endReason === 'conquest'
    ? `taken on circuit ${G.circuit} of ${G.circuits}`
    : `${G.circuits} circuits · the swarm arrives`;
  sheet(`<h3>The ledger closes</h3><div class="sub">${closed}</div>
    <div class="card">${G.endReason === 'conquest'
      ? `Every column posts to one page. <b>${esc(champion.name)}</b> holds the galaxy outright.`
      : `They do not stop. They were never going to stop. On totals, <b>${esc(champion.name)}</b>
         holds the strongest column when the swarm arrives.`}</div>
    ${G.endReason === 'conquest' ? '' :
      `<div class="flav quoted">I have known the bottom line for fifteen years, and I built
       everything anyway, and I would sign it all again — every clause, every world, every
       soul — for one more hour of this. Let it come audited.</div>`}
    <table><tr><th>Player</th><th>Holdings</th><th>Status</th></tr>
    ${rows.map(r => `<tr><td style="color:${pipOf(r.player)}">${esc(r.player.name)}</td>
      <td>${money(r.worth)}</td><td>${esc(r.status)}</td></tr>`).join('')}</table>
    ${btns([
      // Offered on both endings. It used to be withheld from a conquest, which
      // was the one place it had become the more interesting of the two: a
      // vassal can declare independence now, so carrying on from "one player
      // holds everybody" is a run at whether they can hold them. checkVictory
      // only fires when somebody is bound, contested or released, so extending
      // does not simply end the game again on the next check.
      //
      // The figure comes from the engine so the label cannot drift from what
      // the button does. A conquest usually adds nothing at all — it stopped
      // early and the circuits it stopped short of are still there.
      [playOn === 0 ? `Play on — ${E.swarmDistance(G)} circuits still stand`
                    : `Play on — +${playOn} circuits`, 'playOn', 'wide'],
      ['Copy result', 'copyResult', ''],
      ['New game', 'newGame', 'pri', 'Confirm — starts over'],
      ['Back to board', 'closeSheet', 'wide']
    ])}<div id="cpOut"></div>`);
}
function playOn() { E.extendGame(G); closeSheet(); tick(); }

function newGame() {
  clearSave();
  G = null;
  closeSheet();
  // The swarm does not follow you back to the menu.
  //
  // This is the only route from a game to the setup screen, and it used to leave
  // every piece of the sound exactly where the game had left it: the bed still
  // droning and clacking, the score still ducked under it, and the tuning still
  // thirty-eight cents flat from the takeover. Nothing anywhere told the sound a
  // game had ended — resetSoundWatch was called on the way IN to a game, so it
  // came right only once the next one started.
  //
  // The score itself plays on, because the setup screen has always had it and
  // its own Sound switch starts it. What stops is everything that belonged to
  // the game that just finished.
  resetSoundWatch();
  Score.set(moodFor(null));
  era++;                            // nothing still in flight belongs to anything now
  $('game').classList.add('hidden');
  $('setup').classList.remove('hidden');
  drawSetup();
}

function copyResult() {
  const rows = E.standings(G)
    .map(r => `${r.player.name}: ${money(r.worth)} (${r.status})`).join('\n');
  const text = `GRANDIOSE — THE LEDGER\nCircuit ${G.circuit}/${G.circuits}\n\n${rows}\n\nLast entries:\n`
    + G.log.slice(0, 14).map(l => (l.kind === 'voice' ? G.players[l.who].name + ': ' : '') + l.text).join('\n');
  const out = $('cpOut');
  const fallback = () => {
    if (out) out.innerHTML = `<textarea style="width:100%;min-height:150px;margin-top:12px;background:var(--deep);
      color:var(--body);border:1px solid var(--rule);border-radius:6px;font-family:var(--m);font-size:12px">${esc(text)}</textarea>`;
  };
  if (!navigator.clipboard) { fallback(); return; }
  navigator.clipboard.writeText(text).then(() => {
    if (out) out.innerHTML = `<p style="font-family:var(--m);font-size:13px;color:var(--tx);margin-top:12px">Copied.</p>`;
  }).catch(fallback);
}

/* ============================================================ boot */
// A handle for the browser probe in test/. Not used by the game itself.
window.__G = () => G;
// Sound cannot be judged by a machine, but WHETHER one fires can be. The probe
// installs a recording AudioContext and drives state past a cue with these.
window.__Sound = Sound;
window.__Score = Score;
window.__moodFor = (g, d) => moodFor(g, d);
window.__render = () => render();
window.__SETS = () => SETS;
window.__BOARD = () => BOARD;
window.__TR = () => TR;
window.__RULES = () => RULES;
window.__tick = () => tick();
// The panel and the engine each work out rent separately, and once drifted
// three boards apart. The probe compares them, so it needs both.
window.__E = () => E;
window.__CON = () => CONTINGENCY;
window.__COL = () => COLUMN;
// Cards are dealt by tick(), never by a button, so the sheet has no handle of
// its own to reach for.
window.__showCard = () => showCard();
window.__showContract = () => showContract();

// A background tab can be reaped without warning on iOS, so the save is
// refreshed whenever the page is hidden as well as after every move.
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);
// Rotating changes which layout applies, and the board's cells and the galaxy
// canvas both need re-measuring afterwards.
window.addEventListener('orientationchange', () => setTimeout(() => { if (G) render(); }, 220));
window.addEventListener('resize', () => { if (G) renderLog(); });
// iOS leaves position:fixed layers offset from where taps actually land after a
// software keyboard opens or closes, until something scrolls. A sheet is a fixed
// bottom panel, so that shows up as a button you can see and cannot press. This
// nudges the page back to the top whenever the visual viewport changes with a
// sheet open, which is what touching the background was doing by hand.
if (window.visualViewport) {
  const resync = () => {
    if (!$('sheetRoot').firstChild) return;
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
  };
  window.visualViewport.addEventListener('resize', resync);
  window.visualViewport.addEventListener('scroll', resync);
}

// The preference has to be read before the setup screen draws, because the
// switch shows its own state.
Sound.restore();
drawSetup();
