// Interface for Grandiose — The Ledger. Everything DOM lives here; nothing in
// this file decides a rule. The engine is asked what is true and told what the
// player did, and it never waits — it hands back the path a piece took and this
// file animates it.

import {
  SETS, BOARD, N, JAIL, TRAFFIC, PERSONAS, RULES, EPIGRAPH
} from './data.js';
import * as E from './engine.js';
import { Score, moodFor } from './score.js';

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
const setup = { humans: 2, names: ['Sam', 'Meelah'], ais: [], circuits: 24 };

function drawSetup() {
  const saved = loadSaved();
  const seatsUsed = setup.humans + setup.ais.length;
  $('setup').innerHTML = `
    <h1>Grandiose<em>THE LEDGER</em></h1>
    <div class="quote">${esc(EPIGRAPH.text)}<b>— ${esc(EPIGRAPH.cite)}</b></div>
    ${saved ? `<button class="big" id="resume">Resume the game in progress</button>` : ''}
    <div class="fld"><label>Players at the table</label>
      <div class="opts">${[1, 2].map(k =>
        `<button class="opt${setup.humans === k ? ' on' : ''}" data-h="${k}">${k} human${k > 1 ? 's' : ''}</button>`).join('')}</div>
    </div>
    <div class="fld" id="nameWrap"></div>
    <div class="fld"><label>Opponents — ${4 - setup.humans} seats free</label>
      ${Object.entries(PERSONAS).map(([k, a]) => {
        const on = setup.ais.includes(k);
        return `<div class="aiCard" data-a="${k}" style="border-left-color:${a.c};opacity:${on ? 1 : .45}">
          <div class="pip" style="background:${a.c};margin-top:6px"></div>
          <div><div class="n">${esc(a.n)}${on ? ' ✓' : ''}</div><div class="d">${esc(a.d)}</div></div>
        </div>`;
      }).join('')}
    </div>
    <div class="fld"><label>Circuit limit</label>
      <div class="opts">${[16, 24, 36].map(k =>
        `<button class="opt${setup.circuits === k ? ' on' : ''}" data-t="${k}">${k}</button>`).join('')}</div>
    </div>
    <button class="big" id="begin">Open the ledger${seatsUsed < 2 ? ' — add an opponent' : ''}</button>
    <p class="note">Sealed-bid auctions are mandatory and the phone gets passed.
    Garrisons are finite. Neutral Anchorage pays nothing. The Neurex cannot be bought.<br><br>
    The game saves itself after every move, so a call or a locked screen costs nothing.</p>`;

  let nw = '';
  for (let i = 0; i < setup.humans; i++) {
    nw += `<label>Player ${i + 1}</label><input type="text" data-n="${i}" value="${esc(setup.names[i] || '')}"
      maxlength="14" autocapitalize="words" autocomplete="off">`;
  }
  $('nameWrap').innerHTML = nw;
  $('nameWrap').querySelectorAll('[data-n]').forEach(inp =>
    inp.oninput = () => { setup.names[+inp.dataset.n] = inp.value.slice(0, 14); });

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
      ${btns([['Close', 'closeSheet()', 'pri wide']])}`);
    return;
  }
  const seats = [];
  for (let i = 0; i < setup.humans; i++) {
    seats.push({ name: (setup.names[i] || `Player ${i + 1}`).trim() || `Player ${i + 1}`, kind: 'human' });
  }
  setup.ais.forEach(k => seats.push({ name: PERSONAS[k].n, kind: 'ai', persona: k }));
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
// Go bottom-right, play running anticlockwise along the bottom.
const GRID = (() => {
  const m = new Array(N);
  m[0] = [8, 8];
  for (let k = 1; k <= 6; k++) m[k] = [8, 8 - k];
  m[7] = [8, 1];
  for (let k = 1; k <= 6; k++) m[7 + k] = [8 - k, 1];
  m[14] = [1, 1];
  for (let k = 1; k <= 6; k++) m[14 + k] = [1, 1 + k];
  m[21] = [1, 8];
  for (let k = 1; k <= 6; k++) m[21 + k] = [1 + k, 8];
  return m;
})();

const pipOf = p => PIPS[p.i % PIPS.length];
const colourOf = b => b.s ? SETS[b.s].c : b.t === 'f' ? 'var(--fleet)' : b.t === 'u' ? 'var(--util)' : null;
const posOf = p => (anim && anim.i === p.i ? anim.pos : p.pos);

/* ============================================================ render */
function render() {
  renderBar();
  renderBoard();
  renderActions();
  renderLog();
}

function renderBar() {
  $('bar').innerHTML = G.players.map((p, i) => {
    const rel = p.lord !== null
      ? `<div class="vs">vassal · ${esc(G.players[p.lord].name.split(' ')[0])}</div>`
      : p.vassals.length ? `<div class="vs">overlord ×${p.vassals.length}</div>` : '';
    return `<div class="pchip${i === G.cur ? ' act' : ''}">
      <div class="nm"><span class="pip" style="background:${pipOf(p)}"></span>${esc(p.name)}</div>
      <div class="cash">${money(p.cash)}</div>
      ${p.debt ? `<div class="vs" style="color:var(--warn)">debt ${money(p.debt)}</div>` : ''}${rel}</div>`;
  }).join('');
}

function renderBoard() {
  const cur = E.current(G);
  let h = '';
  BOARD.forEach((b, i) => {
    const [r, c] = GRID[i];
    const owner = E.ownerOf(G, i);
    const held = owner ? E.holding(owner, i) : null;
    const colour = colourOf(b);
    const corner = [0, 7, 14, 21].includes(i);
    const toks = G.players.filter(q => posOf(q) === i)
      .map(q => `<div class="tok${q.i === G.cur ? ' me' : ''}" style="background:${pipOf(q)};color:${pipOf(q)}"></div>`)
      .join('');
    const dev = held ? (held.citadel ? '◆' : held.garrisons ? '▪'.repeat(held.garrisons) : held.mortgaged ? '⌀' : '') : '';
    const ownStyle = owner ? `color:${pipOf(owner)};box-shadow:inset 0 0 0 2px ${pipOf(owner)}` : '';
    h += `<div class="cell${corner ? ' corner' : ''}${posOf(cur) === i ? ' here' : ''}${selected === i ? ' sel' : ''}"
        style="grid-row:${r};grid-column:${c};${ownStyle}" data-i="${i}">
      ${colour ? `<div class="cbar" style="background:${colour}"></div>` : ''}
      <div class="code">${esc(b.a)}</div>
      ${b.pr ? `<div class="cpr">${b.pr}</div>` : ''}
      ${dev ? `<div class="grr">${dev}</div>` : ''}
      <div class="toks">${toks}</div></div>`;
  });

  const p = E.current(G);
  const standingOn = BOARD[posOf(p)];
  h += `<div class="mid">
    <div class="who">${esc(p.name)}${p.lord !== null ? ' · vassal' : ''}</div>
    <div class="dice"><div class="die">${G.dice[0] || '–'}</div><div class="die">${G.dice[1] || '–'}</div></div>
    <div class="sq">${esc(standingOn.n)}</div>
    <div class="msg">${esc(G.log[0] ? G.log[0].text : '')}</div>
    <div class="meta">CIRCUIT ${G.circuit}/${G.circuits} · GARRISONS ${G.garrisonPool} · CITADELS ${G.citadelPool}</div>
    <button class="sndBtn" id="sndBtn" style="color:${Score.on ? 'var(--gold)' : 'var(--dim)'}">
      ${Score.on ? '♪ SCORE ON' : '♪ SCORE OFF'}</button>
  </div>`;
  $('board').innerHTML = h;
  $('board').querySelectorAll('[data-i]').forEach(el =>
    el.onclick = () => { selected = +el.dataset.i; renderBoard(); showSquare(+el.dataset.i); });
  $('sndBtn').onclick = ev => {
    ev.stopPropagation();
    Score.resume();
    Score.toggle();
    renderBoard();
  };
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
    ? actBtn('Roll', 'act_roll()', 'pri', p.inFacility ? 'in the Facility' : '&nbsp;')
    : G.phase === 'landed'
      ? actBtn('Resolve', 'act_resolve()', 'pri', esc(BOARD[p.pos].n))
      : actBtn('Roll', '', '', '&nbsp;', true);

  const canAmend = G.phase === 'landed' && p.amends > 0 && p.cash >= E.amendCost(p);
  const relational = p.lord !== null
    ? actBtn('Second ledger', 'showRevolt()', '', 'hidden')
    : p.vassals.length
      ? actBtn('Set tithe', 'showTithe()', '', `${p.tithe}%`)
      : actBtn('—', '', '', '&nbsp;', true);

  $('acts').innerHTML = primary
    + actBtn('Amend', 'act_amend()', '', `${money(E.amendCost(p))} · ${p.amends} left`, !canAmend)
    + actBtn('Manage', 'showManage()', '', 'build · mortgage')
    + actBtn('Propose', 'showTrade()', '', 'draw a contract')
    + relational
    + actBtn('End turn', 'act_end()', G.phase === 'end' ? 'pri' : '', '&nbsp;', G.phase !== 'end');
  bindActs();
}

const actBtn = (label, fn, cls = '', sub = '&nbsp;', disabled = false) =>
  `<button class="act ${cls}" data-fn="${fn}"${disabled ? ' disabled' : ''}>${label}<small>${sub}</small></button>`;

function bindActs() {
  $('acts').querySelectorAll('[data-fn]').forEach(b => {
    const fn = b.dataset.fn;
    if (fn) b.onclick = () => { Score.resume(); ACTIONS[fn.replace(/\(\)$/, '')](); };
  });
}

function renderLog() {
  $('log').innerHTML = G.log.map(l => {
    if (l.kind === 'leader') return `<div class="le leader">${esc(l.text)}</div>`;
    if (l.kind === 'voice') {
      const who = G.players[l.who];
      return `<div class="le voice"><b style="color:${pipOf(who)}">${esc(who.name)}:</b> “${esc(l.text)}”</div>`;
    }
    return `<div class="le"><span class="t">C${l.circuit}</span> ${esc(l.text)}</div>`;
  }).join('');
}

/* ============================================================ sheets */
function sheet(inner) {
  $('sheetRoot').innerHTML = `<div class="scrim"><div class="sheet"><div class="grab"></div>${inner}</div></div>`;
  $('sheetRoot').querySelectorAll('[data-fn]').forEach(b => {
    b.onclick = () => {
      Score.resume();
      const [name, ...args] = b.dataset.fn.split('|');
      ACTIONS[name](...args);
    };
  });
}
function closeSheet() { $('sheetRoot').innerHTML = ''; }
const btns = list => `<div class="mbtns">${list.map(([label, fn, cls = '']) =>
  `<button class="mbtn ${cls}" data-fn="${fn}">${label}</button>`).join('')}</div>`;

/* ============================================================ the flow */
// One place decides what happens next. Every action ends by calling tick().
function tick() {
  if (!G) return;
  save();
  Score.set(moodFor(G));
  render();

  if (G.over) { busy = false; render(); showFinal(); return; }
  const p = E.current(G);

  switch (G.phase) {
    case 'roll':
      if (p.kind === 'ai') { busy = true; render(); setTimeout(act_roll, 750); }
      else busy = false;
      break;

    case 'landed':
      if (p.kind === 'ai') { busy = true; setTimeout(() => { E.resolveLanding(G); tick(); }, 320); }
      else busy = false;
      break;

    case 'card':
      if (p.kind === 'ai') { busy = true; setTimeout(runCard, 520); }
      else { busy = false; showCard(); }
      break;

    case 'offer':
      if (p.kind === 'ai') {
        busy = true;
        setTimeout(() => {
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

    case 'end':
      if (p.kind === 'ai') {
        busy = true;
        setTimeout(() => {
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
function walk(path, done) {
  if (!path || !path.length) { done(); return; }
  const p = E.current(G);
  let k = 0;
  anim = { i: p.i, pos: path[0] };
  renderBoard();
  const step = () => {
    k++;
    if (k >= path.length) { anim = null; renderBoard(); done(); return; }
    anim.pos = path[k];
    renderBoard();
    setTimeout(step, 105);
  };
  setTimeout(step, 105);
}

/* ============================================================ actions */
const ACTIONS = {
  act_roll, act_resolve, act_amend, act_end,
  showSquare, showManage, showTrade, showTithe, showRevolt, showFinal, showLedger,
  closeSheet, newGame, copyResult,
  buyNow, declineToAuction, takeCard, sealBid, sealClaim, endAuction, endContest,
  answerContract, build, raiseCitadel, sellDev, toggleMortgage, repay,
  setTithe, declare, tradeSet, sendTrade, playOn
};
for (const k of Object.keys(ACTIONS)) window[k] = ACTIONS[k];

function act_roll() {
  if (G.phase !== 'roll') return;
  const p = E.current(G);
  const r = E.roll(G);
  if (!r) return;
  render();
  if (r.held) { busy = false; tick(); return; }
  busy = true; render();
  walk(r.path, () => {
    busy = false;
    if (p.kind === 'ai') { E.resolveLanding(G); tick(); }
    else tick();
  });
}

function act_resolve() {
  if (G.phase !== 'landed') return;
  E.resolveLanding(G);
  tick();
}

function act_amend() {
  const r = E.amendManifest(G);
  if (!r) return;
  busy = true; render();
  walk(r.path, () => { busy = false; E.resolveLanding(G); tick(); });
}

function act_end() {
  if (G.phase !== 'end') return;
  E.endTurn(G);
  tick();
}

function runCard() {
  const r = E.applyCard(G);
  closeSheet();
  if (!r) { tick(); return; }
  busy = true; render();
  walk(r.path, () => { busy = false; tick(); });
}

function takeCard() { runCard(); }

/* ---------------------------------------------------------- square detail */
function showSquare(i) {
  i = +i;
  const b = BOARD[i];
  const owner = E.ownerOf(G, i);
  const held = owner ? E.holding(owner, i) : null;
  const kind = b.s ? SETS[b.s].n : b.t === 'f' ? 'Fleet' : b.t === 'u' ? 'Utility' : '—';
  let s = `<h3>${esc(b.n)}</h3><div class="sub">${esc(kind)} · square ${i}</div>
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
  if (b.t === 'f') s += `<div class="stat"><span>Rent</span><span>₡50 · ₡150 for both</span></div>`;
  if (b.t === 'u') s += `<div class="stat"><span>Rent</span><span>4× roll · 10× for both</span></div>`;
  if (b.t === 'jail') s += `<p style="font-size:14px;line-height:1.5;color:var(--dim);margin-top:12px">
    Doubles release you, or the assessment concludes after ${RULES.facilityAttempts} attempts.
    There is nothing to pay. The Neurex does not take payment.</p>`;
  if (owner) s += `<div class="stat"><span>Held by</span><span style="color:${pipOf(owner)}">${esc(owner.name)}${held.mortgaged ? ' (mortgaged)' : ''}</span></div>`;
  s += btns([['The ledger', 'showLedger', ''], ['Close', 'closeSheet', 'pri']]);
  sheet(s);
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
    want to land.</p>${btns([['Close', 'closeSheet', 'pri wide']])}`;
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
      ? [['To auction', 'declineToAuction', 'pri wide']]
      : [[`Buy ${money(b.pr)}`, 'buyNow', 'pri'], ['Decline → auction', 'declineToAuction', '']])}`);
  if (!p.debt && p.cash < b.pr) {
    const el = $('sheetRoot').querySelector('.mbtn.pri');
    if (el) { el.disabled = true; el.textContent = 'Not enough cash'; }
  }
}
function buyNow() { closeSheet(); E.buy(G, E.current(G)); tick(); }
function declineToAuction() { closeSheet(); E.openAuction(G, E.current(G).pos); tick(); }

function showBid() {
  const a = G.auction;
  const p = G.players[a.queue[a.at]];
  const b = BOARD[a.sq];
  sheet(`<h3>Sealed bid</h3><div class="sub">${esc(b.n)} · ${esc(p.name)} only</div>
    ${a.queue.length > 1 ? `<div class="warnbox"><b>Pass the phone to ${esc(p.name)}.</b>
      Nobody sees any bid until every bid is in.</div>` : ''}
    <div class="stat"><span>List price</span><span>${money(b.pr)}</span></div>
    <div class="stat"><span>You hold</span><span>${money(p.cash)}</span></div>
    <div class="stat"><span>Landing frequency</span><span>${TRAFFIC[a.sq].toFixed(2)}%</span></div>
    ${b.s ? `<div class="stat"><span>Set payback</span><span>${E.paybackTurns(b.s, TRAFFIC)} turns</span></div>` : ''}
    <input type="number" id="bidIn" inputmode="numeric" placeholder="0" min="0" max="${p.cash}" style="margin-top:14px">
    ${btns([['Seal it', `sealBid|${p.i}`, 'pri wide']])}`);
  setTimeout(() => { const el = $('bidIn'); if (el) el.focus(); }, 80);
}
function sealBid(i) {
  const el = $('bidIn');
  E.submitBid(G, +i, el ? el.value : 0);
  closeSheet();
  setTimeout(tick, 120);
}
function showAuctionResult() {
  const a = G.auction;
  const b = BOARD[a.sq];
  let s = `<h3>Bids revealed</h3><div class="sub">${esc(b.n)}</div>`;
  for (const e of a.ranked) {
    s += `<div class="stat"><span style="color:${pipOf(e.p)}">${esc(e.p.name)}</span>
      <span>${e.v > 0 ? money(e.v) : 'no bid'}</span></div>`;
  }
  s += a.winner === null || a.winner === undefined
    ? `<div class="card">Nobody bid. It stays unclaimed.</div>`
    : `<div class="card">${esc(G.players[a.winner].name)} takes it for ${money(a.price)}.</div>`;
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
    ${btns([['Enter it', 'takeCard', 'pri wide']])}`);
}

/* ---------------------------------------------------------- manage */
function showManage() {
  const p = E.current(G);
  let s = `<h3>Holdings</h3><div class="sub">${esc(p.name)} · ${money(p.cash)}${p.debt ? ` · debt ${money(p.debt)}` : ''}</div>
    <div class="stat"><span>Upkeep per turn</span><span>${money(E.upkeep(p))}</span></div>
    <div class="stat"><span>Pools</span><span>${G.garrisonPool} garrisons · ${G.citadelPool} citadels</span></div>`;
  if (p.debt) {
    s += `<div class="warnbox">A debt marker blocks buying, building and contracts until it is cleared.
      It grows ${Math.round(RULES.debtInterest * 100)}% every turn.</div>`;
  }
  if (!p.holdings.length) s += `<p style="color:var(--dim);font-size:15px;margin-top:14px">Nothing held.</p>`;

  for (const h of [...p.holdings].sort((a, b) => a.sq - b.sq)) {
    const b = BOARD[h.sq];
    const state = h.mortgaged ? 'MORTGAGED' : h.citadel ? 'CITADEL'
      : `${h.garrisons} garrison${h.garrisons === 1 ? '' : 's'}`;
    let controls = '';
    if (E.canBuild(G, p, h.sq)) controls += `<button data-fn="build|${h.sq}">+G</button>`;
    if (E.canRaiseCitadel(G, p, h.sq)) controls += `<button data-fn="raiseCitadel|${h.sq}">◆</button>`;
    if (h.garrisons > 0 || h.citadel) controls += `<button data-fn="sellDev|${h.sq}">−</button>`;
    if (!h.garrisons && !h.citadel) {
      controls += `<button data-fn="toggleMortgage|${h.sq}">${h.mortgaged ? 'Redeem' : 'Mortgage'}</button>`;
    }
    s += `<div class="row">
      <div><div style="color:${b.s ? SETS[b.s].c : 'var(--body)'};font-size:15px">${esc(b.n)}</div>
      <div style="font-family:var(--m);font-size:11.5px;color:var(--dim);margin-top:2px">
      ${state} · rent ${money(E.rentOf(G, h.sq, 7))}</div></div>
      <div class="rowbtns">${controls}</div></div>`;
  }
  if (p.debt) s += btns([[`Repay ${money(Math.min(p.cash, p.debt))}`, 'repay', 'dgr wide']]);
  s += btns([['Done', 'closeSheet', 'pri wide']]);
  sheet(s);
}
function build(sq) { E.build(G, E.current(G), +sq); save(); render(); showManage(); }
function raiseCitadel(sq) { E.raiseCitadel(G, E.current(G), +sq); save(); render(); showManage(); }
function sellDev(sq) { E.sellDevelopment(G, E.current(G), +sq); save(); render(); showManage(); }
function toggleMortgage(sq) {
  const p = E.current(G), h = E.holding(p, +sq);
  if (h.mortgaged) E.redeem(G, p, +sq); else E.mortgage(G, p, +sq);
  save(); render(); showManage();
}
function repay() { E.repayDebt(G, E.current(G)); save(); render(); showManage(); }

/* ---------------------------------------------------------- tithe / revolt */
function showTithe() {
  const p = E.current(G);
  sheet(`<h3>Tithe rate</h3>
    <div class="sub">${p.vassals.length} vassal${p.vassals.length > 1 ? 's' : ''} · upkeep ${money(E.upkeep(p))}/turn</div>
    <p style="font-size:14.5px;color:var(--dim);line-height:1.5">You take this share of every rent your
    vassals collect. Squeeze harder and you earn more now — and arm whatever they are building faster.
    You cannot see how close they are.</p>
    <div class="opts" style="margin-top:14px">${[10, 25, 40, 55].map(r =>
      `<button class="opt${p.tithe === r ? ' on' : ''}" data-fn="setTithe|${r}">${r}%</button>`).join('')}</div>
    ${btns([['Done', 'closeSheet', 'pri wide']])}`);
}
function setTithe(r) { E.setTithe(G, E.current(G), +r); save(); render(); showTithe(); }

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
         ${btns([[`Declare — ${money(RULES.revoltCost)}`, 'declare', 'pri'], ['Not yet', 'closeSheet', '']])}`
      : `<p style="font-size:14px;color:var(--dim);margin-top:14px">Keep paying. Every credit tithed is a credit counted.</p>
         ${btns([['Close', 'closeSheet', 'pri wide']])}`}`);
  if (ready && p.cash < RULES.revoltCost) {
    const el = $('sheetRoot').querySelector('.mbtn.pri');
    if (el) { el.disabled = true; el.textContent = 'Not enough cash'; }
  }
}
function declare() { E.declareIndependence(G, E.current(G)); closeSheet(); tick(); }

/* ---------------------------------------------------------- contracts */
let TR = null;
function showTrade() {
  const me = E.current(G);
  if (me.debt) {
    sheet(`<h3>Restructuring</h3><div class="sub">${esc(me.name)}</div>
      <p style="font-size:15px;line-height:1.5">A debt marker blocks contracts until it is cleared.</p>
      ${btns([['Close', 'closeSheet', 'pri wide']])}`);
    return;
  }
  const others = G.players.filter(q => q.i !== me.i);
  if (!TR || TR.from !== me.i) TR = { from: me.i, to: others[0].i, get: null, give: null, cash: 0, direction: 1 };
  drawTrade();
}

function drawTrade() {
  const me = G.players[TR.from], them = G.players[TR.to];
  const others = G.players.filter(q => q.i !== me.i);
  const suggestion = E.seekContract(G, me, me.persona || 'spector');

  const why = (owner, sq) => {
    const h = E.holding(owner, sq), b = BOARD[sq];
    if (h.mortgaged) return 'mortgaged — redeem first';
    if (h.garrisons > 0 || h.citadel) return 'garrisoned — sell buildings first';
    if (b.s && SETS[b.s].sq.some(j => {
      const o = E.ownerOf(G, j); if (!o) return false;
      const hh = E.holding(o, j); return hh && (hh.garrisons > 0 || hh.citadel);
    })) return `${SETS[b.s].n} is built up — clear the set first`;
    return null;
  };
  const row = (owner, sq, sel, fn) => {
    const b = BOARD[sq], blocked = why(owner, sq);
    return `<button class="pick${sel ? ' on' : ''}" ${blocked ? 'disabled' : `data-fn="${fn}"`}>
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:8px;
        background:${b.s ? SETS[b.s].c : 'var(--fleet)'}"></span>${esc(b.n)}
      <span class="sub2">${money(b.pr)} · rent ${money(E.rentOf(G, sq, 7))}</span>
      ${blocked ? `<span class="why">${blocked}</span>` : ''}</button>`;
  };

  let s = `<h3>Draw a contract</h3><div class="sub">${esc(me.name)} · ${money(me.cash)} in hand</div>`;
  if (suggestion && suggestion.to === TR.to && TR.get === null) {
    s += `<div class="warnbox" style="border-color:var(--gold);background:rgba(217,164,65,.08)">
      <b>${esc(BOARD[suggestion.get].n)}</b> would complete ${esc(SETS[BOARD[suggestion.get].s].n)} for you.</div>`;
  }
  s += `<div class="opts" style="margin-bottom:16px">${others.map(o =>
    `<button class="opt${TR.to === o.i ? ' on' : ''}" data-fn="tradeSet|to|${o.i}">${esc(o.name.split(' ')[0])}</button>`).join('')}</div>`;

  s += `<div class="sub" style="margin:4px 0 8px">You receive</div>`;
  s += them.holdings.length
    ? [...them.holdings].sort((a, b) => a.sq - b.sq).map(h => row(them, h.sq, TR.get === h.sq, `tradeSet|get|${h.sq}`)).join('')
    : `<p style="color:var(--dim);font-size:14px">${esc(them.name)} holds nothing.</p>`;

  s += `<div class="sub" style="margin:18px 0 8px">You give</div>
    <button class="pick${TR.give === null ? ' on' : ''}" data-fn="tradeSet|give|null">Nothing</button>`;
  s += [...me.holdings].sort((a, b) => a.sq - b.sq).map(h => row(me, h.sq, TR.give === h.sq, `tradeSet|give|${h.sq}`)).join('');

  s += `<div class="sub" style="margin:18px 0 8px">Credits</div>
    <div class="opts" style="margin-bottom:10px">
      <button class="opt${TR.direction === 1 ? ' on' : ''}" data-fn="tradeSet|direction|1">You pay</button>
      <button class="opt${TR.direction === -1 ? ' on' : ''}" data-fn="tradeSet|direction|-1">They pay</button></div>
    <input type="number" id="trCash" inputmode="numeric" value="${TR.cash}" min="0" placeholder="0">
    ${btns([['Propose', 'sendTrade', 'pri'], ['Cancel', 'closeSheet', '']])}`;
  sheet(s);
  if (TR.get === null && TR.give === null) {
    const el = $('sheetRoot').querySelector('.mbtn.pri');
    if (el) el.disabled = true;
  }
}

function tradeSet(key, value) {
  const el = $('trCash');
  if (el) TR.cash = Math.max(0, parseInt(el.value, 10) || 0);
  const v = value === 'null' ? null : +value;
  if (key === 'to') { TR.to = v; TR.get = null; TR.give = null; }
  else TR[key] = v;
  drawTrade();
}

function sendTrade() {
  const el = $('trCash');
  if (el) TR.cash = Math.max(0, parseInt(el.value, 10) || 0);
  const proposal = { ...TR };
  closeSheet();
  const r = E.proposeContract(G, proposal);
  if (!r.ok) {
    sheet(`<h3>Not a legal contract</h3><div class="sub">nothing was exchanged</div>
      <p style="font-size:15px;line-height:1.5">Both sides must be free of debt, and anything
      changing hands must be unmortgaged and unbuilt.</p>${btns([['Close', 'closeSheet', 'pri wide']])}`);
    return;
  }
  if (r.pending) { tick(); return; }              // a human must answer
  if (!r.accepted) {
    const line = G.log[0];
    sheet(`<h3>Refused</h3><div class="sub">${esc(G.players[proposal.to].name)}</div>
      <div class="card">“${esc(line ? line.text : 'No.')}”</div>
      ${btns([['Close', 'closeSheet', 'pri wide']])}`);
  }
  save(); render();
}

function showContract() {
  const c = G.contract;
  const from = G.players[c.from], to = G.players[c.to];
  const brief = (sq, label) => {
    if (sq === null || sq === undefined) return '';
    const b = BOARD[sq];
    return `<div class="sub" style="margin:14px 0 6px">${label}</div>
      <div class="stat"><span>${esc(b.n)}</span><span>${money(b.pr)}</span></div>
      <div class="stat"><span>Rent now</span><span>${money(E.rentOf(G, sq, 7))}</span></div>
      <div class="stat"><span>Landing frequency</span><span>${TRAFFIC[sq].toFixed(2)}%</span></div>`;
  };
  sheet(`<h3>${esc(from.name)} → ${esc(to.name)}</h3>
    <div class="sub">${esc(to.name)}'s eyes only — pass the phone</div>
    ${brief(c.get, `${esc(to.name)} gives up`)}
    ${brief(c.give, `${esc(to.name)} receives`)}
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

/* ---------------------------------------------------------- endings */
function showFinal() {
  const rows = E.standings(G);
  const champion = G.players[G.winner];
  sheet(`<h3>The ledger closes</h3><div class="sub">circuit ${G.circuit} of ${G.circuits}</div>
    <div class="card">${G.endReason === 'conquest'
      ? `Every column posts to one page. <b>${esc(champion.name)}</b> holds the galaxy outright.`
      : `No single overlord. On totals, <b>${esc(champion.name)}</b> holds the strongest column.`}</div>
    <table><tr><th>Player</th><th>Holdings</th><th>Status</th></tr>
    ${rows.map(r => `<tr><td style="color:${pipOf(r.player)}">${esc(r.player.name)}</td>
      <td>${money(r.worth)}</td><td>${esc(r.status)}</td></tr>`).join('')}</table>
    ${btns([
      ...(G.endReason === 'conquest' ? [] : [['Play on — +12 circuits', 'playOn', 'wide']]),
      ['Copy result', 'copyResult', ''],
      ['New game', 'newGame', 'pri'],
      ['Back to board', 'closeSheet', 'wide']
    ])}<div id="cpOut"></div>`);
}
function playOn() { E.extendGame(G, 12); closeSheet(); tick(); }

function newGame() {
  clearSave();
  G = null;
  closeSheet();
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

// A background tab can be reaped without warning on iOS, so the save is
// refreshed whenever the page is hidden as well as after every move.
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

drawSetup();
